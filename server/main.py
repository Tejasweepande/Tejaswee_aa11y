import os
import io
import uuid
import logging
import base64
import numpy as np
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from playwright.async_api import async_playwright
from ultralytics import YOLO
from huggingface_hub import hf_hub_download
from PIL import Image
import easyocr

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

class URLRequest(BaseModel):
    url: str

@app.post("/api/fetch-url")
async def fetch_url(req: URLRequest):
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page(
                viewport={'width': 1024, 'height': 768},
                device_scale_factor=1,
            )
            # Route interception to block media/fonts if needed, but we'll let it load normally for accurate screenshot
            from playwright.async_api import TimeoutError as PlaywrightTimeoutError
            try:
                await page.goto(req.url, wait_until="load", timeout=20000)
            except PlaywrightTimeoutError:
                logger.warning("page.goto timed out, continuing with partial load")
            
            # Extract HTML
            html = await page.content()
            
            # Use CDP session to capture a true full-page screenshot 
            # without altering the viewport (avoids 100vh stretching)
            # and without scrolling (avoids fixed-header duplication)
            client = await page.context.new_cdp_session(page)
            metrics = await client.send('Page.getLayoutMetrics')
            content_size = metrics.get('contentSize', metrics.get('cssContentSize'))
            width = content_size['width']
            height = content_size['height']
            
            result = await client.send('Page.captureScreenshot', {
                'format': 'png',
                'captureBeyondViewport': True,
                'clip': {
                    'x': 0,
                    'y': 0,
                    'width': width,
                    'height': height,
                    'scale': 1
                }
            })
            
            screenshot_b64 = result['data']
            
            await browser.close()
            
            return {
                "html": html,
                "screenshot": f"data:image/png;base64,{screenshot_b64}"
            }
    except Exception as e:
        logger.error(f"Failed to fetch URL: {e}")
        raise HTTPException(status_code=500, detail=str(e))


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL_REPO = "macpaw-research/yolov11l-ui-elements-detection"
MODEL_FILENAME = "ui-elements-detection.pt"
model = None
ocr_reader = None

@app.on_event("startup")
async def startup_event():
    global model, ocr_reader
    logger.info("Downloading/Loading YOLOv11 UI model...")
    try:
        model_path = hf_hub_download(repo_id=MODEL_REPO, filename=MODEL_FILENAME)
        model = YOLO(model_path)
        logger.info(f"Model loaded successfully from {model_path}")
    except Exception as e:
        logger.error(f"Failed to load YOLO model: {e}")
        
    logger.info("Loading EasyOCR model...")
    try:
        ocr_reader = easyocr.Reader(['en'])
        logger.info("EasyOCR model loaded successfully")
    except Exception as e:
        logger.error(f"Failed to load EasyOCR model: {e}")

@app.post("/api/detect")
async def detect_ui_elements(file: UploadFile = File(...)):
    if not model:
        raise HTTPException(status_code=503, detail="Model is not loaded.")
    
    try:
        contents = await file.read()
        image = Image.open(io.BytesIO(contents)).convert("RGB")
        width, height = image.size
        
        # 1. Run EasyOCR
        img_np = np.array(image)
        ocr_boxes = []
        if ocr_reader:
            ocr_results = ocr_reader.readtext(img_np)
            for bbox, text, prob in ocr_results:
                xs = [pt[0] for pt in bbox]
                ys = [pt[1] for pt in bbox]
                min_x, max_x = min(xs), max(xs)
                min_y, max_y = min(ys), max(ys)
                ocr_boxes.append({
                    "text": text,
                    "cx": (min_x + max_x) / 2,
                    "cy": (min_y + max_y) / 2,
                    "min_x": min_x,
                    "max_x": max_x,
                    "min_y": min_y,
                    "max_y": max_y,
                    "matched": False
                })

        # 2. Run YOLOv11
        results = model.predict(image, conf=0.05)
        
        regions = []
        if len(results) > 0:
            result = results[0]
            for box in result.boxes:
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                conf = box.conf[0].item()
                cls_id = int(box.cls[0].item())
                label = result.names[cls_id]
                
                kind = "text"
                lbl_lower = label.lower()
                if "button" in lbl_lower or "btn" in lbl_lower:
                    kind = "button"
                elif "input" in lbl_lower or "text_field" in lbl_lower or "checkbox" in lbl_lower:
                    kind = "input"
                elif "image" in lbl_lower or "icon" in lbl_lower:
                    kind = "image"
                elif "text" in lbl_lower or "paragraph" in lbl_lower or "label" in lbl_lower:
                    kind = "text"
                elif "heading" in lbl_lower or "title" in lbl_lower:
                    kind = "heading"
                
                rel_x = (x1 / width) * 100
                rel_y = (y1 / height) * 100
                rel_w = ((x2 - x1) / width) * 100
                rel_h = ((y2 - y1) / height) * 100
                
                # Match OCR text that falls inside this YOLO box
                matched_texts = []
                for obox in ocr_boxes:
                    # check if OCR center is inside YOLO bounds
                    if x1 <= obox["cx"] <= x2 and y1 <= obox["cy"] <= y2:
                        matched_texts.append(obox["text"])
                        obox["matched"] = True
                
                if matched_texts:
                    final_text = " ".join(matched_texts)
                else:
                    import re
                    clean_text = label
                    # Handle "AX image", "AX_image", "AXImage" etc
                    clean_text = re.sub(r'^AX[\s_]*', '', clean_text, flags=re.IGNORECASE)
                    final_text = re.sub(r'(?<!^)(?=[A-Z])', ' ', clean_text).strip()

                regions.append({
                    "id": f"yolo-region-{str(uuid.uuid4())[:8]}",
                    "kind": kind,
                    "text": final_text,
                    "bbox": {
                        "x": max(0, min(100, rel_x)),
                        "y": max(0, min(100, rel_y)),
                        "w": max(0, min(100, rel_w)),
                        "h": max(0, min(100, rel_h))
                    }
                })
        
        # 3. Add unmatched OCR boxes as standalone text regions
        for obox in ocr_boxes:
            if not obox["matched"]:
                rel_x = (obox["min_x"] / width) * 100
                rel_y = (obox["min_y"] / height) * 100
                rel_w = ((obox["max_x"] - obox["min_x"]) / width) * 100
                rel_h = ((obox["max_y"] - obox["min_y"]) / height) * 100
                regions.append({
                    "id": f"ocr-region-{str(uuid.uuid4())[:8]}",
                    "kind": "text",
                    "text": obox["text"],
                    "bbox": {
                        "x": max(0, min(100, rel_x)),
                        "y": max(0, min(100, rel_y)),
                        "w": max(0, min(100, rel_w)),
                        "h": max(0, min(100, rel_h))
                    }
                })
        
        # Sort top-to-bottom, left-to-right for reading order
        regions.sort(key=lambda r: (round(r["bbox"]["y"] / 2), r["bbox"]["x"]))
        
        for i, r in enumerate(regions):
            r["readingOrder"] = i + 1
            if r["kind"] in ["button", "input", "link"]:
                r["isInteractive"] = True
                
        return {"regions": regions, "width": width, "height": height}
    except Exception as e:
        logger.error(f"Detection failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

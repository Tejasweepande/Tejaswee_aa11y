import asyncio
import io
from PIL import Image
from playwright.async_api import async_playwright
import base64

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, channel="chrome")
        page = await browser.new_page(
            viewport={'width': 1024, 'height': 768},
            device_scale_factor=1,
        )
        url = "https://pmkisan.gov.in/"
        print(f"Loading {url}")
        try:
            await page.goto(url, wait_until="load", timeout=20000)
        except Exception as e:
            print(f"Timeout/Error: {e}")
            
        client = await page.context.new_cdp_session(page)
        metrics = await client.send('Page.getLayoutMetrics')
        content_size = metrics.get('contentSize', metrics.get('cssContentSize'))
        width = content_size['width']
        height = content_size['height']
        print(f"Content Size: {width}x{height}")
        
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
        img = Image.open(io.BytesIO(base64.b64decode(screenshot_b64)))
        img.save("test_pmkisan.png")
        print("Saved to test_pmkisan.png")
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())

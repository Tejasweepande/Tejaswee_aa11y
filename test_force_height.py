import asyncio
import io
import base64
from PIL import Image
from playwright.async_api import async_playwright

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
        except:
            pass
            
        # Force all elements to overflow: visible so they expand to their content height
        await page.evaluate("""
            const all = document.querySelectorAll('*');
            for (const el of all) {
                const style = window.getComputedStyle(el);
                if (style.overflow === 'hidden' || style.overflow === 'auto' || style.overflow === 'scroll' ||
                    style.overflowY === 'hidden' || style.overflowY === 'auto' || style.overflowY === 'scroll') {
                    el.style.setProperty('overflow', 'visible', 'important');
                    el.style.setProperty('overflow-y', 'visible', 'important');
                    el.style.setProperty('height', 'auto', 'important');
                    el.style.setProperty('max-height', 'none', 'important');
                }
            }
        """)
        
        # Wait a bit for layout to settle
        await page.wait_for_timeout(500)
        
        client = await page.context.new_cdp_session(page)
        metrics = await client.send('Page.getLayoutMetrics')
        content_size = metrics.get('contentSize', metrics.get('cssContentSize'))
        width = content_size['width']
        height = content_size['height']
        print(f"New Content Size: {width}x{height}")
        
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
        img.save("test_pmkisan_forced.png")
        print("Saved to test_pmkisan_forced.png")
        
        # Analyze it
        import numpy as np
        arr = np.array(img)
        non_white_rows = np.where(~((arr[:,:,0] >= 250) & (arr[:,:,1] >= 250) & (arr[:,:,2] >= 250)))[0]
        if len(non_white_rows) > 0:
            print(f"Content goes down to row: {np.max(non_white_rows)}")
        else:
            print("Image is entirely white!")
            
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())

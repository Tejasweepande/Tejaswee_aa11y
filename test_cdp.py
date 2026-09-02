import asyncio
from playwright.async_api import async_playwright
import base64

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, channel="chrome")
        page = await browser.new_page(viewport={'width': 1024, 'height': 768})
        await page.goto("https://www.iitg.ac.in/", wait_until="load")
        
        client = await page.context.new_cdp_session(page)
        # We need to get the layout metrics to know the full width/height
        metrics = await client.send('Page.getLayoutMetrics')
        width = metrics['contentSize']['width']
        height = metrics['contentSize']['height']
        
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
        
        with open("test_cdp.png", "wb") as f:
            f.write(base64.b64decode(result['data']))
            
        await browser.close()

asyncio.run(main())

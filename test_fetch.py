import asyncio
import json
import httpx

async def main():
    async with httpx.AsyncClient(timeout=30.0) as client:
        res = await client.post("http://localhost:8000/api/fetch-url", json={"url": "https://pmkisan.gov.in/"})
        data = res.json()
        
        # Save screenshot
        import base64
        import io
        from PIL import Image
        b64_data = data['screenshot'].split(",")[1]
        img = Image.open(io.BytesIO(base64.b64decode(b64_data)))
        img.save("pmkisan_playwright.png")
        print("Saved to pmkisan_playwright.png")

asyncio.run(main())

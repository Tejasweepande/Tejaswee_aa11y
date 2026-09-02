import asyncio
import httpx

async def main():
    async with httpx.AsyncClient(timeout=30.0) as client:
        res = await client.post("http://localhost:8000/api/fetch-url", json={"url": "https://pmkisan.gov.in/"})
        data = res.json()
        with open("test_pmkisan.html", "w") as f:
            f.write(data['html'])
        print("Saved HTML")

asyncio.run(main())

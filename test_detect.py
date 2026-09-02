import requests
import sys

with open(sys.argv[1], 'rb') as f:
    resp = requests.post('http://localhost:8000/api/detect', files={'file': f})
    print(resp.json())

import requests
import json

# scraper = cloudscraper.create_scraper()
url = "https://civitai.com/api/v1/models"

def fetch(page):
    params = {
        "types": "LORA",
        "sort": "Highest Rated",
        "period": "Month",
        "page": page,
        "limit": 20,
        "nsfw": "true"
    }
    import urllib.parse
    query_string = urllib.parse.urlencode(params)
    full_url = f"{url}?{query_string}"
    print(f"Requesting: {full_url}")
    resp = requests.get(full_url, headers={"User-Agent": "Mozilla/5.0"})
    data = resp.json()
    items = data.get('items', [])
    if items:
        print(f"Page {page} First Item: {items[0]['name']}")
        print(f"Page {page} Last Item: {items[-1]['name']}")
    else:
        print(f"Page {page} is empty")
    return [i['id'] for i in items]

ids1 = fetch(1)
ids2 = fetch(2)

if ids1 == ids2:
    print("FAIL: Page 1 and Page 2 are identical!")
else:
    print("SUCCESS: Pages are different.")

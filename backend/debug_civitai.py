import requests
import concurrent.futures

def fetch_parallel(page):
    url = "https://civitai.com/api/v1/models"
    params = {
        "types": "LORA",
        "sort": "Newest",
        "period": "AllTime",
        "nsfw": "true"
    }
    
    internal_limit = 20
    target_limit = 100
    pages_to_fetch = target_limit // internal_limit
    start_page = (page - 1) * pages_to_fetch + 1
    
    tasks = []
    for i in range(pages_to_fetch):
        current_page = start_page + i
        p_copy = params.copy()
        p_copy["page"] = current_page
        p_copy["limit"] = internal_limit
        tasks.append(p_copy)

    print(f"[DEBUG] Fetching {pages_to_fetch} pages (starting {start_page}) in parallel...")

    def fetch_one(p):
        try:
            resp = requests.get(url, params=p, headers={"User-Agent": "Mozilla/5.0"}, timeout=20)
            if resp.status_code != 200:
                print(f"Error: {resp.status_code}")
                return []
            return resp.json().get("items", [])
        except Exception as e:
            print(f"Exception: {e}")
            return []

    all_items = []
    # Sequential for debugging
    for task in tasks:
        res = fetch_one(task)
        all_items.extend(res)
            
    # Deduplicate
    seen = set()
    unique_items = []
    for item in all_items:
        if item['id'] not in seen:
            seen.add(item['id'])
            unique_items.append(item)
            
    return unique_items

items1 = fetch_parallel(1)
print(f"Page 1 Items: {len(items1)}")
if items1:
    print(f"Page 1 First: {items1[0]['name']}")
    print(f"Page 1 Last: {items1[-1]['name']}")

items2 = fetch_parallel(2)
print(f"Page 2 Items: {len(items2)}")
if items2:
    print(f"Page 2 First: {items2[0]['name']}")
    print(f"Page 2 Last: {items2[-1]['name']}")

if items1 and items2:
    ids1 = [i['id'] for i in items1]
    ids2 = [i['id'] for i in items2]
    if ids1 == ids2:
        print("FAIL: Page 1 and Page 2 are identical!")
    else:
        print("SUCCESS: Pages are different.")
        overlap = set(ids1).intersection(set(ids2))
        print(f"Overlap: {len(overlap)}")

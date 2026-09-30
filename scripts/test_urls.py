import httpx
import os

urls_to_test = [
    "http://127.0.0.1:8000/api/health",
    "http://127.0.0.1:8000/api/dashboard",
    "https://times-stan-mortgage-aquatic.trycloudflare.com/api/health",
    "https://times-stan-mortgage-aquatic.trycloudflare.com/api/dashboard",
    "https://submitted-observation-motels-sing.trycloudflare.com",
    "https://submitted-observation-motels-sing.trycloudflare.com/api/health",
    "https://submitted-observation-motels-sing.trycloudflare.com/api/dashboard",
]

print("--- Testing URLs ---")
for url in urls_to_test:
    try:
        r = httpx.get(url, timeout=5.0)
        print(f"[{r.status_code}] {url} -> {r.text[:80]}")
    except Exception as e:
        print(f"[ERR] {url} -> {type(e).__name__}: {e}")

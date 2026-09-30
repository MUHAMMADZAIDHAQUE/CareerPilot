import httpx
import sys
import time

BACKEND_URL = "https://mardi-contacts-linked-terrain.trycloudflare.com"
FRONTEND_URL = "https://proudly-knowledge-still-carl.trycloudflare.com"

print("="*70)
print(f"VERIFYING LIVE PUBLIC CLOUDFLARE TUNNELS")
print(f"Backend Edge:  {BACKEND_URL}")
print(f"Frontend Edge: {FRONTEND_URL}")
print("="*70)

endpoints = [
    ("Backend Health Probe", f"{BACKEND_URL}/api/health"),
    ("Backend Dashboard Direct", f"{BACKEND_URL}/api/dashboard"),
    ("Frontend Landing Page", f"{FRONTEND_URL}"),
    ("Frontend -> Backend Proxy Health", f"{FRONTEND_URL}/api/health"),
    ("Frontend -> Backend Proxy Dashboard", f"{FRONTEND_URL}/api/dashboard"),
]

all_passed = True
with httpx.Client(timeout=30.0, follow_redirects=True) as client:
    for name, url in endpoints:
        try:
            t0 = time.time()
            r = client.get(url)
            elapsed = time.time() - t0
            passed = r.status_code == 200
            icon = "✅ PASS" if passed else "❌ FAIL"
            print(f"[{icon}] {name}: HTTP {r.status_code} ({elapsed:.2f}s)")
            print(f"        URL: {url}")
            print(f"        Preview: {r.text[:100]}...")
            if not passed:
                all_passed = False
        except Exception as e:
            print(f"[❌ FAIL] {name}: {type(e).__name__} -> {e}")
            all_passed = False

if all_passed:
    print("\n🎉 ALL PUBLIC TUNNEL ENDPOINTS RETURNED HTTP 200!")
    sys.exit(0)
else:
    print("\n⚠️ SOME ENDPOINTS FAILED")
    sys.exit(1)

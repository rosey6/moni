"""Smoke-test Secure session cookies through a local HTTPS reverse proxy."""
import http.cookiejar
import json
import os
import sys
import urllib.request
import uuid


BASE = os.environ.get("MONI_HTTPS_TEST_BASE", "https://localhost:8443/backend")


def main():
    context = __import__("ssl")._create_unverified_context()
    cookies = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPSHandler(context=context), urllib.request.HTTPCookieProcessor(cookies))
    email = f"https-{uuid.uuid4().hex[:10]}@example.test"
    body = json.dumps({"name": "HTTPS Validation", "email": email, "password": "ValidationPassword!123", "currency": "XOF"}).encode()
    headers = {"Content-Type": "application/json", "Origin": "https://moni.example.test", "Accept": "application/json"}
    request = urllib.request.Request(BASE + "/register.php", data=body, headers=headers, method="POST")
    with opener.open(request, timeout=10) as response:
        payload = json.loads(response.read())
        assert response.status == 201 and payload["success"]
    request = urllib.request.Request(BASE + "/me.php", headers={"Accept": "application/json", "Origin": "https://moni.example.test"}, method="GET")
    with opener.open(request, timeout=10) as response:
        payload = json.loads(response.read())
        assert response.status == 200 and payload["success"]
    print("HTTPS session validation passed: Secure cookie round-trip and authenticated session")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"HTTPS session validation failed: {error}", file=sys.stderr)
        raise

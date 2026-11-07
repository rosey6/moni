"""Check cookie attributes emitted when MONI_COOKIE_SECURE=1."""
import json
import os
import sys
import urllib.request
import uuid


BASE = os.environ.get("MONI_TEST_BASE", "http://127.0.0.1:8081")


def main():
    body = json.dumps({"name": "Secure Cookie", "email": f"cookie-{uuid.uuid4().hex[:10]}@example.test", "password": "ValidationPassword!123", "currency": "XOF"}).encode()
    request = urllib.request.Request(BASE + "/register.php", data=body, headers={"Content-Type": "application/json", "Origin": "https://moni.example.test"}, method="POST")
    with urllib.request.urlopen(request, timeout=10) as response:
        cookies = "\n".join(response.headers.get_all("Set-Cookie") or [])
        cors = response.headers.get("Access-Control-Allow-Origin")
    lowered = cookies.lower()
    assert "secure" in lowered and "httponly" in lowered and "samesite=lax" in lowered and "path=/" in lowered, cookies
    assert cors == "https://moni.example.test", cors
    print("Secure cookie validation passed: Secure, HttpOnly, SameSite=Lax, exact CORS origin")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"Secure cookie validation failed: {error}", file=sys.stderr)
        raise

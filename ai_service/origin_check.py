"""Origin checks for the loopback restoration server.

The browser Origin header has no path, so https://jviola60.github.io alone
would trust every GitHub Pages site on this account. Callers must also send
a Referer whose path is this repo's Pages base path.
"""

PAGES_ORIGIN = "https://jviola60.github.io"
PAGES_PATH_PREFIX = "/family-history-photos"

DEV_ORIGINS = (
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
)


def _strip_ref(value):
    if not value:
        return ""
    text = value.strip()
    for sep in ("#", "?"):
        if sep in text:
            text = text.split(sep, 1)[0]
    return text


def _pages_referer_ok(referer):
    ref = _strip_ref(referer)
    base = PAGES_ORIGIN + PAGES_PATH_PREFIX
    return ref == base or ref.startswith(base + "/")


def _dev_referer_ok(origin, referer):
    ref = _strip_ref(referer)
    return ref == origin or ref.startswith(origin + "/")


def request_is_allowed(origin, referer):
    """True only for this Pages app, or for the local Vite dev/preview origins."""
    origin = (origin or "").strip()
    if origin == PAGES_ORIGIN:
        return _pages_referer_ok(referer)
    if origin in DEV_ORIGINS:
        return _dev_referer_ok(origin, referer)
    return False

import unittest

from origin_check import PAGES_ORIGIN, request_is_allowed


class OriginCheckTests(unittest.TestCase):
    def test_pages_app_with_path_is_allowed(self):
        self.assertTrue(request_is_allowed(
            PAGES_ORIGIN,
            "https://jviola60.github.io/family-history-photos/",
        ))
        self.assertTrue(request_is_allowed(
            PAGES_ORIGIN,
            "https://jviola60.github.io/family-history-photos/index.html?x=1",
        ))

    def test_other_pages_on_the_same_host_are_rejected(self):
        self.assertFalse(request_is_allowed(
            PAGES_ORIGIN,
            "https://jviola60.github.io/",
        ))
        self.assertFalse(request_is_allowed(
            PAGES_ORIGIN,
            "https://jviola60.github.io/other-repo/",
        ))
        self.assertFalse(request_is_allowed(
            PAGES_ORIGIN,
            "https://jviola60.github.io/family-history-photos-evil/",
        ))

    def test_missing_referer_is_rejected(self):
        self.assertFalse(request_is_allowed(PAGES_ORIGIN, ""))
        self.assertFalse(request_is_allowed(PAGES_ORIGIN, None))

    def test_localhost_dev_origins(self):
        self.assertTrue(request_is_allowed(
            "http://localhost:5173",
            "http://localhost:5173/",
        ))
        self.assertTrue(request_is_allowed(
            "http://127.0.0.1:4173",
            "http://127.0.0.1:4173/index.html",
        ))
        self.assertFalse(request_is_allowed(
            "http://localhost:5173",
            "http://localhost:9999/",
        ))
        self.assertFalse(request_is_allowed(
            "http://localhost:8080",
            "http://localhost:8080/",
        ))

    def test_foreign_origin_is_rejected(self):
        self.assertFalse(request_is_allowed(
            "https://evil.example",
            "https://jviola60.github.io/family-history-photos/",
        ))
        self.assertFalse(request_is_allowed("", ""))


if __name__ == "__main__":
    unittest.main()

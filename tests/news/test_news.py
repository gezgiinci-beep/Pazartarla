import importlib.util
import json
from datetime import datetime, timezone
from pathlib import Path
import sys
import unittest
from unittest.mock import patch
from urllib.error import HTTPError

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "scripts/news"))
import fetch_news
from news_source import ArchiveParser, ArticleParser, discover, safe_url, NoRedirect

SOURCE = json.loads((ROOT / "scripts/news/sources.json").read_text())["sources"][0]
URL = SOURCE["article_prefix"] + "2026/research/"


class SourceTests(unittest.TestCase):
    def test_source_urls_are_fixed_https_and_without_tracking_or_credentials(self):
        for bad in ["http://www.ars.usda.gov/a", "https://www.ars.usda.gov.evil.test/a",
                    URL + "?redirect=evil", URL + "#x", URL + "%2e%2e/foo"]:
            with self.assertRaises(ValueError):
                safe_url(bad, SOURCE["article_prefix"])
        self.assertEqual(safe_url(URL, SOURCE["article_prefix"]), URL)

    def test_redirects_are_rejected(self):
        with self.assertRaises(ValueError):
            NoRedirect().redirect_request(None, None, 302, "", {}, "http://127.0.0.1")

    def test_archive_only_includes_research_news_and_original_dates(self):
        parser = ArchiveParser(SOURCE, 2026)
        parser.feed(f'<table><tr><td>October 27</td><td><a href="{URL}">Research</a><a href="https://evil.test/news">Ignore</a></td></tr></table>')
        self.assertEqual(len(parser.rows), 1)
        self.assertEqual(parser.rows[0]["published"].isoformat(), "2026-10-27T00:00:00+00:00")

    def test_new_year_looks_in_previous_year_archive(self):
        html = f'<table><tr><td>December 29</td><td><a href="{URL}">Research</a></td></tr></table>'.encode()
        with patch("news_source.download", return_value=html) as download:
            result = discover(SOURCE, datetime(2027, 1, 3, tzinfo=timezone.utc))
        self.assertEqual(download.call_count, 2)
        self.assertEqual(result[0]["published"].year, 2026)

    def test_article_only_uses_main_and_explicit_ars_photo_credit(self):
        parser = ArticleParser(SOURCE)
        parser.feed('<header>Ignore me</header><main id="main-content"><h2>Research title</h2>'
                    '<p>' + 'Agricultural research findings. ' * 12 + '</p>'
                    '<p><img src="/ARSUserFiles/news/Photo with spaces.jpg"/>Photo by Alex, ARS</p>'
                    '<p><img src="/ARSUserFiles/news/other.jpg"/>Photo by Someone, Getty</p>'
                    '<script>Ignore injected code</script></main><footer>Footer text</footer>')
        self.assertEqual(parser.title, "Research title")
        self.assertEqual(len(parser.images), 1)
        self.assertIn("Photo%20with%20spaces", parser.images[0]["url"])
        self.assertNotIn("injected", "\n".join(parser.paragraphs))

    def test_missing_or_third_party_credit_not_accepted(self):
        for credit in ["No license information", "Photo by Alex, Getty, ARS", "Photo courtesy of University, ARS"]:
            parser = ArticleParser(SOURCE)
            parser.feed(f'<main id="main-content"><p><img src="/ARSUserFiles/news/x.jpg"/>{credit}</p></main>')
            self.assertFalse(parser.images)


class RewriteTests(unittest.TestCase):
    def draft(self):
        return {"title": "Üreticiler için yeni tarımsal araştırma",
                "excerpt": "Yeni çalışmanın kapsamı ve sınırlamaları inceleniyor.",
                "body": "Araştırma sonuçları yalnızca deney koşullarında değerlendiriliyor. " * 5,
                "review_note": "Özgün kaynak ve uygulama koşulları kontrol edilmeli."}

    def test_validated_summary(self):
        self.assertEqual(fetch_news.validate_rewrite(self.draft(), "A different research source"),
                         {key: value.strip() for key, value in self.draft().items()})

    def test_unsupported_numbers_html_and_missing_fields_rejected(self):
        for change in [{"body": "<script>evil</script>" * 20}, {"title": "Kısa"},
                       {"review_note": "Destek ödemesi 9876543 liradır."}]:
            with self.assertRaises(ValueError):
                fetch_news.validate_rewrite({**self.draft(), **change}, "Research with no numerical results")

    def test_verbatim_rewrite_rejected(self):
        draft = self.draft()
        with self.assertRaises(ValueError):
            fetch_news.validate_rewrite(draft, draft["body"])

    def test_turkish_number_grouping_preserves_the_source_value(self):
        for source, translated in [("15,650", "15 650"), ("15,650", "15.650"),
                                   ("15,650", "15\u202f650"), ("15.65", "15,65"),
                                   ("1500", "1.500")]:
            with self.subTest(source=source, translated=translated):
                draft = {**self.draft(), "review_note": f"Kaynakta {translated} değerini kontrol edin."}
                fetch_news.validate_rewrite(draft, f"Research value {source}")

    def test_number_grouping_never_turns_a_different_value_into_a_match(self):
        for source, translated in [("1.5", "1.500"), ("1,500", "1,5"),
                                   ("15,650", "15 651"), ("12", "1 2")]:
            with self.subTest(source=source, translated=translated):
                draft = {**self.draft(), "review_note": f"Kaynakta {translated} değerini kontrol edin."}
                with self.assertRaises(ValueError):
                    fetch_news.validate_rewrite(draft, f"Research value {source}")

    def test_prompt_protects_geography_and_human_approval(self):
        prompt = (ROOT / "scripts/news/editorial-prompt.txt").read_text()
        for text in ["GÜVENİLMEYEN", "Türkiye", "insan editör", "garantisi verme"]:
            self.assertIn(text, prompt)

    def test_local_production_write_is_blocked(self):
        with patch.dict("os.environ", {"PAZARTARLA_NEWS_GEMINI_API_KEY": "test-not-a-secret",
                                      "GITHUB_REPOSITORY": "wrong/repository", "GITHUB_REF": "refs/heads/main"}):
            with self.assertRaises(ValueError):
                fetch_news.run()


class GeminiTests(unittest.TestCase):
    draft = RewriteTests.draft
    def invoke(self, result):
        item = {"url": URL, "published": datetime(2026, 10, 27, tzinfo=timezone.utc)}
        article = {"title": "Agricultural research", "body": "Independent source with no numerical data"}
        with patch.dict("os.environ", {fetch_news.AI_SECRET: "synthetic-fixture-not-a-key"}, clear=True):
            with patch("fetch_news.http_json", return_value=result) as call:
                output = fetch_news.rewrite(article, SOURCE, item)
        return output, call

    def response(self, data=None, finish="STOP"):
        return {"candidates": [{"finishReason": finish, "content": {"parts": [
            {"text": json.dumps(data or self.draft(), ensure_ascii=False)}
        ]}}]}

    def test_gemini_request_uses_header_not_url_and_has_no_paid_tools(self):
        output, call = self.invoke(self.response())
        url, method, payload, headers = call.call_args.args
        self.assertEqual(url, fetch_news.GEMINI_ENDPOINT)
        self.assertEqual(fetch_news.MODEL, "gemini-3.5-flash-lite")
        self.assertEqual(method, "POST")
        self.assertEqual(headers, {"x-goog-api-key": "synthetic-fixture-not-a-key"})
        self.assertNotIn("synthetic-fixture", url)
        self.assertEqual(payload["generationConfig"]["responseMimeType"], "application/json")
        self.assertEqual(payload["generationConfig"]["maxOutputTokens"], 8192)
        self.assertNotIn("tools", payload)
        self.assertEqual(output["title"], self.draft()["title"])

    def test_blocked_truncated_missing_or_invalid_response_does_not_create_content(self):
        for result in [{"promptFeedback": {"blockReason": "SAFETY"}},
                       {"promptFeedback": "invalid"}, {"candidates": [None]},
                       {"candidates": [{"finishReason": "STOP", "content": None}]},
                       {"candidates": []}, self.response(finish="MAX_TOKENS"),
                       self.response(finish="RECITATION"),
                       {"candidates": [{"finishReason": "STOP", "content": {"parts": []}}]}]:
            with self.subTest(result=result):
                with self.assertRaises(ValueError):
                    self.invoke(result)

    def test_thinking_parts_are_not_treated_as_the_article(self):
        result = self.response()
        result["candidates"][0]["content"]["parts"].insert(0, {"thought": True, "text": "Private reasoning, not article JSON"})
        output, _ = self.invoke(result)
        self.assertEqual(output["title"], self.draft()["title"])

    def test_quota_or_billing_error_stops_without_retry_or_fallback(self):
        for status in [401, 402, 403, 429]:
            with self.subTest(status=status):
                with patch.dict("os.environ", {fetch_news.AI_SECRET: "synthetic-fixture-not-a-key"}, clear=True):
                    with patch("fetch_news.http_json", side_effect=HTTPError("https://example.test", status, "blocked", {}, None)) as call:
                        with patch("fetch_news.time.sleep") as sleep:
                            with self.assertRaises(HTTPError):
                                fetch_news.rewrite({"title": "Research", "body": "Source data"}, SOURCE,
                                                   {"url": URL, "published": datetime(2026, 10, 27, tzinfo=timezone.utc)})
                            self.assertEqual(call.call_count, 1)
                            sleep.assert_not_called()

    def test_transient_error_has_bounded_backoff_on_the_same_model(self):
        with patch.dict("os.environ", {fetch_news.AI_SECRET: "synthetic-fixture-not-a-key"}, clear=True):
            with patch("fetch_news.http_json", side_effect=[HTTPError("https://example.test", 503, "temporary", {}, None),
                                                           self.response()]) as call:
                with patch("fetch_news.time.sleep") as sleep:
                    result = fetch_news.rewrite({"title": "Research", "body": "Source data"}, SOURCE,
                                                {"url": URL, "published": datetime(2026, 10, 27, tzinfo=timezone.utc)})
                    self.assertEqual(result["title"], self.draft()["title"])
                    self.assertEqual(call.call_count, 2)
                    self.assertTrue(all(c.args[0] == fetch_news.GEMINI_ENDPOINT for c in call.call_args_list))
                    sleep.assert_called_once_with(5)

    def test_openai_key_is_not_used_as_a_gemini_credential(self):
        with patch.dict("os.environ", {"PAZARTARLA_NEWS_AI_API_KEY": "synthetic-old-key"}, clear=True):
            with patch("fetch_news.http_json") as call:
                with self.assertRaises(ValueError):
                    fetch_news.rewrite({}, SOURCE, {})
                call.assert_not_called()

    def test_503_retries_twice_then_succeeds_without_changing_provider(self):
        unavailable = HTTPError("https://example.test", 503, "temporary", {}, None)
        with patch.dict("os.environ", {fetch_news.AI_SECRET: "synthetic-fixture-not-a-key"}, clear=True):
            with patch("fetch_news.http_json", side_effect=[unavailable, unavailable, self.response()]) as call:
                with patch("fetch_news.time.sleep") as sleep:
                    result = fetch_news.rewrite({"title": "Research", "body": "Source data"}, SOURCE,
                                                {"url": URL, "published": datetime(2026, 10, 27, tzinfo=timezone.utc)})
                    self.assertEqual(result["title"], self.draft()["title"])
                    self.assertEqual([c.args[0] for c in sleep.call_args_list], [5, 10])
                    self.assertEqual(call.call_count, 3)
                    self.assertTrue(all(c.args[0] == fetch_news.GEMINI_ENDPOINT for c in call.call_args_list))

    def test_persistent_503_is_bounded_and_logs_no_secret_or_response_body(self):
        from contextlib import redirect_stderr
        from io import StringIO
        output = StringIO()
        unavailable = HTTPError("https://example.test", 503, "SENSITIVE_PROVIDER_RESPONSE", {}, None)
        with patch.dict("os.environ", {fetch_news.AI_SECRET: "synthetic-fixture-not-a-key"}, clear=True):
            with patch("fetch_news.http_json", side_effect=unavailable) as call:
                with patch("fetch_news.time.sleep") as sleep, redirect_stderr(output):
                    with self.assertRaises(HTTPError):
                        fetch_news.rewrite({"title": "Research", "body": "Source data"}, SOURCE,
                                           {"url": URL, "published": datetime(2026, 10, 27, tzinfo=timezone.utc)})
                    self.assertEqual(call.call_count, 3)
                    self.assertEqual([c.args[0] for c in sleep.call_args_list], [5, 10])
        self.assertIn("HTTP 503", output.getvalue())
        self.assertNotIn("synthetic-fixture-not-a-key", output.getvalue())
        self.assertNotIn("SENSITIVE_PROVIDER_RESPONSE", output.getvalue())

    def test_workflow_only_requests_gemini_secret(self):
        workflow = (ROOT / ".github/workflows/fetch-news.yml").read_text()
        self.assertIn("secrets.PAZARTARLA_NEWS_GEMINI_API_KEY", workflow)
        self.assertNotIn("secrets.PAZARTARLA_NEWS_AI_API_KEY", workflow)
        self.assertIn("vars.PAZARTARLA_NEWS_AUTOMATION_ENABLED == 'true'", workflow)


if __name__ == "__main__":
    unittest.main()

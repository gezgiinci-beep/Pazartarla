"""Bounded factual-summary recovery; all AI responses and imports are mocked."""
from contextlib import redirect_stderr
from datetime import datetime, timezone
from io import StringIO
from pathlib import Path
import json
import sys
import unittest
from unittest.mock import patch
from urllib.error import HTTPError

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
import fetch_news

SECRET = "synthetic-rewrite-key-not-a-credential"
SOURCE = {"id": "fixture", "name": "Fixture", "language": "tr",
          "enabled": True, "max_age_days": 3, "image_policy": "generated-editorial-cover"}
ITEM = {"url": "https://example.test/research", "published": datetime.now(timezone.utc)}
BODY = "Üretici birliğinin duyurusunda başvuru koşulları ve yerel kapsam anlatılıyor. " * 4
ARTICLE = {"title": "Üretici birliğinin yeni tarım duyurusu", "body": BODY}
DRAFT = {"title": "Yerel üreticilere yönelik başvuru duyurusu",
         "excerpt": "Birlik, başvurunun kapsamını ve koşullarını duyurdu.",
         "body": "Başvuruda yer alacak üreticiler için koşullar duyuruldu. "
                 "Birliğin açıklaması yerel uygulamanın kapsamını ele alıyor. "
                 "Duyurunun muhatapları, açıklanan başvuru koşullarına göre belirlenecek; "
                 "kapsamın diğer bölgelere genişlediğine ilişkin bilgi bulunmuyor.",
         "review_note": "Kaynak, kapsam ve başvuru durumu editörce kontrol edilmeli."}


def response(draft):
    return {"candidates": [{"finishReason": "STOP", "content": {"parts": [
        {"text": json.dumps(draft, ensure_ascii=False)}
    ]}}]}


class RewriteRecoveryTests(unittest.TestCase):
    def invoke(self, results, reserve=None):
        requests, logs = [], StringIO()
        def api(url, method, payload, headers):
            requests.append(json.loads(json.dumps(payload)))
            current = results[len(requests) - 1]
            if isinstance(current, Exception):
                raise current
            return current
        with patch.dict("os.environ", {fetch_news.AI_SECRET: SECRET}, clear=True), \
             patch("fetch_news.http_json", side_effect=api), redirect_stderr(logs):
            result = fetch_news.rewrite(ARTICLE, SOURCE, ITEM, reserve_extra_attempt=reserve)
        self.assertNotIn(SECRET, logs.getvalue())
        return result, requests

    def test_similar_first_draft_gets_one_feedback_then_same_strict_validation(self):
        reserve = unittest.mock.Mock()
        result, requests = self.invoke([response({**DRAFT, "body": BODY}), response(DRAFT)], reserve)
        self.assertEqual(result, DRAFT)
        self.assertEqual(len(requests), 2)
        reserve.assert_called_once_with()
        second_prompt = requests[1]["systemInstruction"]["parts"][0]["text"]
        self.assertIn(fetch_news.SIMILARITY_RETRY_INSTRUCTION, second_prompt)
        self.assertNotIn(BODY, second_prompt)
        self.assertEqual(requests[0]["contents"], requests[1]["contents"])

    def test_second_similar_draft_is_rejected_without_third_rewrite(self):
        with patch.dict("os.environ", {fetch_news.AI_SECRET: SECRET}, clear=True), \
             patch("fetch_news.http_json", return_value=response({**DRAFT, "body": BODY})) as api, \
             redirect_stderr(StringIO()):
            with self.assertRaisesRegex(ValueError, "too similar"):
                fetch_news.rewrite(ARTICLE, SOURCE, ITEM)
        self.assertEqual(api.call_count, 2)

    def test_missing_numbers_unsafe_text_and_short_body_do_not_get_repair_retries(self):
        for change in [{"review_note": "Destek 9876543 lira olarak açıklandı."},
                       {"body": "<script>unsafe</script>" * 15}, {"body": "Kısa"}]:
            with self.subTest(change=change), \
                 patch.dict("os.environ", {fetch_news.AI_SECRET: SECRET}, clear=True), \
                 patch("fetch_news.http_json", return_value=response({**DRAFT, **change})) as api:
                with self.assertRaises(ValueError):
                    fetch_news.rewrite(ARTICLE, SOURCE, ITEM)
                self.assertEqual(api.call_count, 1)

    def test_budget_exhaustion_stops_before_extra_generation(self):
        def exhausted():
            raise ValueError("AI request budget exhausted")
        with patch.dict("os.environ", {fetch_news.AI_SECRET: SECRET}, clear=True), \
             patch("fetch_news.http_json", return_value=response({**DRAFT, "body": BODY})) as api, \
             redirect_stderr(StringIO()):
            with self.assertRaisesRegex(ValueError, "budget exhausted"):
                fetch_news.rewrite(ARTICLE, SOURCE, ITEM, reserve_extra_attempt=exhausted)
        self.assertEqual(api.call_count, 1)

    def test_all_extra_http_requests_use_budget_and_original_provider_limits(self):
        reserve = unittest.mock.Mock()
        transient = HTTPError("https://example.test", 503, "private body", {}, None)
        with patch("fetch_news.time.sleep") as sleep:
            _, requests = self.invoke([transient, response({**DRAFT, "body": BODY}), response(DRAFT)], reserve)
        self.assertEqual(len(requests), 3)
        self.assertEqual(reserve.call_count, 2)
        sleep.assert_called_once_with(5)

    def test_quota_error_never_retries_or_falls_back(self):
        with patch.dict("os.environ", {fetch_news.AI_SECRET: SECRET}, clear=True), \
             patch("fetch_news.http_json", side_effect=HTTPError("https://example.test", 429, "private", {}, None)) as api, \
             patch("fetch_news.time.sleep") as sleep:
            with self.assertRaises(HTTPError):
                fetch_news.rewrite(ARTICLE, SOURCE, ITEM)
        self.assertEqual(api.call_count, 1)
        sleep.assert_not_called()

    def test_runner_budget_counts_similarity_and_transport_retries(self):
        posts, calls = [], []
        def importer(method, payload=None, source_url=None, stats=False):
            if stats:
                return {"imported_today": 0, "remaining_capacity": 6, "recent_urls": []}
            if method == "POST":
                posts.append(payload)
                return {"created": True}
            return {"imported": False}
        rows = [(SOURCE, {**ITEM, "url": ITEM["url"] + str(i)}) for i in range(12)]
        def fake_rewrite(article, source, item, *, reserve_extra_attempt):
            calls.append(item["url"])
            reserve_extra_attempt()
            return DRAFT
        with patch.dict("os.environ", {fetch_news.AI_SECRET: SECRET,
                 "GITHUB_REPOSITORY": "gezgiinci-beep/Pazartarla", "GITHUB_REF": "refs/heads/main"}, clear=True), \
             patch.object(Path, "read_text", return_value=json.dumps({"sources": [SOURCE]})), \
             patch("fetch_news.collect_sources", return_value=([rows], 0)), \
             patch("fetch_news.importer", side_effect=importer), \
             patch("fetch_news.read_article", return_value=ARTICLE), \
             patch("fetch_news.rewrite", side_effect=fake_rewrite), \
             patch("fetch_news.record_summary") as summary:
            code = fetch_news.run()
        self.assertEqual(code, 0)
        self.assertEqual(len(calls), 4)
        self.assertEqual(len(posts), 4)
        self.assertEqual(summary.call_args.args[0]["ai_attempts"], 8)
        self.assertTrue(all("status" not in p for p in posts))

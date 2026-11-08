"""Offline diagnostics: no credentials, provider requests or production writes."""
from contextlib import redirect_stderr, redirect_stdout
from datetime import datetime, timezone
from io import StringIO
from pathlib import Path
import json
import sys
import unittest
from unittest.mock import patch
from urllib.error import HTTPError, URLError

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
import fetch_news
from news_diagnostics import DraftValidationError, failure_details

PRIVATE = "DO_NOT_LOG_credential_article_body_phone_or_provider_response"
SOURCE = {"id": "test", "enabled": True, "image_policy": "generated-editorial-cover"}
ENV = {"PAZARTARLA_NEWS_GEMINI_API_KEY": PRIVATE,
       "GITHUB_REPOSITORY": "gezgiinci-beep/Pazartarla", "GITHUB_REF": "refs/heads/main"}


class DiagnosticTests(unittest.TestCase):
    def draft(self):
        return {"title": "Üreticiler için yeni tarımsal araştırma",
                "excerpt": "Araştırmanın kapsamı ve sınırlamaları değerlendiriliyor.",
                "body": "Sonuçların üretim koşullarına uygunluğu ayrıca incelenmeli. " * 5,
                "review_note": "İnsan editör kaynak ve güncelliği kontrol etmeli."}

    def run_failure(self, phase, problem):
        item = {"url": "https://example.test/news", "published": datetime.now(timezone.utc)}
        posts = []
        def importer(method, payload=None, source_url=None, stats=False):
            if stats:
                return {"imported_today": 0, "remaining_capacity": 6, "recent_urls": []}
            if phase == "lookup" and method == "GET":
                raise problem
            if method == "POST":
                if phase == "import":
                    raise problem
                posts.append(payload)
                return {"created": True}
            return {"imported": False}
        output, errors = StringIO(), StringIO()
        with patch.dict("os.environ", ENV, clear=True), \
             patch.object(Path, "read_text", return_value=json.dumps({"sources": [SOURCE]})), \
             patch("fetch_news.collect_sources", return_value=([[(SOURCE, item)]], 0)), \
             patch("fetch_news.importer", side_effect=importer), \
             patch("fetch_news.read_article", side_effect=problem if phase == "source" else None,
                   return_value={"title": "Tarım haberi", "body": PRIVATE}), \
             patch("fetch_news.rewrite", side_effect=problem if phase == "ai" else None,
                   return_value=self.draft()), \
             patch("fetch_news.record_summary") as summary, \
             redirect_stderr(errors), redirect_stdout(output):
            exit_code = fetch_news.run()
        serialized = output.getvalue() + errors.getvalue()
        self.assertNotIn(PRIVATE, serialized)
        events = [json.loads(line) for line in serialized.splitlines() if line.startswith("{")]
        return exit_code, posts, summary.call_args.args[0], events

    def test_field_failures_identify_rule_without_printing_the_value(self):
        for field, value, code in [
            ("body", "Kısa", "ai_field_too_short"),
            ("title", 42, "ai_field_type"),
            ("review_note", "x" * 601, "ai_field_too_long"),
            ("body", ("<script>" + PRIVATE + "</script>") * 4, "ai_field_unsafe_text"),
        ]:
            with self.subTest(field=field, code=code):
                with self.assertRaises(ValueError) as raised:
                    fetch_news.validate_rewrite({**self.draft(), field: value}, "Independent source")
                detail = failure_details("ai", raised.exception)
                self.assertEqual(detail, {"phase": "ai", "error_code": code, "field": field})
                self.assertNotIn(PRIVATE, json.dumps(detail))

    def test_exception_messages_documents_and_urls_are_never_serialized(self):
        for problem, code in [
            (ValueError(PRIVATE), "value_invalid"),
            (KeyError(PRIVATE), "missing_required_field"),
            (URLError("https://example.test/?key=" + PRIVATE), "network_or_io_error"),
            (OSError(PRIVATE), "network_or_io_error"),
            (json.JSONDecodeError(PRIVATE, PRIVATE, 0), "invalid_json"),
        ]:
            with self.subTest(code=code):
                detail = failure_details("ai", problem)
                self.assertEqual(detail["error_code"], code)
                self.assertNotIn(PRIVATE, json.dumps(detail))

    def test_only_allowlisted_metadata_and_http_statuses_are_emitted(self):
        self.assertEqual(failure_details(PRIVATE, ValueError(PRIVATE))["phase"], "unknown")
        malicious = DraftValidationError(PRIVATE, PRIVATE)
        self.assertEqual(failure_details("ai", malicious),
                         {"phase": "ai", "error_code": "ai_output_validation"})
        for status, code in [(401, "authentication_failed"), (403, "permission_denied"),
                             (429, "quota_or_rate_limit"), (503, "upstream_unavailable")]:
            detail = failure_details("ai", HTTPError(PRIVATE, status, PRIVATE, {PRIVATE: PRIVATE}, None))
            self.assertEqual(detail, {"phase": "ai", "status": status, "error_code": code})

    def test_lookup_ai_and_import_failures_have_distinct_safe_phases(self):
        for phase in ["lookup", "ai", "import"]:
            with self.subTest(phase=phase):
                code, posts, summary, events = self.run_failure(phase, ValueError(PRIVATE))
                self.assertEqual(code, 1)
                self.assertFalse(posts)
                self.assertEqual(summary["created_drafts"], 0)
                self.assertEqual(summary["failed"], 1)
                self.assertEqual(events[0]["phase"], phase)
                self.assertEqual(events[0]["error_code"], "value_invalid")

    def test_numeric_guard_is_still_strict_and_reported(self):
        draft = {**self.draft(), "review_note": "Destek miktarı 9876543 lira olarak açıklandı."}
        with self.assertRaises(ValueError) as raised:
            fetch_news.validate_rewrite(draft, "A source without any numbers")
        self.assertEqual(failure_details("ai", raised.exception)["error_code"], "ai_unsupported_numbers")
        code, posts, _, events = self.run_failure("ai", raised.exception)
        self.assertEqual(code, 1)
        self.assertFalse(posts)
        self.assertEqual(events[0]["error_code"], "ai_unsupported_numbers")

    def test_source_rejection_is_still_skipped_and_not_rewritten_or_posted(self):
        _, posts, summary, events = self.run_failure("source", ValueError(PRIVATE))
        self.assertFalse(posts)
        self.assertEqual(summary["skipped"], 1)
        self.assertEqual(events[0]["result"], "skipped_unusable_text_or_unlicensed_photo")
        self.assertEqual(events[0]["phase"], "source")

    def test_auth_billing_and_quota_still_stop_without_fallback_or_publication(self):
        for status in [401, 402, 403, 404, 429]:
            with self.subTest(status=status):
                code, posts, summary, events = self.run_failure(
                    "ai", HTTPError(PRIVATE, status, PRIVATE, {}, None))
                self.assertEqual(code, 1)
                self.assertFalse(posts)
                self.assertEqual(summary["reason"], "provider_or_importer_limit")
                self.assertEqual(events[0]["result"], "processing_stopped")
                self.assertEqual(events[0]["status"], status)

    def test_discovery_failure_uses_fixed_code_without_source_response(self):
        errors = StringIO()
        with patch("fetch_news.discover", side_effect=ValueError(PRIVATE)), redirect_stderr(errors):
            streams, count = fetch_news.collect_sources(
                [{**SOURCE, "max_age_days": 3}], set(), datetime.now(timezone.utc))
        self.assertEqual(count, 1)
        self.assertEqual(streams, [[]])
        self.assertNotIn(PRIVATE, errors.getvalue())
        self.assertEqual(json.loads(errors.getvalue()),
                         {"source": "test", "result": "discovery_failed",
                          "phase": "discovery", "error_code": "value_invalid"})

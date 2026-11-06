"""Offline scheduling, freshness and quota tests; no real AI or database writes."""
from datetime import datetime, timedelta, timezone
from pathlib import Path
import json
import sys
import unittest
from unittest.mock import patch
from urllib.error import HTTPError

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
import fetch_news

SOURCE = {"id": "test", "enabled": True, "max_age_days": 30,
          "image_policy": "generated-editorial-cover"}
ENV = {"PAZARTARLA_NEWS_GEMINI_API_KEY": "synthetic-fixture",
       "GITHUB_REPOSITORY": "gezgiinci-beep/Pazartarla", "GITHUB_REF": "refs/heads/main"}


def items(count):
    return [{"url": f"https://example.test/{i}", "published": datetime.now(timezone.utc),
             "_article": {"title": "Üretici destek başvuruları"}} for i in range(count)]


class DailyTargetTests(unittest.TestCase):
    def invoke(self, before=0, count=15, known=None, read=None, rewrite_error=None):
        rows = items(count)
        calls = []
        def importer(method, payload=None, source_url=None, stats=False):
            calls.append((method, payload, source_url, stats))
            if stats:
                return {"imported_today": before, "remaining_capacity": 20 - before,
                        "recent_urls": known or []}
            return {"created": True} if method == "POST" else {"imported": False}
        with patch.dict("os.environ", ENV, clear=True), \
             patch.object(Path, "read_text", return_value=json.dumps({"sources": [SOURCE]})), \
             patch("fetch_news.importer", side_effect=importer), \
             patch("fetch_news.collect_sources", return_value=([[(SOURCE, row) for row in rows]], 0)) as collect, \
             patch("fetch_news.read_article", side_effect=read, return_value={"title": "Tarım haberi", "body": "Bilgi"}) as article, \
             patch("fetch_news.rewrite", side_effect=rewrite_error, return_value={"title": "Hazır taslak"}) as rewrite, \
             patch("fetch_news.record_summary") as summary:
            code = fetch_news.run()
        return code, calls, collect, article, rewrite, summary

    def test_first_run_prepares_six_then_next_run_completes_ten(self):
        self.assertEqual(sum(c[0] == "POST" for c in self.invoke()[1]), 6)
        self.assertEqual(sum(c[0] == "POST" for c in self.invoke(before=6)[1]), 4)
        self.assertEqual(sum(c[0] == "POST" for c in self.invoke(before=9)[1]), 1)

    def test_daily_target_reached_stops_before_sources_and_ai(self):
        code, calls, collect, _, rewrite, summary = self.invoke(before=10)
        self.assertEqual(code, 0)
        self.assertEqual(len(calls), 1)
        collect.assert_not_called()
        rewrite.assert_not_called()
        self.assertEqual(summary.call_args.args[0]["shortfall"], 0)

    def test_recent_known_url_does_not_spend_ai_quota(self):
        _, calls, _, _, rewrite, _ = self.invoke(count=2, known=["https://example.test/0"])
        self.assertEqual(rewrite.call_count, 1)
        self.assertEqual(sum(c[0] == "POST" for c in calls), 1)

    def test_shortage_is_reported_not_filled_with_invented_articles(self):
        _, _, _, _, _, summary = self.invoke(count=2)
        self.assertEqual(summary.call_args.args[0]["shortfall"], 8)

    def test_ai_validation_failures_are_bounded_and_report_failure(self):
        code, calls, _, _, rewrite, summary = self.invoke(rewrite_error=ValueError("Invalid draft"))
        self.assertEqual(code, 1)
        self.assertEqual(rewrite.call_count, 8)
        self.assertEqual(sum(c[0] == "POST" for c in calls), 0)
        self.assertEqual(summary.call_args.args[0]["shortfall"], 10)

    def test_one_unavailable_official_article_does_not_discard_the_whole_source(self):
        from official_sources import discover_official
        from news_source import safe_url
        source = {"id": "fixture", "archive_url": "https://example.test/",
                  "article_prefix": "https://example.test/news/", "parser": "ministry", "max_age_days": 3}
        def download(url, prefix):
            if url == source["archive_url"]:
                return b'<a href="/news/one">one</a><a href="/news/two">two</a>'
            if url.endswith("/one"):
                raise HTTPError(url, 403, "Forbidden", {}, None)
            return ('<div id="th-content-post"><h3>Yeni tarım araştırması</h3>'
                    '<div class="itemDateCreated">05.11.2026</div><p>'
                    + "Tarımsal üretimde yeni bulgular değerlendirildi. " * 8 + '</p></div>').encode()
        rows = discover_official(source, download, safe_url, datetime(2026, 11, 6, tzinfo=timezone.utc))
        self.assertEqual([row["url"] for row in rows], ["https://example.test/news/two"])

    def test_one_source_403_does_not_stop_other_candidates(self):
        problem = HTTPError("https://example.test/0", 403, "Forbidden", {}, None)
        article = {"title": "Tarım haberi", "body": "Bilgi"}
        code, calls, _, _, _, summary = self.invoke(count=2, read=[problem, article])
        self.assertEqual(code, 0)
        self.assertEqual(sum(c[0] == "POST" for c in calls), 1)
        self.assertEqual(summary.call_args.args[0]["failed"], 1)

    def test_collection_rejects_old_future_and_bounds_source_reads(self):
        now = datetime.now(timezone.utc)
        rows = [{"url": f"https://example.test/{hour}", "published": now - timedelta(hours=hour)}
                for hour in [-1, 0, 72, 73]]
        with patch("fetch_news.discover", return_value=rows) as discover:
            streams, failed = fetch_news.collect_sources([SOURCE], {"known"}, now)
        self.assertEqual(failed, 0)
        self.assertEqual(len(streams[0]), 2)
        source = discover.call_args.args[0]
        self.assertEqual(source["max_age_days"], 3)
        self.assertEqual(source["max_article_reads"], 6)
        self.assertEqual(source["_known_urls"], {"known"})

    def test_new_pool_contains_faculties_research_grants_and_rss(self):
        sources = json.loads((fetch_news.ROOT / "scripts/news/sources.json").read_text())["sources"]
        ids = [source["id"] for source in sources]
        self.assertEqual(len(ids), len(set(ids)))
        for id in ["tr-tagem", "tr-trgm", "tr-isparta-ziraat", "tr-omu-ziraat", "tr-tarimdanhaber-rss"]:
            self.assertIn(id, ids)
        for source in sources:
            if source.get("organization_type") in {"agricultural_faculty", "agricultural_research", "agricultural_portal"}:
                self.assertEqual(source["image_policy"], "generated-editorial-cover")

    def test_schedule_runs_twelve_times_without_changing_trusted_workflow(self):
        workflow = (fetch_news.ROOT / ".github/workflows/fetch-news.yml").read_text()
        self.assertRegex(workflow, r"(?m)^\s+- cron: '[0-5]?\d \*/2 \* \* \*'$")
        self.assertEqual(workflow.count("cron:"), 1)
        self.assertIn("refs/heads/main", workflow)
        self.assertIn("vars.PAZARTARLA_NEWS_AUTOMATION_ENABLED == 'true'", workflow)
        self.assertIn("environment: gazette-automation", workflow)
        self.assertIn("id-token: write", workflow)

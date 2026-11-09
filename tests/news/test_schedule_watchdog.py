import contextlib
import importlib.util
import io
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("schedule_watchdog", ROOT / "scripts/news/schedule_watchdog.py")
watchdog = importlib.util.module_from_spec(spec)
spec.loader.exec_module(watchdog)
NOW = datetime(2026, 11, 9, 12, tzinfo=timezone.utc)
ENV = {"GITHUB_REPOSITORY": watchdog.REPOSITORY, "GITHUB_REF": "refs/heads/main",
       "GITHUB_EVENT_NAME": "schedule", "GITHUB_TOKEN": "test-only-not-a-credential"}


def row(age, status="completed", conclusion="success", identifier=1, **extra):
    return {"id": identifier, "created_at": (NOW - timedelta(seconds=age)).isoformat(),
            "head_branch": "main", "event": "schedule", "status": status, "conclusion": conclusion, **extra}


class FakeApi:
    def __init__(self, rows, step="success", active=True):
        self.rows, self.step, self.active, self.posts = rows, step, active, []

    def __call__(self, path, method="GET", body=None):
        if method == "POST":
            self.posts.append((path, body))
            return None
        if path.endswith("/fetch-news.yml"):
            return {"state": "active" if self.active else "disabled_manually",
                    "path": ".github/workflows/fetch-news.yml"}
        if "/jobs?" in path:
            return {"jobs": [{"name": "prepare-drafts", "conclusion": "success", "steps": [
                {"name": watchdog.IMPORT_STEP, "conclusion": self.step}]}]}
        return {"workflow_runs": self.rows}


class WatchdogTests(unittest.TestCase):
    def execute(self, api, env=None):
        with contextlib.redirect_stdout(io.StringIO()):
            return watchdog.run(ENV if env is None else env, NOW, api)

    def test_overdue_scan_dispatches_only_existing_main_draft_workflow_once(self):
        api = FakeApi([row(3 * 3600)])
        self.assertTrue(self.execute(api)["dispatch"])
        self.assertEqual(api.posts, [(watchdog.ROOT + "/workflows/fetch-news.yml/dispatches", {"ref": "main"})])

    def test_active_scan_is_not_duplicated_even_if_old(self):
        for status in watchdog.ACTIVE:
            api = FakeApi([row(5 * 3600, status=status, conclusion=None)])
            self.assertEqual(self.execute(api)["reason"], "scan_already_active")
            self.assertEqual(api.posts, [])

    def test_recent_attempt_cools_down_failures_and_manual_scans(self):
        for event in ["schedule", "workflow_dispatch"]:
            api = FakeApi([row(100, conclusion="failure", event=event)])
            self.assertEqual(self.execute(api)["reason"], "recent_attempt")
            self.assertEqual(api.posts, [])

    def test_actual_successful_import_prevents_redundant_scan(self):
        api = FakeApi([row(4000)])
        self.assertEqual(self.execute(api)["reason"], "recent_successful_scan")
        self.assertEqual(api.posts, [])

    def test_skipped_import_is_not_mistaken_for_successful_scan(self):
        api = FakeApi([row(4000)], step="skipped")
        self.assertTrue(self.execute(api)["dispatch"])
        self.assertEqual(len(api.posts), 1)

    def test_disabled_workflow_is_not_reenabled_or_dispatched(self):
        api = FakeApi([], active=False)
        with self.assertRaisesRegex(ValueError, "not_active"):
            self.execute(api)
        self.assertEqual(api.posts, [])

    def test_untrusted_repo_branch_event_and_missing_token_fail_closed(self):
        for change in [{"GITHUB_REPOSITORY": "other/repo"}, {"GITHUB_REF": "refs/heads/untrusted"},
                       {"GITHUB_EVENT_NAME": "pull_request"}, {"GITHUB_TOKEN": ""}]:
            api = FakeApi([])
            with self.assertRaises(ValueError):
                self.execute(api, {**ENV, **change})
            self.assertEqual(api.posts, [])

    def test_future_timestamps_and_malformed_history_fail_closed(self):
        for bad in [row(-3600), {**row(3600), "created_at": "n/a"}, {**row(3600), "id": True}]:
            api = FakeApi([bad])
            with self.assertRaises(ValueError):
                self.execute(api)
            self.assertEqual(api.posts, [])

    def test_ambiguous_dispatch_is_never_retried(self):
        api = FakeApi([row(3 * 3600)])
        def uncertain(path, method="GET", body=None):
            answer = api(path, method, body)
            if method == "POST":
                raise ValueError("github_request_uncertain")
            return answer
        with self.assertRaisesRegex(ValueError, "uncertain"):
            self.execute(uncertain)
        self.assertEqual(len(api.posts), 1)

    def test_transport_rejects_arbitrary_endpoints_refs_and_other_workflows(self):
        call = watchdog.client("test-only")
        for path, method, body in [("/user", "GET", None),
                                  (watchdog.ROOT + "/workflows/other.yml/dispatches", "POST", {"ref": "main"}),
                                  (watchdog.ROOT + "/workflows/fetch-news.yml/dispatches", "POST", {"ref": "other"}),
                                  (watchdog.ROOT + "/runs/1/jobs?per_page=100/../../secrets", "GET", None)]:
            with self.assertRaisesRegex(ValueError, "not_allowlisted"):
                call(path, method, body)

    def test_failure_output_is_allowlisted_and_ambiguous_writes_are_not_called_rejected(self):
        self.assertEqual(watchdog.safe_failure(ValueError("github_request_uncertain")),
                         {"dispatch": None, "reason": "github_request_uncertain"})
        self.assertEqual(watchdog.safe_failure(ValueError("github_http_403")),
                         {"dispatch": False, "reason": "github_http_403"})
        value = ValueError("provider body or token must never be logged")
        self.assertNotIn("provider", str(watchdog.safe_failure(value)))

    def test_workflow_preserves_trust_gate_and_never_receives_news_or_database_credentials(self):
        workflow = (ROOT / ".github/workflows/news-schedule-watchdog.yml").read_text()
        self.assertIn("actions: write", workflow)
        self.assertIn("contents: read", workflow)
        self.assertIn("environment: gazette-automation", workflow)
        self.assertIn("refs/heads/main", workflow)
        self.assertIn("vars.PAZARTARLA_NEWS_AUTOMATION_ENABLED == 'true'", workflow)
        self.assertNotIn("secrets.", workflow)
        self.assertNotIn("id-token: write", workflow)
        self.assertNotIn("fetch_news.py", workflow)
        self.assertIn("cancel-in-progress: false", workflow)
        import re
        match = re.search(r"cron: '(\d+),(\d+) \* \* \* \*'", workflow)
        self.assertIsNotNone(match)
        minutes = sorted(map(int, match.groups()))
        self.assertTrue(0 <= minutes[0] < minutes[1] <= 59)
        self.assertTrue(max(minutes[1] - minutes[0], 60 - minutes[1] + minutes[0]) <= 30)


if __name__ == "__main__":
    unittest.main()

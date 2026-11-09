"""Recover overdue draft scans; never import, publish or expose credentials."""
import json
import os
import re
from datetime import datetime, timezone
from urllib import error, request

REPOSITORY = "gezgiinci-beep/Pazartarla"
ROOT = f"/repos/{REPOSITORY}/actions"
WORKFLOW = "fetch-news.yml"
IMPORT_STEP = "Kaynak, metin ve izinli kapak görselinden taslak hazırla"
ACTIVE = {"queued", "in_progress", "waiting", "requested", "pending"}
RECOVER_AFTER_SECONDS = 2 * 60 * 60
RETRY_AFTER_SECONDS = 60 * 60


def timestamp(value):
    if not isinstance(value, str):
        raise ValueError("invalid_run_time")
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        raise ValueError("invalid_run_time")
    return parsed.astimezone(timezone.utc)


def evaluate(get, now):
    workflow = get(f"{ROOT}/workflows/{WORKFLOW}")
    if not isinstance(workflow, dict) or workflow.get("state") != "active" or workflow.get("path") != f".github/workflows/{WORKFLOW}":
        raise ValueError("draft_workflow_not_active")
    history = get(f"{ROOT}/workflows/{WORKFLOW}/runs?branch=main&per_page=30")
    rows = history.get("workflow_runs") if isinstance(history, dict) else None
    if not isinstance(rows, list):
        raise ValueError("invalid_history")
    runs = []
    for run in rows:
        if not isinstance(run, dict):
            raise ValueError("invalid_run")
        if run.get("head_branch") != "main" or run.get("event") not in {"schedule", "workflow_dispatch"}:
            continue
        if (not isinstance(run.get("id"), int) or isinstance(run.get("id"), bool) or run["id"] < 1):
            raise ValueError("invalid_run_id")
        age = (now - timestamp(run.get("created_at"))).total_seconds()
        if age < -60:
            raise ValueError("future_run_time")
        runs.append((run, age))
    if any(run["status"] in ACTIVE for run, _ in runs):
        return {"dispatch": False, "reason": "scan_already_active"}
    if any(age < RETRY_AFTER_SECONDS for _, age in runs):
        return {"dispatch": False, "reason": "recent_attempt"}
    # Read actual import steps: a green workflow with a skipped job is not a scan.
    recent_successes = [(run, age) for run, age in runs
                        if run.get("status") == "completed" and run.get("conclusion") == "success"
                        and age < RECOVER_AFTER_SECONDS]
    if len(recent_successes) > 6:
        raise ValueError("ambiguous_recent_history")
    for run, _ in recent_successes:
        jobs = get(f"{ROOT}/runs/{run['id']}/jobs?per_page=100").get("jobs")
        if not isinstance(jobs, list) or len(jobs) >= 100:
            raise ValueError("invalid_jobs")
        if any(job.get("name") == "prepare-drafts" and job.get("conclusion") == "success" and
               any(step.get("name") == IMPORT_STEP and step.get("conclusion") == "success"
                   for step in job.get("steps", [])) for job in jobs):
            return {"dispatch": False, "reason": "recent_successful_scan"}
    if len(rows) >= 30 and runs and max(age for _, age in runs) < RECOVER_AFTER_SECONDS:
        raise ValueError("history_window_incomplete")
    return {"dispatch": True, "reason": "draft_scan_overdue"}


class NoRedirect(request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def client(token):
    opener = request.build_opener(NoRedirect())

    def call(path, method="GET", body=None):
        allowed_get = (f"{ROOT}/workflows/{WORKFLOW}", f"{ROOT}/workflows/{WORKFLOW}/runs?branch=main&per_page=30")
        allowed_job = path.startswith(f"{ROOT}/runs/") and path.endswith("/jobs?per_page=100") and path[len(ROOT) + 6:].split("/")[0].isdigit()
        dispatch_path = f"{ROOT}/workflows/{WORKFLOW}/dispatches"
        if not ((method == "GET" and (path in allowed_get or allowed_job)) or
                (method == "POST" and path == dispatch_path and body == {"ref": "main"})):
            raise ValueError("operation_not_allowlisted")
        req = request.Request("https://api.github.com" + path, method=method,
                              data=json.dumps(body).encode() if body is not None else None,
                              headers={"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json",
                                       "Content-Type": "application/json", "X-GitHub-Api-Version": "2022-11-28",
                                       "User-Agent": "PazarTarla-News-Watchdog"})
        try:
            with opener.open(req, timeout=20) as response:
                if method == "POST":
                    if response.status != 204:
                        raise ValueError("dispatch_ack_unknown")
                    return None
                data = response.read(500_001)
                if len(data) > 500_000:
                    raise ValueError("response_too_large")
                return json.loads(data)
        except error.HTTPError as exc:
            raise ValueError(f"github_http_{exc.code}") from None
        except (error.URLError, TimeoutError, OSError):
            # A POST may already have committed. Never retry an uncertain dispatch.
            raise ValueError("github_request_uncertain") from None
    return call


def run(environ=None, now=None, api=None):
    env = os.environ if environ is None else environ
    if (env.get("GITHUB_REPOSITORY") != REPOSITORY or env.get("GITHUB_REF") != "refs/heads/main" or
            env.get("GITHUB_EVENT_NAME") not in {"schedule", "workflow_dispatch"}):
        raise ValueError("untrusted_runner")
    if not env.get("GITHUB_TOKEN"):
        raise ValueError("missing_github_token")
    call = api or client(env["GITHUB_TOKEN"])
    result = evaluate(lambda path: call(path), now or datetime.now(timezone.utc))
    if result["dispatch"]:
        call(f"{ROOT}/workflows/{WORKFLOW}/dispatches", "POST", {"ref": "main"})
        result = {**result, "reason": "draft_scan_dispatched"}
    print(json.dumps(result))
    return result


def safe_failure(exc):
    allowed = {"invalid_run_time", "draft_workflow_not_active", "invalid_history",
               "invalid_run", "invalid_run_id", "future_run_time", "ambiguous_recent_history",
               "invalid_jobs", "history_window_incomplete", "operation_not_allowlisted",
               "dispatch_ack_unknown", "response_too_large", "github_request_uncertain",
               "untrusted_runner", "missing_github_token"}
    code = str(exc)
    if code not in allowed and not re.fullmatch(r"github_http_[1-5][0-9]{2}", code):
        code = "watchdog_check_failed_no_retry"
    return {"dispatch": None if code in {"dispatch_ack_unknown", "github_request_uncertain"} else False,
            "reason": code}


if __name__ == "__main__":
    try:
        run()
    except Exception as exc:
        # Never serialize exception text, response bodies or credentials.
        print(json.dumps(safe_failure(exc)))
        raise SystemExit(1)

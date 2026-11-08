#!/usr/bin/env python3
"""GitHub Actions -> licensed source -> AI summary -> private editorial draft."""
import argparse
import base64
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from difflib import SequenceMatcher
from decimal import Decimal, InvalidOperation
import json
import os
from pathlib import Path
import re
import sys
import time
from itertools import zip_longest
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib import request, parse, error

sys.path.insert(0, str(Path(__file__).parent / "scripts" / "news"))
from news_source import discover, read_article, download, MAX_IMAGE, NoRedirect  # noqa: E402
from news_diagnostics import DraftValidationError, failure_details  # noqa: E402

ROOT = Path(__file__).resolve().parent
ENDPOINT = "https://www.pazartarla.com.tr/api/gazette-import"
MODEL = "gemini-3.5-flash-lite"
AI_SECRET = "PAZARTARLA_NEWS_GEMINI_API_KEY"
GEMINI_ENDPOINT = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent"
MAX_PER_RUN = 6
MAX_AI_ATTEMPTS_PER_RUN = 8
DAILY_TARGET = 10
FRESH_HOURS = 72
RUN_BUDGET_SECONDS = 1080
AI_RETRY_DELAYS = (5, 10)
RETRYABLE_AI_STATUSES = frozenset({500, 502, 503, 504})
NUMBER_TOKEN = re.compile(r"\d+(?:[.,]\d+)*(?:[ \u00a0\u202f]\d{3}(?!\d))*")


def numeric_tokens(value):
    def calendar_parts(match):
        day, month, year = re.split(r"[./]", match.group())
        try:
            datetime(int(year), int(month), int(day))
        except ValueError:
            return match.group()
        return f"{day} {month} {year}"
    return NUMBER_TOKEN.findall(re.sub(r"\b\d{1,2}[./]\d{1,2}[./]20\d{2}\b", calendar_parts, value))


def number_value(token, language):
    """Compare source English and editorial Turkish grouping without rounding."""
    token = re.sub(r"[\u00a0\u202f]", " ", token)
    grouped = r"\d{1,3}(?: \d{3})+"
    if language == "en":
        valid = rf"(?:\d+|\d{{1,3}}(?:,\d{{3}})+|{grouped})(?:\.\d+)?"
        normalized = token.replace(",", "").replace(" ", "")
    else:
        valid = rf"(?:\d+|\d{{1,3}}(?:\.\d{{3}})+|{grouped})(?:,\d+)?"
        normalized = token.replace(".", "").replace(" ", "").replace(",", ".")
    if not re.fullmatch(valid, token):
        raise ValueError("AI added unsupported numbers")
    try:
        return Decimal(normalized)
    except InvalidOperation:
        raise ValueError("AI added unsupported numbers") from None


def http_json(url, method="GET", payload=None, headers=None):
    data = None if payload is None else json.dumps(payload, ensure_ascii=False).encode()
    req = request.Request(url, data=data, method=method, headers={
        "Content-Type": "application/json", **(headers or {})})
    with request.build_opener(NoRedirect()).open(req, timeout=30) as response:
        body = response.read(2_000_001)
        if len(body) > 2_000_000:
            raise ValueError("API response too large")
        return json.loads(body)


def oidc():
    url = os.environ["ACTIONS_ID_TOKEN_REQUEST_URL"]
    parts = parse.urlsplit(url)
    if parts.scheme != "https" or not parts.hostname.endswith(".actions.githubusercontent.com"):
        raise ValueError("Invalid OIDC endpoint")
    sep = "&" if parts.query else "?"
    result = http_json(url + sep + parse.urlencode({"audience": ENDPOINT}), headers={
        "Authorization": "Bearer " + os.environ["ACTIONS_ID_TOKEN_REQUEST_TOKEN"]})
    return result["value"]


def importer(method, payload=None, source_url=None, stats=False):
    # Refresh the five-minute token for each call; never persist or print it.
    query = {"action": "stats"} if stats else {"source_url": source_url} if source_url else {}
    url = ENDPOINT + ("?" + parse.urlencode(query) if query else "")
    return http_json(url, method, payload, {"Authorization": "Bearer " + oidc()})


def validate_rewrite(result, original, original_language="en"):
    limits = {"title": (12, 160), "excerpt": (30, 400), "body": (200, 6000), "review_note": (1, 600)}
    if not isinstance(result, dict):
        raise ValueError("AI output must be an object")
    if set(result) != set(limits):
        raise ValueError("AI output has unexpected fields")
    for key, (minimum, maximum) in limits.items():
        value = result.get(key)
        if not isinstance(value, str):
            raise DraftValidationError("ai_field_type", key)
        if len(value.strip()) < minimum:
            raise DraftValidationError("ai_field_too_short", key)
        if len(value.strip()) > maximum:
            raise DraftValidationError("ai_field_too_long", key)
        if re.search(r"[<>]|\x00|https?://", value):
            raise DraftValidationError("ai_field_unsafe_text", key)
    # Reject near-verbatim text. This is only a guard, not a legal/SEO originality guarantee.
    left = re.sub(r"\W+", " ", original.casefold()).strip()
    right = re.sub(r"\W+", " ", result["body"].casefold()).strip()
    if SequenceMatcher(None, left, right, autojunk=False).ratio() > 0.7:
        raise ValueError("AI output too similar to source")
    # Numeric claims must already occur in the source; editorial review is still required.
    original_numbers = set(numeric_tokens(original))
    original_values = set()
    for token in original_numbers:
        try:
            original_values.add(number_value(token, original_language))
        except ValueError:
            pass  # Opaque source literals may only be repeated exactly.
    for token in numeric_tokens(" ".join(result.values())):
        if token not in original_numbers and number_value(token, "tr") not in original_values:
            raise ValueError("AI added unsupported numbers")
    return {key: result[key].strip() for key in limits}


def rewrite(article, source, item):
    key = os.environ.get(AI_SECRET)
    if not key:
        raise ValueError("AI secret is not configured")
    prompt = (ROOT / "scripts/news/editorial-prompt.txt").read_text()
    content = {"source_name": source["name"], "source_kind": source.get("organization_type", source.get("parser", "official")),
               "source_url": item["url"],
               "original_published_at": item["published"].isoformat(),
               "reference_date_istanbul": datetime.now(ZoneInfo("Europe/Istanbul")).date().isoformat(),
               "source_region": source.get("region", "Kaynakta belirtilen coğrafi kapsam"),
               "allowed_number_literals": sorted(set(numeric_tokens(article["title"] + "\n" + article["body"]
                   + "\n" + item["published"].date().isoformat()))),
               "title": article["title"], "text": article["body"]}
    payload = {
        "systemInstruction": {"parts": [{"text": prompt}]},
        "contents": [{"role": "user", "parts": [{"text": json.dumps(content, ensure_ascii=False)}]}],
        "generationConfig": {
            "candidateCount": 1,
            "maxOutputTokens": 8192,
            "responseMimeType": "application/json",
            "responseSchema": {
                "type": "OBJECT",
                "properties": {field: {"type": "STRING"} for field in
                               ["title", "excerpt", "body", "review_note"]},
                "required": ["title", "excerpt", "body", "review_note"],
            },
        },
    }
    for attempt in range(len(AI_RETRY_DELAYS) + 1):
        try:
            # No key in URLs/logs, no paid tools, alternate model or provider fallback.
            # Free-vs-paid is controlled by the key's Google project, not by this request.
            result = http_json(GEMINI_ENDPOINT, "POST", payload, {"x-goog-api-key": key})
            if not isinstance(result, dict):
                raise ValueError("AI response invalid")
            feedback = result.get("promptFeedback")
            if feedback is not None and (not isinstance(feedback, dict) or feedback.get("blockReason")):
                raise ValueError("AI prompt blocked")
            candidates = result.get("candidates")
            if not isinstance(candidates, list) or len(candidates) != 1:
                raise ValueError("AI response missing")
            choice = candidates[0]
            if not isinstance(choice, dict) or choice.get("finishReason") != "STOP":
                raise ValueError("AI response incomplete")
            candidate_content = choice.get("content")
            if not isinstance(candidate_content, dict):
                raise ValueError("AI response invalid")
            parts = candidate_content.get("parts", [])
            if not isinstance(parts, list):
                raise ValueError("AI response invalid")
            generated = "".join(part["text"] for part in parts if isinstance(part, dict)
                                and not part.get("thought") and isinstance(part.get("text"), str))
            if not generated or len(generated) > 20000:
                raise ValueError("AI response invalid")
            return validate_rewrite(json.loads(generated),
                                    article["title"] + "\n" + article["body"] + "\n" + item["published"].date().isoformat(),
                                    original_language=source.get("language", "en"))
        except error.HTTPError as exc:
            # A quota/billing/auth error ends this run; never upgrade billing or retry
            # against a different (possibly paid) model/provider.
            if exc.code not in RETRYABLE_AI_STATUSES or attempt == len(AI_RETRY_DELAYS):
                raise
            delay = AI_RETRY_DELAYS[attempt]
            print(f"RETRY: Gemini HTTP {exc.code}; retry {attempt + 1}/{len(AI_RETRY_DELAYS)} "
                  f"after {delay}s", file=sys.stderr)
            time.sleep(delay)
    raise ValueError("AI unavailable")


def source_order(sources, now=None):
    enabled = [source for source in sources if source.get("enabled")]
    if not enabled:
        return []
    slot = int((now or datetime.now(timezone.utc)).timestamp() // (2 * 60 * 60))
    offset = slot % len(enabled)
    return enabled[offset:] + enabled[:offset]


def record_summary(summary):
    print(json.dumps(summary, ensure_ascii=False))
    path = os.environ.get("GITHUB_STEP_SUMMARY")
    if path:
        with open(path, "a", encoding="utf-8") as out:
            out.write("\n## PazarTarla haber taraması\n")
            out.write(f"- Türkiye günü: {summary['day']}\n")
            out.write(f"- Bu çalışmada yeni taslak: {summary['created_drafts']}\n")
            out.write(f"- Günlük güncel taslak: {summary['daily_total']} / {DAILY_TARGET}\n")
            out.write(f"- Eksik kalan: {summary['shortfall']}\n")
            out.write(f"- Kaynak/işlem hatası: {summary['failed']}\n")
            out.write("- Tüm içerikler yönetici incelemesi bekleyen taslaktır.\n")
            if summary["shortfall"]:
                out.write("- Hedef henüz karşılanmadı; eski/tekrarlanan içerikle doldurulmadı.\n")


def collect_sources(sources, known, now):
    ordered = source_order(sources, now)
    collected, failed = {}, 0
    def scan(source):
        bounded = {**source, "max_age_days": min(source["max_age_days"], FRESH_HOURS / 24),
                   "max_article_reads": min(source.get("max_article_reads", 6), 6),
                   "_known_urls": known}
        return [item for item in discover(bounded) if
                0 <= (now - item["published"]).total_seconds() <= FRESH_HOURS * 3600]
    with ThreadPoolExecutor(max_workers=6) as executor:
        futures = {executor.submit(scan, source): source for source in ordered}
        for future in as_completed(futures):
            source = futures[future]
            try:
                collected[source["id"]] = future.result()
            except (ValueError, KeyError, error.URLError, OSError) as exc:
                failed += 1
                print(json.dumps({"source": source["id"], "result": "discovery_failed",
                                  **failure_details("discovery", exc)}), file=sys.stderr)
    return [[(source, item) for item in collected.get(source["id"], [])]
            for source in ordered], failed


def run(check_sources=False, source_ids=None):
    if not check_sources:
        if not os.environ.get(AI_SECRET):
            raise ValueError("Gemini secret is not configured")
        if not os.environ.get("GITHUB_REPOSITORY") == "gezgiinci-beep/Pazartarla" or os.environ.get("GITHUB_REF") != "refs/heads/main":
            raise ValueError("Automation runs only on the trusted repository main branch")
    sources = json.loads((ROOT / "scripts/news/sources.json").read_text())["sources"]
    if source_ids:
        if set(source_ids) - {s["id"] for s in sources}:
            raise ValueError("Unknown source ID")
        sources = [s for s in sources if s["id"] in source_ids]
    now = datetime.now(timezone.utc)
    started = time.monotonic()
    progress = ({"imported_today": 0, "remaining_capacity": MAX_PER_RUN, "recent_urls": []}
                if check_sources else importer("GET", stats=True))
    if not isinstance(progress.get("imported_today"), int) or not isinstance(progress.get("remaining_capacity"), int):
        raise ValueError("Daily progress response invalid")
    daily_before = progress["imported_today"]
    run_limit = min(MAX_PER_RUN, max(0, DAILY_TARGET - daily_before), max(0, progress["remaining_capacity"]))
    day = now.astimezone(ZoneInfo("Europe/Istanbul")).date().isoformat()
    if not check_sources and run_limit == 0:
        record_summary({"day": day, "created_drafts": 0, "daily_total": daily_before,
                        "shortfall": max(0, DAILY_TARGET - daily_before), "failed": 0,
                        "reason": "target_reached" if daily_before >= DAILY_TARGET else "capacity_reached"})
        return 0
    created, duplicate, skipped, failed, candidates, ai_attempts = 0, 0, 0, 0, 0, 0
    known = set(progress.get("recent_urls", []))
    streams, failed = collect_sources(sources, known, now)
    seen = set(known)
    # Interleave sources, prioritize fresh grant/support announcements within a
    # round, and avoid spending AI quota on URLs already processed in another feed.
    for group in zip_longest(*streams):
        available = [entry for entry in group if entry is not None]
        def priority(entry):
            _, item = entry
            article = item.get("_article", {})
            heading = article.get("title", "").casefold()
            age_bucket = int((now - item["published"]).total_seconds() // 86400)
            support = any(term in heading for term in ("hibe", "destek", "ipard", "kırsal", "başvuru"))
            return (age_bucket, not support, -item["published"].timestamp())
        for entry in sorted(available, key=priority):
            source, item = entry
            candidates += 1
            if (not check_sources and (created >= run_limit or ai_attempts >= MAX_AI_ATTEMPTS_PER_RUN)) or time.monotonic() - started >= RUN_BUDGET_SECONDS:
                break
            if item["url"] in seen:
                duplicate += 1
                continue
            seen.add(item["url"])
            phase = "lookup"
            try:
                if not check_sources and importer("GET", source_url=item["url"])["imported"]:
                    duplicate += 1
                    continue
                try:
                    phase = "source"
                    article = read_article(source, item)
                    generated_cover = source.get("image_policy") == "generated-editorial-cover"
                    image = None if generated_cover else download(article["image"]["url"], source["image_prefix"], MAX_IMAGE, image=True)
                except ValueError as exc:
                    skipped += 1
                    print(json.dumps({"source": source["id"], "result": "skipped_unusable_text_or_unlicensed_photo",
                                      **failure_details("source", exc)}))
                    continue
                if check_sources:
                    print(json.dumps({"source": source["id"], "url": item["url"], "date": item["published"].isoformat(),
                                      "usable_original_photo": not generated_cover, "generated_editorial_cover": generated_cover,
                                      "image_bytes": len(image) if image else 0}))
                    continue
                phase = "ai"
                ai_attempts += 1
                rewritten = rewrite(article, source, item)
                payload = {**rewritten, "source_id": source["id"], "source_url": item["url"],
                           "source_published_at": item["published"].isoformat(), "ai_model": MODEL}
                if not generated_cover:
                    payload.update(original_image_url=article["image"]["url"], image_credit=article["image"]["credit"],
                                   image_base64=base64.b64encode(image).decode())
                phase = "import"
                result = importer("POST", payload)
                if result.get("created"):
                    created += 1
                else:
                    duplicate += 1
            except error.HTTPError as exc:
                # Do not log headers/provider bodies: they can contain credentials or private data.
                if phase != "source" and exc.code in {401, 402, 403, 404, 429}:
                    print(json.dumps({"source": source["id"], "result": "processing_stopped",
                                      **failure_details(phase, exc)}), file=sys.stderr)
                    print(f"STOP: authorization, model access or quota unavailable (HTTP {exc.code}); no paid fallback.", file=sys.stderr)
                    record_summary({"day": day, "created_drafts": created, "daily_total": daily_before + created,
                                    "shortfall": max(0, DAILY_TARGET - daily_before - created),
                                    "failed": failed + 1, "reason": "provider_or_importer_limit"})
                    return 1
                print(json.dumps({"source": source["id"], "result": "http_error",
                                  **failure_details(phase, exc)}), file=sys.stderr)
                failed += 1
            except (ValueError, KeyError, error.URLError, OSError) as exc:
                failed += 1
                print(json.dumps({"source": source["id"], "result": "processing_failed",
                                  **failure_details(phase, exc)}), file=sys.stderr)
        if (not check_sources and (created >= run_limit or ai_attempts >= MAX_AI_ATTEMPTS_PER_RUN)) or time.monotonic() - started >= RUN_BUDGET_SECONDS:
            break
    record_summary({"day": day, "created_drafts": created, "duplicates": duplicate, "skipped": skipped,
                    "failed": failed, "candidates": candidates, "check_sources_only": check_sources,
                    "ai_attempts": ai_attempts, "daily_total": daily_before + created,
                    "shortfall": max(0, DAILY_TARGET - daily_before - created)})
    return 1 if failed and (not candidates if check_sources else not created) else 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--check-sources", action="store_true", help="Public reads only; no AI or database writes")
    parser.add_argument("--source", action="append", help="Check selected allowlisted sources")
    args = parser.parse_args()
    try:
        sys.exit(run(args.check_sources, args.source))
    except (ValueError, KeyError, error.URLError, OSError) as exc:
        print(json.dumps({"result": "startup_failed", **failure_details("startup", exc)}), file=sys.stderr)
        print("STOP: automation configuration or source is unavailable; no publication was attempted.", file=sys.stderr)
        sys.exit(1)

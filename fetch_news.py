#!/usr/bin/env python3
"""GitHub Actions -> licensed source -> AI summary -> private editorial draft."""
import argparse
import base64
from datetime import datetime, timezone
from difflib import SequenceMatcher
from decimal import Decimal, InvalidOperation
import json
import os
from pathlib import Path
import re
import sys
import time
from urllib import request, parse, error

sys.path.insert(0, str(Path(__file__).parent / "scripts" / "news"))
from news_source import discover, read_article, download, MAX_IMAGE, NoRedirect  # noqa: E402

ROOT = Path(__file__).resolve().parent
ENDPOINT = "https://www.pazartarla.com.tr/api/gazette-import"
MODEL = "gemini-3.5-flash-lite"
AI_SECRET = "PAZARTARLA_NEWS_GEMINI_API_KEY"
GEMINI_ENDPOINT = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent"
MAX_PER_RUN = 3
AI_RETRY_DELAYS = (5, 10)
RETRYABLE_AI_STATUSES = frozenset({500, 502, 503, 504})
NUMBER_TOKEN = re.compile(r"\d+(?:[.,]\d+)*(?:[ \u00a0\u202f]\d{3}(?!\d))*")


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
    with request.build_opener(NoRedirect()).open(req, timeout=90) as response:
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


def importer(method, payload=None, source_url=None):
    # Refresh the five-minute token for each call; never persist or print it.
    url = ENDPOINT + ("?" + parse.urlencode({"source_url": source_url}) if source_url else "")
    return http_json(url, method, payload, {"Authorization": "Bearer " + oidc()})


def validate_rewrite(result, original):
    limits = {"title": (12, 160), "excerpt": (30, 400), "body": (200, 6000), "review_note": (1, 600)}
    if not isinstance(result, dict):
        raise ValueError("AI output must be an object")
    if set(result) != set(limits):
        raise ValueError("AI output has unexpected fields")
    for key, (minimum, maximum) in limits.items():
        value = result.get(key)
        if not isinstance(value, str) or not minimum <= len(value.strip()) <= maximum or re.search(r"[<>]|\x00|https?://", value):
            raise ValueError("AI output validation failed")
    # Reject near-verbatim text. This is only a guard, not a legal/SEO originality guarantee.
    left = re.sub(r"\W+", " ", original.casefold()).strip()
    right = re.sub(r"\W+", " ", result["body"].casefold()).strip()
    if SequenceMatcher(None, left, right, autojunk=False).ratio() > 0.7:
        raise ValueError("AI output too similar to source")
    # Numeric claims must already occur in the source; editorial review is still required.
    original_numbers = set(NUMBER_TOKEN.findall(original))
    original_values = {number_value(token, "en") for token in original_numbers}
    for token in NUMBER_TOKEN.findall(" ".join(result.values())):
        if token not in original_numbers and number_value(token, "tr") not in original_values:
            raise ValueError("AI added unsupported numbers")
    return {key: result[key].strip() for key in limits}


def rewrite(article, source, item):
    key = os.environ.get(AI_SECRET)
    if not key:
        raise ValueError("AI secret is not configured")
    prompt = (ROOT / "scripts/news/editorial-prompt.txt").read_text()
    content = {"source_name": source["name"], "source_url": item["url"],
               "original_published_at": item["published"].isoformat(),
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
                                    article["title"] + "\n" + article["body"])
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


def run(check_sources=False):
    if not check_sources:
        if not os.environ.get(AI_SECRET):
            raise ValueError("Gemini secret is not configured")
        if not os.environ.get("GITHUB_REPOSITORY") == "gezgiinci-beep/Pazartarla" or os.environ.get("GITHUB_REF") != "refs/heads/main":
            raise ValueError("Automation runs only on the trusted repository main branch")
    sources = json.loads((ROOT / "scripts/news/sources.json").read_text())["sources"]
    created, duplicate, skipped, failed, candidates = 0, 0, 0, 0, 0
    for source in sources:
        if not source.get("enabled"):
            continue
        for item in discover(source):
            candidates += 1
            if created >= MAX_PER_RUN:
                break
            try:
                if not check_sources and importer("GET", source_url=item["url"])["imported"]:
                    duplicate += 1
                    continue
                try:
                    article = read_article(source, item)
                    image = download(article["image"]["url"], source["image_prefix"], MAX_IMAGE, image=True)
                except ValueError:
                    skipped += 1
                    print(json.dumps({"source": source["id"], "result": "skipped_unusable_text_or_unlicensed_photo"}))
                    continue
                if check_sources:
                    print(json.dumps({"source": source["id"], "url": item["url"], "date": item["published"].isoformat(),
                                      "usable_original_photo": True, "image_bytes": len(image)}))
                    continue
                rewritten = rewrite(article, source, item)
                payload = {**rewritten, "source_id": source["id"], "source_url": item["url"],
                           "source_published_at": item["published"].isoformat(), "ai_model": MODEL,
                           "original_image_url": article["image"]["url"], "image_credit": article["image"]["credit"],
                           "image_base64": base64.b64encode(image).decode()}
                result = importer("POST", payload)
                if result.get("created"):
                    created += 1
                else:
                    duplicate += 1
            except error.HTTPError as exc:
                # Do not log headers/provider bodies: they can contain credentials or private data.
                if exc.code in {401, 402, 403, 404, 429}:
                    print(f"STOP: authorization, model access or quota unavailable (HTTP {exc.code}); no paid fallback.", file=sys.stderr)
                    return 1
                print(json.dumps({"source": source["id"], "result": "http_error", "status": exc.code}), file=sys.stderr)
                failed += 1
            except (ValueError, KeyError, error.URLError, OSError):
                failed += 1
                print(json.dumps({"source": source["id"], "result": "processing_failed"}), file=sys.stderr)
    print(json.dumps({"created_drafts": created, "duplicates": duplicate, "skipped": skipped,
                      "failed": failed, "candidates": candidates, "check_sources_only": check_sources}))
    return 1 if failed else 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--check-sources", action="store_true", help="Public reads only; no AI or database writes")
    args = parser.parse_args()
    try:
        sys.exit(run(args.check_sources))
    except (ValueError, KeyError, error.URLError, OSError):
        print("STOP: automation configuration or source is unavailable; no publication was attempted.", file=sys.stderr)
        sys.exit(1)

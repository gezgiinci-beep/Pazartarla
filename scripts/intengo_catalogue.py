"""Bounded anonymous catalogue search; never authentication, bidding or contact submission."""
import json
import re
import time
from datetime import datetime, timezone
from urllib.error import HTTPError
from urllib.parse import quote
from zoneinfo import ZoneInfo

HOST = "gayrimenkul.intengo.com"
SEARCH = "https://" + HOST + "/look-up/search"
COMPANIES = {"vakifbank": "vakifbank", "vakif_leasing": "vakifleasing"}


def search_page(bank_id, page, core):
    if bank_id not in COMPANIES or not isinstance(page, int) or not 0 <= page < 1000:
        raise core.SourceUnavailable("search_scope_invalid")
    if not core.robots_allowed({"host": HOST, "url": SEARCH}):
        raise core.SourceUnavailable("search_robots_disallowed")
    # This exact anonymous endpoint is the public site's read-only search API.
    # POST encodes a query only; it cannot authenticate, bid or send a contact form.
    body = {"company": COMPANIES[bank_id], "cityIdList": [], "townIdList": [],
            "quarterIdList": [], "categoryIdList": [], "subCategoryIdList": [],
            "minPrice": "", "maxPrice": "", "realEstateNo": "", "sortType": "ALL",
            "orderType": "DEFAULT", "limit": 50, "page": page}
    try:
        with core.build_opener(core.PublicRedirects(HOST)).open(core.Request(
            SEARCH, data=json.dumps(body).encode(), method="POST",
            headers={"User-Agent": core.USER_AGENT, "Content-Type": "application/json",
                     "Accept": "application/json"}), timeout=25) as response:
            if "json" not in response.headers.get("Content-Type", "").lower():
                raise core.SourceUnavailable("search_not_json")
            raw = response.read(core.MAX_BYTES + 1)
            if len(raw) > core.MAX_BYTES:
                raise core.SourceUnavailable("search_too_large")
            data = json.loads(raw).get("responseObject")
    except HTTPError as exc:
        raise core.SourceUnavailable(f"search_http_{exc.code}") from None
    if not isinstance(data, dict) or not isinstance(data.get("content"), list) or \
            not isinstance(data.get("totalPages"), int) or isinstance(data.get("totalPages"), bool) or \
            not 0 <= data["totalPages"] <= 1000 or len(data["content"]) > 50:
        raise core.SourceUnavailable("search_structure_changed")
    return data


def parse_rows(bank_id, items, core, now=None):
    now = now or datetime.now(timezone.utc)
    result = []
    for item in items:
        if not isinstance(item, dict) or item.get("companyName") != COMPANIES[bank_id]:
            continue
        title = item.get("realEstateName")
        if not isinstance(title, str) or len(title) > 200:
            continue
        folded = core.fold(title)
        if bank_id == "vakifbank" and not folded.startswith("vakifbank'tan"):
            continue
        if bank_id == "vakif_leasing" and not re.match(r"^vakif\s*leasing'(ten|den)\b", folded):
            continue
        kind = core.classify_asset(title)
        if not kind:
            continue
        end = item.get("bidEndingDate")
        if end:
            if not isinstance(end, str):
                continue
            try:
                ended = datetime.fromisoformat(end.replace("Z", "+00:00"))
                if ended.tzinfo is None:
                    ended = ended.replace(tzinfo=ZoneInfo("Europe/Istanbul"))
                if ended <= now:
                    continue
            except (TypeError, ValueError):
                continue
        slug, notice = item.get("realEstateNameForUrl"), str(item.get("noticeId", ""))
        if not isinstance(slug, str) or not re.fullmatch(r"\d{1,20}", notice):
            continue
        slug = quote(slug.lower().replace(" ", "-"), safe="-_")
        canonical = core.canonical_source(bank_id, f"/{COMPANIES[bank_id]}/ilan/{slug}-{notice}/")
        if not canonical:
            continue
        try:
            price = core.decimal_text(str(item.get("introductoryPrice", "")))
            if "." in price and len(price.split(".")[1]) > 2:
                continue
        except ValueError:
            continue
        if not isinstance(item.get("noTenderSale"), bool):
            continue  # Never infer fixed sale vs starting bid from an unspecified flag.
        area = None
        if kind in ("field", "vineyard", "orchard", "farm") and item.get("area") is not None:
            try:
                # JSON numbers are not Turkish thousands-separated strings.
                raw = str(item["area"])
                if isinstance(item["area"], (int, float)) and re.fullmatch(r"\d+(?:\.\d+)?", raw):
                    area = raw if float(raw) > 0 else None
                elif isinstance(item["area"], str):
                    area = core.decimal_text(raw)
            except ValueError:
                pass
        location = " / ".join(v.strip() for v in [
            item.get("cityName"), item.get("townName"), item.get("quarterName")
        ] if isinstance(v, str) and v.strip())[:200]
        result.append({"bank_id": bank_id, "external_id": canonical[0], "source_url": canonical[1],
            "title": title, "asset_kind": kind, "price": price, "currency": "TRY",
            "price_kind": "asking" if item["noTenderSale"] else "initial_bid",
            "location": location, "area_m2": area,
            "reference": str(item.get("realEstateNo") or "")[:80],
            "available": True, "observed_at": now.isoformat()})
    return list({r["external_id"]: r for r in result}.values())


def collect(bank_id, core, target=10, max_pages=8, now=None):
    now = now or datetime.now(timezone.utc)
    first = search_page(bank_id, 0, core)
    pages = first["totalPages"]
    rows = parse_rows(bank_id, first["content"], core, now)
    seen = {r["external_id"] for r in rows}
    # Always check new first-page records, then rotate bounded older pages.
    # This prevents repeatedly seeing only the first small set of listings.
    offset = int(now.timestamp() // (6 * 3600)) % max(1, pages)
    visited = {0}
    for n in range(pages):
        page = (offset + n) % max(1, pages)
        if page in visited:
            continue
        if len(visited) >= max_pages or len(rows) >= target * 4:
            break
        time.sleep(1)
        data = search_page(bank_id, page, core)
        visited.add(page)
        for row in parse_rows(bank_id, data["content"], core, now):
            if row["external_id"] not in seen:
                seen.add(row["external_id"])
                rows.append(row)
    return rows[:target * 4]

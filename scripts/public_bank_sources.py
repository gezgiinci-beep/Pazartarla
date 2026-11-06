"""Halkbank public read APIs and Ziraat's anonymous land-search form.

No login, bidding, contact submission, images or copied descriptions.
"""
import json
import re
import time
from datetime import datetime, timezone
from http.cookiejar import CookieJar
from urllib.request import HTTPCookieProcessor

HALK_HOST = "www.halkbankgayrimenkul.com.tr"
ZIRAAT_HOST = "e-satis.ziraatbank.com.tr"


def halk_read(endpoint, payload, core):
    # Only the bank's two publicly used read endpoints may receive a query.
    if endpoint not in ("ListeTumu", "Detay"):
        raise core.SourceUnavailable("halk_read_scope_invalid")
    url = f"https://{HALK_HOST}/IlanWeb/Ilan/{endpoint}"
    if not core.robots_allowed({"host": HALK_HOST, "url": url}):
        raise core.SourceUnavailable("robots_disallowed")
    with core.build_opener(core.PublicRedirects(HALK_HOST)).open(core.Request(
        url, data=json.dumps(payload).encode(), method="POST",
        headers={"User-Agent": core.USER_AGENT, "Content-Type": "application/json",
                 "Accept": "application/json"}), timeout=25) as response:
        if "json" not in response.headers.get("Content-Type", "").lower():
            raise core.SourceUnavailable("halk_not_json")
        raw = response.read(core.MAX_BYTES + 1)
        if len(raw) > core.MAX_BYTES:
            raise core.SourceUnavailable("halk_too_large")
        result = json.loads(raw)
    if str(result.get("statusCode")) != "0" or not isinstance(result.get("data"), dict):
        raise core.SourceUnavailable("halk_structure_changed")
    return result["data"]


def halk_record(row, detail, core, now=None):
    if not isinstance(row, dict) or row.get("tip") != 1 or not isinstance(detail, dict):
        return None  # Excludes the separately branded GYO inventory.
    external = str(row.get("seriNo", ""))
    if not re.fullmatch(r"\d{1,20}", external) or str(detail.get("seriNo")) != external:
        return None
    title = detail.get("baslik")
    if not isinstance(title, str) or not title.strip() or len(title.strip()) > 200:
        return None
    if core.fold(title.strip()) != core.fold(str(row.get("baslik", "")).strip()):
        return None
    kind = core.classify_asset(title, str(row.get("emlakTipAd", "")))
    if not kind:
        return None
    end = detail.get("ihaleBitisTarihi") or row.get("ihaleBitisTarihi")
    if end:
        from zoneinfo import ZoneInfo
        try:
            date = datetime.fromisoformat(str(end).replace("Z", "+00:00"))
            if date.tzinfo is None:
                date = date.replace(tzinfo=ZoneInfo("Europe/Istanbul"))
            if date <= (now or datetime.now(timezone.utc)):
                return None
        except ValueError:
            return None
    # The official field is a starting price, not proof of a fixed sale price.
    try:
        price = str(detail.get("baslangicFiyati", ""))
        if not re.fullmatch(r"\d{1,13}(?:\.\d{1,2})?", price) or float(price) <= 0:
            return None
    except (TypeError, ValueError):
        return None
    area = None
    if kind in ("field", "vineyard", "orchard", "farm"):
        try:
            area = core.decimal_text(str(detail.get("mevcutKullanimAlani", "")))
        except ValueError:
            pass
    location = " / ".join(v.strip() for v in [
        row.get("il"), row.get("ilce"), detail.get("mahalleKoy")
    ] if isinstance(v, str) and v.strip())[:200]
    parcel = " / ".join(str(detail.get(k)).strip() for k in ("ada", "parsel")
                        if detail.get(k) is not None)[:100]
    return {"bank_id": "halkbank", "external_id": external,
        "source_url": f"https://{HALK_HOST}/ilan-detay/{external}",
        "title": title.strip(), "asset_kind": kind, "price": price,
        "price_kind": "initial_bid", "currency": "TRY", "location": location,
        "area_m2": area, "parcel": parcel, "reference": external,
        "contact_phone": core.normalize_contact_phone(str(detail.get("ilgiliSubeTelefon") or "")),
        "available": True, "observed_at": (now or datetime.now(timezone.utc)).isoformat()}


def collect_halk(core, target=10, max_pages=6):
    result, seen = [], set()
    for page in range(1, max_pages + 1):
        data = halk_read("ListeTumu", {"page": page, "sort": 1, "tab": 0, "limit": 50}, core)
        rows = data.get("list")
        if not isinstance(rows, list) or len(rows) > 50:
            raise core.SourceUnavailable("halk_catalogue_changed")
        for row in rows:
            if not isinstance(row, dict) or row.get("tip") != 1 or not core.classify_asset(
                str(row.get("baslik", "")), str(row.get("emlakTipAd", ""))):
                continue
            external = str(row.get("seriNo", ""))
            if not re.fullmatch(r"\d{1,20}", external) or external in seen:
                continue
            seen.add(external)
            time.sleep(1)
            detail = halk_read("Detay", {"seriNo": int(external)}, core).get("detay")
            value = halk_record(row, detail, core)
            if value:
                result.append(value)
            if len(result) >= target * 2:
                return result
        if len(rows) < 50:
            break
        time.sleep(1)
    return result


def collect_ziraat(core):
    url = f"https://{ZIRAAT_HOST}/gm-index.intengo"
    if not core.robots_allowed({"host": ZIRAAT_HOST, "url": url}):
        raise core.SourceUnavailable("robots_disallowed")
    # Ephemeral anonymous cookies/ViewState are required by the public search.
    # They are never persisted, logged or copied into saved listing URLs.
    opener = core.build_opener(core.PublicRedirects(ZIRAAT_HOST), HTTPCookieProcessor(CookieJar()))
    def read(request):
        with opener.open(request, timeout=25) as response:
            if "html" not in response.headers.get("Content-Type", "").lower():
                raise core.SourceUnavailable("ziraat_not_html")
            raw = response.read(core.MAX_BYTES + 1)
            if len(raw) > core.MAX_BYTES:
                raise core.SourceUnavailable("ziraat_too_large")
            return raw.decode("utf-8", "replace")
    html = read(core.Request(url, headers={"User-Agent": core.USER_AGENT}))
    root = core.Tree(html).root
    form = root.first(lambda n: n.tag == "form" and n.attrs.get("id") == "searchForm")
    if not form:
        raise core.SourceUnavailable("ziraat_search_changed")
    state = form.first(lambda n: n.attrs.get("name") == "javax.faces.ViewState")
    button = form.first(lambda n: n.tag == "input" and n.attrs.get("type") == "submit"
                        and n.attrs.get("value") == "Ara")
    action = form.attrs.get("action", "")
    if not state or not button or not re.fullmatch(r"searchForm:j_id\d+", button.attrs.get("name", "")) or \
            not re.fullmatch(r"/gm-index\.intengo(?:;jsessionid=[A-Fa-f0-9]+)?", action):
        raise core.SourceUnavailable("ziraat_search_changed")
    category = form.first(lambda n: n.tag == "select" and n.attrs.get("name") == "searchForm:search-category")
    if not category or not category.first(lambda n: n.tag == "option" and
            n.attrs.get("value") == "2" and core.fold(n.text()) == "arsa"):
        raise core.SourceUnavailable("ziraat_category_changed")
    payload = {"searchForm": "searchForm", "javax.faces.ViewState": state.attrs.get("value", ""),
        "searchForm:search-category": "2", button.attrs["name"]: "Ara"}
    html = read(core.Request(f"https://{ZIRAAT_HOST}" + action,
        data=core.urlencode(payload).encode(), method="POST",
        headers={"User-Agent": core.USER_AGENT, "Content-Type": "application/x-www-form-urlencoded"}))
    rows = core.parse_catalogue("ziraat", html)
    return rows

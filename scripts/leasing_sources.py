"""Official leasing directories, sharing the importer's bounded public reader.

No site scripts, sign-in, bidding, media download or company impersonation.
The core helper module is injected to keep source parsing separately testable.
"""
import re
import unicodedata
from datetime import datetime, timezone
from hashlib import sha256

MONEY = r"(\d[\d.,]*(?:[eE][+-]?\d+)?)\s*(TRY|TL|EUR|USD|€)(?![A-Za-z])"


def money(text, core, initial=False):
    pattern = r"Başlangıç\s*Bedeli\s*:?\s*" + MONEY if initial else MONEY
    matches = re.findall(pattern, text, re.I)
    values = set()
    for amount, unit in matches:
        value = core.decimal_text(amount)
        if len(value.split(".")[-1]) > 2 and "." in value:
            raise ValueError("price_precision")
        values.add((value, {"TL": "TRY", "€": "EUR"}.get(unit.upper(), unit.upper())))
    if len(values) != 1:
        return None, None, "unknown"
    amount, currency = next(iter(values))
    return amount, currency, "initial_bid" if initial else "asking"


def tax_note(text, core):
    value = core.fold(text)
    included = bool(re.search(r"\bkdv\s+dahil\b", value))
    excluded = bool(re.search(r"\bkdv\s+haric\b", value))
    if included and not excluded:
        return "KDV dahil"
    if excluded and not included:
        return "KDV hariç"
    return ""


def verified_vakif_detail(canonical, expected_kind, source, core):
    detail_scope = {"host": source["detail_host"], "url": canonical[1]}
    if not core.robots_allowed(detail_scope):
        raise core.SourceUnavailable("detail_robots_disallowed")
    html, content_type = core.public_read(canonical[1], source["detail_host"])
    if "text/html" not in content_type.lower():
        raise core.SourceUnavailable("detail_not_html")
    detail = core.Tree(html).root
    heading = detail.first(lambda n: n.tag == "h1")
    if not heading or not re.match(r"^vakif\s*leasing'(ten|den)\b", core.fold(heading.text())):
        raise core.SourceUnavailable("detail_seller_mismatch")
    if core.classify_asset(heading.text()) != expected_kind:
        raise core.SourceUnavailable("detail_asset_changed")
    # Intengo also uses real-estate placeholders (including m²) for machines.
    # Do not turn those placeholders into agricultural/property facts.
    return draft("vakif_leasing", heading.text(), canonical, core, detail.text())


def draft(source_id, title, canonical, core, price_text="", reference="", location=""):
    kind = core.classify_asset(title)
    if not kind:
        return None
    if re.search(r"\b(satildi|satisi tamamlandi|ihale sona erdi|ihalesi sona erdi)\b", core.fold(price_text)):
        return None
    initial = "baslangic bedeli" in core.fold(price_text)
    amount, currency, price_kind = money(price_text, core, initial)
    return {
        "bank_id": source_id, "external_id": canonical[0], "source_url": canonical[1],
        "title": " ".join(title.split())[:200], "asset_kind": kind,
        "price": amount, "price_kind": price_kind, "currency": currency,
        "location": location[:200], "area_m2": None, "reference": reference[:80],
        "tax_note": tax_note(price_text, core),
        "available": True, "observed_at": datetime.now(timezone.utc).isoformat(),
    }


def parse_halk(root, core):
    candidates = {}
    structure_seen = False
    for anchor in root.nodes():
        if anchor.tag != "a" or not anchor.text() or core.fold(anchor.text()) == "incele":
            continue
        canonical = core.canonical_source("halk_leasing", anchor.attrs.get("href", ""))
        if not canonical:
            continue
        structure_seen = True
        if not core.classify_asset(anchor.text()):
            continue
        tile = anchor.parent
        while tile:
            links = {core.canonical_source("halk_leasing", n.attrs.get("href", ""))[1]
                     for n in tile.nodes() if n.tag == "a" and
                     core.canonical_source("halk_leasing", n.attrs.get("href", ""))}
            if len(links) != 1:
                break
            if tile.has_class("cmp-teaser") or re.search(MONEY, tile.text(), re.I):
                break
            tile = tile.parent
        # Never take the next card's price or the whole directory's prices.
        price_text = tile.text() if tile and len(links) == 1 else ""
        value = draft("halk_leasing", anchor.text(), canonical, core, price_text)
        if value:
            candidates[canonical[0]] = value
    if not structure_seen:
        raise core.SourceUnavailable("catalogue_structure_changed")
    return list(candidates.values())


def parse_ziraat(root, core):
    candidates, warnings = [], []
    tables = [n for n in root.nodes() if n.tag == "table"]
    structure_seen = False
    for table in tables:
        fields = {}
        for row in table.nodes():
            if row.tag != "tr":
                continue
            cells = [n for n in row.children if getattr(n, "tag", "") in ("td", "th")]
            if len(cells) == 2:
                fields[core.fold(cells[0].text()).strip(" :")] = cells[1].text()
        title = fields.get("makine cinsi", "")
        if not title:
            continue
        structure_seen = True
        if not core.classify_asset(title):
            continue
        stable = next(((key, fields[key]) for key in (
            "sasi/seri no", "sasi no", "seri no", "makine seri no", "stok no", "ilan no"
        ) if fields.get(key)), None)
        if not stable:
            warnings.append("agricultural_asset_missing_stable_id")
            continue
        reference = stable[0] + ": " + stable[1]
        if len(reference) > 80:
            warnings.append("asset_reference_too_long")
            continue
        identity = re.sub(r"\s+", "", unicodedata.normalize("NFKC", reference)).upper()
        source_id = sha256(identity.encode()).hexdigest()[:24]
        canonical = (source_id, core.SOURCES["ziraat_leasing"]["url"])
        value = draft("ziraat_leasing", title, canonical, core, fields.get("fiyat", ""), reference)
        if value:
            candidates.append(value)
    if not structure_seen:
        raise core.SourceUnavailable("catalogue_structure_changed")
    return list({v["external_id"]: v for v in candidates}.values()), warnings


def collect_leasing(source_id, source, core, limit=12):
    records, warnings = [], []
    for url in [source["url"], *source.get("additional_urls", [])]:
        scope = {**source, "url": url}
        if not core.robots_allowed(scope):
            raise core.SourceUnavailable("robots_disallowed")
        html, content_type = core.public_read(url, source["host"])
        if "text/html" not in content_type.lower():
            raise core.SourceUnavailable("not_html")
        root = core.Tree(html).root
        if source_id == "halk_leasing":
            records.extend(parse_halk(root, core))
        elif source_id == "ziraat_leasing":
            rows, notes = parse_ziraat(root, core)
            records.extend(rows)
            warnings.extend(notes)
        elif source_id == "vakif_leasing":
            if source.get("format") == "intengo":
                candidates = core.parse_catalogue(source_id, html)
                for candidate in candidates[:limit]:
                    canonical = (candidate["external_id"], candidate["source_url"])
                    value = verified_vakif_detail(canonical, candidate["asset_kind"], source, core)
                    if value:
                        records.append(value)
                continue
            tables_seen = False
            for row in root.nodes():
                if row.tag != "tr":
                    continue
                cells = [n for n in row.children if getattr(n, "tag", "") == "td"]
                if len(cells) < 3:
                    continue
                link = row.first(lambda n: n.tag == "a" and bool(core.canonical_source(source_id, n.attrs.get("href", ""))))
                if not link:
                    continue
                tables_seen = True
                if not core.classify_asset(cells[1].text()):
                    continue
                canonical = core.canonical_source(source_id, link.attrs["href"])
                if len(records) >= limit:
                    break
                value = verified_vakif_detail(canonical, core.classify_asset(cells[1].text()), source, core)
                if value:
                    records.append(value)
            if not tables_seen:
                raise core.SourceUnavailable("catalogue_structure_changed")
        else:
            raise core.SourceUnavailable("adapter_not_verified")
    return list({v["external_id"]: v for v in records}.values()), warnings

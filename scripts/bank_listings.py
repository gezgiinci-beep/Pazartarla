"""Minimal factual bank-sale discovery; no photographs, descriptions or auto-publishing.

Only public, anonymous catalogue pages are read. Authentication, bidding, CAPTCHA
and contact-form endpoints are deliberately unsupported.
"""
import argparse
import json
import re
import sys
import time
import unicodedata
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from html.parser import HTMLParser
from hashlib import sha256
from urllib.error import HTTPError
from urllib.parse import parse_qs, urlencode, urljoin, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener
from urllib.robotparser import RobotFileParser

USER_AGENT = "PazarTarlaBankImporter/1.0"
MAX_BYTES = 2_000_000
SOURCES = {
    "ziraat": {
        "url": "https://e-satis.ziraatbank.com.tr/gm-index.intengo?activeTab=newAdditions",
        "host": "e-satis.ziraatbank.com.tr",
    },
    "vakifbank": {
        "url": "https://gayrimenkul.intengo.com/vakifbank",
        "host": "gayrimenkul.intengo.com",
    },
    # The public site currently returns an application shell, not a verified
    # catalogue feed. Never treat HTML from its JSON-looking routes as JSON.
    "halkbank": {
        "url": "https://www.halkbankgayrimenkul.com.tr/",
        "host": "www.halkbankgayrimenkul.com.tr",
        "paused": "public_feed_not_verified",
    },
    "vakif_leasing": {
        # Directly linked by the company's official sale page. Its own site
        # currently has an incomplete TLS chain for this runner: do NOT disable TLS.
        "url": "https://gayrimenkul.intengo.com/vakifleasing",
        "host": "gayrimenkul.intengo.com",
        "detail_host": "gayrimenkul.intengo.com",
        "detail_prefix": "/vakifleasing/ilan/",
        "official_directory_url": "https://www.vakifleasing.com.tr/tr-TR/satis-ilanlari/627869",
        "format": "intengo",
        "adapter": "leasing",
    },
    "halk_leasing": {
        "url": "https://www.halkleasing.com.tr/tr/ikinci-el-satis/makine-ekipman.html",
        "host": "www.halkleasing.com.tr",
        "additional_urls": [
            "https://www.halkleasing.com.tr/tr/ikinci-el-satis/tasitlar.html",
            "https://www.halkleasing.com.tr/tr/ikinci-el-satis/gayrimenkul.html",
        ],
        "adapter": "leasing",
    },
    "ziraat_leasing": {
        "url": "https://www.ziraatleasing.com.tr/ikinci-el-satis",
        "host": "www.ziraatleasing.com.tr",
        "adapter": "leasing",
    },
}
_ROBOTS_CACHE = {}


class SourceUnavailable(Exception):
    pass


def fold(value):
    value = value.replace("ı", "i").replace("İ", "I").replace("’", "'")
    return "".join(c for c in unicodedata.normalize("NFKD", value)
                   if not unicodedata.combining(c)).lower()


def classify_asset(title, property_type=""):
    """Do not infer agricultural use from an address or generic 'arsa/makine'."""
    title = fold(title)
    kind = fold(property_type)
    title = re.sub(r"\b(?:ciftlik|tarla|bag|bahce)\s+(?:mahallesi|mah\.?|mh\.?|sokagi|sokak|sok\.?)\b",
                   "adres", title)
    value = kind + " " + title
    if re.search(r"\b(ciftlik|ciftligi|besihane|hayvancilik tesisi|sut uretim tesisi|tavuk ciftligi)\b", value):
        return "farm"
    if re.search(r"\b(apartman|daire|villa|mesken|konut|dukkan|enjeksiyon|torna)\b", value):
        return None
    if re.search(r"\btraktor\b", value):
        return "tractor"
    if re.search(r"\b(bicerdover|tarim makinesi|tarim makinasi|balya makinesi|ekim makinesi|"
                 r"tarimsal ekipman|tarim romorku|silaj makinesi|pulluk|mibzer)\b", value):
        return "agricultural_machine"
    if re.search(r"\btarla\b", value):
        return "field"
    if re.search(r"\bbag(?:i)?\b", value):
        return "vineyard"
    if re.search(r"\bbahce(?:si)?\b", value):
        return "orchard"
    return None


def decimal_text(value):
    value = value.strip().replace(" ", "").replace("\xa0", "")
    if not re.fullmatch(r"\d[\d.,]*(?:[eE][+-]?\d+)?", value):
        raise ValueError("invalid_number")
    if "," in value:
        value = value.replace(".", "").replace(",", ".")
    elif re.fullmatch(r"\d{1,3}(?:\.\d{3})+", value):
        value = value.replace(".", "")
    try:
        number = Decimal(value)
    except InvalidOperation as exc:
        raise ValueError("invalid_number") from exc
    if not number.is_finite() or number <= 0 or number > Decimal("1000000000000"):
        raise ValueError("invalid_number")
    return format(number, "f")


class Node:
    def __init__(self, tag="", attrs=None, parent=None):
        self.tag, self.attrs, self.parent = tag, dict(attrs or []), parent
        self.children = []

    def nodes(self):
        yield self
        for child in self.children:
            if isinstance(child, Node):
                yield from child.nodes()

    def text(self):
        if self.tag in ("script", "style", "noscript"):
            return ""
        return " ".join(x.text() if isinstance(x, Node) else x for x in self.children).strip()

    def has_class(self, name):
        return name in self.attrs.get("class", "").split()

    def first(self, predicate):
        return next((x for x in self.nodes() if predicate(x)), None)


class Tree(HTMLParser):
    VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}

    def __init__(self, html):
        super().__init__(convert_charrefs=True)
        self.root = Node()
        self.current = self.root
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        node = Node(tag, attrs, self.current)
        self.current.children.append(node)
        if tag not in self.VOID:
            self.current = node

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in self.VOID:
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        node = self.current
        while node.parent is not None:
            if node.tag == tag:
                self.current = node.parent
                return
            node = node.parent

    def handle_data(self, data):
        self.current.children.append(data.strip())


class PublicRedirects(HTTPRedirectHandler):
    def __init__(self, host):
        self.host = host

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        u = urlsplit(newurl)
        if u.scheme != "https" or u.hostname != self.host or u.username or u.password or u.port:
            raise SourceUnavailable("redirect_not_allowed")
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def public_read(url, host):
    u = urlsplit(url)
    if u.scheme != "https" or u.hostname != host or u.username or u.password or u.port:
        raise SourceUnavailable("source_not_allowed")
    try:
        with build_opener(PublicRedirects(host)).open(
            Request(url, headers={"User-Agent": USER_AGENT, "Accept": "text/html,text/plain"}),
            timeout=25,
        ) as response:
            content_type = response.headers.get("Content-Type", "")
            data = response.read(MAX_BYTES + 1)
            if len(data) > MAX_BYTES:
                raise SourceUnavailable("response_too_large")
            charset = response.headers.get_content_charset() or "utf-8"
            if re.search(br'charset\s*=\s*["\']?utf-8', data[:2000], re.I):
                charset = "utf-8"
            html = data.decode(charset, "replace")
            if re.search(r"<title>[^<]*(?:captcha|just a moment|access denied)", html, re.I):
                raise SourceUnavailable("access_protected")
            return html, content_type
    except HTTPError as exc:
        raise SourceUnavailable(f"http_{exc.code}") from None


def robots_allowed(source):
    if source["host"] not in _ROBOTS_CACHE:
        robots_url = "https://" + source["host"] + "/robots.txt"
        try:
            content, _ = public_read(robots_url, source["host"])
        except SourceUnavailable as exc:
            if str(exc) not in ("http_404", "http_410"):
                raise
            content = "User-agent: *\nAllow: /"
        rules = RobotFileParser()
        rules.parse(content.splitlines())
        _ROBOTS_CACHE[source["host"]] = rules
    rules = _ROBOTS_CACHE[source["host"]]
    delay = rules.crawl_delay(USER_AGENT) or rules.crawl_delay("*")
    if delay and delay > 60:
        raise SourceUnavailable("crawl_delay_requires_slow_runner")
    if delay:
        time.sleep(delay)
    return rules.can_fetch(USER_AGENT, source["url"])


def canonical_source(bank_id, href):
    source = SOURCES[bank_id]
    host = source.get("detail_host", source["host"])
    base = "https://" + host + "/" if source.get("detail_host") else source["url"]
    u = urlsplit(urljoin(base, href))
    if u.scheme != "https" or u.hostname != host or u.username or u.password or u.port or u.fragment:
        return None
    if bank_id == "ziraat":
        # Strip anonymous session identifiers and tracking before saving/logging.
        if u.path.split(";")[0] != "/gm-details.intengo":
            return None
        value = parse_qs(u.query).get("gayrimenkulId", [""])[0]
        if not value.isdigit():
            return None
        return value, f"https://{source['host']}/gm-details.intengo?" + urlencode({"gayrimenkulId": value})
    if bank_id in ("vakifbank", "vakif_leasing"):
        prefix = source.get("detail_prefix", "/vakifbank/ilan/")
        match = re.fullmatch(re.escape(prefix) + r"[A-Za-z0-9%_-]+-(\d+)/?", u.path)
        if match and not u.query:
            return match.group(1), f"https://{host}{u.path}"
    if bank_id == "halk_leasing" and not u.query:
        if re.fullmatch(r"/tr/ikinci-el-satis/(makine-ekipman|tasitlar|gayrimenkul)/[A-Za-z0-9_-]+\.html", u.path):
            return sha256(u.path.encode()).hexdigest()[:24], f"https://{host}{u.path}"
    return None


def parse_catalogue(bank_id, html, now=None):
    root = Tree(html).root
    records = []
    if bank_id == "ziraat":
        tiles = [x for x in root.nodes() if x.has_class("residence-item")]
    elif bank_id in ("vakifbank", "vakif_leasing"):
        tiles = []
        for anchor in root.nodes():
            if anchor.tag != "a" or not anchor.attrs.get("id", "").startswith("realEstateName"):
                continue
            tile = anchor.parent
            while tile and not tile.first(lambda n: n.has_class("priceMask")):
                tile = tile.parent
            if tile and len([n for n in tile.nodes() if n.attrs.get("id", "").startswith("realEstateName")]) == 1:
                tiles.append(tile)
    else:
        raise SourceUnavailable("adapter_not_verified")
    if not tiles:
        raise SourceUnavailable("catalogue_structure_changed")
    for tile in tiles:
        if bank_id == "ziraat":
            anchor = tile.first(lambda n: n.tag == "a" and n.has_class("title") and bool(n.text()))
        else:
            anchor = tile.first(lambda n: n.tag == "a" and n.attrs.get("id", "").startswith("realEstateName"))
        if not anchor:
            continue
        title = " ".join(anchor.text().split())
        if bank_id == "vakifbank" and not fold(title).startswith("vakifbank'tan"):
            continue  # A bank-branded portal can also contain OTHER sellers.
        if bank_id == "vakif_leasing" and not re.match(r"^vakif\s*leasing'(ten|den)\b", fold(title)):
            continue
        canonical = canonical_source(bank_id, anchor.attrs.get("href", ""))
        if not canonical:
            continue
        source_text = " ".join(tile.text().split())
        if re.search(r"ihale(?:si)? sona erdi|satildi|satisi tamamlandi|suresi doldu", fold(source_text)):
            continue
        type_node = tile.first(lambda n: n.has_class("type"))
        kind = classify_asset(title, type_node.text() if type_node else "")
        if not kind:
            continue
        price, price_kind = None, "unknown"
        price_node = tile.first(lambda n: n.has_class("priceMask"))
        price_match = re.search(r"([\d.,]+)\s*TL\s*Başlangıç Bedeli", source_text, re.I)
        if "baslangic bedeli" in fold(source_text):
            raw = price_node.text() if price_node else price_match.group(1) if price_match else None
            if raw:
                try:
                    price = decimal_text(raw)
                    if Decimal(price).as_tuple().exponent < -2:
                        raise ValueError("price_precision")
                    price_kind = "initial_bid"
                except ValueError:
                    continue
        area = None
        area_match = re.search(r"(\d[\d.,]*)\s*m[²2]\b", source_text)
        if area_match:
            try:
                area = decimal_text(area_match.group(1))
            except ValueError:
                continue
        location_node = tile.first(lambda n: n.has_class("city") or n.attrs.get("id", "").startswith("realEstateLocation"))
        reference_match = re.search(r"(?:G\.\s*No:|No:)\s*([A-Za-z0-9-]+)", source_text)
        records.append({
            "bank_id": bank_id, "external_id": canonical[0], "source_url": canonical[1],
            "title": title[:200], "asset_kind": kind, "price": price, "price_kind": price_kind,
            "currency": "TRY", "location": location_node.text()[:200] if location_node else "",
            "area_m2": area, "reference": reference_match.group(1) if reference_match else "",
            "available": True, "observed_at": (now or datetime.now(timezone.utc)).isoformat(),
        })
    return list({item["external_id"]: item for item in records}.values())


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--bank", choices=list(SOURCES))
    parser.add_argument("--max-items", type=int, default=12)
    args = parser.parse_args()
    if not 1 <= args.max_items <= 30:
        parser.error("--max-items must be between 1 and 30")
    from os import environ
    summary = {"candidates": 0, "accepted": 0, "unavailable_sources": [],
               "source_warnings": [], "source_candidates": {}, "dry_run": args.dry_run}
    token = None
    queues = []
    for bank_id in ([args.bank] if args.bank else SOURCES):
        source = SOURCES[bank_id]
        try:
            if source.get("paused"):
                raise SourceUnavailable(source["paused"])
            if source.get("adapter") == "leasing":
                from leasing_sources import collect_leasing
                drafts, warnings = collect_leasing(bank_id, source, sys.modules[__name__], args.max_items)
                summary["source_warnings"].extend({"source": bank_id, "reason": w} for w in warnings)
            else:
                if not robots_allowed(source):
                    raise SourceUnavailable("robots_disallowed")
                html, content_type = public_read(source["url"], source["host"])
                if "text/html" not in content_type.lower():
                    raise SourceUnavailable("not_html")
                drafts = parse_catalogue(bank_id, html)
            summary["candidates"] += len(drafts)
            summary["source_candidates"][bank_id] = len(drafts)
            queues.append(iter(drafts))
            time.sleep(1)
        except Exception as exc:
            reason = str(exc) if isinstance(exc, SourceUnavailable) else type(exc).__name__
            summary["unavailable_sources"].append({"bank": bank_id, "reason": reason})
    # Round robin: a full bank catalogue must not starve the leasing sources.
    while queues and summary["accepted"] < args.max_items:
        remaining = []
        for queue in queues:
            draft = next(queue, None)
            if draft is None:
                continue
            if summary["accepted"] >= args.max_items:
                break
            if not args.dry_run:
                if token is None:
                    token = oidc_token(environ)
                import_draft(draft, token)
            summary["accepted"] += 1
            remaining.append(queue)
        queues = remaining
    print(json.dumps(summary, ensure_ascii=False))
    if len(summary["unavailable_sources"]) == (1 if args.bank else len(SOURCES)):
        return 1
    return 0


def oidc_token(environ):
    base = environ.get("ACTIONS_ID_TOKEN_REQUEST_URL", "")
    request_token = environ.get("ACTIONS_ID_TOKEN_REQUEST_TOKEN", "")
    u = urlsplit(base)
    if u.scheme != "https" or not u.hostname or not (
        u.hostname.endswith(".actions.githubusercontent.com") or
        u.hostname.endswith(".actions.githubusercontent.com.")
    ) or not request_token:
        raise SourceUnavailable("github_identity_unavailable")
    url = base + ("&" if u.query else "?") + urlencode({
        "audience": "https://www.pazartarla.com.tr/api/bank-listings",
    })
    with build_opener(PublicRedirects(u.hostname)).open(
        Request(url, headers={"Authorization": f"Bearer {request_token}"}), timeout=20,
    ) as response:
        data = json.loads(response.read(32_000))
    value = data.get("value", "")
    if not re.fullmatch(r"[A-Za-z0-9_.-]{100,16000}", value):
        raise SourceUnavailable("github_identity_invalid")
    return value


def import_draft(draft, token):
    url = "https://www.pazartarla.com.tr/api/bank-listings"
    payload = json.dumps({"action": "import", "draft": draft}).encode("utf-8")
    # No blind retry for a possibly committed POST. Stable source IDs make the
    # next scheduled run idempotent without issuing duplicate writes now.
    with build_opener(PublicRedirects("www.pazartarla.com.tr")).open(
        Request(url, data=payload, method="POST", headers={
            "Authorization": f"Bearer {token}", "Content-Type": "application/json",
        }), timeout=30,
    ) as response:
        result = json.loads(response.read(16_000))
        if result.get("status") not in ("draft", "rejected", "transferred"):
            raise SourceUnavailable("unexpected_import_response")


if __name__ == "__main__":
    sys.exit(main())

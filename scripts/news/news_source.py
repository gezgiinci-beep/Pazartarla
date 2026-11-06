"""Bounded, allowlisted public-source reader. Never follows an off-site redirect."""
from datetime import datetime, timezone
from html.parser import HTMLParser
import ipaddress
import re
import socket
from urllib import request, parse, error

MAX_HTML = 2_000_000
MAX_IMAGE = 1_400_000  # Base64 + JSON stays below the API's existing 2 MiB limit.


def safe_url(url, prefix):
    parts = parse.urlsplit(url)
    if (not url.startswith(prefix) or parts.scheme != "https" or parts.username
            or parts.password or parts.port or parts.query or parts.fragment
            or re.search(r"%2f|%5c|%2e", url, re.I)):
        raise ValueError("Source URL rejected")
    return url


class NoRedirect(request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise ValueError("Source redirect rejected")


def download(url, allowed_prefix, limit=MAX_HTML, image=False, archive_year=None, feed_xml=False):
    if archive_year is not None:
        if url != f"https://www.ars.usda.gov/news-events/news-archive/?year={archive_year}" or not 2000 <= archive_year <= 2100:
            raise ValueError("Archive query rejected")
        safe_url(url.split("?", 1)[0], allowed_prefix)
    else:
        safe_url(url, allowed_prefix)
    host = parse.urlsplit(url).hostname
    for record in socket.getaddrinfo(host, 443, type=socket.SOCK_STREAM):
        if not ipaddress.ip_address(record[4][0]).is_global:
            raise ValueError("Non-public source address rejected")
    req = request.Request(url, headers={"User-Agent": "PazarTarlaGazete/1.0 (editorial-draft-reader)"})
    with request.build_opener(NoRedirect()).open(req, timeout=30) as response:
        mime = response.headers.get_content_type()
        allowed = {"image/jpeg", "image/png", "image/webp"} if image else {"text/html"}
        if feed_xml and not image:
            allowed = {"application/rss+xml", "application/xml", "text/xml"}
        if mime not in allowed:
            raise ValueError("Source content type rejected")
        data = response.read(limit + 1)
        if len(data) > limit:
            raise ValueError("Source response too large")
        return data


class ArchiveParser(HTMLParser):
    def __init__(self, source, year):
        super().__init__(convert_charrefs=True)
        self.source, self.year, self.rows = source, year, []
        self.row, self.links = None, []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "tr":
            self.row, self.links = [], []
        if self.row is not None and tag == "a":
            href = parse.urljoin(self.source["article_prefix"], attrs.get("href", ""))
            if href.startswith(self.source["article_prefix"]):
                self.links.append(href)

    def handle_data(self, text):
        if self.row is not None:
            self.row.append(text)

    def handle_endtag(self, tag):
        if tag == "tr" and self.row is not None:
            line = " ".join(self.row)
            match = re.search(r"\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})\b", line)
            if match:
                date = datetime.strptime(f"{match[1]} {match[2]} {self.year}", "%B %d %Y").replace(tzinfo=timezone.utc)
                for url in self.links:
                    self.rows.append({"url": url, "published": date})
            self.row = None


class ArticleParser(HTMLParser):
    def __init__(self, source):
        super().__init__(convert_charrefs=True)
        self.source = source
        self.inside, self.skip = False, 0
        self.current, self.image, self.heading = None, None, None
        self.title, self.paragraphs, self.images = "", [], []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "main" and attrs.get("id") == "main-content":
            self.inside = True
        if not self.inside:
            return
        if tag in {"script", "style"}:
            self.skip += 1
        if tag == "h2" and not self.title:
            self.heading = []
        if tag == "p":
            self.current, self.image = [], None
        if tag == "img" and self.current is not None:
            raw = parse.urljoin(self.source["article_prefix"], attrs.get("src", ""))
            parts = parse.urlsplit(raw)
            self.image = parse.urlunsplit(parts._replace(path=parse.quote(parse.unquote(parts.path), safe="/().-_~")))

    def handle_data(self, text):
        if self.inside and not self.skip:
            if self.heading is not None:
                self.heading.append(text)
            if self.current is not None:
                self.current.append(text)

    def handle_endtag(self, tag):
        if tag in {"script", "style"} and self.skip:
            self.skip -= 1
        if tag == "h2" and self.heading is not None:
            self.title, self.heading = " ".join(self.heading).strip(), None
        if tag == "p" and self.current is not None:
            line = re.sub(r"\s+", " ", " ".join(self.current)).strip()
            credit = re.search(r"(Photo (?:by|courtesy of)[^()]{5,180}(?:ARS|Agricultural Research Service))", line, re.I)
            if self.image and credit and not re.search(r"copyright|getty|alamy|shutterstock|courtesy of (?!USDA|ARS)", line, re.I):
                try:
                    safe_url(self.image, self.source["image_prefix"])
                    self.images.append({"url": self.image, "credit": credit[1]})
                except ValueError:
                    pass
            if len(line) > 80 and not self.image:
                self.paragraphs.append(line)
            self.current, self.image = None, None
        if tag == "main":
            self.inside = False


def discover(source, now=None):
    if source.get("parser") == "rss":
        from official_sources import discover_feed
        return discover_feed(source, download, safe_url, now or datetime.now(timezone.utc))
    if source.get("parser") in {"ministry", "tkdk", "local"}:
        from official_sources import discover_official
        return discover_official(source, download, safe_url, now or datetime.now(timezone.utc))
    now = now or datetime.now(timezone.utc)
    found = {}
    # Around New Year, include the previous archive without missing recent articles.
    years = [now.year] + ([now.year - 1] if now.month <= 2 else [])
    for year in years:
        url = source["archive_url"].format(year=year)
        archive_prefix = "https://www.ars.usda.gov/news-events/news-archive/"
        parser = ArchiveParser(source, year)
        parser.feed(download(url, archive_prefix, archive_year=year).decode("utf-8", errors="replace"))
        for row in parser.rows:
            age = (now - row["published"]).total_seconds() / 86400
            if 0 <= age <= source["max_age_days"]:
                found[row["url"]] = row
    return sorted(found.values(), key=lambda item: item["published"], reverse=True)[:12]


def read_article(source, item):
    if source.get("parser") in {"ministry", "tkdk", "local", "rss"}:
        from official_sources import read_official
        safe_url(item["url"], source["article_prefix"])
        return item.get("_article") or read_official(source, item["url"], download)
    parser = ArticleParser(source)
    parser.feed(download(item["url"], source["article_prefix"]).decode("utf-8", errors="replace"))
    body = "\n\n".join(parser.paragraphs)[:16000]
    if not parser.title or len(body) < 200 or not parser.images:
        raise ValueError("Usable text or explicitly credited original photo missing")
    return {"title": parser.title, "body": body, "image": parser.images[0]}

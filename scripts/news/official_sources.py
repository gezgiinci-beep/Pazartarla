"""Read public Turkish official facts, never their photographs or attachments."""
from datetime import datetime, timezone
from html.parser import HTMLParser
import re
import unicodedata
from html import unescape
from email.utils import parsedate_to_datetime
import xml.etree.ElementTree as ET
import json
import sys
from urllib import error
from urllib.parse import urljoin, urlsplit, unquote

VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}
MONTHS = {"ocak": 1, "şubat": 2, "mart": 3, "nisan": 4, "mayıs": 5, "haziran": 6,
          "temmuz": 7, "ağustos": 8, "eylül": 9, "ekim": 10, "kasım": 11, "aralık": 12}
AGRICULTURE = ("tarim", "ciftci", "hayvancil", "tohum", "fide", "fidan", "aricilik",
               "sulama", "kirsal", "gubre", "sut destek", "sut uret", "zirai", "ipard",
               "bitkisel uret", "bugday", "toprak analiz", "meyve", "zeytin", "hasat", "tarla",
               "celtik", "pirinc", "hayvan", "buyukbas", "kucukbas", "damizlik", "buzagi", "sigir",
               "duve", "koyun", "keci", "besicilik", "yem destek", "yem bitki", "mera", "coban",
               "cig sut", "sut primi", "sut fiyat", "sut tesvik", "agroexpo", "growtech", "burtarim",
               "toptanci hal", "toptan meyve", "toptan sebze", "hal mudurlug", "hal esnafi",
               "hal kayit sistemi", "hal duyuru", "yas meyve", "misir", "tmo",
               "ziraat", "seracilik", "genomik", "bitki sagligi", "pancar",
               "patates", "domates", "narenciye", "findik", "ceviz", "turkseker",
               "tarsim", "gida", "balikcilik", "kanatli", "yumurta")
UNRELATED = ("emlak vergisi", "imar plani", "cenaze", "taziye", "personel alimi", "vefat",
             "ziyaret", "kutlama", "meclis kurulu", "sosyal destek kart")


def folded(text):
    return "".join(c for c in unicodedata.normalize("NFKD", text.casefold().replace("ı", "i"))
                   if not unicodedata.combining(c))


def relevant(source, title, body=""):
    if not source.get("agriculture_only"):
        return True
    heading, text = folded(title), folded(title + " " + body)
    if any(re.search(r"(?<!\w)" + term, folded(title + " " + body[:500]))
           for term in ("sahipsiz hayvan", "sokak hayvan", "kedi", "kopek")):
        return False
    return not any(term in heading for term in UNRELATED) and any(
        re.search(r"(?<!\w)" + re.escape(term), text) for term in AGRICULTURE)


def matches(tag, attrs, selector):
    return bool(selector) and (not selector.get("tag") or tag == selector["tag"]) and (
        not selector.get("class") or selector["class"] in attrs.get("class", "").split()) and (
        not selector.get("id") or attrs.get("id") == selector["id"])


def source_url(source, url, validate):
    validate(url, source["article_prefix"])
    if source.get("article_pattern") and not re.fullmatch(source["article_pattern"], url):
        raise ValueError("Article path rejected")


def publication_date(text):
    date = re.search(r"(?<!\d)(\d{1,2})[./](\d{1,2})[./](20\d{2})(?!\d)", text)
    if date:
        day, month, year = map(int, date.groups())
    else:
        month_names = {folded(name): number for name, number in MONTHS.items()}
        date = re.search(r"(?<!\d)(\d{1,2})\s+(" + "|".join(month_names) + r")\s+(20\d{2})(?!\d)", folded(text))
        if not date:
            raise ValueError("Original publication date missing")
        day, month, year = int(date[1]), month_names[date[2]], int(date[3])
    return datetime(year, month, day, tzinfo=timezone.utc)


class OfficialLinks(HTMLParser):
    def __init__(self, source, validate):
        super().__init__()
        self.source, self.validate, self.urls = source, validate, []
        self.labels, self.current_url = {}, None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "img" and self.current_url:
            self.labels[self.current_url] += " " + attrs.get("alt", "")
        href = attrs.get("href", "")
        if tag != "a" or not href:
            return
        self.current_url = None
        url = urljoin(self.source["archive_url"], href)
        try:
            source_url(self.source, url, self.validate)
        except ValueError:
            return
        if url not in self.urls:
            self.urls.append(url)
        self.current_url = url
        self.labels.setdefault(url, "")
        self.labels[url] += " " + attrs.get("title", "")

    def handle_data(self, data):
        if self.current_url:
            self.labels[self.current_url] += " " + data

    def handle_endtag(self, tag):
        if tag == "a":
            self.current_url = None


class OfficialArticle(HTMLParser):
    def __init__(self, kind, settings=None):
        super().__init__(convert_charrefs=True)
        self.kind, self.stack = kind, []
        self.root = None
        self.title, self.title_parts, self.date_parts, self.paragraphs = "", [], [], []
        self.paragraph = None
        self.settings, self.body_parts, self.title_depth = settings or {}, [], None
        self.completed = False

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if self.kind == "local" and tag == "meta" and attrs.get("property") == "og:title":
            self.title_parts = [attrs.get("content", "").removeprefix("Haberler | ")]
        if tag in VOID:
            if tag == "br" and self.paragraph is not None:
                self.paragraph.append(" ")
            return
        self.stack.append((tag, attrs))
        classes = attrs.get("class", "").split()
        if self.root is None and not self.completed and (
            (tag == "div" and self.kind == "ministry" and attrs.get("id") == "th-content-post") or
            (tag == "div" and self.kind == "tkdk" and "duyuruIcerik" in classes) or
            (self.kind == "local" and matches(tag, attrs, self.settings.get("article_root")))
        ):
            self.root = len(self.stack)
        if self.root is not None and not self.title_parts and (
            (self.kind == "ministry" and tag == "h3") or (self.kind == "tkdk" and tag == "h2") or
            matches(tag, attrs, self.settings.get("title_selector"))
        ):
            self.title_depth = len(self.stack)
        if self.root is not None and tag == "p":
            self.flush_paragraph()
            self.paragraph = []

    def handle_data(self, data):
        if self.root is None or any(tag in {"script", "style", "noscript"} for tag, _ in self.stack):
            return
        if self.title_depth is not None and len(self.stack) >= self.title_depth:
            self.title_parts.append(data)
        if any("itemDateCreated" in attrs.get("class", "").split() or
               "post_info" in attrs.get("class", "").split() for _, attrs in self.stack[self.root:]):
            self.date_parts.append(data)
        if self.kind == "local":
            if any(matches(tag, attrs, self.settings.get("date_selector")) for tag, attrs in self.stack[self.root:]) or (
                self.settings.get("date_label") and self.settings["date_label"] in data
            ):
                self.date_parts.append(data)
            if any(matches(tag, attrs, self.settings.get("body_selector")) for tag, attrs in self.stack[self.root - 1:]):
                self.body_parts.append(data)
        if self.paragraph is not None:
            self.paragraph.append(data)

    def flush_paragraph(self):
        if self.paragraph is not None:
            text = re.sub(r"\s+", " ", "".join(self.paragraph)).replace("\u200b", "").strip()
            if text:
                self.paragraphs.append(text)
            self.paragraph = None

    def handle_endtag(self, tag):
        positions = [index for index, (name, _) in enumerate(self.stack) if name == tag]
        if not positions:
            return
        position = positions[-1]
        if tag == "p":
            self.flush_paragraph()
        if self.title_depth is not None and position < self.title_depth:
            self.title_depth = None
        if self.root is not None and position < self.root:
            self.flush_paragraph()
            self.root = None
            self.completed = True
        self.stack = self.stack[:position]

    def result(self):
        self.flush_paragraph()
        title = re.sub(r"\s+", " ", "".join(self.title_parts)).strip()
        body = (re.sub(r"\s+", " ", " ".join(self.body_parts)).strip() if self.kind == "local"
                else "\n\n".join(self.paragraphs))[:16000]
        if not title or len(body) < 200:
            raise ValueError("Official article title, original date or factual text missing")
        # These pages publish calendar dates, not a verified time of day.
        published = publication_date(" ".join(self.date_parts))
        return {"title": title, "body": body, "published": published, "image": None}


def discover_official(source, download, validate, now):
    links = OfficialLinks(source, validate)
    options = ({"limit": min(4_000_000, source["max_archive_bytes"])}
               if source.get("max_archive_bytes") else {})
    links.feed(download(source["archive_url"], source["archive_url"], **options).decode("utf-8", errors="replace"))
    if not links.urls:
        raise ValueError("Official archive article links missing; review source structure")
    found, network_errors = [], 0
    urls = [url for url in links.urls if url not in source.get("_known_urls", set())]
    if source.get("agriculture_only") and source.get("organization_type") not in {
        "agricultural_faculty", "agricultural_research"
    }:
        # Prefer agricultural slugs without downloading every unrelated municipal article.
        urls = [url for url in urls if relevant(
            source, links.labels.get(url, "") + " " + unquote(urlsplit(url).path))]
    for url in urls[:source.get("max_article_reads", 12)]:
        try:
            article = read_official(source, url, download)
            age = (now - article["published"]).total_seconds() / 86400
            if not 0 <= age <= source["max_age_days"]:
                continue
            if any(term in article["title"].casefold() for term in source.get("exclude_title_terms", [])):
                continue
            if not relevant(source, article["title"], article["body"]):
                continue
            found.append({"url": url, "published": article["published"], "_article": article})
        except ValueError:
            continue
        except (error.URLError, OSError) as exc:
            network_errors += 1
            print(json.dumps({"source": source["id"], "result": "article_unavailable",
                              "status": getattr(exc, "code", None)}), file=sys.stderr)
    if network_errors and not found:
        raise ValueError("Official article requests unavailable")
    return sorted(found, key=lambda item: item["published"], reverse=True)


def read_official(source, url, download):
    parser = OfficialArticle(source["parser"], source)
    parser.feed(download(url, source["article_prefix"]).decode("utf-8", errors="replace"))
    return parser.result()


class FeedText(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts, self.skip = [], 0

    def handle_starttag(self, tag, attrs):
        if tag in {"script", "style", "iframe", "noscript"}:
            self.skip += 1

    def handle_endtag(self, tag):
        if tag in {"script", "style", "iframe", "noscript"}:
            self.skip = max(0, self.skip - 1)

    def handle_data(self, data):
        if not self.skip:
            self.parts.append(data)


def discover_feed(source, download, validate, now):
    raw = download(source["archive_url"], source["archive_url"], feed_xml=True)
    if re.search(br"<!\s*(?:DOCTYPE|ENTITY)\b", raw, re.I):
        raise ValueError("Feed document declarations rejected")
    try:
        root = ET.fromstring(raw)
    except ET.ParseError as exc:
        raise ValueError("Malformed source feed") from exc
    found = []
    for item in root.findall("./channel/item")[:60]:
        try:
            url = (item.findtext("link") or "").strip()
            source_url(source, url, validate)
            if url in source.get("_known_urls", set()):
                continue
            published = parsedate_to_datetime(item.findtext("pubDate") or "")
            if published.tzinfo is None:
                raise ValueError("Feed publication timezone missing")
            if not 0 <= (now - published).total_seconds() / 86400 <= source["max_age_days"]:
                continue
            title = unescape(item.findtext("title") or "").strip()
            parser = FeedText()
            parser.feed(item.findtext("{http://purl.org/rss/1.0/modules/content/}encoded")
                        or item.findtext("description") or "")
            body = re.sub(r"\s+", " ", " ".join(parser.parts)).strip()[:16000]
            if len(body) < 200 or not title or not relevant(source, title, body):
                continue
            found.append({"url": url, "published": published,
                          "_article": {"title": title, "body": body, "published": published, "image": None}})
        except (ValueError, TypeError, OverflowError):
            continue
    return sorted(found, key=lambda item: item["published"], reverse=True)

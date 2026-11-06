import json
import sys
import unittest
from pathlib import Path
from datetime import datetime, timezone, timedelta
from unittest.mock import patch
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts/news"))
from official_sources import OfficialLinks, OfficialArticle, discover_official, discover_feed, relevant, publication_date
from news_source import safe_url

SOURCES = json.loads((ROOT / "scripts/news/sources.json").read_text())["sources"]
MINISTRY = next(s for s in SOURCES if s["id"] == "tr-ministry-news")
TKDK = next(s for s in SOURCES if s["id"] == "tr-tkdk-notices")
BODY = "Resmî kurumun yayımladığı duyuruda başvuru sürecinin koşulları açıklanıyor. " * 5


class OfficialSourceTests(unittest.TestCase):
    def test_only_allowlisted_paths_without_queries_or_foreign_hosts(self):
        parser = OfficialLinks(MINISTRY, safe_url)
        parser.feed('<a href="/Haber/123/Tarim">Yeni</a><a href="https://evil.test/Haber/1">Kötü</a>'
                    '<a href="/Haber/123/Tarim?x=1">Sorgu</a><a href="/Duyuru/1">Diğer</a>')
        self.assertEqual(parser.urls, ["https://www.tarimorman.gov.tr/Haber/123/Tarim"])

    def test_ministry_only_reads_article_text_and_original_date_not_menu_or_photos(self):
        parser = OfficialArticle("ministry")
        parser.feed(f'<p>Menü dışı veri</p><div id="th-content-post"><h3>Yeni tarım gelişmesi</h3>'
                    f'<span class="itemDateCreated"><span></span>5.11.2026 /</span>'
                    f'<p>{BODY}<script>ignore()</script></p><img src="https://unlicensed.test/a.jpg"></div>'
                    '<p>Footer reklamı</p>')
        article = parser.result()
        self.assertEqual(article["published"], datetime(2026, 11, 5, tzinfo=timezone.utc))
        self.assertNotIn("Footer", article["body"])
        self.assertNotIn("Menü", article["body"])
        self.assertNotIn("ignore", article["body"])
        self.assertIsNone(article["image"])

    def test_tkdk_scoped_title_date_and_nested_paragraphs(self):
        parser = OfficialArticle("tkdk")
        parser.feed('<h1>Duyurular</h1><div class="post nopadding duyuruIcerik">'
                    '<div class="post_info"><li><span>3.11.2026</span></li></div><h2>IPARD duyurusu</h2>'
                    f'<p><p>{BODY}</p><p>Koşullar kaynakta ayrıca değerlendirilmelidir.</p></div>')
        article = parser.result()
        self.assertEqual(article["title"], "IPARD duyurusu")
        self.assertIn("Koşullar", article["body"])
        self.assertEqual(article["published"].day, 3)

    def test_missing_date_or_insufficient_source_text_is_never_invented(self):
        parser = OfficialArticle("tkdk")
        parser.feed(f'<div class="duyuruIcerik"><h2>Başlık</h2><p>{BODY}</p></div>')
        with self.assertRaises(ValueError):
            parser.result()

    def test_stale_and_future_articles_are_not_discovered(self):
        archive = b'<a href="/Duyuru/one">One</a><a href="/Duyuru/two">Two</a>'
        def download(url, prefix):
            if url == TKDK["archive_url"]:
                return archive
            date = "1.1.2026" if url.endswith("one") else "1.1.2027"
            return (f'<div class="duyuruIcerik"><div class="post_info">{date}</div>'
                    f'<h2>IPARD destek duyurusu</h2><p>{BODY}</p></div>').encode()
        self.assertEqual(discover_official(TKDK, download, safe_url, datetime(2026, 11, 6, tzinfo=timezone.utc)), [])

    def test_official_covers_are_explicit_not_a_claim_of_photo_reuse_permission(self):
        for source in SOURCES:
            if source.get("parser") in {"ministry", "tkdk", "local", "rss"}:
                self.assertEqual(source["image_policy"], "generated-editorial-cover")
                self.assertEqual(source["language"], "tr")
                self.assertNotIn("image_prefix", source)

    def test_local_topics_do_not_use_menu_or_institution_name_as_evidence(self):
        source = {"agriculture_only": True}
        self.assertTrue(relevant(source, "Üreticilere buğday tohumu desteği"))
        self.assertFalse(relevant(source, "Yeni spor salonu açıldı"))
        self.assertFalse(relevant(source, "Emlak vergisi", "tarım"))
        self.assertFalse(relevant(source, "Muhtarlar toplantısı"))
        self.assertFalse(relevant(source, "Banka yetkililerinden ziyaret", "Tarımsal destekler görüşüldü"))
        for title in ("Büyükbaş ve küçükbaş yetiştiricilerine yem desteği", "Çiğ süt primi başvuruları",
                      "Gönen Tarım ve Hayvancılık Fuarı", "Growtech programı", "Toptancı hali çalışma saatleri",
                      "Hal Müdürlüğü üreticilere duyurdu", "Toptan meyve sebze sevkiyat duyurusu"):
            self.assertTrue(relevant(source, title), title)
        for title in ("Sahipsiz hayvan bakım merkezi", "Kedi ve köpekler için aşılama",
                      "Kitap fuarı başlıyor", "Muhtarlar toplantısı", "Halk konseri"):
            self.assertFalse(relevant(source, title), title)

    def test_numeric_municipality_urls_use_anchor_titles_for_topic_filtering(self):
        source = next(s for s in SOURCES if s["id"] == "tr-tekirdag-municipality")
        html = f'<div class="inner-page__content"><div class="title">Çiftçiye tohum desteği</div>' \
               f'<div class="page-content__description"><p>{BODY}</p></div>' \
               '<span>Haber Eklenme Tarihi : 05/11/2026 15:20:42</span></div>'
        def download(url, prefix):
            return (f'<a href="/haber/123"><h3>Çiftçiye tohum desteği</h3></a>'
                    '<a href="/haber/124">Spor salonu açılışı</a>').encode() if url == source["archive_url"] else html.encode()
        rows = discover_official(source, download, safe_url, datetime(2026, 11, 6, tzinfo=timezone.utc))
        self.assertEqual([row["url"] for row in rows], ["https://www.tekirdag.bel.tr/haber/123"])

    def test_turkish_named_dates_and_no_sidebar_text(self):
        source = next(s for s in SOURCES if s["id"] == "tr-akdeniz-agriculture-chamber")
        parser = OfficialArticle("local", source)
        parser.feed(f'<meta property="og:title" content="Tarımsal destek duyurusu">'
                    f'<div class="page-content"><span class="tarih">05 Kasım 2026, 11:56</span>'
                    f'<div class="detay">{BODY}</div><aside>Başka haber, 999 milyon destek</aside></div>')
        article = parser.result()
        self.assertEqual(article["published"].month, 11)
        self.assertNotIn("999", article["body"])
        self.assertEqual(publication_date("5 KASIM 2026").month, 11)

    def test_balikesir_gonen_is_not_the_other_gonen_municipality(self):
        source = next(s for s in SOURCES if s["id"] == "tr-gonen-municipality")
        self.assertTrue(source["article_prefix"].startswith("https://balikesirgonen.bel.tr/"))
        self.assertEqual(source["region"], "Balıkesir / Gönen")
        self.assertTrue(any(s["organization_type"] == "commerce_chamber" and
                            "Ticaret Odası" in s["name"] for s in SOURCES if s.get("region") == "Balıkesir / Gönen"))

    def test_rotation_gives_each_enabled_feed_a_first_slot(self):
        sys.path.insert(0, str(ROOT))
        from fetch_news import source_order
        enabled = [s for s in SOURCES if s["enabled"]]
        start = datetime(2026, 11, 6, tzinfo=timezone.utc)
        first = {source_order(SOURCES, start + timedelta(hours=12 * n))[0]["id"] for n in range(len(enabled))}
        self.assertEqual(first, {s["id"] for s in enabled})

    def test_feed_uses_original_date_facts_only_and_never_fetches_images(self):
        source = next(s for s in SOURCES if s["id"] == "tr-bolu-agriculture-chamber")
        xml = f'''<rss xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel><item>
          <title>Çiftçilere tohum desteği</title><link>https://www.boluziraatodasi.org.tr/tohum-destegi/</link>
          <pubDate>Thu, 05 Nov 2026 10:00:00 +0000</pubDate><content:encoded><![CDATA[
          <p>{BODY}</p><img src="https://unlicensed.test/photo.jpg"/><script>not-a-fact</script>
          ]]></content:encoded></item></channel></rss>'''.encode()
        calls = []
        def download(url, prefix, **kwargs):
            calls.append((url, kwargs))
            return xml
        rows = discover_feed(source, download, safe_url, datetime(2026, 11, 6, tzinfo=timezone.utc))
        self.assertEqual(len(rows), 1)
        self.assertEqual(len(calls), 1)
        self.assertTrue(calls[0][1]["feed_xml"])
        self.assertIsNone(rows[0]["_article"]["image"])
        self.assertNotIn("not-a-fact", rows[0]["_article"]["body"])
        with self.assertRaises(ValueError):
            discover_feed(source, lambda *a, **k: b'<!DOCTYPE rss [<!ENTITY a "bad">]><rss/>',
                          safe_url, datetime(2026, 11, 6, tzinfo=timezone.utc))

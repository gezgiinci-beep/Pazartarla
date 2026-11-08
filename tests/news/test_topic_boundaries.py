"""Regression checks for the actual municipality-topic false positives."""
from datetime import datetime, timezone
from pathlib import Path
import json
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts/news"))
from official_sources import relevant, discover_official
from news_source import safe_url

SOURCE = next(s for s in json.loads(
    (Path(__file__).resolve().parents[2] / "scripts/news/sources.json").read_text()
)["sources"] if s["id"] == "tr-tekirdag-municipality")


class TopicBoundaryTests(unittest.TestCase):
    def test_curiosity_and_names_are_not_pasture_mentions(self):
        for word in ("merak", "meraklı", "merakla", "merakını", "Meral", "Meram", "merasim"):
            with self.subTest(word=word):
                self.assertFalse(relevant(SOURCE, "Kültür duyurusu", f"Duyuruda {word} sözü geçiyor."))

    def test_real_pasture_and_inflections_still_pass(self):
        for word in ("mera", "meralar", "meraları", "meraların", "meralarımızı",
                     "meralarına", "meralarda", "meranın", "meraya", "merayı",
                     "merada", "meradan", "merası", "merasının", "merasına"):
            with self.subTest(word=word):
                self.assertTrue(relevant(SOURCE, f"{word} ıslah çalışması"))

    def test_screenshot_topics_do_not_pass_from_merak_in_the_body(self):
        for title, text in [
            ('BÜYÜKŞEHİR VE LÖSEV’DEN LÖSEMİYE KARŞI TURUNCU FARKINDALIK',
             "Katılımcılar hastalığa ilişkin merak ettikleri konuları sordu."),
            ('ŞEHİR TİYATROLARINDA YENİ SEZONUN İLK ÇOCUK OYUNU SAHNELENDİ',
             "Oyun, meraklı bir çocuğun öyküsünü anlatıyor."),
        ]:
            with self.subTest(title=title):
                self.assertFalse(relevant(SOURCE, title, text))
                self.assertFalse(relevant(SOURCE, title + " " + text))

    def test_unrelated_archive_links_are_not_fetched_or_sent_to_ai(self):
        urls = []
        def download(url, prefix):
            urls.append(url)
            if url == SOURCE["archive_url"]:
                return ('<a href="/haber/1">Şehir tiyatrolarında meraklı bir çocuk</a>'
                        '<a href="/haber/2">LÖSEV etkinliğinde merak edilenler</a>'
                        '<a href="/haber/3">Meraların ıslahı başladı</a>').encode()
            self.assertEqual(url, SOURCE["article_prefix"] + "3")
            return ('<div class="inner-page__content"><div class="title">Meraların ıslahı başladı</div>'
                    '<div class="page-content__description"><p>' +
                    "Meraların verimli kullanımı için ıslah çalışmaları yürütülüyor. " * 5 +
                    '</p></div><span>Haber Eklenme Tarihi : 08/11/2026 09:00</span></div>').encode()
        rows = discover_official(SOURCE, download, safe_url, datetime(2026, 11, 8, 12, tzinfo=timezone.utc))
        self.assertEqual([r["url"] for r in rows], [SOURCE["article_prefix"] + "3"])
        self.assertEqual(len(urls), 2)

    def test_legitimate_local_agricultural_topics_remain_in_scope(self):
        for title in ("Çiftçiye tohum desteği", "Gönen Tarım ve Hayvancılık Fuarı",
                      "Süt üreticilerine destek", "Toptan meyve sebze duyurusu",
                      "Mera ıslahı ve üreticilere yem desteği"):
            self.assertTrue(relevant(SOURCE, title), title)

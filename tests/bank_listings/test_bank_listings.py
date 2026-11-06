import importlib.util
import unittest
from pathlib import Path

SPEC = importlib.util.spec_from_file_location(
    "bank_listings", Path(__file__).resolve().parents[2] / "scripts/bank_listings.py")
bank = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(bank)


class BankListingTests(unittest.TestCase):
    def test_property_facts_are_labelled_and_never_machine_placeholders(self):
        html = """<ul><li><span>İl / İlçe / Semt</span><span>Balıkesir / Gönen</span></li>
        <li><span>m²</span><span>8.966</span></li>
        <li><span>Ada / Parsel</span><span>101 / 250</span></li>
        <li><span>Tapu Durumu</span><span>Müstakil Tapulu</span></li></ul>"""
        root = bank.Tree(html).root
        self.assertEqual(bank.extract_property_facts(root, "field"), {
            "location": "Balıkesir / Gönen", "area_m2": "8966",
            "parcel": "101 / 250", "deed_status": "Müstakil Tapulu"})
        self.assertEqual(bank.extract_property_facts(root, "tractor"), {})
        self.assertEqual(bank.extract_property_facts(bank.Tree("<p>Tarla 8966 m²</p>").root, "field"), {})
        self.assertNotIn("area_m2", bank.extract_property_facts(bank.Tree(
            html + "<li><span>m²</span><span>123</span></li>").root, "field"))

    def test_sale_contact_normalization(self):
        for raw in ["+90 (216) 555 01 23", "0090 216 555 01 23",
                    "0216 555 01 23", "2165550123"]:
            self.assertEqual(bank.normalize_contact_phone(raw), "02165550123")
        for raw in ["123", "+1 212 555 0123", "02165550123;ext=2",
                    "02165550123 veya 02165550456", "javascript:02165550123"]:
            self.assertEqual(bank.normalize_contact_phone(raw), "")

    def test_sale_contact_scoped_not_footer_or_form(self):
        html = """<footer><a href="tel:02165550456">Merkez</a></footer>
        <div class="contactForm"><input value="02165550456"></div>
        <div class="callUs"><div class="tel"><a href="tel:+90 (216) 555 01 23">Ara</a></div></div>"""
        self.assertEqual(bank.extract_sale_phone(bank.Tree(html).root, "vakifbank"), "02165550123")
        self.assertEqual(bank.extract_sale_phone(bank.Tree("<footer><a href='tel:02165550456'>Ara</a></footer>").root, "vakifbank"), "")
        ambiguous = html + '<div class="callUs"><a href="tel:02165550456">Ara</a></div>'
        self.assertEqual(bank.extract_sale_phone(bank.Tree(ambiguous).root, "vakifbank"), "")
        self.assertEqual(bank.extract_sale_phone(bank.Tree(html).root, "ziraat"), "")

    def test_leasing_contact_is_per_table(self):
        html = "<table><tr><td>Yetkili Telefon:</td><td>0216 555 01 23</td></tr></table>"
        self.assertEqual(bank.extract_sale_phone(bank.Tree(html).root, "ziraat_leasing"), "02165550123")

    def test_enrichment_requires_same_listing_and_robots(self):
        from unittest.mock import patch
        row = {"bank_id": "vakifbank", "title": "VakıfBank'tan Satılık Tarla",
               "source_url": "https://gayrimenkul.intengo.com/vakifbank/ilan/tarla-123/"}
        html = "<h1>Başka satıcı</h1><div class='callUs'><a href='tel:02165550123'>Ara</a></div>"
        with patch.object(bank, "robots_allowed", return_value=True), \
             patch.object(bank, "public_read", return_value=(html, "text/html")):
            with self.assertRaises(bank.SourceUnavailable):
                bank.enrich_sale_phone(row)
            html = html.replace("Başka satıcı", row["title"])
            with patch.object(bank, "public_read", return_value=(html, "text/html")):
                self.assertEqual(bank.enrich_sale_phone(row), "02165550123")
        with patch.object(bank, "robots_allowed", return_value=False), \
             patch.object(bank, "public_read") as read:
            with self.assertRaises(bank.SourceUnavailable):
                bank.enrich_sale_phone(row)
            read.assert_not_called()

    def test_requested_asset_kinds(self):
        examples = [
            ("Bankadan satılık tarla", "field"),
            ("Satılık bağ", "vineyard"), ("Satılık meyve bahçesi", "orchard"),
            ("Satılık Bahçe", "orchard"), ("Satılık Çiftlik", "farm"),
            ("VakıfBank'tan Satılık Süt Çiftliği", "farm"),
            ("Satılık Traktör", "tractor"), ("Satılık Biçerdöver", "agricultural_machine"),
            ("Satılık Balya Makinesi", "agricultural_machine"),
        ]
        for title, expected in examples:
            with self.subTest(title=title):
                self.assertEqual(bank.classify_asset(title), expected)

    def test_addresses_and_non_agricultural_assets_are_not_imported(self):
        for title in [
            "Çiftlik Mahallesi'nde Daire", "Tarla Sokak Satılık Arsa",
            "Bahçeli Villa", "Plastik Enjeksiyon Makinesi", "Satılık Otomobil",
            "Satılık Arsa", "Konut", "Sanayi Torna Makinesi",
        ]:
            with self.subTest(title=title):
                self.assertIsNone(bank.classify_asset(title))

    def test_decimal_and_scientific_bank_prices(self):
        self.assertEqual(bank.decimal_text("2.400.000"), "2400000")
        self.assertEqual(bank.decimal_text("1.51E+7"), "15100000")
        self.assertEqual(bank.decimal_text("8.500.000,50"), "8500000.50")
        for invalid in ["bedelsiz", "0", "-5", "nan", "1e999"]:
            with self.assertRaises(ValueError):
                bank.decimal_text(invalid)

    def test_no_sessions_or_tracking_in_saved_urls(self):
        result = bank.canonical_source("ziraat",
            "/gm-details.intengo;jsessionid=anonymous-test?gayrimenkulId=123&cid=456")
        self.assertEqual(result, ("123",
            "https://e-satis.ziraatbank.com.tr/gm-details.intengo?gayrimenkulId=123"))
        self.assertIsNone(bank.canonical_source("ziraat", "https://evil.invalid/gm-details.intengo?gayrimenkulId=123"))
        self.assertIsNone(bank.canonical_source("ziraat", "http://e-satis.ziraatbank.com.tr/gm-details.intengo?gayrimenkulId=123"))

    def test_ziraat_minimal_facts_no_photo_copy_or_body_rewrite(self):
        html = """<div class="residence-item">
          <a class="title" href="/gm-details.intengo?gayrimenkulId=123">Satılık Tarla</a>
          <span class="city">Balıkesir / Gönen</span><span class="type">Arsa - Tarla</span>
          <span class="area">1.500 m2</span><span>G. No: 999</span>
          <span>2.400.000 TL Başlangıç Bedeli</span><img src="/copyrighted.jpg">
        </div>"""
        rows = bank.parse_catalogue("ziraat", html)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["price"], "2400000")
        self.assertEqual(rows[0]["area_m2"], "1500")
        self.assertEqual(rows[0]["price_kind"], "initial_bid")
        self.assertNotIn("image", rows[0])
        self.assertNotIn("description", rows[0])
        self.assertEqual(rows[0]["asset_kind"], "field")
        self.assertEqual(bank.parse_catalogue("ziraat", html.replace(
            "Başlangıç Bedeli", "Başlangıç Bedeli İhale Sona Erdi")), [])

    def test_vakifbank_does_not_import_other_sellers(self):
        html = """<div class="listing"><div class="reInfo">
          <a id="realEstateName0" href="/vakifbank/ilan/vakifbank-tan-satilik-tarla-123/">
            VakıfBank'tan Satılık Tarla</a>
          <span class="priceMask">1.51E+7</span><span>Başlangıç Bedeli</span>
        </div></div>"""
        rows = bank.parse_catalogue("vakifbank", html)
        self.assertEqual(rows[0]["price"], "15100000")
        self.assertEqual(bank.parse_catalogue("vakifbank", html.replace(
            "VakıfBank'tan", "Vakıf Leasing'den")), [])

    def test_structure_change_is_not_a_successful_empty_catalogue(self):
        with self.assertRaises(bank.SourceUnavailable):
            bank.parse_catalogue("ziraat", "<html>Enable JavaScript</html>")


if __name__ == "__main__":
    unittest.main()

import importlib.util
import unittest
from pathlib import Path

SPEC = importlib.util.spec_from_file_location(
    "bank_listings", Path(__file__).resolve().parents[2] / "scripts/bank_listings.py")
bank = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(bank)


class BankListingTests(unittest.TestCase):
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

import importlib.util
import unittest
from hashlib import sha256
from pathlib import Path
from types import SimpleNamespace

SCRIPTS = Path(__file__).resolve().parents[2] / "scripts"


def load(name):
    spec = importlib.util.spec_from_file_location(name, SCRIPTS / (name + ".py"))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


bank = load("bank_listings")
leasing = load("leasing_sources")


class LeasingSourceTests(unittest.TestCase):
    def test_halk_only_agricultural_cards_keep_currency_and_tax(self):
        html = """<div>
          <div class="cmp-teaser"><h2><a href="/tr/ikinci-el-satis/makine-ekipman/traktor.html">SATILIK TRAKTÖR</a></h2>
            <p>72.000 EUR (KDV DAHİL)</p><a href="/tr/ikinci-el-satis/makine-ekipman/traktor.html">İncele</a></div>
          <div class="cmp-teaser"><h2><a href="/tr/ikinci-el-satis/makine-ekipman/cnc.html">CNC TORNA TEZGAHI</a></h2>
            <p>88.000 EUR</p></div>
        </div>"""
        rows = leasing.parse_halk(bank.Tree(html).root, bank)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["bank_id"], "halk_leasing")
        self.assertEqual(rows[0]["price"], "72000")
        self.assertEqual(rows[0]["currency"], "EUR")
        self.assertEqual(rows[0]["tax_note"], "KDV dahil")
        self.assertEqual(rows[0]["price_kind"], "asking")
        self.assertNotIn("images", rows[0])

    def test_halk_does_not_steal_next_cards_price(self):
        html = """<div>
          <div class="cmp-teaser"><a href="/tr/ikinci-el-satis/makine-ekipman/traktor.html">TRAKTÖR</a></div>
          <div class="cmp-teaser"><a href="/tr/ikinci-el-satis/makine-ekipman/traktor2.html">TRAKTÖR</a><p>500.000 TL</p></div>
        </div>"""
        rows = leasing.parse_halk(bank.Tree(html).root, bank)
        self.assertIsNone(rows[0]["price"])
        self.assertIsNone(rows[0]["currency"])
        self.assertEqual(rows[1]["price"], "500000")

    def test_ziraat_stable_serial_not_price_or_table_order_is_identity(self):
        html = """<table>
          <tr><td>MAKİNE CİNSİ</td><td>TRAKTÖR</td></tr>
          <tr><td>SERİ NO</td><td>AGRI-001</td></tr>
          <tr><td>FİYAT</td><td>72.000 EUR (KDV HARİÇ)</td></tr>
        </table>"""
        rows, warnings = leasing.parse_ziraat(bank.Tree(html).root, bank)
        self.assertEqual(warnings, [])
        self.assertEqual(rows[0]["currency"], "EUR")
        self.assertEqual(rows[0]["tax_note"], "KDV hariç")
        changed, _ = leasing.parse_ziraat(bank.Tree(html.replace("72.000", "68.000")).root, bank)
        self.assertEqual(changed[0]["external_id"], rows[0]["external_id"])
        reference = rows[0]["reference"].replace(" ", "").upper()
        self.assertEqual(rows[0]["external_id"], sha256(reference.encode()).hexdigest()[:24])

    def test_ziraat_does_not_invent_id_when_two_identical_machines_have_no_serial(self):
        html = """<table><tr><td>MAKİNE CİNSİ</td><td>TRAKTÖR</td></tr>
          <tr><td>FİYAT</td><td>72.000 EUR</td></tr></table>"""
        rows, warnings = leasing.parse_ziraat(bank.Tree(html).root, bank)
        self.assertEqual(rows, [])
        self.assertIn("agricultural_asset_missing_stable_id", warnings)

    def test_seller_scoped_urls_and_halk_stable_path_id(self):
        canonical = bank.canonical_source("vakif_leasing",
            "https://gayrimenkul.intengo.com/vakifleasing/ilan/satilik-traktor-123/")
        self.assertEqual(canonical[0], "123")
        self.assertIsNone(bank.canonical_source("vakifbank", canonical[1]))
        self.assertIsNone(bank.canonical_source("vakif_leasing",
            canonical[1].replace("/vakifleasing/", "/other/")))
        path = "/tr/ikinci-el-satis/makine-ekipman/traktor.html"
        self.assertEqual(bank.canonical_source("halk_leasing", path)[0],
                         sha256(path.encode()).hexdigest()[:24])

    def test_vakif_official_directory_checks_matching_detail_and_original_bid_price(self):
        source = {**bank.SOURCES["vakif_leasing"], "format": "official_directory",
                  "url": bank.SOURCES["vakif_leasing"]["official_directory_url"],
                  "host": "www.vakifleasing.com.tr"}
        link = "https://gayrimenkul.intengo.com/vakifleasing/ilan/vakif-leasing-ten-satilik-traktor-123/"
        directory = f'<table><tr><td>1</td><td>SATILIK TRAKTÖR</td><td><a href="{link}">İLAN DETAYI</a></td></tr></table>'
        detail = "<h1>Vakıf Leasing'ten Satılık Traktör</h1><p>Başlangıç Bedeli 800.000 TRY</p><p>Teminat Bedeli 40.000 TRY</p>"
        calls = []

        def read(url, host):
            calls.append(url)
            return (directory if url == source["url"] else detail), "text/html"

        core = SimpleNamespace(**vars(bank))
        core.public_read = read
        core.robots_allowed = lambda scope: True
        rows, warnings = leasing.collect_leasing("vakif_leasing", source, core)
        self.assertEqual(warnings, [])
        self.assertEqual(calls, [source["url"], link])
        self.assertEqual(rows[0]["price"], "800000")
        self.assertEqual(rows[0]["price_kind"], "initial_bid")
        self.assertEqual(rows[0]["bank_id"], "vakif_leasing")

    def test_vakif_industrial_rows_do_not_trigger_detail_or_photo_downloads(self):
        source = {**bank.SOURCES["vakif_leasing"], "format": "official_directory",
                  "url": bank.SOURCES["vakif_leasing"]["official_directory_url"],
                  "host": "www.vakifleasing.com.tr"}
        directory = '<table><tr><td>1</td><td>ENJEKSİYON MAKİNESİ</td><td><a href="https://gayrimenkul.intengo.com/vakifleasing/ilan/enjeksiyon-makinesi-1/">Detay</a></td></tr></table>'
        core = SimpleNamespace(**vars(bank))
        core.robots_allowed = lambda scope: True

        def read(url, host):
            self.assertEqual(url, source["url"])
            return directory, "text/html"
        core.public_read = read
        self.assertEqual(leasing.collect_leasing("vakif_leasing", source, core), ([], []))

    def test_ambiguous_money_is_not_guessed(self):
        self.assertEqual(leasing.money("72.000 EUR veya 80.000 USD", bank),
                         (None, None, "unknown"))
        self.assertEqual(leasing.money("80.000 USD", bank),
                         ("80000", "USD", "asking"))

    def test_vakif_live_catalogue_adapter_confirms_currency_from_actual_detail(self):
        source = bank.SOURCES["vakif_leasing"]
        catalogue = """<div><div class="reInfo">
          <a id="realEstateName0" href="/vakifleasing/ilan/vakif-leasing-ten-satilik-traktor-123/">
            Vakıf Leasing'ten Satılık Traktör</a>
          <span class="priceMask">800000</span><span>Başlangıç Bedeli</span>
        </div></div>"""
        detail = "<h1>Vakıf Leasing'ten Satılık Traktör</h1><p>Başlangıç Bedeli 800.000 EUR</p>"
        core = SimpleNamespace(**vars(bank))
        core.robots_allowed = lambda scope: True
        core.public_read = lambda url, host: (
            catalogue if url == source["url"] else detail, "text/html")
        rows, warnings = leasing.collect_leasing("vakif_leasing", source, core)
        self.assertEqual(warnings, [])
        self.assertEqual(rows[0]["currency"], "EUR")
        self.assertEqual(rows[0]["price"], "800000")


if __name__ == "__main__":
    unittest.main()

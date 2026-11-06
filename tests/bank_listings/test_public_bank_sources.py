import importlib.util
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2] / "scripts"
def load(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / (name + ".py"))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module
bank, public = load("bank_listings"), load("public_bank_sources")
NOW = datetime(2026, 11, 6, tzinfo=timezone.utc)
ROW = {"tip": 1, "seriNo": 123, "baslik": "Satılık Tarla", "emlakTipAd": "ARSA",
       "il": "Balıkesir", "ilce": "Gönen"}
DETAIL = {"seriNo": "123", "baslik": "Satılık Tarla ", "baslangicFiyati": "2400000.00",
          "mevcutKullanimAlani": "8.966,50", "ilgiliSubeTelefon": "0216 555 01 23",
          "ada": "101", "parsel": "250"}


class PublicBankTests(unittest.TestCase):
    def test_halk_official_minimal_facts_and_phone(self):
        value = public.halk_record(ROW, DETAIL, bank, NOW)
        self.assertEqual(value["source_url"], "https://www.halkbankgayrimenkul.com.tr/ilan-detay/123")
        self.assertEqual(value["area_m2"], "8966.50")
        self.assertEqual(value["contact_phone"], "02165550123")
        self.assertEqual(value["price_kind"], "initial_bid")
        self.assertNotIn("description", value)
        self.assertNotIn("images", value)

    def test_halk_excludes_gyo_wrong_record_nonagriculture_and_ended_sales(self):
        self.assertIsNone(public.halk_record({**ROW, "tip": 2}, DETAIL, bank, NOW))
        self.assertIsNone(public.halk_record(ROW, {**DETAIL, "seriNo": "124"}, bank, NOW))
        self.assertIsNone(public.halk_record({**ROW, "baslik": "Satılık Konut"},
            {**DETAIL, "baslik": "Satılık Konut"}, bank, NOW))
        self.assertIsNone(public.halk_record(ROW, {**DETAIL, "ihaleBitisTarihi": "2020-01-01T10:00:00"}, bank, NOW))

    def test_no_bid_or_contact_endpoints_and_robots_is_enforced(self):
        with patch.object(bank, "build_opener") as opener:
            with self.assertRaises(bank.SourceUnavailable):
                public.halk_read("IletisimFormuEkle", {}, bank)
            opener.assert_not_called()
        with patch.object(bank, "robots_allowed", return_value=False), patch.object(bank, "build_opener") as opener:
            with self.assertRaises(bank.SourceUnavailable):
                public.halk_read("ListeTumu", {"page": 1}, bank)
            with self.assertRaises(bank.SourceUnavailable):
                public.collect_ziraat(bank)
            opener.assert_not_called()

    def test_halk_catalogue_is_bounded_and_deduplicated(self):
        def read(endpoint, payload, core):
            return {"list": [ROW] * 50} if endpoint == "ListeTumu" else {"detay": DETAIL}
        with patch.object(public, "halk_read", side_effect=read) as request, patch.object(public.time, "sleep"):
            rows = public.collect_halk(bank, max_pages=2)
        self.assertEqual(len(rows), 1)
        self.assertEqual(request.call_count, 3)

    def test_ziraat_future_physical_auction_not_rejected_by_timeup_template(self):
        html = """<div class="residence-item">
        <a class="title" href="/gm-details.intengo?gayrimenkulId=123"></a>
        <a class="title" href="/gm-details.intengo?gayrimenkulId=123">Satılık Tarla</a>
        <span class="type">Arsa - Tarla</span><span class="city">Balıkesir / Gönen</span>
        <span>8966 m2</span><span>2.400.000 TL Başlangıç Bedeli</span>
        <span>FİZİKİ İHALE İLE SATILMAKTADIR</span>
        <div class="time-up">İHALE SONA ERDİ</div><span>İHALE TARİHİ: 19.11.2026</span>
        </div>"""
        rows = bank.parse_catalogue("ziraat", html, NOW)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["title"], "Satılık Tarla")
        self.assertEqual(rows[0]["area_m2"], "8966")
        self.assertEqual(bank.parse_catalogue("ziraat", html.replace("19.11.2026", "01.11.2026"), NOW), [])
        self.assertEqual(bank.parse_catalogue("ziraat", html.replace("İHALE TARİHİ: 19.11.2026", ""), NOW), [])


if __name__ == "__main__":
    unittest.main()

import importlib.util
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch

SCRIPTS = Path(__file__).resolve().parents[2] / "scripts"
def load(name):
    spec = importlib.util.spec_from_file_location(name, SCRIPTS / (name + ".py"))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module
bank, catalogue = load("bank_listings"), load("intengo_catalogue")
NOW = datetime(2026, 11, 6, 15, tzinfo=timezone.utc)
def row(i=123, **patches):
    return {"companyName": "vakifbank", "realEstateName": "VakıfBank'tan Satılık Tarla",
            "realEstateNameForUrl": "vakifbank-tan-satilik-tarla", "noticeId": i,
            "introductoryPrice": 2400000, "noTenderSale": False,
            "area": 8966.5, "cityName": "Balıkesir", "townName": "Gönen", **patches}


class CatalogueTests(unittest.TestCase):
    def test_only_official_seller_and_requested_assets(self):
        valid = catalogue.parse_rows("vakifbank", [row(), row(), row(124, companyName="other"),
            row(125, realEstateName="VakıfBank'tan Satılık Daire")], bank, NOW)
        self.assertEqual(len(valid), 1)
        self.assertEqual(valid[0]["area_m2"], "8966.5")
        self.assertEqual(valid[0]["location"], "Balıkesir / Gönen")
        self.assertEqual(valid[0]["price_kind"], "initial_bid")
        self.assertNotIn("image", valid[0])

    def test_expired_ambiguous_and_wrong_scheme_values_rejected(self):
        for patch_data in [{"bidEndingDate": "2020-01-01T10:00:00"},
                           {"bidEndingDate": "broken"}, {"introductoryPrice": -1},
                           {"noTenderSale": None}, {"noticeId": "../123"}]:
            self.assertEqual(catalogue.parse_rows("vakifbank", [row(**patch_data)], bank, NOW), [])
        value = catalogue.parse_rows("vakifbank", [row(noTenderSale=True)], bank, NOW)[0]
        self.assertEqual(value["price_kind"], "asking")

    def test_machine_area_is_not_a_property_fact(self):
        value = catalogue.parse_rows("vakifbank", [row(realEstateName="VakıfBank'tan Satılık Traktör")], bank, NOW)[0]
        self.assertIsNone(value["area_m2"])

    def test_pages_bounded_deduplicated_and_not_only_homepage(self):
        calls = []
        def page(bank_id, index, core):
            calls.append(index)
            return {"totalPages": 100, "content": [row(index * 100 + i) for i in range(20)]}
        with patch.object(catalogue, "search_page", side_effect=page), patch.object(catalogue.time, "sleep"):
            rows = catalogue.collect("vakifbank", bank, target=10, max_pages=3, now=NOW)
        self.assertEqual(len(rows), 40)
        self.assertEqual(calls[0], 0)
        self.assertLessEqual(len(calls), 3)
        self.assertEqual(len({r["external_id"] for r in rows}), len(rows))

    def test_robots_denial_never_makes_search_request(self):
        with patch.object(bank, "robots_allowed", return_value=False), patch.object(bank, "build_opener") as opener:
            with self.assertRaises(bank.SourceUnavailable):
                catalogue.search_page("vakifbank", 0, bank)
            opener.assert_not_called()

    def test_reviewed_records_do_not_consume_ten_draft_target(self):
        import sys
        rows = [{**row(), "bank_id": "vakifbank", "contact_phone": "", "external_id": str(i)} for i in range(12)]
        responses = iter(["transferred", "rejected"] + ["draft"] * 10)
        # Register the dynamically loaded core because main injects it into collectors.
        with patch.dict(sys.modules, {"bank_listings": bank, "intengo_catalogue": catalogue}), \
             patch.object(sys, "argv", ["bank_listings.py", "--bank", "vakifbank"]), \
             patch.object(catalogue, "collect", return_value=rows), \
             patch.object(bank, "oidc_token", return_value="test-only"), \
             patch.object(bank, "import_draft", side_effect=lambda *a: next(responses)) as importer, \
             patch.object(bank.time, "sleep"), patch("builtins.print") as output:
            self.assertEqual(bank.main(), 0)
        import json
        summary = json.loads(output.call_args.args[0])
        self.assertEqual(summary["accepted"], 10)
        self.assertEqual(summary["attempted"], 12)
        self.assertEqual(summary["skipped_reviewed"], 2)
        self.assertEqual(summary["shortfall"], 0)
        self.assertEqual(importer.call_count, 12)


if __name__ == "__main__":
    unittest.main()

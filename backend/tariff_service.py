import requests
from bs4 import BeautifulSoup
import re
import datetime
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("tariff_service")

DEFAULT_BASE_RATE = 0.5429  # NIS before VAT (approx 54.29 agorot)
VAT_RATE = 0.17  # 17% Israeli VAT
DEFAULT_RATE_WITH_VAT = round(DEFAULT_BASE_RATE * (1 + VAT_RATE), 4)  # ~0.6352 NIS

class ElectricityTariffService:
    def __init__(self):
        self.cached_tariff = None
        self.last_checked = None

    def get_current_tariff(self, force_refresh=False):
        now = datetime.datetime.now()
        # Cache for 6 hours unless force_refresh is True
        if not force_refresh and self.cached_tariff and self.last_checked:
            if (now - self.last_checked).total_seconds() < 21600:
                return self.cached_tariff

        tariff = self._fetch_tariff_online()
        self.cached_tariff = tariff
        self.last_checked = now
        return tariff

    def _fetch_tariff_online(self):
        """Attempts to scrape or retrieve the latest electricity tariff for residential users in Israel."""
        tariff_data = {
            "base_rate": DEFAULT_BASE_RATE,
            "vat_percent": 17.0,
            "rate_with_vat": DEFAULT_RATE_WITH_VAT,
            "unit": "NIS / kWh",
            "last_updated": datetime.date.today().isoformat(),
            "source": "Default Official Israeli Electricity Authority Tariff (July 2026)",
            "is_live": False
        }

        # Try online sources
        try:
            # Check IEC website or gov.il API/scraping
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
            res = requests.get("https://www.iec.co.il/home/rates/residential", headers=headers, timeout=5)
            if res.status_code == 200:
                # Look for numbers matching typical rates (e.g. 63.52 or 0.635)
                matches = re.findall(r'(\d{2}\.\d{2})\s*אגורות', res.text)
                if matches:
                    agorot = float(matches[0])
                    rate_with_vat = round(agorot / 100.0, 4)
                    base_rate = round(rate_with_vat / (1 + VAT_RATE), 4)
                    tariff_data.update({
                        "base_rate": base_rate,
                        "rate_with_vat": rate_with_vat,
                        "source": "Israel Electric Corporation (Live Site)",
                        "is_live": True
                    })
                    logger.info(f"Fetched live tariff: {rate_with_vat} NIS/kWh")
                    return tariff_data
        except Exception as e:
            logger.warning(f"Could not fetch live tariff online: {e}. Using official default.")

        return tariff_data

tariff_service = ElectricityTariffService()

if __name__ == "__main__":
    t = tariff_service.get_current_tariff(force_refresh=True)
    print("Tariff Info:", t)

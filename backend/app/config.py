import os
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parents[2]  # .../backend
DATA_DIR = BASE_DIR / "data"

class Settings:
   # PRIVACY_OSCAL_PATH: Path = Path(
   #     os.environ.get("OG_PRIVACY_OSCAL_PATH", "/opengov-privacy-oscal")
   # )
   # SECURITY_OSCAL_PATH: Path = Path(
   #     os.environ.get("OG_SECURITY_OSCAL_PATH", "/opengov-security-oscal")
   # )

    PRIVACY_OSCAL_PATH: Path = DATA_DIR / "opengov-privacy-oscal"
    SECURITY_OSCAL_PATH: Path = DATA_DIR / "opengov-security-oscal"

    # symbolische Namen → echte Dateien
    PRIVACY_CATALOG_NAME = "open_privacy_catalog_risk"
    PRIVACY_CATALOG_FILE = PRIVACY_OSCAL_PATH / "oscal" / "catalog" / "open_privacy_catalog_risk.json"

    SDM_PRIVACY_CATALOG_NAME = "sdm_privacy_catalog"
    SDM_PRIVACY_CATALOG_FILE = PRIVACY_OSCAL_PATH / "oscal" / "catalog" / "sdm_privacy_catalog.json"

    RESILIENCE_CATALOG_NAME = "resilience_baseline_catalog"
    RESILIENCE_CATALOG_FILE = SECURITY_OSCAL_PATH / "oscal" / "catalog" / "resilience_baseline_catalog.json"

    SDM_MAPPING_NAME = "sdm_privacy_to_security"
    SDM_MAPPING_FILE = SECURITY_OSCAL_PATH / "mappings" / "sdm_privacy_to_security.json"


settings = Settings()

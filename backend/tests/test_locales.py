from app.locales import locale_direction, locale_registry, resolve_locale, supported_locale_tags


EXPECTED_LOCALES = (
    "en",
    "zh-Hans",
    "hi",
    "es",
    "ar",
    "fr",
    "bn",
    "pt",
    "id",
    "ur",
    "nl",
)


def test_frozen_v1_locale_set_and_order() -> None:
    assert supported_locale_tags() == EXPECTED_LOCALES
    assert locale_registry()["source_locale"] == "en"
    assert locale_registry()["fallback_locale"] == "en"


def test_locale_resolution_accepts_aliases_and_language_variants() -> None:
    assert resolve_locale("zh-CN") == "zh-Hans"
    assert resolve_locale("pt_BR") == "pt"
    assert resolve_locale("es-AR") == "es"
    assert resolve_locale("nl-BE") == "nl"
    assert resolve_locale("fr-CH,fr;q=0.8,en;q=0.5") == "fr"


def test_unknown_or_unsupported_locale_falls_back_to_english() -> None:
    assert resolve_locale(None) == "en"
    assert resolve_locale("") == "en"
    assert resolve_locale("de-DE") == "en"
    assert resolve_locale("zh-Hant") == "en"
    assert resolve_locale("*") == "en"


def test_only_arabic_and_urdu_are_right_to_left() -> None:
    assert locale_direction("ar") == "rtl"
    assert locale_direction("ur-PK") == "rtl"
    assert locale_direction("en") == "ltr"
    assert locale_direction("unknown") == "ltr"

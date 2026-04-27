"""One-off script to inject the `hairstyle_gallery` section into per-locale ai/image.json.

Run from repo root:
    python scripts/add-hairstyle-gallery-section.py
"""

import json
import os
from pathlib import Path

# Localized category titles reused from generator.categories in each locale's own file.
CATEGORY_TITLES = {
    "en": {
        "men": "Men's Hairstyles",
        "women": "Women's Hairstyles",
        "boys": "Boys' Hairstyles",
        "girls": "Girls' Hairstyles",
    },
    "de": {
        "men": "Herrenfrisuren",
        "women": "Damenfrisuren",
        "boys": "Jungenfrisuren",
        "girls": "Mädchenfrisuren",
    },
    "es": {
        "men": "Peinados para Hombres",
        "women": "Peinados para Mujeres",
        "boys": "Peinados para Niños",
        "girls": "Peinados para Niñas",
    },
    "it": {
        "men": "Acconciature Uomo",
        "women": "Acconciature Donna",
        "boys": "Acconciature Bambino",
        "girls": "Acconciature Bambina",
    },
    "ja": {
        "men": "メンズヘアスタイル",
        "women": "レディースヘアスタイル",
        "boys": "男の子ヘアスタイル",
        "girls": "女の子ヘアスタイル",
    },
    "ko": {
        "men": "남성 헤어스타일",
        "women": "여성 헤어스타일",
        "boys": "남아 헤어스타일",
        "girls": "여아 헤어스타일",
    },
    "pt": {
        "men": "Penteados Masculinos",
        "women": "Penteados Femininos",
        "boys": "Penteados para Meninos",
        "girls": "Penteados para Meninas",
    },
    "zh": {
        "men": "男士发型",
        "women": "女士发型",
        "boys": "男童发型",
        "girls": "女童发型",
    },
}

# Descriptions and CTA labels stay in English for now (translate later).
CATEGORY_DESCRIPTIONS = {
    "men": "197 men's haircuts including fades, buzz cuts, crops, quiffs, undercuts, textured crops, and classic side parts. Preview every cut on your own photo before booking your barber.",
    "women": "240 women's haircuts including bobs, pixies, long layers, beach waves, lobs, bangs, and curly styles. Test length, texture, and color before a salon appointment.",
    "boys": "56 kid-friendly boys' haircuts — tapered cuts, short combs, textured tops, and school-ready classics. Parents can preview any cut in seconds.",
    "girls": "85 girls' hairstyles — long layers, braids, bangs, trendy bobs, and playful curls. Safe, family-friendly previews for every age.",
}

CATEGORY_CTA = {
    "men": "Try men's styles",
    "women": "Try women's styles",
    "boys": "Try boys' styles",
    "girls": "Try girls' styles",
}


def build_section(locale: str) -> dict:
    titles = CATEGORY_TITLES[locale]
    return {
        "block": "hairstyle-gallery",
        "id": "hairstyle_gallery",
        "title": "Explore Hairstyles by Category",
        "description": "Browse 500+ AI-ready haircuts grouped by Men, Women, Boys, and Girls. Tap any style to try it on your own photo with the free AI hairstyle changer.",
        "limit": 8,
        "cta_url": "/ai-brow-tint-generator",
        "categories": [
            {
                "key": key,
                "title": titles[key],
                "description": CATEGORY_DESCRIPTIONS[key],
                "cta_label": CATEGORY_CTA[key],
            }
            for key in ("men", "women", "boys", "girls")
        ],
        "tip": "Every preview is free to try. New AI hairstyles are added regularly.",
    }


def inject(path: Path, locale: str) -> None:
    with path.open(encoding="utf-8") as f:
        data = json.load(f)

    page = data.get("page", {})
    sections = page.setdefault("sections", {})
    show = page.setdefault("show_sections", [])

    # 1. Insert into show_sections before "testimonials" if missing.
    if "hairstyle_gallery" not in show:
        if "testimonials" in show:
            show.insert(show.index("testimonials"), "hairstyle_gallery")
        else:
            show.append("hairstyle_gallery")

    # 2. Rebuild sections dict preserving insertion order with gallery before testimonials.
    if "hairstyle_gallery" not in sections:
        new_sections = {}
        inserted = False
        for key, value in sections.items():
            if key == "testimonials" and not inserted:
                new_sections["hairstyle_gallery"] = build_section(locale)
                inserted = True
            new_sections[key] = value
        if not inserted:
            new_sections["hairstyle_gallery"] = build_section(locale)
        page["sections"] = new_sections

    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")


def main() -> None:
    root = Path(__file__).resolve().parent.parent
    messages_dir = root / "src" / "config" / "locale" / "messages"
    # Process both the ai-hairstyle-changer page and the home landing page across all locales.
    # The en versions may already have manual edits; the injection functions are idempotent.
    targets = [
        ("ai", "image.json"),
        ("pages", "index.json"),
    ]
    for locale in ("en", "de", "es", "it", "ja", "ko", "pt", "zh"):
        for sub, filename in targets:
            path = messages_dir / locale / sub / filename
            if not path.exists():
                print(f"SKIP missing: {path}")
                continue
            inject(path, locale)
            print(f"OK  {locale}/{sub}/{filename}")


if __name__ == "__main__":
    main()

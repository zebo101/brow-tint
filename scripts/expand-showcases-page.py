"""One-off script to expand pages/showcases.json with gallery + video + usage + faq + cta.

Keeps the existing `showcases` section verbatim, then adds:
  - hairstyle_gallery (DB-sourced grid, 12 per category)
  - video_demo (features-accordion with /video/v1.mp4 + v2.mp4)
  - usage (features-step how-to)
  - faq (SEO Q&A)
  - cta

Run from repo root:
    python scripts/expand-showcases-page.py
"""

import json
from pathlib import Path

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

GALLERY_CATEGORY_DESCRIPTIONS = {
    "men": "Hand-picked men's haircuts — fades, crops, quiffs, buzz cuts, and classic side parts. See real examples before your next barber visit.",
    "women": "Trending women's cuts — bobs, pixies, long layers, beach waves, and bangs. Preview length, texture, and color before committing.",
    "boys": "Curated boys' cuts for every age — tapered tops, short combs, and textured school-ready classics.",
    "girls": "Popular girls' hairstyles — long layers, braids, trendy bobs, and playful curls. Family-friendly previews for every age.",
}


def build_hairstyle_gallery(locale: str) -> dict:
    titles = CATEGORY_TITLES[locale]
    return {
        "block": "hairstyle-gallery",
        "id": "hairstyle_gallery",
        "title": "Browse the Full Hairstyle Library",
        "description": "Scroll through our 500+ AI-ready cuts organized by gender and age. Click any look to preview it on your own photo.",
        "limit": 12,
        "cta_url": "/ai-brow-tint-generator",
        "categories": [
            {
                "key": key,
                "title": titles[key],
                "description": GALLERY_CATEGORY_DESCRIPTIONS[key],
                "cta_label": "Try now",
            }
            for key in ("men", "women", "boys", "girls")
        ],
        "tip": "Every preview is free. New AI hairstyles are added regularly.",
    }


def build_video_demo() -> dict:
    return {
        "block": "features-accordion",
        "id": "video_demo",
        "label": "Video Demo",
        "title": "See AI Barber in Action",
        "description": "Watch real hairstyle transformations — from upload to download in seconds.",
        "items": [
            {
                "title": "Try Multiple Hairstyles in Seconds",
                "description": "Upload one photo and watch it try on several distinct cuts and colors, side by side.",
                "icon": "RiPlayCircleLine",
                "image": {
                    "src": "/video/v1.mp4",
                    "alt": "AI hairstyle transformation demo video",
                },
            },
            {
                "title": "Preview Hair Movement and Texture",
                "description": "See how bangs, layers, curls, and volume flow with realistic motion — before you commit to the cut.",
                "icon": "RiFilmLine",
                "image": {
                    "src": "/video/v2.mp4",
                    "alt": "Hair texture and movement preview video",
                },
            },
        ],
    }


def build_usage() -> dict:
    return {
        "block": "features-step",
        "id": "usage",
        "label": "How It Works",
        "title": "From Photo to New Hairstyle in 4 Steps",
        "description": "AI Barber is built for fast, realistic hairstyle previews. No install, no signup needed to try.",
        "image_position": "left",
        "text_align": "center",
        "items": [
            {
                "title": "Upload a Clear Front-Facing Photo",
                "description": "Good lighting and a visible hairline give the AI the most accurate map of your face.",
            },
            {
                "title": "Pick a Hairstyle From the Gallery",
                "description": "Browse 500+ AI hairstyles across men, women, boys, and girls — or describe a custom look.",
            },
            {
                "title": "Fine-Tune Length, Texture, and Color",
                "description": "Add an optional prompt to dial in bangs, layers, highlights, or a specific color.",
            },
            {
                "title": "Generate, Compare, and Download",
                "description": "Generate multiple looks, compare side-by-side, and download your favorite to share with your stylist.",
            },
        ],
    }


def build_faq() -> dict:
    return {
        "id": "faq",
        "title": "Hairstyle Preview FAQ",
        "description": "Common questions about AI hairstyle previews, photo tips, and how to get the best results.",
        "items": [
            {
                "question": "Are the AI hairstyle previews in this gallery free?",
                "answer": "Yes. You can browse every style for free and generate previews on your own photo with a free trial.",
            },
            {
                "question": "Will the AI preview match my real haircut?",
                "answer": "AI Barber renders realistic cuts, colors, and textures that blend with your hairline. Actual results still depend on your hair type and your stylist — we recommend downloading your preview and sharing it with your barber.",
            },
            {
                "question": "How many hairstyles can I try?",
                "answer": "There are 500+ curated hairstyles in the gallery, covering men's, women's, boys', and girls' cuts. You can also describe custom styles with your own prompt.",
            },
            {
                "question": "Do I need to install an app?",
                "answer": "No. AI Barber runs entirely in your browser — on mobile or desktop. No downloads or plugins required.",
            },
            {
                "question": "What photo works best for a hairstyle preview?",
                "answer": "Use a clear, front-facing photo with even lighting. Avoid sunglasses, hats, or heavy filters. A neutral expression with visible hairline gives the AI the most to work with.",
            },
            {
                "question": "Is my photo kept private?",
                "answer": "Your uploaded photos are processed securely for generation only. They are not stored permanently or shared with third parties.",
            },
            {
                "question": "Can boys and girls try these hairstyles safely?",
                "answer": "Yes. The kids' sections are family-friendly and cover everyday cuts. Parents can preview any look before visiting the salon.",
            },
            {
                "question": "Does AI Barber support color changes only?",
                "answer": "Yes. You can preview a color change on your current cut — black, blonde, copper, silver, pink, blue, and more — or combine color with a new style.",
            },
        ],
    }


def build_cta() -> dict:
    return {
        "id": "cta",
        "title": "Ready to Try a New Hairstyle?",
        "description": "Upload your photo and preview every look in the gallery — completely free, no install required.",
        "buttons": [
            {
                "title": "Try AI Barber now",
                "url": "/ai-brow-tint-generator",
                "target": "_self",
                "icon": "Zap",
            }
        ],
        "className": "bg-muted",
    }


def rebuild_page(data: dict, locale: str) -> None:
    page = data.setdefault("page", {})
    original_sections = page.get("sections", {}) or {}
    showcases_section = original_sections.get("showcases")

    new_sections: dict = {}
    if showcases_section is not None:
        new_sections["showcases"] = showcases_section
    new_sections["hairstyle_gallery"] = build_hairstyle_gallery(locale)
    new_sections["video_demo"] = build_video_demo()
    new_sections["usage"] = build_usage()
    new_sections["faq"] = build_faq()
    new_sections["cta"] = build_cta()
    page["sections"] = new_sections

    page["show_sections"] = [
        "showcases",
        "hairstyle_gallery",
        "video_demo",
        "usage",
        "faq",
        "cta",
    ]


def main() -> None:
    root = Path(__file__).resolve().parent.parent
    messages_dir = root / "src" / "config" / "locale" / "messages"
    for locale in ("en", "de", "es", "it", "ja", "ko", "pt", "zh"):
        path = messages_dir / locale / "pages" / "showcases.json"
        if not path.exists():
            print(f"SKIP missing: {path}")
            continue
        with path.open(encoding="utf-8") as f:
            data = json.load(f)
        rebuild_page(data, locale)
        with path.open("w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            f.write("\n")
        print(f"OK  {locale}")


if __name__ == "__main__":
    main()

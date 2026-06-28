from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
ANDROID_RES = ROOT / "android" / "app" / "src" / "main" / "res"

BACKGROUND_TOP = "#14232F"
BACKGROUND_BOTTOM = "#342418"
PAPER = "#F6E8C9"
PAPER_EDGE = "#D7B46F"
PAGE_SHADOW = "#E7CD8C"
INK = "#5A432C"
SCROLL_SILK = "#8C5524"
SCROLL_DARK = "#5D3416"
BOOKMARK = "#C86532"


def hex_to_rgb(value: str) -> tuple[int, int, int]:
    value = value.lstrip("#")
    return tuple(int(value[index : index + 2], 16) for index in (0, 2, 4))


def lerp(a: int, b: int, t: float) -> int:
    return round(a + (b - a) * t)


def scale_box(box: tuple[float, float, float, float], factor: float) -> tuple[int, int, int, int]:
    return tuple(round(value * factor) for value in box)


def draw_gradient_background(size: int) -> Image.Image:
    top = hex_to_rgb(BACKGROUND_TOP)
    bottom = hex_to_rgb(BACKGROUND_BOTTOM)
    image = Image.new("RGBA", (size, size), top + (255,))
    draw = ImageDraw.Draw(image)

    for y in range(size):
        t = y / max(size - 1, 1)
        color = tuple(lerp(top[index], bottom[index], t) for index in range(3))
        draw.line([(0, y), (size, y)], fill=color + (255,))

    glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    glow_draw.ellipse(
        (-round(size * 0.25), -round(size * 0.18), round(size * 0.92), round(size * 0.72)),
        fill=(181, 128, 55, 46),
    )
    glow_draw.ellipse(
        (round(size * 0.36), round(size * 0.48), round(size * 1.18), round(size * 1.08)),
        fill=(42, 99, 113, 38),
    )
    image.alpha_composite(glow.filter(ImageFilter.GaussianBlur(round(size * 0.04))))
    return image


def draw_jokja_mark(size: int, monochrome: bool = False, shadow: bool = True) -> Image.Image:
    factor = size / 1024
    mark = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(mark)

    if monochrome:
        paper = edge = page_shadow = ink = silk = dark = bookmark = (255, 255, 255, 255)
        subtle = (255, 255, 255, 185)
    else:
        paper = hex_to_rgb(PAPER) + (255,)
        edge = hex_to_rgb(PAPER_EDGE) + (255,)
        page_shadow = hex_to_rgb(PAGE_SHADOW) + (255,)
        ink = hex_to_rgb(INK) + (220,)
        silk = hex_to_rgb(SCROLL_SILK) + (255,)
        dark = hex_to_rgb(SCROLL_DARK) + (255,)
        bookmark = hex_to_rgb(BOOKMARK) + (255,)
        subtle = hex_to_rgb("#CDAE72") + (150,)

    if shadow:
        shadow_layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        shadow_draw = ImageDraw.Draw(shadow_layer)
        shadow_draw.rounded_rectangle(
            scale_box((300, 126, 724, 880), factor),
            radius=round(42 * factor),
            fill=(0, 0, 0, 82),
        )
        shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(round(22 * factor)))
        mark.alpha_composite(shadow_layer, (round(0 * factor), round(18 * factor)))

    cord = (206, 154, 101, 230) if not monochrome else (255, 255, 255, 210)
    draw.line(
        [(round(512 * factor), round(112 * factor)), (round(418 * factor), round(204 * factor))],
        fill=cord,
        width=max(round(14 * factor), 1),
    )
    draw.line(
        [(round(512 * factor), round(112 * factor)), (round(606 * factor), round(204 * factor))],
        fill=cord,
        width=max(round(14 * factor), 1),
    )
    draw.ellipse(
        scale_box((474, 74, 550, 150), factor),
        outline=cord,
        width=max(round(12 * factor), 1),
    )

    draw.rounded_rectangle(
        scale_box((334, 190, 690, 238), factor),
        radius=round(24 * factor),
        fill=dark,
    )
    draw.rounded_rectangle(
        scale_box((304, 216, 720, 824), factor),
        radius=round(34 * factor),
        fill=silk,
    )
    draw.rounded_rectangle(
        scale_box((334, 258, 690, 758), factor),
        radius=round(22 * factor),
        fill=paper,
        outline=edge,
        width=max(round(8 * factor), 1),
    )
    draw.rounded_rectangle(
        scale_box((360, 286, 664, 730), factor),
        radius=round(12 * factor),
        outline=subtle,
        width=max(round(4 * factor), 1),
    )

    for y in (250, 766):
        draw.rectangle(scale_box((312, y, 712, y + 22), factor), fill=page_shadow)

    draw.rounded_rectangle(
        scale_box((300, 806, 724, 856), factor),
        radius=round(25 * factor),
        fill=dark,
    )
    draw.rounded_rectangle(
        scale_box((330, 796, 694, 838), factor),
        radius=round(21 * factor),
        fill=silk,
    )

    draw.polygon(
        [
            (round(610 * factor), round(258 * factor)),
            (round(690 * factor), round(258 * factor)),
            (round(690 * factor), round(338 * factor)),
        ],
        fill=bookmark,
    )
    draw.line(
        [(round(610 * factor), round(258 * factor)), (round(690 * factor), round(338 * factor))],
        fill=(117, 66, 35, 120) if not monochrome else (255, 255, 255, 150),
        width=max(round(5 * factor), 1),
    )

    lines = [
        (408, 386, 616, 410),
        (394, 466, 630, 490),
        (420, 546, 604, 570),
        (432, 626, 592, 650),
    ]
    for line in lines:
        draw.rounded_rectangle(
            scale_box(line, factor),
            radius=round(12 * factor),
            fill=ink,
        )

    rotated = mark.rotate(-3, resample=Image.Resampling.BICUBIC, center=(size / 2, size / 2))
    return rotated


def composite_icon(size: int) -> Image.Image:
    icon = draw_gradient_background(size)
    icon.alpha_composite(draw_jokja_mark(size, shadow=True))
    return icon.convert("RGB")


def round_masked_icon(size: int) -> Image.Image:
    icon = composite_icon(size).convert("RGBA")
    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((0, 0, size - 1, size - 1), fill=255)
    icon.putalpha(mask)
    return icon


def resize(image: Image.Image, size: int) -> Image.Image:
    return image.resize((size, size), Image.Resampling.LANCZOS)


def save_png(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, optimize=True)


def save_webp(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, "WEBP", lossless=True, quality=100, method=6)


def main() -> None:
    icon_1024 = composite_icon(1024)
    background_1080 = draw_gradient_background(1080)
    foreground_1080 = draw_jokja_mark(1080, shadow=True)
    monochrome_1080 = draw_jokja_mark(1080, monochrome=True, shadow=False)

    save_png(icon_1024, ASSETS / "icon.png")
    save_png(background_1080, ASSETS / "android-icon-background.png")
    save_png(foreground_1080, ASSETS / "android-icon-foreground.png")
    save_png(monochrome_1080, ASSETS / "android-icon-monochrome.png")
    save_png(resize(icon_1024, 48), ASSETS / "favicon.png")
    save_png(draw_jokja_mark(1024, shadow=True), ASSETS / "splash-icon.png")

    densities = {
        "mdpi": (48, 108, 288),
        "hdpi": (72, 162, 432),
        "xhdpi": (96, 216, 576),
        "xxhdpi": (144, 324, 864),
        "xxxhdpi": (192, 432, 1152),
    }

    for density, (legacy_size, adaptive_size, splash_size) in densities.items():
        mipmap = ANDROID_RES / f"mipmap-{density}"
        drawable = ANDROID_RES / f"drawable-{density}"
        save_webp(resize(icon_1024, legacy_size).convert("RGBA"), mipmap / "ic_launcher.webp")
        save_webp(round_masked_icon(legacy_size), mipmap / "ic_launcher_round.webp")
        save_webp(resize(background_1080, adaptive_size), mipmap / "ic_launcher_background.webp")
        save_webp(resize(foreground_1080, adaptive_size), mipmap / "ic_launcher_foreground.webp")
        save_webp(resize(monochrome_1080, adaptive_size), mipmap / "ic_launcher_monochrome.webp")
        save_png(resize(draw_jokja_mark(1152, shadow=True), splash_size), drawable / "splashscreen_logo.png")


if __name__ == "__main__":
    main()

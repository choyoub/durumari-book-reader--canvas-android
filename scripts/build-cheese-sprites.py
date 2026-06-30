from __future__ import annotations

from collections import deque
from dataclasses import dataclass
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
CONCEPTS = ROOT / "assets" / "avatars" / "cheese" / "concepts"
SPRITES = ROOT / "assets" / "avatars" / "cheese" / "sprites"
CELL = 192


@dataclass(frozen=True)
class SheetSpec:
    name: str
    rows: int
    cols: int = 5
    crop_mode: str = "grid"


SHEETS = {
    "sit": SheetSpec(name="sit", rows=8),
    "lie": SheetSpec(name="lie", rows=6, cols=4),
    "sleep": SheetSpec(name="sleep", rows=5),
    "walk": SheetSpec(name="walk", rows=5),
    "stretch": SheetSpec(name="stretch", rows=4),
    "groom": SheetSpec(name="groom", rows=4, cols=6),
    "play": SheetSpec(name="play", rows=4, cols=6),
    "alert": SheetSpec(name="alert", rows=4, cols=6),
    "drag": SheetSpec(name="drag", rows=4, cols=6),
    "fall": SheetSpec(name="fall", rows=3, cols=6, crop_mode="component"),
    "land": SheetSpec(name="land", rows=3, cols=6, crop_mode="component"),
}


def is_background(pixel: tuple[int, int, int, int]) -> bool:
    r, g, b, _ = pixel
    high_value = r > 218 and g > 210 and b > 195
    low_saturation = max(r, g, b) - min(r, g, b) < 42
    near_warm_sheet = r >= g >= b and (r - b) < 55
    soft_shadow = r > 150 and g > 140 and b > 130 and low_saturation
    return (high_value and (low_saturation or near_warm_sheet)) or soft_shadow


def flood_clear_background(cell: Image.Image) -> Image.Image:
    rgba = cell.convert("RGBA")
    pixels = rgba.load()
    width, height = rgba.size
    visited = set()
    queue: deque[tuple[int, int]] = deque()

    for x in range(width):
        queue.append((x, 0))
        queue.append((x, height - 1))
    for y in range(height):
        queue.append((0, y))
        queue.append((width - 1, y))

    while queue:
        x, y = queue.popleft()
        if (x, y) in visited or x < 0 or y < 0 or x >= width or y >= height:
            continue
        visited.add((x, y))
        if not is_background(pixels[x, y]):
            continue
        pixels[x, y] = (255, 255, 255, 0)
        queue.append((x + 1, y))
        queue.append((x - 1, y))
        queue.append((x, y + 1))
        queue.append((x, y - 1))

    return rgba


def source_box(
    col: int,
    row: int,
    source_width: int,
    source_height: int,
    spec: SheetSpec,
) -> tuple[int, int, int, int]:
    raw_cell_width = source_width / spec.cols
    raw_cell_height = source_height / spec.rows
    left = round(col * raw_cell_width)
    upper = round(row * raw_cell_height)
    right = round((col + 1) * raw_cell_width)
    lower = round((row + 1) * raw_cell_height)
    return left, upper, right, lower


def component_boxes(row_image: Image.Image, expected_cols: int) -> list[tuple[int, int, int, int]]:
    rgba = row_image.convert("RGBA")
    pixels = rgba.load()
    width, height = rgba.size
    visited = set()
    components: list[tuple[int, int, int, int, int]] = []

    for start_y in range(height):
        for start_x in range(width):
            if (start_x, start_y) in visited or is_background(pixels[start_x, start_y]):
                continue

            queue: deque[tuple[int, int]] = deque([(start_x, start_y)])
            visited.add((start_x, start_y))
            min_x = max_x = start_x
            min_y = max_y = start_y
            area = 0

            while queue:
                x, y = queue.popleft()
                area += 1
                min_x = min(min_x, x)
                max_x = max(max_x, x)
                min_y = min(min_y, y)
                max_y = max(max_y, y)

                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if nx < 0 or ny < 0 or nx >= width or ny >= height or (nx, ny) in visited:
                        continue
                    visited.add((nx, ny))
                    if is_background(pixels[nx, ny]):
                        continue
                    queue.append((nx, ny))

            if area >= 300:
                components.append((area, min_x, min_y, max_x + 1, max_y + 1))

    if len(components) < expected_cols:
        return []

    selected = sorted(components, reverse=True)[:expected_cols]
    boxes = []
    for _, left, upper, right, lower in sorted(selected, key=lambda item: item[1]):
        boxes.append((
            max(0, left - 18),
            max(0, upper - 18),
            min(width, right + 18),
            min(height, lower + 18),
        ))
    return boxes


def source_boxes_for_row(source: Image.Image, row: int, spec: SheetSpec) -> list[tuple[int, int, int, int]]:
    if spec.crop_mode != "component":
        return [source_box(col, row, source.width, source.height, spec) for col in range(spec.cols)]

    raw_cell_height = source.height / spec.rows
    upper = round(row * raw_cell_height)
    lower = round((row + 1) * raw_cell_height)
    row_image = source.crop((0, upper, source.width, lower))
    detected = component_boxes(row_image, spec.cols)
    if detected:
        return [(left, upper + top, right, upper + bottom) for left, top, right, bottom in detected]
    return [source_box(col, row, source.width, source.height, spec) for col in range(spec.cols)]


def make_checker_preview(preview: Image.Image) -> Image.Image:
    checker = Image.new("RGBA", preview.size, (255, 255, 255, 255))
    checker_pixels = checker.load()
    tile = 16
    for y in range(preview.height):
        for x in range(preview.width):
            shade = 232 if ((x // tile) + (y // tile)) % 2 == 0 else 204
            checker_pixels[x, y] = (shade, shade, shade, 255)
    checker.alpha_composite(preview)
    return checker


def build_sheet(spec: SheetSpec) -> None:
    source = Image.open(CONCEPTS / f"{spec.name}.png").convert("RGBA")
    SPRITES.mkdir(parents=True, exist_ok=True)

    sprite = Image.new("RGBA", (spec.cols * CELL, spec.rows * CELL), (255, 255, 255, 0))

    for row in range(spec.rows):
        row_boxes = source_boxes_for_row(source, row, spec)
        for col, box in enumerate(row_boxes):
            crop = source.crop(box)
            crop.thumbnail((CELL, CELL), Image.Resampling.LANCZOS)
            cell = Image.new("RGBA", (CELL, CELL), (255, 255, 255, 0))
            x = (CELL - crop.width) // 2
            y = CELL - crop.height
            cell.alpha_composite(crop, (x, y))
            cell = flood_clear_background(cell)
            sprite.alpha_composite(cell, (col * CELL, row * CELL))

    out_sprite = SPRITES / f"{spec.name}.png"
    out_preview = SPRITES / f"{spec.name}-preview.png"
    out_checker_preview = SPRITES / f"{spec.name}-preview-checker.png"

    sprite.save(out_sprite)

    preview = sprite.copy()
    preview.thumbnail((480, 768), Image.Resampling.LANCZOS)
    preview.save(out_preview)
    make_checker_preview(preview).save(out_checker_preview)

    print(f"wrote {out_sprite}")
    print(f"wrote {out_preview}")
    print(f"wrote {out_checker_preview}")


def main() -> None:
    for spec in SHEETS.values():
        build_sheet(spec)


if __name__ == "__main__":
    main()

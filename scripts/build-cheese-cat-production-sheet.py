from __future__ import annotations

import json
import math
from collections import deque
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
CONCEPT_DIR = ROOT / "assets" / "avatars" / "concepts"
OUT_DIR = ROOT / "assets" / "avatars" / "cats"
CATALOG_PATH = OUT_DIR / "cheese-cat-v1-action-catalog.json"
CELL = 96


SOURCES = {
    "core": {
        "path": CONCEPT_DIR / "cheese-cat-polished-action-sheet-v2.png",
        "cols": 7,
        "rows": 8,
    },
    "ambient": {
        "path": CONCEPT_DIR / "cheese-cat-ambient-sheet-v1.png",
        "cols": 6,
        "rows": 9,
    },
    "interaction": {
        "path": CONCEPT_DIR / "cheese-cat-interaction-sheet-v1.png",
        "cols": 8,
        "rows": 8,
    },
    "drag": {
        "path": CONCEPT_DIR / "cheese-cat-drag-scruff-sheet-v1.png",
        "cols": 7,
        "rows": 3,
    },
}


# Coordinates are concept-sheet grid positions, not final engine positions.
# They are chosen from the best-looking frames in the generated art sheets.
CROP_PLAN = {
    "sit_tail": ("ambient", [(0, c) for c in [0, 1, 2, 3, 1, 0]]),
    "sit_blink": ("ambient", [(0, c) for c in [0, 2, 3, 0]]),
    "sit_ear_twitch": ("ambient", [(0, c) for c in [0, 3, 3, 0]]),
    "sit_look_back": ("ambient", [(0, c) for c in [4, 5, 4, 5, 4, 0]]),
    "sit_paw_tidy": ("ambient", [(4, c) for c in [0, 1, 2, 3, 4, 5]]),
    "lie_tail": ("ambient", [(1, c) for c in [0, 1, 2, 3, 4, 5]]),
    "lie_forepaw_stretch": ("ambient", [(1, c) for c in [0, 1, 5, 6, 5]]),
    "lie_roll": ("ambient", [(2, c) for c in [0, 1, 2, 5, 2]]),
    "sleep_breathe": ("ambient", [(3, c) for c in [0, 1, 2, 3, 4, 5]]),
    "sleep_twitch": ("ambient", [(2, c) for c in [2, 3, 4, 2]]),
    "walk_side": ("core", [(2, c) for c in [0, 1, 2, 3, 0, 1]]),
    "walk_pause_sniff": ("ambient", [(6, c) for c in [0, 1, 2, 3, 4]]),
    "turn_around": ("interaction", [(7, c) for c in [0, 1, 2, 4, 5, 6]]),
    "stretch_yawn": ("ambient", [(5, c) for c in [0, 1, 2, 3, 4, 3]]),
    "groom_face": ("ambient", [(4, c) for c in [0, 1, 2, 3, 4, 5]]),
    "groom_body": ("ambient", [(4, c) for c in [2, 3, 4, 5, 4, 5]]),
    "play_paw_tap": ("interaction", [(5, c) for c in [0, 1, 2, 3, 4]]),
    "play_tail_chase": ("interaction", [(6, c) for c in [1, 2, 3, 4, 5]]),
    "alert_touch": ("interaction", [(0, c) for c in [0, 1, 2, 3, 4, 5]]),
    "drag_scruff_sway": ("drag", [(0, c) for c in range(7)] + [(1, c) for c in range(7)]),
    "fall_loop": ("interaction", [(3, c) for c in [0, 1, 2, 3, 4]]),
    "land_recover": ("interaction", [(4, c) for c in [4, 5, 6, 7, 6, 7]]),
    "back_sit_tail": ("ambient", [(8, c) for c in [0, 1, 2, 3, 4, 5]]),
}


def color_distance(a: tuple[int, int, int], b: tuple[int, int, int]) -> float:
    return math.sqrt(sum((int(a[i]) - int(b[i])) ** 2 for i in range(3)))


def cell_box(source_key: str, row: int, col: int) -> tuple[int, int, int, int]:
    source = SOURCES[source_key]
    image = Image.open(source["path"])
    w, h = image.size
    x0 = round(col * w / source["cols"])
    x1 = round((col + 1) * w / source["cols"])
    y0 = round(row * h / source["rows"])
    y1 = round((row + 1) * h / source["rows"])
    return x0, y0, x1, y1


def flood_remove_background(crop: Image.Image) -> Image.Image:
    rgba = crop.convert("RGBA")
    pix = rgba.load()
    w, h = rgba.size

    border_samples = []
    for x in range(w):
        border_samples.append(pix[x, 0][:3])
        border_samples.append(pix[x, h - 1][:3])
    for y in range(h):
        border_samples.append(pix[0, y][:3])
        border_samples.append(pix[w - 1, y][:3])
    bg = tuple(round(sum(c[i] for c in border_samples) / len(border_samples)) for i in range(3))

    visited = set()
    queue = deque()
    for x in range(w):
        queue.append((x, 0))
        queue.append((x, h - 1))
    for y in range(h):
        queue.append((0, y))
        queue.append((w - 1, y))

    threshold = 46
    while queue:
        x, y = queue.popleft()
        if (x, y) in visited or x < 0 or y < 0 or x >= w or y >= h:
            continue
        visited.add((x, y))
        r, g, b, a = pix[x, y]
        if a == 0 or color_distance((r, g, b), bg) <= threshold:
            pix[x, y] = (r, g, b, 0)
            queue.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))

    return rgba


def trim_and_fit(crop: Image.Image) -> Image.Image:
    alpha = crop.getchannel("A")
    bbox = alpha.getbbox()
    if not bbox:
        return Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
    subject = crop.crop(bbox)
    sw, sh = subject.size
    scale = min((CELL - 8) / sw, (CELL - 8) / sh, 1.0)
    size = (max(1, round(sw * scale)), max(1, round(sh * scale)))
    subject = subject.resize(size, Image.Resampling.LANCZOS)
    out = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
    x = (CELL - size[0]) // 2
    y = CELL - size[1] - 4
    if size[1] > CELL - 8:
        y = 4
    out.alpha_composite(subject, (x, y))
    return out


def cut_frame(source_key: str, row: int, col: int) -> Image.Image:
    image = Image.open(SOURCES[source_key]["path"]).convert("RGBA")
    crop = image.crop(cell_box(source_key, row, col))
    crop = flood_remove_background(crop)
    return trim_and_fit(crop)


def make_preview(sheet: Image.Image, rows: int, cols: int) -> Image.Image:
    preview = Image.new("RGBA", sheet.size, (248, 244, 237, 255))
    draw = ImageDraw.Draw(preview)
    for x in range(0, cols * CELL + 1, CELL):
        draw.line([(x, 0), (x, rows * CELL)], fill=(213, 197, 160, 180), width=1)
    for y in range(0, rows * CELL + 1, CELL):
        draw.line([(0, y), (cols * CELL, y)], fill=(213, 197, 160, 180), width=1)
    preview.alpha_composite(sheet)
    return preview


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    actions = catalog["actions"]
    ordered = list(actions.keys())
    max_frames = max(actions[action]["frames"] for action in ordered)

    sheet = Image.new("RGBA", (max_frames * CELL, len(ordered) * CELL), (0, 0, 0, 0))
    manifest = {
        "id": "cheese-cat-v1-production-draft",
        "image": "cheese-cat-v1-production-draft.png",
        "cell": {"width": CELL, "height": CELL},
        "displaySizePx": catalog["cell"]["displaySizePx"],
        "actions": {},
        "sourceCatalog": "cheese-cat-v1-action-catalog.json",
        "notes": [
            "Production draft generated by cropping concept sheets.",
            "Review every frame before using in the app; concept art is not guaranteed to be perfectly aligned.",
            "Background removal is automated and may require manual cleanup."
        ],
    }

    for row_index, action_id in enumerate(ordered):
        action = actions[action_id]
        source_key, positions = CROP_PLAN[action_id]
        frame_count = action["frames"]
        if len(positions) < frame_count:
            positions = positions + [positions[-1]] * (frame_count - len(positions))
        for frame_index, (src_row, src_col) in enumerate(positions[:frame_count]):
            frame = cut_frame(source_key, src_row, src_col)
            sheet.alpha_composite(frame, (frame_index * CELL, row_index * CELL))
        manifest["actions"][action_id] = {
            "row": row_index,
            "col": 0,
            "frames": frame_count,
            "fps": action["fps"],
            "loop": action["loop"],
            "next": action.get("next"),
            "group": action["group"],
            "view": action["view"],
            "priority": action["priority"],
        }

    sheet_path = OUT_DIR / "cheese-cat-v1-production-draft.png"
    preview_path = OUT_DIR / "cheese-cat-v1-production-draft-preview.png"
    manifest_path = OUT_DIR / "cheese-cat-v1-production-draft.json"
    sheet.save(sheet_path)
    make_preview(sheet, len(ordered), max_frames).save(preview_path)
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()

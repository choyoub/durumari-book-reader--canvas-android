from __future__ import annotations

import json
import math
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "assets" / "avatars" / "cats"
CELL = 96

COLORS = {
    "line": "#6b3512",
    "line_dark": "#3f210c",
    "fur": "#d9822b",
    "fur_mid": "#e9963d",
    "fur_light": "#f2b765",
    "cream": "#f8d79a",
    "cream_shadow": "#e8b96d",
    "stripe": "#a9561d",
    "eye": "#5b3612",
    "eye_hi": "#fff1b2",
    "nose": "#8f4c3f",
    "pink": "#efb49a",
    "shadow": "#00000036",
}


ACTIONS = [
    ("sit_tail", 6, 6, "front"),
    ("sit_blink", 4, 7, "front"),
    ("sit_ear", 4, 7, "front"),
    ("sit_look", 6, 7, "front"),
    ("lie_tail", 6, 6, "side"),
    ("sleep_breathe", 6, 5, "side"),
    ("walk_side", 8, 10, "side"),
    ("walk_sniff_turn", 8, 8, "side"),
    ("groom", 8, 7, "front"),
    ("stretch_yawn", 8, 7, "side"),
    ("alert", 6, 8, "front"),
    ("drag_limp", 4, 6, "front"),
    ("fall_loop", 4, 8, "front"),
    ("land_recover", 6, 8, "front"),
    ("back_sit_tail", 6, 6, "back"),
]


def rgba(hex_color: str) -> tuple[int, int, int, int]:
    raw = hex_color.lstrip("#")
    if len(raw) == 6:
        raw += "ff"
    return tuple(int(raw[i : i + 2], 16) for i in range(0, 8, 2))


def ellipse(draw: ImageDraw.ImageDraw, box, fill, outline="line", width=2):
    draw.ellipse(box, fill=rgba(COLORS[fill]), outline=rgba(COLORS[outline]), width=width)


def rect(draw: ImageDraw.ImageDraw, box, fill, outline=None, width=1):
    draw.rectangle(box, fill=rgba(COLORS[fill]), outline=rgba(COLORS[outline]) if outline else None, width=width)


def poly(draw: ImageDraw.ImageDraw, points, fill, outline="line", width=2):
    draw.polygon(points, fill=rgba(COLORS[fill]), outline=rgba(COLORS[outline]))
    if width > 1:
        draw.line(points + [points[0]], fill=rgba(COLORS[outline]), width=width, joint="curve")


def line(draw: ImageDraw.ImageDraw, points, color="stripe", width=2):
    draw.line(points, fill=rgba(COLORS[color]), width=width)


def shadow(draw: ImageDraw.ImageDraw, x: float, y: float, w: float, h: float):
    draw.ellipse((x - w / 2, y - h / 2, x + w / 2, y + h / 2), fill=rgba(COLORS["shadow"]))


def draw_tail_front(draw: ImageDraw.ImageDraw, cx: float, cy: float, frame: int, back=False):
    sway = math.sin(frame / 5 * math.tau) * 9
    base_x = cx + 18
    base_y = cy + 21
    points = [
        (base_x, base_y),
        (base_x + 18 + sway, base_y + 1),
        (base_x + 21 + sway, base_y - 16),
        (base_x + 11 + sway * 0.5, base_y - 23),
    ]
    line(draw, points, "line", 9)
    line(draw, points, "fur", 6)
    line(draw, [(points[1][0] - 2, points[1][1] - 3), (points[2][0] + 1, points[2][1] - 2)], "stripe", 2)
    if back:
        line(draw, [(base_x + 9, base_y - 2), (base_x + 16 + sway, base_y - 6)], "stripe", 2)


def draw_front_head(draw: ImageDraw.ImageDraw, cx: float, cy: float, frame: int, blink=False, alert=False, ear_twitch=False, look=0):
    ear_l = [(cx - 22, cy - 20), (cx - 11, cy - 43 - (4 if ear_twitch and frame % 2 else 0)), (cx - 3, cy - 19)]
    ear_r = [(cx + 22, cy - 20), (cx + 11, cy - 43), (cx + 3, cy - 19)]
    poly(draw, ear_l, "fur_light")
    poly(draw, ear_r, "fur_light")
    poly(draw, [(cx - 16, cy - 22), (cx - 11, cy - 34), (cx - 7, cy - 21)], "pink", "stripe", 1)
    poly(draw, [(cx + 16, cy - 22), (cx + 11, cy - 34), (cx + 7, cy - 21)], "pink", "stripe", 1)
    ellipse(draw, (cx - 25, cy - 29, cx + 25, cy + 18), "fur_light")
    for sx in [-14, 0, 14]:
        line(draw, [(cx + sx, cy - 27), (cx + sx * 0.7, cy - 18)], "stripe", 2)
    eye_h = 6 if alert else 4
    if blink:
        line(draw, [(cx - 15, cy - 4), (cx - 7, cy - 4)], "line", 2)
        line(draw, [(cx + 7, cy - 4), (cx + 15, cy - 4)], "line", 2)
    else:
        ellipse(draw, (cx - 17 + look, cy - 8, cx - 8 + look, cy - 8 + eye_h), "eye", "line", 1)
        ellipse(draw, (cx + 8 + look, cy - 8, cx + 17 + look, cy - 8 + eye_h), "eye", "line", 1)
        rect(draw, (cx - 14 + look, cy - 6, cx - 12 + look, cy - 4), "eye_hi")
        rect(draw, (cx + 11 + look, cy - 6, cx + 13 + look, cy - 4), "eye_hi")
    ellipse(draw, (cx - 9, cy + 1, cx + 9, cy + 14), "cream", "cream_shadow", 1)
    poly(draw, [(cx - 3, cy + 4), (cx + 3, cy + 4), (cx, cy + 8)], "nose", "nose", 1)
    line(draw, [(cx - 24, cy + 2), (cx - 36, cy - 1)], "line", 1)
    line(draw, [(cx + 24, cy + 2), (cx + 36, cy - 1)], "line", 1)


def draw_front_body(draw: ImageDraw.ImageDraw, cx: float, cy: float, squash=0, paw_up=False):
    ellipse(draw, (cx - 25, cy - 9 + squash, cx + 25, cy + 44), "fur")
    ellipse(draw, (cx - 14, cy + 3 + squash, cx + 14, cy + 40), "cream", "cream_shadow", 1)
    for sx in [-21, -15, 15, 21]:
        line(draw, [(cx + sx, cy + 4), (cx + sx * 0.8, cy + 20)], "stripe", 2)
    if paw_up:
        ellipse(draw, (cx - 25, cy + 6, cx - 11, cy + 24), "cream", "line", 2)
    else:
        ellipse(draw, (cx - 22, cy + 30, cx - 5, cy + 47), "cream", "line", 2)
    ellipse(draw, (cx + 5, cy + 30, cx + 22, cy + 47), "cream", "line", 2)


def draw_sit(draw: ImageDraw.ImageDraw, frame: int, variant: str):
    cx, ground = 48, 84
    shadow(draw, cx, ground - 2, 54, 8)
    blink = variant == "blink" and frame in (1, 2)
    ear = variant == "ear"
    look = -4 if variant == "look" and frame < 3 else 4 if variant == "look" else 0
    draw_tail_front(draw, cx, ground - 32, frame)
    draw_front_body(draw, cx, ground - 42)
    draw_front_head(draw, cx, ground - 39, frame, blink=blink, ear_twitch=ear, look=look)


def draw_back_sit(draw: ImageDraw.ImageDraw, frame: int):
    cx, ground = 48, 84
    shadow(draw, cx, ground - 2, 52, 8)
    draw_tail_front(draw, cx, ground - 31, frame, back=True)
    ellipse(draw, (cx - 24, ground - 57, cx + 24, ground - 5), "fur")
    ellipse(draw, (cx - 23, ground - 75, cx + 23, ground - 31), "fur_light")
    poly(draw, [(cx - 21, ground - 62), (cx - 13, ground - 88), (cx - 4, ground - 62)], "fur_light")
    poly(draw, [(cx + 21, ground - 62), (cx + 13, ground - 88), (cx + 4, ground - 62)], "fur_light")
    for sx in [-13, -5, 5, 13]:
        line(draw, [(cx + sx, ground - 68), (cx + sx * 0.6, ground - 18)], "stripe", 2)
    ellipse(draw, (cx - 20, ground - 12, cx - 3, ground + 2), "fur_light", "line", 2)
    ellipse(draw, (cx + 3, ground - 12, cx + 20, ground + 2), "fur_light", "line", 2)


def draw_side_cat(draw: ImageDraw.ImageDraw, frame: int, action: str):
    ground = 83
    x = 48
    bob = math.sin(frame / 8 * math.tau) * 2 if action == "walk" else 0
    tail = math.sin(frame / 6 * math.tau) * 7
    if action == "lie":
        shadow(draw, x, ground - 3, 66, 8)
        line(draw, [(x - 30, ground - 24), (x - 45, ground - 25 + tail * 0.2), (x - 39, ground - 35 + tail * 0.3)], "line", 7)
        line(draw, [(x - 30, ground - 24), (x - 45, ground - 25 + tail * 0.2), (x - 39, ground - 35 + tail * 0.3)], "fur", 5)
        ellipse(draw, (x - 30, ground - 35, x + 24, ground - 12), "fur")
        ellipse(draw, (x + 16, ground - 42, x + 42, ground - 18), "fur_light")
        poly(draw, [(x + 21, ground - 39), (x + 27, ground - 55), (x + 31, ground - 38)], "fur_light")
        poly(draw, [(x + 35, ground - 38), (x + 39, ground - 52), (x + 41, ground - 36)], "fur_light")
        ellipse(draw, (x + 27, ground - 32, x + 33, ground - 27), "eye", "line", 1)
        rect(draw, (x - 14, ground - 17, x + 20, ground - 11), "cream")
        for sx in [-20, -8, 5]:
            line(draw, [(x + sx, ground - 35), (x + sx - 5, ground - 18)], "stripe", 2)
        return
    if action == "sleep":
        draw_side_cat(draw, frame, "lie")
        offset = math.sin(frame / 6 * math.tau) * 2
        line(draw, [(x - 12, ground - 17 + offset), (x + 8, ground - 17 + offset)], "cream_shadow", 2)
        return
    if action == "stretch":
        shadow(draw, x, ground - 2, 66, 8)
        line(draw, [(x - 21, ground - 36), (x - 39, ground - 52), (x - 35, ground - 63)], "line", 7)
        line(draw, [(x - 21, ground - 36), (x - 39, ground - 52), (x - 35, ground - 63)], "fur", 5)
        ellipse(draw, (x - 25, ground - 42, x + 22, ground - 20), "fur")
        ellipse(draw, (x + 19, ground - 53, x + 45, ground - 28), "fur_light")
        poly(draw, [(x + 24, ground - 49), (x + 30, ground - 66), (x + 34, ground - 49)], "fur_light")
        poly(draw, [(x + 37, ground - 48), (x + 42, ground - 62), (x + 43, ground - 46)], "fur_light")
        ellipse(draw, (x + 29, ground - 42, x + 35, ground - 37), "eye", "line", 1)
        line(draw, [(x + 39, ground - 35), (x + 47, ground - 32)], "nose", 3)
        ellipse(draw, (x + 12, ground - 18, x + 32, ground - 8), "cream", "line", 2)
        ellipse(draw, (x + 26, ground - 18, x + 47, ground - 8), "cream", "line", 2)
        return
    sniff = action == "sniff"
    shadow(draw, x, ground - 2, 62, 8)
    body_y = ground - 46 + bob
    ellipse(draw, (x - 28, body_y, x + 22, body_y + 31), "fur")
    ellipse(draw, (x - 12, body_y + 16, x + 22, body_y + 31), "cream", "cream_shadow", 1)
    line(draw, [(x - 25, body_y + 8), (x - 44, body_y + 4 + tail), (x - 38, body_y - 8 + tail)], "line", 8)
    line(draw, [(x - 25, body_y + 8), (x - 44, body_y + 4 + tail), (x - 38, body_y - 8 + tail)], "fur", 5)
    head_y = body_y - 4 + (7 if sniff else 0)
    ellipse(draw, (x + 13, head_y, x + 43, head_y + 27), "fur_light")
    poly(draw, [(x + 18, head_y + 3), (x + 23, head_y - 14), (x + 28, head_y + 2)], "fur_light")
    poly(draw, [(x + 33, head_y + 3), (x + 38, head_y - 12), (x + 40, head_y + 4)], "fur_light")
    ellipse(draw, (x + 25, head_y + 10, x + 31, head_y + 16), "eye", "line", 1)
    line(draw, [(x + 39, head_y + 17), (x + 45, head_y + 18)], "nose", 2)
    for idx, sx in enumerate([-17, -5, 8]):
        line(draw, [(x + sx, body_y + 3), (x + sx - 6, body_y + 21)], "stripe", 2)
    step = frame % 4
    legs = [(-16, 0), (0, 2), (10, 0), (21, 2)]
    for i, (lx, off) in enumerate(legs):
        lift = 4 if (step + i) % 4 == 0 and action == "walk" else 0
        ellipse(draw, (x + lx, ground - 13 - lift, x + lx + 11, ground - 2 - lift), "cream", "line", 2)


def draw_groom(draw: ImageDraw.ImageDraw, frame: int):
    cx, ground = 48, 84
    shadow(draw, cx, ground - 2, 52, 8)
    draw_tail_front(draw, cx, ground - 32, 1)
    draw_front_body(draw, cx, ground - 42, paw_up=True)
    draw_front_head(draw, cx, ground - 39, frame, blink=frame % 3 == 1)
    paw_y = ground - 39 + (frame % 4) * 2
    ellipse(draw, (cx - 25, paw_y, cx - 9, paw_y + 15), "cream", "line", 2)


def draw_alert(draw: ImageDraw.ImageDraw, frame: int):
    cx, ground = 48, 84
    lift = 5 if frame in (1, 2) else 0
    shadow(draw, cx, ground - 2, 52, 8)
    draw_tail_front(draw, cx, ground - 35 - lift, 2)
    draw_front_body(draw, cx, ground - 41 - lift)
    draw_front_head(draw, cx, ground - 36 - lift, frame, alert=True)


def draw_drag(draw: ImageDraw.ImageDraw, frame: int):
    cx, cy = 48, 45
    sway = math.sin(frame / 4 * math.tau) * 3
    line(draw, [(cx - 24, cy + 18), (cx - 37, cy + 29 + sway)], "line", 6)
    line(draw, [(cx - 24, cy + 18), (cx - 37, cy + 29 + sway)], "fur", 4)
    ellipse(draw, (cx - 20, cy - 4, cx + 20, cy + 42), "fur")
    ellipse(draw, (cx - 11, cy + 13, cx + 11, cy + 38), "cream", "cream_shadow", 1)
    draw_front_head(draw, cx, cy - 8, frame, blink=True)
    ellipse(draw, (cx - 29, cy + 22, cx - 14, cy + 35), "cream", "line", 2)
    ellipse(draw, (cx + 14, cy + 22, cx + 29, cy + 35), "cream", "line", 2)


def draw_fall(draw: ImageDraw.ImageDraw, frame: int):
    cx, cy = 48, 49
    rot = math.sin(frame / 4 * math.tau) * 8
    shadow(draw, cx, 86, 35, 6)
    ellipse(draw, (cx - 22, cy - 12, cx + 22, cy + 28), "fur")
    ellipse(draw, (cx - 12, cy + 1, cx + 12, cy + 25), "cream", "cream_shadow", 1)
    draw_front_head(draw, cx, cy - 7 + rot * 0.1, frame, alert=True)
    ellipse(draw, (cx - 37, cy + 1 + rot * 0.1, cx - 21, cy + 17), "cream", "line", 2)
    ellipse(draw, (cx + 21, cy + 1 - rot * 0.1, cx + 37, cy + 17), "cream", "line", 2)
    line(draw, [(cx + 20, cy + 11), (cx + 37, cy + 20), (cx + 33, cy + 33)], "line", 7)
    line(draw, [(cx + 20, cy + 11), (cx + 37, cy + 20), (cx + 33, cy + 33)], "fur", 5)


def draw_land(draw: ImageDraw.ImageDraw, frame: int):
    cx, ground = 48, 84
    crouch = max(0, 10 - frame * 2)
    shadow(draw, cx, ground - 2, 62 - crouch, 8)
    ellipse(draw, (cx - 29, ground - 40 + crouch, cx + 29, ground - 15 + crouch), "fur")
    ellipse(draw, (cx + 10, ground - 52 + crouch, cx + 38, ground - 25 + crouch), "fur_light")
    poly(draw, [(cx + 16, ground - 49 + crouch), (cx + 22, ground - 65 + crouch), (cx + 27, ground - 49 + crouch)], "fur_light")
    poly(draw, [(cx + 31, ground - 48 + crouch), (cx + 36, ground - 62 + crouch), (cx + 38, ground - 47 + crouch)], "fur_light")
    ellipse(draw, (cx + 21, ground - 41 + crouch, cx + 27, ground - 36 + crouch), "eye", "line", 1)
    line(draw, [(cx - 25, ground - 32 + crouch), (cx - 43, ground - 40 + crouch)], "line", 7)
    line(draw, [(cx - 25, ground - 32 + crouch), (cx - 43, ground - 40 + crouch)], "fur", 5)
    ellipse(draw, (cx - 18, ground - 13, cx + 2, ground - 3), "cream", "line", 2)
    ellipse(draw, (cx + 15, ground - 13, cx + 36, ground - 3), "cream", "line", 2)


def draw_frame(action: str, frame: int) -> Image.Image:
    img = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    if action == "sit_tail":
        draw_sit(draw, frame, "tail")
    elif action == "sit_blink":
        draw_sit(draw, frame, "blink")
    elif action == "sit_ear":
        draw_sit(draw, frame, "ear")
    elif action == "sit_look":
        draw_sit(draw, frame, "look")
    elif action == "lie_tail":
        draw_side_cat(draw, frame, "lie")
    elif action == "sleep_breathe":
        draw_side_cat(draw, frame, "sleep")
    elif action == "walk_side":
        draw_side_cat(draw, frame, "walk")
    elif action == "walk_sniff_turn":
        draw_side_cat(draw, frame, "sniff" if frame in (4, 5) else "walk")
    elif action == "groom":
        draw_groom(draw, frame)
    elif action == "stretch_yawn":
        draw_side_cat(draw, frame, "stretch")
    elif action == "alert":
        draw_alert(draw, frame)
    elif action == "drag_limp":
        draw_drag(draw, frame)
    elif action == "fall_loop":
        draw_fall(draw, frame)
    elif action == "land_recover":
        draw_land(draw, frame)
    elif action == "back_sit_tail":
        draw_back_sit(draw, frame)
    return img


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    max_frames = max(frames for _, frames, _, _ in ACTIONS)
    sheet = Image.new("RGBA", (max_frames * CELL, len(ACTIONS) * CELL), (0, 0, 0, 0))
    manifest = {
        "image": "cheese-cat-v1-sheet.png",
        "cell": {"width": CELL, "height": CELL},
        "defaultScale": 0.68,
        "actions": {},
    }
    for row, (name, frames, fps, view) in enumerate(ACTIONS):
        for col in range(frames):
            sheet.alpha_composite(draw_frame(name, col), (col * CELL, row * CELL))
        manifest["actions"][name] = {
            "row": row,
            "col": 0,
            "frames": frames,
            "fps": fps,
            "loop": name not in {"alert", "land_recover"},
            "view": view,
        }
    sheet.save(OUT_DIR / "cheese-cat-v1-sheet.png")
    (OUT_DIR / "cheese-cat-v1.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    preview = Image.new("RGBA", sheet.size, (248, 244, 237, 255))
    pdraw = ImageDraw.Draw(preview)
    for x in range(0, preview.width + 1, CELL):
        pdraw.line([(x, 0), (x, preview.height)], fill=(213, 197, 160, 160), width=1)
    for y in range(0, preview.height + 1, CELL):
        pdraw.line([(0, y), (preview.width, y)], fill=(213, 197, 160, 160), width=1)
    preview.alpha_composite(sheet)
    preview.save(OUT_DIR / "cheese-cat-v1-preview.png")


if __name__ == "__main__":
    main()

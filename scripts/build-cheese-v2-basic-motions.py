from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
BLUEPRINT_DIR = ROOT / "assets" / "avatars" / "blueprint"
SPRITES_DIR = BLUEPRINT_DIR / "sprites"

CELL = 320
GROUND_Y = 270
SCALE = 4

TRANSPARENT = (0, 0, 0, 0)
INK = (66, 46, 34, 255)
OUTLINE = (91, 54, 29, 255)
OUTLINE_SOFT = (117, 67, 35, 255)
FUR = (223, 129, 47, 255)
FUR_DARK = (168, 82, 28, 255)
FUR_MID = (237, 153, 63, 255)
FUR_LIGHT = (250, 182, 89, 255)
BELLY = (255, 218, 151, 255)
BELLY_SHADE = (236, 184, 105, 255)
EAR_INNER = (244, 144, 116, 255)
EYE = (51, 36, 27, 255)
EYE_SHINE = (255, 244, 219, 230)
NOSE = (99, 52, 44, 255)
WHISKER = (103, 72, 52, 210)
SHADOW = (82, 56, 38, 54)
SOFT_SHADOW = (82, 56, 38, 28)


@dataclass(frozen=True)
class Pose:
    kind: str
    offset_x: int = 0
    roll_deg: float = 0
    body_y: int = 0
    head_y: int = 0
    tail_y: int = 0
    tail_tip_x: int = 0
    tail_tip_y: int = 0
    step: int = 0
    eye_state: str = "open"
    squash: float = 1.0


def s(value: float | int) -> int:
    return round(value * SCALE)


def xy(point: tuple[float, float]) -> tuple[int, int]:
    return s(point[0]), s(point[1])


def box(values: tuple[float, float, float, float]) -> tuple[int, int, int, int]:
    return tuple(s(value) for value in values)  # type: ignore[return-value]


def line(draw: ImageDraw.ImageDraw, points: list[tuple[float, float]], fill, width: int) -> None:
    draw.line([xy(point) for point in points], fill=fill, width=s(width), joint="curve")


def ellipse(draw: ImageDraw.ImageDraw, values: tuple[float, float, float, float], fill, outline=None, width: int = 1) -> None:
    draw.ellipse(box(values), fill=fill, outline=outline, width=s(width) if outline else 1)


def rounded_rect(
    draw: ImageDraw.ImageDraw,
    values: tuple[float, float, float, float],
    radius: int,
    fill,
    outline=None,
    width: int = 1,
) -> None:
    draw.rounded_rectangle(box(values), radius=s(radius), fill=fill, outline=outline, width=s(width) if outline else 1)


def polygon(draw: ImageDraw.ImageDraw, points: list[tuple[float, float]], fill, outline=None) -> None:
    draw.polygon([xy(point) for point in points], fill=fill, outline=outline)


def draw_ear(draw: ImageDraw.ImageDraw, points: list[tuple[float, float]]) -> None:
    polygon(draw, points, FUR, OUTLINE)
    cx = sum(x for x, _ in points) / len(points)
    cy = sum(y for _, y in points) / len(points)
    inner = [(cx + (x - cx) * 0.55, cy + (y - cy) * 0.60) for x, y in points]
    polygon(draw, inner, EAR_INNER)


def draw_shadow(draw: ImageDraw.ImageDraw, x1: int, x2: int) -> None:
    ellipse(draw, (x1, GROUND_Y - 7, x2, GROUND_Y + 10), SOFT_SHADOW)
    ellipse(draw, (x1 + 20, GROUND_Y - 4, x2 - 20, GROUND_Y + 7), SHADOW)


def draw_face_side(draw: ImageDraw.ImageDraw, cx: int, cy: int, eye_state: str = "open") -> None:
    if eye_state == "closed":
        draw.arc(box((cx - 15, cy - 5, cx - 2, cy + 6)), start=20, end=160, fill=EYE, width=s(3))
    else:
        ellipse(draw, (cx - 15, cy - 5, cx - 7, cy + 3), EYE)
        ellipse(draw, (cx - 12, cy - 3, cx - 10, cy - 1), EYE_SHINE)
    polygon(draw, [(cx + 12, cy + 5), (cx + 19, cy + 7), (cx + 13, cy + 10)], NOSE)
    line(draw, [(cx + 14, cy + 12), (cx + 24, cy + 14)], INK, 2)
    line(draw, [(cx + 7, cy + 9), (cx + 36, cy + 4)], WHISKER, 1)
    line(draw, [(cx + 7, cy + 13), (cx + 38, cy + 13)], WHISKER, 1)
    line(draw, [(cx + 7, cy + 17), (cx + 34, cy + 23)], WHISKER, 1)


def draw_face_front(draw: ImageDraw.ImageDraw, cx: int, cy: int, eye_state: str = "open") -> None:
    if eye_state == "closed":
        draw.arc(box((cx - 24, cy - 5, cx - 11, cy + 6)), start=25, end=155, fill=EYE, width=s(3))
        draw.arc(box((cx + 11, cy - 5, cx + 24, cy + 6)), start=25, end=155, fill=EYE, width=s(3))
    else:
        ellipse(draw, (cx - 23, cy - 4, cx - 14, cy + 5), EYE)
        ellipse(draw, (cx + 14, cy - 4, cx + 23, cy + 5), EYE)
        ellipse(draw, (cx - 20, cy - 2, cx - 17, cy + 1), EYE_SHINE)
        ellipse(draw, (cx + 17, cy - 2, cx + 20, cy + 1), EYE_SHINE)
    polygon(draw, [(cx - 4, cy + 8), (cx + 4, cy + 8), (cx, cy + 13)], NOSE)
    line(draw, [(cx, cy + 13), (cx, cy + 20)], INK, 2)
    draw.arc(box((cx - 12, cy + 17, cx, cy + 29)), start=10, end=100, fill=INK, width=s(2))
    draw.arc(box((cx, cy + 17, cx + 12, cy + 29)), start=80, end=170, fill=INK, width=s(2))


def draw_stand_side(draw: ImageDraw.ImageDraw, pose: Pose) -> None:
    by = pose.body_y
    hy = pose.head_y
    draw_shadow(draw, 68, 266)
    line(
        draw,
        [(220, 220 + pose.tail_y), (251, 205 + pose.tail_y), (282 + pose.tail_tip_x, 218 + pose.tail_tip_y)],
        OUTLINE,
        18,
    )
    line(
        draw,
        [(220, 220 + pose.tail_y), (251, 205 + pose.tail_y), (282 + pose.tail_tip_x, 218 + pose.tail_tip_y)],
        FUR_MID,
        11,
    )
    ellipse(draw, (101, 185 + by, 235, 255 + by), FUR, OUTLINE, 3)
    ellipse(draw, (132, 207 + by, 205, 247 + by), BELLY, BELLY_SHADE, 2)
    for stripe in [(148, 192 + by, 137, 212 + by), (170, 188 + by, 169, 210 + by), (197, 194 + by, 187, 214 + by)]:
        line(draw, [(stripe[0], stripe[1]), (stripe[2], stripe[3])], FUR_DARK, 4)

    step = pose.step
    legs = [
        (111 + step, 232 + by, 126 + step, GROUND_Y),
        (134 - step, 232 + by, 149 - step, GROUND_Y),
        (194 - step, 232 + by, 209 - step, GROUND_Y),
        (214 + step, 232 + by, 229 + step, GROUND_Y),
    ]
    for x1, y1, x2, y2 in legs:
        rounded_rect(draw, (x1, y1, x2, y2), 7, FUR_LIGHT, OUTLINE, 2)
        ellipse(draw, (x1 - 6, GROUND_Y - 8, x2 + 7, GROUND_Y + 3), FUR_LIGHT, OUTLINE, 2)

    draw_ear(draw, [(69, 187 + hy), (83, 156 + hy), (96, 189 + hy)])
    draw_ear(draw, [(104, 188 + hy), (123, 161 + hy), (125, 193 + hy)])
    ellipse(draw, (58, 174 + hy, 130, 238 + hy), FUR, OUTLINE, 3)
    ellipse(draw, (76, 197 + hy, 119, 232 + hy), FUR_MID)
    for stripe in [(80, 184 + hy, 92, 198 + hy), (101, 183 + hy, 99, 199 + hy)]:
        line(draw, [(stripe[0], stripe[1]), (stripe[2], stripe[3])], FUR_DARK, 4)
    draw_face_side(draw, 88, 204 + hy, pose.eye_state)


def draw_sit_front(draw: ImageDraw.ImageDraw, pose: Pose) -> None:
    by = pose.body_y
    hy = pose.head_y
    draw_shadow(draw, 86, 236)
    line(draw, [(210, 237), (238, 250), (285, 242)], OUTLINE, 18)
    line(draw, [(210, 237), (238, 250), (285, 242)], FUR_MID, 11)
    ellipse(draw, (95, 190 + by, 225, 273 + by), FUR, OUTLINE, 3)
    ellipse(draw, (124, 209 + by, 196, 273 + by), BELLY, BELLY_SHADE, 2)
    ellipse(draw, (101, 244, 134, 273), FUR_LIGHT, OUTLINE, 2)
    ellipse(draw, (186, 244, 219, 273), FUR_LIGHT, OUTLINE, 2)
    rounded_rect(draw, (137, 224 + by, 155, GROUND_Y), 8, FUR_LIGHT, OUTLINE, 2)
    rounded_rect(draw, (165, 224 + by, 183, GROUND_Y), 8, FUR_LIGHT, OUTLINE, 2)
    draw_ear(draw, [(125, 183 + hy), (142, 150 + hy), (155, 185 + hy)])
    draw_ear(draw, [(165, 185 + hy), (184, 150 + hy), (197, 183 + hy)])
    ellipse(draw, (118, 167 + hy, 202, 239 + hy), FUR, OUTLINE, 3)
    ellipse(draw, (135, 203 + hy, 185, 235 + hy), BELLY)
    for stripe in [(143, 181 + hy, 149, 196 + hy), (160, 177 + hy, 160, 195 + hy), (177, 181 + hy, 171, 196 + hy)]:
        line(draw, [(stripe[0], stripe[1]), (stripe[2], stripe[3])], FUR_DARK, 4)
    draw_face_front(draw, 160, 204 + hy, pose.eye_state)


def draw_lie_side(draw: ImageDraw.ImageDraw, pose: Pose) -> None:
    by = pose.body_y
    hy = pose.head_y
    draw_shadow(draw, 52, 291)
    line(draw, [(214, 252 + by), (250, 262 + by), (287 + pose.tail_tip_x, 249 + pose.tail_tip_y)], OUTLINE, 17)
    line(draw, [(214, 252 + by), (250, 262 + by), (287 + pose.tail_tip_x, 249 + pose.tail_tip_y)], FUR_MID, 10)
    ellipse(draw, (88, 222 + by, 230, 273 + by), FUR, OUTLINE, 3)
    ellipse(draw, (122, 240 + by, 205, 273 + by), BELLY, BELLY_SHADE, 2)
    rounded_rect(draw, (117, 253 + by, 178, 266 + by), 6, FUR_LIGHT, OUTLINE, 2)
    rounded_rect(draw, (158, 243 + by, 218, 257 + by), 6, FUR_LIGHT, OUTLINE, 2)
    draw_ear(draw, [(72, 222 + hy), (77, 193 + hy), (91, 222 + hy)])
    draw_ear(draw, [(96, 222 + hy), (113, 198 + hy), (115, 227 + hy)])
    ellipse(draw, (55, 215 + hy, 119, 266 + hy), FUR, OUTLINE, 3)
    draw_face_side(draw, 82, 242 + hy, pose.eye_state)


def draw_sleep_side(draw: ImageDraw.ImageDraw, pose: Pose) -> None:
    draw_lie_side(draw, Pose(kind="lie", body_y=pose.body_y, head_y=pose.head_y, tail_tip_y=pose.tail_tip_y, eye_state="closed"))
    draw.arc(box((102, 205 + pose.head_y, 126, 229 + pose.head_y)), start=180, end=350, fill=(117, 67, 35, 190), width=s(2))


def draw_pose(draw: ImageDraw.ImageDraw, pose: Pose) -> None:
    if pose.kind == "sit":
        draw_sit_front(draw, pose)
    elif pose.kind == "stand":
        draw_stand_side(draw, pose)
    elif pose.kind == "lie":
        draw_lie_side(draw, pose)
    elif pose.kind == "sleep":
        draw_sleep_side(draw, pose)
    else:
        draw_stand_side(draw, pose)


def render_frame(pose: Pose) -> Image.Image:
    image = Image.new("RGBA", (CELL * SCALE, CELL * SCALE), TRANSPARENT)
    shadow_layer = Image.new("RGBA", image.size, TRANSPARENT)
    draw = ImageDraw.Draw(shadow_layer)
    draw_pose(draw, pose)
    shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(s(0.2)))
    if pose.offset_x:
        shadow_layer = shadow_layer.transform(
            shadow_layer.size,
            Image.Transform.AFFINE,
            (1, 0, -s(pose.offset_x), 0, 1, 0),
            resample=Image.Resampling.BICUBIC,
            fillcolor=TRANSPARENT,
        )
    image.alpha_composite(shadow_layer)
    return image.resize((CELL, CELL), Image.Resampling.LANCZOS)


def render_source_frame(source: Pose | Image.Image) -> Image.Image:
    if isinstance(source, Image.Image):
        return source
    return render_frame(source)


def draw_lie_belly_roll_frame(phase: int) -> Image.Image:
    if phase in (0, 7):
        return render_frame(Pose("lie"))

    image = Image.new("RGBA", (CELL * SCALE, CELL * SCALE), TRANSPARENT)
    draw = ImageDraw.Draw(image)
    amount = [0, 0.25, 0.65, 1.0, 0.65, 0.25, 0.08, 0][phase]
    settle = [0, 0, 0, 0, 0, 0, -1, 0][phase]
    cy = 248 + settle
    body_top = 222 - amount * 16
    body_bottom = 274 + amount * 4
    belly_top = 238 - amount * 18
    belly_bottom = 273 - amount * 2

    draw_shadow(draw, 52, 291)

    line(draw, [(214, 252), (250, 262 - amount * 4), (287, 249 - amount * 9)], OUTLINE, 17)
    line(draw, [(214, 252), (250, 262 - amount * 4), (287, 249 - amount * 9)], FUR_MID, 10)

    ellipse(draw, (86, body_top, 232, body_bottom), FUR, OUTLINE, 3)
    ellipse(draw, (112, belly_top, 210, belly_bottom), BELLY, BELLY_SHADE, 2)

    if amount < 0.5:
        rounded_rect(draw, (117, 252 - amount * 10, 178, 266 - amount * 5), 6, FUR_LIGHT, OUTLINE, 2)
        rounded_rect(draw, (158, 243 - amount * 9, 218, 257 - amount * 5), 6, FUR_LIGHT, OUTLINE, 2)
    else:
        for x, y, tilt in [
            (116, cy - 26, -8),
            (151, cy - 31, -4),
            (181, cy - 29, 5),
            (211, cy - 22, 8),
        ]:
            rounded_rect(draw, (x - 8, y - 5, x + 12, y + 15), 8, FUR_LIGHT, OUTLINE, 2)
            line(draw, [(x - 1, y + 9), (x + tilt, y + 18)], OUTLINE, 2)

    head_front = amount > 0.55
    if head_front:
        draw_ear(draw, [(67, 225), (75, 196), (91, 225)])
        draw_ear(draw, [(92, 225), (109, 199), (115, 229)])
        ellipse(draw, (52, 214, 122, 272), FUR, OUTLINE, 3)
        ellipse(draw, (68, 238, 108, 266), FUR_MID)
        draw_face_front(draw, 88, 243, "open")
    else:
        draw_ear(draw, [(72, 222), (77, 193), (91, 222)])
        draw_ear(draw, [(96, 222), (113, 198), (115, 227)])
        ellipse(draw, (55, 215, 119, 266), FUR, OUTLINE, 3)
        draw_face_side(draw, 82, 242, "open")

    for stripe in [
        (129, body_top + 9, 120, body_top + 24),
        (157, body_top + 4, 157, body_top + 23),
        (188, body_top + 9, 196, body_top + 24),
    ]:
        line(draw, [(stripe[0], stripe[1]), (stripe[2], stripe[3])], FUR_DARK, 4)

    return image.resize((CELL, CELL), Image.Resampling.LANCZOS)


def write_sheet(path: Path, rows: int, cols: int, clips: dict[int, list[Pose | Image.Image]]) -> None:
    sheet = Image.new("RGBA", (CELL * cols, CELL * rows), TRANSPARENT)
    for row, frames in clips.items():
        for col, source in enumerate(frames):
            sheet.alpha_composite(render_source_frame(source), (col * CELL, row * CELL))
    path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(path)


def checker_tile(size: int = 8) -> Image.Image:
    tile = Image.new("RGBA", (size * 2, size * 2), (255, 255, 255, 255))
    draw = ImageDraw.Draw(tile)
    draw.rectangle((0, 0, size - 1, size - 1), fill=(226, 226, 226, 255))
    draw.rectangle((size, size, size * 2 - 1, size * 2 - 1), fill=(226, 226, 226, 255))
    return tile


def write_preview(path: Path, poses: list[Pose | Image.Image], sizes: list[int] | None = None) -> None:
    sizes = sizes or [64, 72, 80]
    pad = 18
    label_w = 64
    width = label_w + len(poses) * (80 + pad) + pad
    height = pad + len(sizes) * (80 + pad)
    preview = Image.new("RGBA", (width, height), (244, 239, 227, 255))
    draw = ImageDraw.Draw(preview)
    tile = checker_tile()
    for row, size in enumerate(sizes):
        y = pad + row * (80 + pad)
        draw.text((pad, y + 27), f"{size}px", fill=INK)
        for col, source in enumerate(poses):
            x = label_w + col * (80 + pad)
            backdrop = Image.new("RGBA", (80, 80), (255, 255, 255, 255))
            for tx in range(0, 80, tile.width):
                for ty in range(0, 80, tile.height):
                    backdrop.alpha_composite(tile, (tx, ty))
            frame = render_source_frame(source).resize((size, size), Image.Resampling.LANCZOS)
            preview.alpha_composite(backdrop, (x, y))
            preview.alpha_composite(frame, (x + (80 - size) // 2, y + (80 - size) // 2))
    preview.save(path)


def write_gif(path: Path, poses: list[Pose | Image.Image], duration: int = 145) -> None:
    frames = []
    tile = checker_tile()
    for source in poses:
        frame = Image.new("RGBA", (128, 128), (244, 239, 227, 255))
        for tx in range(0, 128, tile.width):
            for ty in range(0, 128, tile.height):
                frame.alpha_composite(tile, (tx, ty))
        cat = render_source_frame(source).resize((80, 80), Image.Resampling.LANCZOS)
        frame.alpha_composite(cat, (24, 26))
        frames.append(frame.convert("P", palette=Image.Palette.ADAPTIVE))
    frames[0].save(
        path,
        save_all=True,
        append_images=frames[1:],
        duration=duration,
        loop=0,
        optimize=False,
        disposal=2,
    )


STAND_IDLE = [
    Pose("stand", body_y=0, head_y=0, tail_tip_y=0),
    Pose("stand", body_y=-1, head_y=-1, tail_tip_y=-1),
    Pose("stand", body_y=-2, head_y=-1, tail_tip_y=-2),
    Pose("stand", body_y=-1, head_y=-1, tail_tip_y=-1),
    Pose("stand", body_y=0, head_y=0, tail_tip_y=0),
    Pose("stand", body_y=1, head_y=0, tail_tip_y=1),
]

WALK_START = [
    Pose("stand", step=0),
    Pose("stand", body_y=-1, head_y=-1, step=3),
    Pose("stand", body_y=-1, head_y=-1, step=6, tail_tip_y=-2),
    Pose("stand", body_y=0, step=9, tail_tip_y=-1),
    Pose("stand", body_y=-1, step=6, tail_tip_y=1),
    Pose("stand", step=3),
]

WALK_LOOP = [
    Pose("stand", step=9, tail_tip_y=-2),
    Pose("stand", body_y=-1, step=5, tail_tip_y=-1),
    Pose("stand", step=0, tail_tip_y=0),
    Pose("stand", body_y=-1, step=-5, tail_tip_y=1),
    Pose("stand", step=-9, tail_tip_y=2),
    Pose("stand", body_y=-1, step=-5, tail_tip_y=1),
    Pose("stand", step=0, tail_tip_y=0),
    Pose("stand", body_y=-1, step=5, tail_tip_y=-1),
]

WALK_STOP = [
    Pose("stand", step=7),
    Pose("stand", body_y=-1, step=4),
    Pose("stand", body_y=-1, step=2),
    Pose("stand", step=0),
    Pose("stand", head_y=0, step=0),
    Pose("stand", step=0),
]

WALK_TURN = [
    Pose("stand", step=5),
    Pose("stand", body_y=-1, step=2, head_y=1),
    Pose("stand", body_y=0, step=0, head_y=2),
    Pose("stand", body_y=1, step=-2, head_y=1),
    Pose("stand", step=-5),
    Pose("stand", body_y=0, step=-2),
    Pose("stand", body_y=-1, step=0),
    Pose("stand", step=0),
]

LIE_IDLE = [
    Pose("lie", body_y=0, head_y=0, tail_tip_y=0),
    Pose("lie", body_y=-1, head_y=0, tail_tip_y=0),
    Pose("lie", body_y=-2, head_y=-1, tail_tip_y=-1),
    Pose("lie", body_y=-1, head_y=0, tail_tip_y=0),
    Pose("lie", body_y=0, head_y=0, tail_tip_y=0),
    Pose("lie", body_y=1, head_y=0, tail_tip_y=1),
]

LIE_TAIL_TIP = [
    Pose("lie", tail_tip_x=-7, tail_tip_y=3),
    Pose("lie", tail_tip_x=-3, tail_tip_y=1),
    Pose("lie", tail_tip_x=0, tail_tip_y=0),
    Pose("lie", tail_tip_x=3, tail_tip_y=-2),
    Pose("lie", tail_tip_x=0, tail_tip_y=0),
    Pose("lie", tail_tip_x=-3, tail_tip_y=2),
]

LIE_PUSH_REACT = [
    draw_lie_belly_roll_frame(0),
    draw_lie_belly_roll_frame(1),
    draw_lie_belly_roll_frame(2),
    draw_lie_belly_roll_frame(3),
    draw_lie_belly_roll_frame(4),
    draw_lie_belly_roll_frame(5),
    draw_lie_belly_roll_frame(6),
    draw_lie_belly_roll_frame(7),
]

SLEEP_BREATHE = [
    Pose("sleep", body_y=0, head_y=0, tail_tip_y=0),
    Pose("sleep", body_y=-1, head_y=0, tail_tip_y=0),
    Pose("sleep", body_y=-2, head_y=-1, tail_tip_y=-1),
    Pose("sleep", body_y=-1, head_y=0, tail_tip_y=0),
    Pose("sleep", body_y=0, head_y=0, tail_tip_y=0),
    Pose("sleep", body_y=1, head_y=0, tail_tip_y=1),
    Pose("sleep", body_y=0, head_y=0, tail_tip_y=0),
    Pose("sleep", body_y=-1, head_y=0, tail_tip_y=-1),
]

SIT_TO_STAND = [
    Pose("sit"),
    Pose("sit", body_y=-2, head_y=-1),
    Pose("sit", body_y=-6, head_y=-4),
    Pose("stand", body_y=3, head_y=4),
    Pose("stand", body_y=1, head_y=1),
    Pose("stand"),
]

STAND_TO_SIT = list(reversed(SIT_TO_STAND))
STAND_TO_WALK = [
    Pose("stand"),
    Pose("stand", body_y=-1, head_y=-1, step=2),
    Pose("stand", body_y=-1, step=4, tail_tip_y=-1),
    Pose("stand", step=6, tail_tip_y=-1),
]
WALK_TO_STAND = list(reversed(STAND_TO_WALK))
SIT_TO_LIE = [
    Pose("sit"),
    Pose("sit", body_y=2, head_y=1),
    Pose("sit", body_y=4, head_y=3),
    Pose("lie", body_y=-5, head_y=-5),
    Pose("lie", body_y=-3, head_y=-3),
    Pose("lie", body_y=-1, head_y=-1),
    Pose("lie"),
    Pose("lie"),
]
LIE_TO_SIT = list(reversed(SIT_TO_LIE))
LIE_TO_SLEEP = [
    Pose("lie", eye_state="open"),
    Pose("lie", eye_state="closed"),
    Pose("sleep", body_y=0, head_y=0),
    Pose("sleep", body_y=-1, head_y=0),
    Pose("sleep"),
]
SLEEP_TO_LIE = list(reversed(LIE_TO_SLEEP))


def main() -> None:
    SPRITES_DIR.mkdir(parents=True, exist_ok=True)
    write_sheet(SPRITES_DIR / "stand.png", 1, 6, {0: STAND_IDLE})
    write_sheet(SPRITES_DIR / "walk.png", 5, 8, {0: WALK_START, 1: WALK_LOOP, 2: WALK_STOP, 3: WALK_TURN})
    write_sheet(SPRITES_DIR / "lie.png", 3, 8, {0: LIE_IDLE, 1: LIE_TAIL_TIP, 2: LIE_PUSH_REACT})
    write_sheet(SPRITES_DIR / "sleep.png", 1, 8, {0: SLEEP_BREATHE})
    write_sheet(
        SPRITES_DIR / "transitions.png",
        11,
        8,
        {
            0: SIT_TO_STAND,
            1: STAND_TO_SIT,
            2: STAND_TO_WALK,
            3: WALK_TO_STAND,
            4: SIT_TO_LIE,
            5: LIE_TO_SIT,
            6: LIE_TO_SLEEP,
            7: SLEEP_TO_LIE,
        },
    )

    write_preview(SPRITES_DIR / "stand-idle-preview.png", STAND_IDLE)
    write_preview(SPRITES_DIR / "walk-loop-preview.png", WALK_LOOP)
    write_preview(SPRITES_DIR / "lie-idle-preview.png", LIE_IDLE)
    write_preview(SPRITES_DIR / "lie-push-react-preview.png", LIE_PUSH_REACT)
    write_preview(SPRITES_DIR / "sleep-breathe-preview.png", SLEEP_BREATHE)
    write_gif(SPRITES_DIR / "stand-idle-animated-preview.gif", STAND_IDLE + list(reversed(STAND_IDLE[1:-1])))
    write_gif(SPRITES_DIR / "walk-loop-animated-preview.gif", WALK_LOOP, duration=110)
    write_gif(SPRITES_DIR / "lie-idle-animated-preview.gif", LIE_IDLE + list(reversed(LIE_IDLE[1:-1])))
    write_gif(SPRITES_DIR / "lie-push-react-animated-preview.gif", LIE_PUSH_REACT, duration=95)
    write_gif(SPRITES_DIR / "sleep-breathe-animated-preview.gif", SLEEP_BREATHE + list(reversed(SLEEP_BREATHE[1:-1])), duration=180)
    write_gif(
        SPRITES_DIR / "basic-motion-sequence-preview.gif",
        SIT_TO_STAND + STAND_IDLE[:3] + STAND_TO_WALK + WALK_LOOP + WALK_TO_STAND + STAND_TO_SIT + SIT_TO_LIE + LIE_IDLE[:3] + LIE_TO_SLEEP + SLEEP_BREATHE[:6] + SLEEP_TO_LIE + LIE_TO_SIT,
        duration=125,
    )

    for path in [
        "stand.png",
        "walk.png",
        "lie.png",
        "sleep.png",
        "transitions.png",
        "basic-motion-sequence-preview.gif",
    ]:
        print(f"Wrote {SPRITES_DIR / path}")


if __name__ == "__main__":
    main()

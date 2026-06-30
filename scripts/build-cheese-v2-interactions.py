from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
BASIC_SCRIPT = ROOT / "scripts" / "build-cheese-v2-basic-motions.py"
BLUEPRINT_DIR = ROOT / "assets" / "avatars" / "blueprint"
SPRITES_DIR = BLUEPRINT_DIR / "sprites"

spec = importlib.util.spec_from_file_location("cheese_v2_basic_motions", BASIC_SCRIPT)
basic = importlib.util.module_from_spec(spec)
assert spec and spec.loader
sys.modules[spec.name] = basic
spec.loader.exec_module(basic)

CELL = basic.CELL
SCALE = basic.SCALE
GROUND_Y = basic.GROUND_Y
TRANSPARENT = basic.TRANSPARENT
INK = basic.INK
OUTLINE = basic.OUTLINE
FUR = basic.FUR
FUR_DARK = basic.FUR_DARK
FUR_MID = basic.FUR_MID
FUR_LIGHT = basic.FUR_LIGHT
BELLY = basic.BELLY
BELLY_SHADE = basic.BELLY_SHADE
EAR_INNER = basic.EAR_INNER
EYE = basic.EYE
EYE_SHINE = basic.EYE_SHINE
WHISKER = basic.WHISKER
SHADOW = basic.SHADOW
SOFT_SHADOW = basic.SOFT_SHADOW
draw_shadow = basic.draw_shadow
Pose = basic.Pose


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


def rounded_rect(draw: ImageDraw.ImageDraw, values: tuple[float, float, float, float], radius: int, fill, outline=None, width: int = 1) -> None:
    draw.rounded_rectangle(box(values), radius=s(radius), fill=fill, outline=outline, width=s(width) if outline else 1)


def polygon(draw: ImageDraw.ImageDraw, points: list[tuple[float, float]], fill, outline=None) -> None:
    draw.polygon([xy(point) for point in points], fill=fill, outline=outline)


def draw_ear(draw: ImageDraw.ImageDraw, points: list[tuple[float, float]]) -> None:
    polygon(draw, points, FUR, OUTLINE)
    cx = sum(x for x, _ in points) / len(points)
    cy = sum(y for _, y in points) / len(points)
    inner = [(cx + (x - cx) * 0.55, cy + (y - cy) * 0.60) for x, y in points]
    polygon(draw, inner, EAR_INNER)


def checker_tile(size: int = 8) -> Image.Image:
    tile = Image.new("RGBA", (size * 2, size * 2), (255, 255, 255, 255))
    draw = ImageDraw.Draw(tile)
    draw.rectangle((0, 0, size - 1, size - 1), fill=(226, 226, 226, 255))
    draw.rectangle((size, size, size * 2 - 1, size * 2 - 1), fill=(226, 226, 226, 255))
    return tile


def draw_stand_front_frame(index: int, alerted: bool = False) -> Image.Image:
    image = Image.new("RGBA", (CELL * SCALE, CELL * SCALE), TRANSPARENT)
    draw = ImageDraw.Draw(image)
    lift = [0, -1, -2, -1, 0, 1][index % 6]
    shake = [0, -3, 3, -2, 2, 0][index % 6] if alerted else 0
    paw_lift = [0, -6, -9, -6, -2, 0][index % 6] if alerted else 0
    tail_tip = [0, 3, -2, 2, -1, 0][index % 6]
    eye_widen = alerted and index in (1, 2, 3, 4)

    ellipse(draw, (88, GROUND_Y - 7, 232, GROUND_Y + 10), SOFT_SHADOW)
    ellipse(draw, (108, GROUND_Y - 4, 212, GROUND_Y + 7), SHADOW)

    line(draw, [(210 + shake, 225 + lift), (242 + shake, 192 + lift), (256 + shake, 151 + lift + tail_tip)], OUTLINE, 17)
    line(draw, [(210 + shake, 225 + lift), (242 + shake, 192 + lift), (256 + shake, 151 + lift + tail_tip)], FUR_MID, 11)
    line(draw, [(242 + shake, 192 + lift), (256 + shake, 151 + lift + tail_tip)], FUR_LIGHT, 4)

    ellipse(draw, (103 + shake, 190 + lift, 217 + shake, 252 + lift), FUR, OUTLINE, 3)
    ellipse(draw, (121 + shake, 206 + lift, 199 + shake, 258 + lift), BELLY, BELLY_SHADE, 2)

    rounded_rect(draw, (114 + shake, 237 + lift + paw_lift, 132 + shake, GROUND_Y + paw_lift), 7, FUR_LIGHT, OUTLINE, 2)
    rounded_rect(draw, (188 + shake, 237 + lift + paw_lift, 206 + shake, GROUND_Y + paw_lift), 7, FUR_LIGHT, OUTLINE, 2)
    ellipse(draw, (109 + shake, GROUND_Y - 7 + paw_lift, 137 + shake, GROUND_Y + 2 + paw_lift), FUR_LIGHT, OUTLINE, 2)
    ellipse(draw, (183 + shake, GROUND_Y - 7 + paw_lift, 211 + shake, GROUND_Y + 2 + paw_lift), FUR_LIGHT, OUTLINE, 2)

    draw_ear(draw, [(127 + shake, 179 + lift), (143 + shake, 150 + lift - (6 if alerted and index == 2 else 0)), (154 + shake, 181 + lift)])
    draw_ear(draw, [(166 + shake, 181 + lift), (184 + shake, 150 + lift - (6 if alerted and index == 2 else 0)), (195 + shake, 181 + lift)])
    ellipse(draw, (121 + shake, 168 + lift, 199 + shake, 234 + lift), FUR, OUTLINE, 3)
    ellipse(draw, (138 + shake, 196 + lift, 182 + shake, 229 + lift), FUR_MID)

    for stripe in [
        (145 + shake, 181 + lift, 151 + shake, 192 + lift),
        (160 + shake, 178 + lift, 160 + shake, 191 + lift),
        (174 + shake, 181 + lift, 169 + shake, 192 + lift),
    ]:
        line(draw, [(stripe[0], stripe[1]), (stripe[2], stripe[3])], FUR_DARK, 4)

    if eye_widen:
        ellipse(draw, (136 + shake, 195 + lift, 150 + shake, 209 + lift), EYE)
        ellipse(draw, (170 + shake, 195 + lift, 184 + shake, 209 + lift), EYE)
        ellipse(draw, (141 + shake, 198 + lift, 145 + shake, 202 + lift), EYE_SHINE)
        ellipse(draw, (175 + shake, 198 + lift, 179 + shake, 202 + lift), EYE_SHINE)
    else:
        ellipse(draw, (139 + shake, 197 + lift, 147 + shake, 205 + lift), EYE)
        ellipse(draw, (174 + shake, 197 + lift, 182 + shake, 205 + lift), EYE)
        ellipse(draw, (142 + shake, 199 + lift, 145 + shake, 202 + lift), EYE_SHINE)
        ellipse(draw, (177 + shake, 199 + lift, 180 + shake, 202 + lift), EYE_SHINE)

    polygon(draw, [(157 + shake, 207 + lift), (163 + shake, 207 + lift), (160 + shake, 213 + lift)], basic.NOSE)
    if eye_widen:
        ellipse(draw, (153 + shake, 216 + lift, 167 + shake, 229 + lift), TRANSPARENT, INK, 2)
    else:
        line(draw, [(160 + shake, 211 + lift), (160 + shake, 217 + lift)], INK, 2)
        draw.arc(box((150 + shake, 213 + lift, 161 + shake, 224 + lift)), 0, 100, fill=INK, width=s(2))
        draw.arc(box((161 + shake, 213 + lift, 172 + shake, 224 + lift)), 80, 180, fill=INK, width=s(2))

    for side in (-1, 1):
        x1 = 154 + shake if side < 0 else 166 + shake
        line(draw, [(x1, 211 + lift), (x1 + side * 27, 204 + lift)], WHISKER, 1)
        line(draw, [(x1, 216 + lift), (x1 + side * 30, 216 + lift)], WHISKER, 1)

    if alerted and index in (1, 2, 3):
        line(draw, [(111 + shake, 160 + lift), (100 + shake, 139 + lift)], (245, 158, 11, 230), 4)
        line(draw, [(160 + shake, 151 + lift), (160 + shake, 126 + lift)], (245, 158, 11, 230), 4)
        line(draw, [(209 + shake, 160 + lift), (220 + shake, 139 + lift)], (245, 158, 11, 230), 4)

    return image.resize((CELL, CELL), Image.Resampling.LANCZOS)


def draw_walk_side_alert_frame(index: int) -> Image.Image:
    image = Image.new("RGBA", (CELL * SCALE, CELL * SCALE), TRANSPARENT)
    draw = ImageDraw.Draw(image)
    lift = [0, -1, -3, -2, 1, 0][index % 6]
    shake = [0, -3, 3, -2, 2, 0][index % 6]
    step = [0, 3, -3, 2, -2, 0][index % 6]
    tail_tip = [0, -4, 4, -3, 2, 0][index % 6]
    eye_widen = index in (1, 2, 3, 4)

    draw_shadow(draw, 68, 266)
    line(draw, [(220 + shake, 220 + lift), (251 + shake, 205 + lift), (282 + shake, 218 + lift + tail_tip)], OUTLINE, 18)
    line(draw, [(220 + shake, 220 + lift), (251 + shake, 205 + lift), (282 + shake, 218 + lift + tail_tip)], FUR_MID, 11)

    ellipse(draw, (101 + shake, 185 + lift, 235 + shake, 255 + lift), FUR, OUTLINE, 3)
    ellipse(draw, (132 + shake, 207 + lift, 205 + shake, 247 + lift), BELLY, BELLY_SHADE, 2)
    for stripe in [
        (148 + shake, 192 + lift, 137 + shake, 212 + lift),
        (170 + shake, 188 + lift, 169 + shake, 210 + lift),
        (197 + shake, 194 + lift, 187 + shake, 214 + lift),
    ]:
        line(draw, [(stripe[0], stripe[1]), (stripe[2], stripe[3])], FUR_DARK, 4)

    legs = [
        (111 + step + shake, 232 + lift, 126 + step + shake, GROUND_Y),
        (134 - step + shake, 232 + lift, 149 - step + shake, GROUND_Y),
        (194 - step + shake, 232 + lift, 209 - step + shake, GROUND_Y),
        (214 + step + shake, 232 + lift, 229 + step + shake, GROUND_Y),
    ]
    for x1, y1, x2, y2 in legs:
        rounded_rect(draw, (x1, y1, x2, y2), 7, FUR_LIGHT, OUTLINE, 2)
        ellipse(draw, (x1 - 6, GROUND_Y - 8, x2 + 7, GROUND_Y + 3), FUR_LIGHT, OUTLINE, 2)

    hx = 92 + shake
    hy = 204 + lift
    ear_lift = 6 if index == 2 else 0
    draw_ear(draw, [(59 + shake, 188 + lift), (74 + shake, 158 + lift - ear_lift), (88 + shake, 190 + lift)])
    draw_ear(draw, [(96 + shake, 190 + lift), (115 + shake, 160 + lift - ear_lift), (128 + shake, 188 + lift)])
    ellipse(draw, (52 + shake, 174 + lift, 132 + shake, 240 + lift), FUR, OUTLINE, 3)
    ellipse(draw, (70 + shake, 202 + lift, 114 + shake, 234 + lift), FUR_MID)

    for stripe in [
        (78 + shake, 187 + lift, 84 + shake, 200 + lift),
        (92 + shake, 183 + lift, 92 + shake, 199 + lift),
        (107 + shake, 187 + lift, 101 + shake, 200 + lift),
    ]:
        line(draw, [(stripe[0], stripe[1]), (stripe[2], stripe[3])], FUR_DARK, 4)

    if eye_widen:
        ellipse(draw, (69 + shake, 198 + lift, 83 + shake, 212 + lift), EYE)
        ellipse(draw, (101 + shake, 198 + lift, 115 + shake, 212 + lift), EYE)
        ellipse(draw, (74 + shake, 201 + lift, 78 + shake, 205 + lift), EYE_SHINE)
        ellipse(draw, (106 + shake, 201 + lift, 110 + shake, 205 + lift), EYE_SHINE)
        ellipse(draw, (86 + shake, 218 + lift, 100 + shake, 230 + lift), TRANSPARENT, INK, 2)
    else:
        ellipse(draw, (72 + shake, 199 + lift, 81 + shake, 208 + lift), EYE)
        ellipse(draw, (104 + shake, 199 + lift, 113 + shake, 208 + lift), EYE)
        line(draw, [(92 + shake, 213 + lift), (92 + shake, 220 + lift)], INK, 2)
        draw.arc(box((80 + shake, 216 + lift, 92 + shake, 228 + lift)), 10, 100, fill=INK, width=s(2))
        draw.arc(box((92 + shake, 216 + lift, 104 + shake, 228 + lift)), 80, 170, fill=INK, width=s(2))

    polygon(draw, [(88 + shake, 209 + lift), (96 + shake, 209 + lift), (92 + shake, 215 + lift)], basic.NOSE)
    for side in (-1, 1):
        x1 = 86 + shake if side < 0 else 98 + shake
        line(draw, [(x1, 213 + lift), (x1 + side * 28, 207 + lift)], WHISKER, 1)
        line(draw, [(x1, 218 + lift), (x1 + side * 31, 218 + lift)], WHISKER, 1)

    if index in (1, 2, 3):
        line(draw, [(54 + shake, 166 + lift), (39 + shake, 145 + lift)], (245, 158, 11, 230), 4)
        line(draw, [(92 + shake, 154 + lift), (92 + shake, 128 + lift)], (245, 158, 11, 230), 4)
        line(draw, [(132 + shake, 166 + lift), (148 + shake, 145 + lift)], (245, 158, 11, 230), 4)

    return image.resize((CELL, CELL), Image.Resampling.LANCZOS)


def draw_sleep_front_frame(index: int, bubble: int = 0, popped: bool = False, wake: bool = False) -> Image.Image:
    image = Image.new("RGBA", (CELL * SCALE, CELL * SCALE), TRANSPARENT)
    draw = ImageDraw.Draw(image)
    breathe = [0, -1, -2, -1, 0, 1, 0, -1][index % 8]
    head_lift = [0, 0, 0, 2, 5, 2][index % 6] if wake else 0
    eye_state = "wake" if wake and index in (1, 2) else "blink" if wake and index in (3, 4) else "sleep"

    ellipse(draw, (80, GROUND_Y - 8, 240, GROUND_Y + 9), SOFT_SHADOW)
    ellipse(draw, (103, GROUND_Y - 4, 217, GROUND_Y + 6), SHADOW)

    line(draw, [(204, 242 + breathe), (242, 255 + breathe), (283, 244 + breathe)], OUTLINE, 17)
    line(draw, [(204, 242 + breathe), (242, 255 + breathe), (283, 244 + breathe)], FUR_MID, 11)

    ellipse(draw, (96, 203 + breathe, 224, 273 + breathe), FUR, OUTLINE, 3)
    ellipse(draw, (120, 221 + breathe, 200, 274 + breathe), BELLY, BELLY_SHADE, 2)
    ellipse(draw, (102, 246 + breathe, 135, 273 + breathe), FUR_LIGHT, OUTLINE, 2)
    ellipse(draw, (185, 246 + breathe, 218, 273 + breathe), FUR_LIGHT, OUTLINE, 2)
    rounded_rect(draw, (137, 238 + breathe, 155, GROUND_Y), 8, FUR_LIGHT, OUTLINE, 2)
    rounded_rect(draw, (165, 238 + breathe, 183, GROUND_Y), 8, FUR_LIGHT, OUTLINE, 2)

    hy = breathe + head_lift
    draw_ear(draw, [(125, 193 + hy), (142, 165 + hy), (155, 195 + hy)])
    draw_ear(draw, [(165, 195 + hy), (184, 165 + hy), (197, 193 + hy)])
    ellipse(draw, (118, 179 + hy, 202, 247 + hy), FUR, OUTLINE, 3)
    ellipse(draw, (135, 213 + hy, 185, 241 + hy), BELLY)

    for stripe in [
        (143, 192 + hy, 149, 204 + hy),
        (160, 189 + hy, 160, 203 + hy),
        (177, 192 + hy, 171, 204 + hy),
    ]:
        line(draw, [(stripe[0], stripe[1]), (stripe[2], stripe[3])], FUR_DARK, 4)

    if eye_state == "wake":
        ellipse(draw, (137, 209 + hy, 150, 222 + hy), EYE)
        ellipse(draw, (170, 209 + hy, 183, 222 + hy), EYE)
        ellipse(draw, (141, 211 + hy, 145, 215 + hy), EYE_SHINE)
        ellipse(draw, (174, 211 + hy, 178, 215 + hy), EYE_SHINE)
    elif eye_state == "blink":
        draw.arc(box((136, 211 + hy, 151, 222 + hy)), start=20, end=160, fill=EYE, width=s(3))
        draw.arc(box((169, 211 + hy, 184, 222 + hy)), start=20, end=160, fill=EYE, width=s(3))
    else:
        draw.arc(box((136, 210 + hy, 151, 222 + hy)), start=20, end=160, fill=EYE, width=s(3))
        draw.arc(box((169, 210 + hy, 184, 222 + hy)), start=20, end=160, fill=EYE, width=s(3))

    polygon(draw, [(157, 223 + hy), (163, 223 + hy), (160, 228 + hy)], basic.NOSE)
    if wake and index in (1, 2):
        ellipse(draw, (153, 231 + hy, 167, 242 + hy), TRANSPARENT, INK, 2)
    else:
        draw.arc(box((150, 227 + hy, 161, 238 + hy)), start=10, end=100, fill=INK, width=s(2))
        draw.arc(box((159, 227 + hy, 171, 238 + hy)), start=80, end=170, fill=INK, width=s(2))

    if bubble > 0:
        radius = bubble
        cx = 180
        cy = 220 + hy - radius // 3
        ellipse(draw, (cx - radius, cy - radius, cx + radius, cy + radius), (186, 230, 253, 160), (14, 116, 144, 180), 2)
        ellipse(draw, (cx - radius * 0.45, cy - radius * 0.48, cx - radius * 0.12, cy - radius * 0.15), (255, 255, 255, 185))

    if popped:
        for points in [
            [(175, 199 + hy), (165, 184 + hy)],
            [(184, 202 + hy), (201, 188 + hy)],
            [(190, 217 + hy), (210, 218 + hy)],
            [(171, 217 + hy), (154, 226 + hy)],
        ]:
            line(draw, points, (14, 116, 144, 200), 3)
        ellipse(draw, (177, 210 + hy, 184, 217 + hy), (255, 255, 255, 160))

    return image.resize((CELL, CELL), Image.Resampling.LANCZOS)


def draw_drag_frame(dx: int, tail_dx: int, foot_shift: int) -> Image.Image:
    image = Image.new("RGBA", (CELL * SCALE, CELL * SCALE), TRANSPARENT)
    draw = ImageDraw.Draw(image)
    # hand and scruff point
    rounded_rect(draw, (134 + dx, 52, 187 + dx, 88), 14, (238, 188, 142, 255), (123, 78, 55, 255), 3)
    rounded_rect(draw, (153 + dx, 24, 169 + dx, 71), 8, (238, 188, 142, 255), (123, 78, 55, 255), 2)
    line(draw, [(160 + dx, 88), (160 + dx, 126)], (123, 78, 55, 255), 5)
    line(draw, [(204 + dx, 191), (240 + dx + tail_dx, 209), (276 + dx + tail_dx, 190)], OUTLINE, 16)
    line(draw, [(204 + dx, 191), (240 + dx + tail_dx, 209), (276 + dx + tail_dx, 190)], FUR_MID, 10)
    ellipse(draw, (102 + dx, 122, 218 + dx, 224), FUR, OUTLINE, 3)
    ellipse(draw, (126 + dx, 153, 198 + dx, 220), BELLY, BELLY_SHADE, 2)
    draw_ear(draw, [(84 + dx, 106), (91 + dx, 78), (105 + dx, 106)])
    draw_ear(draw, [(109 + dx, 107), (126 + dx, 84), (129 + dx, 113)])
    ellipse(draw, (70 + dx, 100, 134 + dx, 160), FUR, OUTLINE, 3)
    ellipse(draw, (90 + dx, 128, 99 + dx, 137), EYE)
    line(draw, [(113 + dx, 142), (124 + dx, 144)], INK, 2)
    for x in (108, 136, 178, 203):
        rounded_rect(draw, (x + dx, 210 + foot_shift, x + 14 + dx, 259 + foot_shift), 7, FUR_LIGHT, OUTLINE, 2)
        ellipse(draw, (x - 5 + dx, 253 + foot_shift, x + 19 + dx, 266 + foot_shift), FUR_LIGHT, OUTLINE, 2)
    return image.resize((CELL, CELL), Image.Resampling.LANCZOS)


def draw_fall_frame(angle: int, y: int, tail: int) -> Image.Image:
    image = Image.new("RGBA", (CELL * SCALE, CELL * SCALE), TRANSPARENT)
    draw = ImageDraw.Draw(image)
    cx, cy = 160, y
    line(draw, [(202, cy + 8), (235 + tail, cy - 5), (262 + tail, cy + 20)], OUTLINE, 15)
    line(draw, [(202, cy + 8), (235 + tail, cy - 5), (262 + tail, cy + 20)], FUR_MID, 9)
    ellipse(draw, (98, cy - 44, 220, cy + 50), FUR, OUTLINE, 3)
    ellipse(draw, (126, cy - 20, 196, cy + 37), BELLY, BELLY_SHADE, 2)
    draw_ear(draw, [(95, cy - 40), (103, cy - 68), (117, cy - 37)])
    draw_ear(draw, [(132, cy - 43), (151, cy - 65), (153, cy - 33)])
    ellipse(draw, (78, cy - 43, 145, cy + 18), FUR, OUTLINE, 3)
    ellipse(draw, (100, cy - 18, 109, cy - 9), EYE)
    line(draw, [(122, cy - 4), (134, cy - 1)], INK, 2)
    for x, yy in [(112, cy + 45), (142, cy + 48), (178, cy + 45), (205, cy + 37)]:
        ellipse(draw, (x - 9, yy - 8, x + 10, yy + 10), FUR_LIGHT, OUTLINE, 2)
    if angle:
        image = image.rotate(angle, resample=Image.Resampling.BICUBIC, center=xy((160, y)), fillcolor=TRANSPARENT)
    return image.resize((CELL, CELL), Image.Resampling.LANCZOS)


def draw_land_frame(squash: int, head: int, tail: int) -> Image.Image:
    image = Image.new("RGBA", (CELL * SCALE, CELL * SCALE), TRANSPARENT)
    draw = ImageDraw.Draw(image)
    ellipse(draw, (70, GROUND_Y - 6, 260, GROUND_Y + 9), SOFT_SHADOW)
    line(draw, [(210, 248), (248, 258 + tail), (286, 244 + tail)], OUTLINE, 17)
    line(draw, [(210, 248), (248, 258 + tail), (286, 244 + tail)], FUR_MID, 10)
    ellipse(draw, (94, 204 + squash, 228, 274), FUR, OUTLINE, 3)
    ellipse(draw, (124, 224 + squash, 199, 274), BELLY, BELLY_SHADE, 2)
    rounded_rect(draw, (112, 250, 145, GROUND_Y + 3), 7, FUR_LIGHT, OUTLINE, 2)
    rounded_rect(draw, (181, 250, 216, GROUND_Y + 3), 7, FUR_LIGHT, OUTLINE, 2)
    draw_ear(draw, [(74, 218 + head), (82, 190 + head), (96, 219 + head)])
    draw_ear(draw, [(103, 220 + head), (120, 196 + head), (123, 225 + head)])
    ellipse(draw, (60, 210 + head, 130, 268 + head), FUR, OUTLINE, 3)
    ellipse(draw, (86, 236 + head, 94, 244 + head), EYE)
    line(draw, [(108, 249 + head), (119, 251 + head)], INK, 2)
    return image.resize((CELL, CELL), Image.Resampling.LANCZOS)


def draw_fall_to_land_frame(squash: int, head: int, tail: int, impact: int) -> Image.Image:
    image = draw_land_frame(squash, head, tail).resize((CELL * SCALE, CELL * SCALE), Image.Resampling.LANCZOS)
    draw = ImageDraw.Draw(image)
    if impact:
        line(draw, [(88, GROUND_Y - 18), (68, GROUND_Y - 28)], (117, 67, 35, 150), 2)
        line(draw, [(231, GROUND_Y - 15), (255, GROUND_Y - 24)], (117, 67, 35, 150), 2)
        ellipse(draw, (84 - impact, GROUND_Y - 8, 258 + impact, GROUND_Y + 12), (82, 56, 38, 18))
    return image.resize((CELL, CELL), Image.Resampling.LANCZOS)


def write_sheet(path: Path, rows: int, cols: int, clips: dict[int, list[Image.Image]]) -> None:
    sheet = Image.new("RGBA", (CELL * cols, CELL * rows), TRANSPARENT)
    for row, frames in clips.items():
        for col, frame in enumerate(frames):
            sheet.alpha_composite(frame, (col * CELL, row * CELL))
    path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(path)


def write_preview(path: Path, frames: list[Image.Image], sizes: list[int] | None = None) -> None:
    sizes = sizes or [64, 72, 80]
    pad = 18
    label_w = 64
    width = label_w + len(frames) * (80 + pad) + pad
    height = pad + len(sizes) * (80 + pad)
    preview = Image.new("RGBA", (width, height), (244, 239, 227, 255))
    draw = ImageDraw.Draw(preview)
    tile = checker_tile()
    for row, size in enumerate(sizes):
        y = pad + row * (80 + pad)
        draw.text((pad, y + 27), f"{size}px", fill=INK)
        for col, source in enumerate(frames):
            x = label_w + col * (80 + pad)
            backdrop = Image.new("RGBA", (80, 80), (255, 255, 255, 255))
            for tx in range(0, 80, tile.width):
                for ty in range(0, 80, tile.height):
                    backdrop.alpha_composite(tile, (tx, ty))
            frame = source.resize((size, size), Image.Resampling.LANCZOS)
            preview.alpha_composite(backdrop, (x, y))
            preview.alpha_composite(frame, (x + (80 - size) // 2, y + (80 - size) // 2))
    preview.save(path)


def write_gif(path: Path, frames: list[Image.Image], duration: int = 130) -> None:
    tile = checker_tile()
    out = []
    for source in frames:
        frame = Image.new("RGBA", (128, 128), (244, 239, 227, 255))
        for tx in range(0, 128, tile.width):
            for ty in range(0, 128, tile.height):
                frame.alpha_composite(tile, (tx, ty))
        cat = source.resize((80, 80), Image.Resampling.LANCZOS)
        frame.alpha_composite(cat, (24, 26))
        out.append(frame.convert("P", palette=Image.Palette.ADAPTIVE))
    out[0].save(path, save_all=True, append_images=out[1:], duration=duration, loop=0, optimize=False, disposal=2)


def update_transitions(rows: dict[int, list[Image.Image]]) -> None:
    path = SPRITES_DIR / "transitions.png"
    if path.exists():
        sheet = Image.open(path).convert("RGBA")
    else:
        sheet = Image.new("RGBA", (CELL * 8, CELL * 11), TRANSPARENT)
    for row, frames in rows.items():
        sheet.paste(Image.new("RGBA", (CELL * 8, CELL), TRANSPARENT), (0, row * CELL))
        for col, frame in enumerate(frames):
            sheet.alpha_composite(frame, (col * CELL, row * CELL))
    sheet.save(path)


def main() -> None:
    SPRITES_DIR.mkdir(parents=True, exist_ok=True)
    stand_look = [draw_stand_front_frame(i, alerted=False) for i in range(6)]
    alert = [draw_stand_front_frame(i, alerted=True) for i in range(6)]
    walk_alert = [draw_walk_side_alert_frame(i) for i in range(6)]
    drag = [draw_drag_frame(dx, tail, foot) for dx, tail, foot in [(-2, -4, 0), (0, 0, 2), (2, 4, -1), (0, 2, 1), (-2, -3, 2), (1, 3, 0), (2, 4, -1), (0, 0, 1)]]
    fall = [draw_fall_frame(a, y, tail) for a, y, tail in [(-18, 168, -4), (-8, 176, 0), (8, 184, 4), (18, 192, 2), (8, 202, -2), (-8, 212, 0)]]
    land = [draw_land_frame(sq, head, tail) for sq, head, tail in [(8, 7, 3), (5, 4, 2), (2, 2, 1), (0, 0, 0), (-1, -1, 0), (0, 0, 0), (0, 0, 0), (0, 0, 0)]]

    drag_release = drag[:1]
    fall_to_land = [
        draw_fall_to_land_frame(14, 12, 6, 7),
        draw_fall_to_land_frame(12, 10, 5, 5),
        draw_fall_to_land_frame(10, 8, 4, 3),
        draw_fall_to_land_frame(8, 7, 3, 1),
    ]
    land_to_sit = [
        land[4],
        land[5],
        land[6],
        basic.render_frame(Pose("sit", body_y=14, head_y=16, tail_tip_y=5, eye_state="closed")),
        basic.render_frame(Pose("sit", body_y=10, head_y=11, tail_tip_y=3)),
        basic.render_frame(Pose("sit", body_y=6, head_y=6, tail_tip_y=2)),
        basic.render_frame(Pose("sit", body_y=2, head_y=2, tail_tip_y=1)),
        basic.render_frame(Pose("sit")),
    ]

    write_sheet(SPRITES_DIR / "alert.png", 3, 6, {0: stand_look, 1: alert, 2: walk_alert})
    write_sheet(SPRITES_DIR / "drag.png", 1, 8, {0: drag})
    write_sheet(SPRITES_DIR / "fall.png", 1, 6, {0: fall})
    write_sheet(SPRITES_DIR / "land.png", 1, 8, {0: land})
    update_transitions({8: [], 9: fall_to_land, 10: land_to_sit})

    write_preview(SPRITES_DIR / "stand-look-preview.png", stand_look)
    write_preview(SPRITES_DIR / "alert-touch-preview.png", alert)
    write_preview(SPRITES_DIR / "alert-walk-touch-preview.png", walk_alert)
    write_preview(SPRITES_DIR / "drag-scruff-preview.png", drag)
    write_preview(SPRITES_DIR / "fall-loop-preview.png", fall)
    write_preview(SPRITES_DIR / "land-recover-preview.png", land)
    write_preview(SPRITES_DIR / "land-to-sit-preview.png", land_to_sit)
    write_gif(SPRITES_DIR / "stand-look-animated-preview.gif", stand_look)
    write_gif(SPRITES_DIR / "alert-touch-animated-preview.gif", alert)
    write_gif(SPRITES_DIR / "alert-walk-touch-animated-preview.gif", walk_alert)
    write_gif(SPRITES_DIR / "drag-scruff-animated-preview.gif", drag)
    write_gif(SPRITES_DIR / "fall-loop-animated-preview.gif", fall, duration=100)
    write_gif(SPRITES_DIR / "land-recover-animated-preview.gif", land, duration=110)
    write_gif(SPRITES_DIR / "land-to-sit-animated-preview.gif", land_to_sit, duration=110)
    write_gif(
        SPRITES_DIR / "interaction-sequence-preview.gif",
        alert + drag + drag_release + fall + fall_to_land + land + land_to_sit,
        duration=105,
    )

    for path in [
        "alert.png",
        "stand-look-preview.png",
        "stand-look-animated-preview.gif",
        "alert-walk-touch-preview.png",
        "alert-walk-touch-animated-preview.gif",
        "drag.png",
        "fall.png",
        "land.png",
        "transitions.png",
        "land-to-sit-preview.png",
        "land-to-sit-animated-preview.gif",
        "interaction-sequence-preview.gif",
    ]:
        print(f"Wrote {SPRITES_DIR / path}")


if __name__ == "__main__":
    main()

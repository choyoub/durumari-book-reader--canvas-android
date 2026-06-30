from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
BLUEPRINT_DIR = ROOT / "assets" / "avatars" / "blueprint"
SPRITES_DIR = BLUEPRINT_DIR / "sprites"

CELL = 320
COLS = 8
ROWS = 9
GROUND_Y = 270
SCALE = 4

OUT = SPRITES_DIR / "sit.png"
IDLE_PREVIEW = SPRITES_DIR / "sit-idle-preview.png"
IDLE_ANIMATED_PREVIEW = SPRITES_DIR / "sit-idle-animated-preview.gif"
TAIL_SWAY_PREVIEW = SPRITES_DIR / "sit-tail-sway-preview.png"
TAIL_SWAY_ANIMATED_PREVIEW = SPRITES_DIR / "sit-tail-sway-animated-preview.gif"
BLINK_PREVIEW = SPRITES_DIR / "sit-blink-preview.png"
BLINK_ANIMATED_PREVIEW = SPRITES_DIR / "sit-blink-animated-preview.gif"
DROWSY_PREVIEW = SPRITES_DIR / "sit-drowsy-preview.png"
DROWSY_ANIMATED_PREVIEW = SPRITES_DIR / "sit-drowsy-animated-preview.gif"
EAR_TWITCH_PREVIEW = SPRITES_DIR / "sit-ear-twitch-preview.png"
EAR_TWITCH_ANIMATED_PREVIEW = SPRITES_DIR / "sit-ear-twitch-animated-preview.gif"
PAW_TIDY_PREVIEW = SPRITES_DIR / "sit-paw-tidy-preview.png"
PAW_TIDY_ANIMATED_PREVIEW = SPRITES_DIR / "sit-paw-tidy-animated-preview.gif"
SLEEP_PREVIEW = SPRITES_DIR / "sit-sleep-preview.png"
SLEEP_ANIMATED_PREVIEW = SPRITES_DIR / "sit-sleep-animated-preview.gif"
NOSE_BUBBLE_PREVIEW = SPRITES_DIR / "sit-nose-bubble-preview.png"
NOSE_BUBBLE_ANIMATED_PREVIEW = SPRITES_DIR / "sit-nose-bubble-animated-preview.gif"
ALERT_WAKE_PREVIEW = SPRITES_DIR / "sit-alert-wake-preview.png"
ALERT_WAKE_ANIMATED_PREVIEW = SPRITES_DIR / "sit-alert-wake-animated-preview.gif"
FOUNDATION_SEQUENCE_PREVIEW = SPRITES_DIR / "sit-foundation-sequence-preview.gif"


@dataclass(frozen=True)
class FramePose:
    body_y: int = 0
    head_y: int = 0
    cheek_y: int = 0
    ear_y: int = 0
    tail_y: int = 0
    tail_mid_x: int = 0
    tail_mid_y: int = 0
    tail_tip_x: int = 0
    tail_tip_y: int = 0
    belly_scale_y: float = 1.0
    eye_state: str = "open"
    mouth_state: str = "smile"
    bubble_radius: int = 0
    bubble_pop: bool = False
    paw_tidy: int = 0
    alert_marks: bool = False
    left_ear_tip_x: int = 0
    left_ear_tip_y: int = 0
    right_ear_tip_x: int = 0
    right_ear_tip_y: int = 0


IDLE_FRAMES = [
    FramePose(body_y=0, head_y=0, cheek_y=0, ear_y=0, tail_y=0, belly_scale_y=1.00),
    FramePose(body_y=-1, head_y=-1, cheek_y=-1, ear_y=-1, tail_y=0, belly_scale_y=1.01),
    FramePose(body_y=-2, head_y=-1, cheek_y=-1, ear_y=-1, tail_y=-1, belly_scale_y=1.02),
    FramePose(body_y=-1, head_y=-1, cheek_y=-1, ear_y=-1, tail_y=0, belly_scale_y=1.01),
    FramePose(body_y=0, head_y=0, cheek_y=0, ear_y=0, tail_y=0, belly_scale_y=1.00),
    FramePose(body_y=1, head_y=0, cheek_y=0, ear_y=0, tail_y=1, belly_scale_y=0.99),
]

TAIL_SWAY_FRAMES = [
    FramePose(tail_mid_x=-6, tail_mid_y=4, tail_tip_x=-8, tail_tip_y=6),
    FramePose(tail_mid_x=-3, tail_mid_y=2, tail_tip_x=-4, tail_tip_y=3),
    FramePose(tail_mid_x=0, tail_mid_y=0, tail_tip_x=0, tail_tip_y=0),
    FramePose(tail_mid_x=2, tail_mid_y=-2, tail_tip_x=3, tail_tip_y=-4),
    FramePose(tail_mid_x=1, tail_mid_y=-1, tail_tip_x=2, tail_tip_y=-2),
    FramePose(tail_mid_x=-2, tail_mid_y=1, tail_tip_x=-3, tail_tip_y=2),
]

BLINK_FRAMES = [
    FramePose(eye_state="open"),
    FramePose(eye_state="half"),
    FramePose(eye_state="closed"),
    FramePose(eye_state="open"),
]

DROWSY_FRAMES = [
    FramePose(eye_state="open", mouth_state="smile"),
    FramePose(head_y=1, ear_y=1, eye_state="half", mouth_state="flat"),
    FramePose(head_y=2, ear_y=1, eye_state="half", mouth_state="flat"),
    FramePose(head_y=3, ear_y=2, eye_state="closed", mouth_state="flat", belly_scale_y=0.99),
    FramePose(head_y=3, ear_y=2, eye_state="closed", mouth_state="flat", belly_scale_y=0.99),
    FramePose(head_y=2, ear_y=1, eye_state="half", mouth_state="flat"),
    FramePose(head_y=1, ear_y=1, eye_state="half", mouth_state="smile"),
    FramePose(eye_state="open", mouth_state="smile"),
]

EAR_TWITCH_FRAMES = [
    FramePose(),
    FramePose(left_ear_tip_x=-5, left_ear_tip_y=7),
    FramePose(right_ear_tip_x=5, right_ear_tip_y=7),
    FramePose(),
]

PAW_TIDY_FRAMES = [
    FramePose(paw_tidy=0),
    FramePose(paw_tidy=1, head_y=1),
    FramePose(paw_tidy=2, head_y=1, eye_state="half"),
    FramePose(paw_tidy=3, head_y=1, eye_state="closed"),
    FramePose(paw_tidy=2, head_y=1, eye_state="half"),
    FramePose(paw_tidy=1),
    FramePose(paw_tidy=0),
    FramePose(),
]

SLEEP_FRAMES = [
    FramePose(head_y=3, ear_y=2, eye_state="closed", mouth_state="flat", belly_scale_y=0.99),
    FramePose(head_y=4, ear_y=2, eye_state="closed", mouth_state="flat", belly_scale_y=1.00),
    FramePose(head_y=5, ear_y=2, eye_state="closed", mouth_state="flat", belly_scale_y=1.01),
    FramePose(head_y=4, ear_y=2, eye_state="closed", mouth_state="flat", belly_scale_y=1.00),
    FramePose(head_y=3, ear_y=2, eye_state="closed", mouth_state="flat", belly_scale_y=0.99),
    FramePose(head_y=4, ear_y=2, eye_state="closed", mouth_state="flat", belly_scale_y=1.00),
]

NOSE_BUBBLE_FRAMES = [
    FramePose(head_y=4, ear_y=2, eye_state="closed", mouth_state="flat", bubble_radius=4),
    FramePose(head_y=4, ear_y=2, eye_state="closed", mouth_state="flat", bubble_radius=8),
    FramePose(head_y=5, ear_y=2, eye_state="closed", mouth_state="flat", bubble_radius=12),
    FramePose(head_y=5, ear_y=2, eye_state="closed", mouth_state="flat", bubble_radius=17),
    FramePose(head_y=4, ear_y=2, eye_state="closed", mouth_state="flat", bubble_radius=22),
    FramePose(head_y=4, ear_y=2, eye_state="closed", mouth_state="flat", bubble_radius=26),
    FramePose(head_y=3, ear_y=2, eye_state="closed", mouth_state="flat", bubble_pop=True),
    FramePose(head_y=2, ear_y=1, eye_state="half", mouth_state="flat", bubble_pop=True),
]

ALERT_WAKE_FRAMES = [
    FramePose(head_y=2, ear_y=1, eye_state="half", mouth_state="flat"),
    FramePose(head_y=-3, ear_y=-4, eye_state="open", mouth_state="open", alert_marks=True, left_ear_tip_y=-4, right_ear_tip_y=-4),
    FramePose(head_y=-5, ear_y=-5, eye_state="open", mouth_state="open", alert_marks=True, left_ear_tip_x=-3, right_ear_tip_x=3),
    FramePose(head_y=-2, ear_y=-2, eye_state="open", mouth_state="open", alert_marks=True),
    FramePose(head_y=0, ear_y=0, eye_state="half", mouth_state="flat"),
    FramePose(eye_state="open", mouth_state="smile"),
]

CLIPS = [
    (0, IDLE_FRAMES),
    (1, TAIL_SWAY_FRAMES),
    (2, BLINK_FRAMES),
    (3, DROWSY_FRAMES),
    (4, EAR_TWITCH_FRAMES),
    (5, PAW_TIDY_FRAMES),
    (6, SLEEP_FRAMES),
    (7, NOSE_BUBBLE_FRAMES),
    (8, ALERT_WAKE_FRAMES),
]

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


def s(value: float | int) -> int:
    return round(value * SCALE)


def xy(point: tuple[float, float]) -> tuple[int, int]:
    return s(point[0]), s(point[1])


def box(values: tuple[float, float, float, float]) -> tuple[int, int, int, int]:
    return tuple(s(value) for value in values)  # type: ignore[return-value]


def color(rgba: tuple[int, int, int, int]) -> tuple[int, int, int, int]:
    return rgba


def line(draw: ImageDraw.ImageDraw, points: list[tuple[float, float]], fill, width: int, joint: str = "curve") -> None:
    draw.line([xy(point) for point in points], fill=fill, width=s(width), joint=joint)


def ellipse(draw: ImageDraw.ImageDraw, values: tuple[float, float, float, float], fill, outline=None, width: int = 1) -> None:
    draw.ellipse(box(values), fill=fill, outline=outline, width=s(width) if outline else 1)


def polygon(draw: ImageDraw.ImageDraw, points: list[tuple[float, float]], fill, outline=None) -> None:
    draw.polygon([xy(point) for point in points], fill=fill, outline=outline)


def rounded_rect(
    draw: ImageDraw.ImageDraw,
    values: tuple[float, float, float, float],
    radius: int,
    fill,
    outline=None,
    width: int = 1,
) -> None:
    draw.rounded_rectangle(box(values), radius=s(radius), fill=fill, outline=outline, width=s(width) if outline else 1)


def draw_tail(draw: ImageDraw.ImageDraw, pose: FramePose) -> None:
    y = pose.tail_y
    tail_points = [
        (210, 237 + y),
        (235 + pose.tail_mid_x, 250 + y + pose.tail_mid_y),
        (261 + pose.tail_mid_x, 247 + y + pose.tail_mid_y),
        (286 + pose.tail_tip_x, 238 + y + pose.tail_tip_y),
    ]
    line(draw, tail_points, OUTLINE, 19)
    line(draw, tail_points, FUR_DARK, 14)
    line(draw, tail_points, FUR_MID, 9)
    line(
        draw,
        [
            (235 + pose.tail_mid_x, 249 + y + pose.tail_mid_y),
            (260 + pose.tail_mid_x, 247 + y + pose.tail_mid_y),
            (284 + pose.tail_tip_x, 239 + y + pose.tail_tip_y),
        ],
        FUR_LIGHT,
        3,
    )
    ellipse(
        draw,
        (
            281 + pose.tail_tip_x,
            232 + y + pose.tail_tip_y,
            294 + pose.tail_tip_x,
            244 + y + pose.tail_tip_y,
        ),
        FUR_LIGHT,
    )


def draw_ear(draw: ImageDraw.ImageDraw, points: list[tuple[float, float]]) -> None:
    polygon(draw, points, FUR, OUTLINE)
    cx = sum(x for x, _ in points) / len(points)
    cy = sum(y for _, y in points) / len(points)
    inner = [(cx + (x - cx) * 0.55, cy + (y - cy) * 0.60) for x, y in points]
    polygon(draw, inner, EAR_INNER)


def draw_body(draw: ImageDraw.ImageDraw, pose: FramePose) -> None:
    by = pose.body_y
    ellipse(draw, (95, 190 + by, 225, 273 + by), FUR, OUTLINE, 3)
    ellipse(draw, (112, 204 + by, 208, 273 + by), FUR_MID)

    belly_cy = 240 + by
    belly_h = 62 * pose.belly_scale_y
    ellipse(draw, (124, belly_cy - belly_h / 2, 196, belly_cy + belly_h / 2), BELLY, BELLY_SHADE, 2)
    ellipse(draw, (134, belly_cy - belly_h / 2 + 7, 186, belly_cy + belly_h / 2 - 5), (255, 231, 177, 255))

    stripes = [
        [(129, 198 + by), (123, 211 + by)],
        [(151, 191 + by), (149, 207 + by)],
        [(174, 193 + by), (180, 209 + by)],
        [(206, 220 + by), (220, 214 + by)],
        [(104, 221 + by), (91, 215 + by)],
    ]
    for stripe in stripes:
        line(draw, stripe, FUR_DARK, 4)


def draw_back_paws(draw: ImageDraw.ImageDraw) -> None:
    ellipse(draw, (101, 244, 134, 273), FUR_LIGHT, OUTLINE, 2)
    ellipse(draw, (186, 244, 219, 273), FUR_LIGHT, OUTLINE, 2)
    ellipse(draw, (105, 255, 131, 273), (255, 198, 102, 255))
    ellipse(draw, (190, 255, 216, 273), (255, 198, 102, 255))


def draw_front_legs(draw: ImageDraw.ImageDraw, pose: FramePose) -> None:
    by = pose.body_y
    if pose.paw_tidy:
        lift = min(14, pose.paw_tidy * 5)
        rounded_rect(draw, (137, 224 + by, 155, GROUND_Y), 8, FUR_LIGHT, OUTLINE, 2)
        ellipse(draw, (135, GROUND_Y - 9, 158, GROUND_Y + 3), FUR_LIGHT, OUTLINE, 2)
        rounded_rect(draw, (165, 224 + by - lift, 183, GROUND_Y - lift), 8, FUR_LIGHT, OUTLINE, 2)
        ellipse(draw, (162, GROUND_Y - 9 - lift, 185, GROUND_Y + 3 - lift), FUR_LIGHT, OUTLINE, 2)
        line(draw, [(167, GROUND_Y - 16 - lift), (154, 230 + by)], OUTLINE_SOFT, 2)
        return
    rounded_rect(draw, (137, 224 + by, 155, GROUND_Y), 8, FUR_LIGHT, OUTLINE, 2)
    rounded_rect(draw, (165, 224 + by, 183, GROUND_Y), 8, FUR_LIGHT, OUTLINE, 2)
    ellipse(draw, (135, GROUND_Y - 9, 158, GROUND_Y + 3), FUR_LIGHT, OUTLINE, 2)
    ellipse(draw, (162, GROUND_Y - 9, 185, GROUND_Y + 3), FUR_LIGHT, OUTLINE, 2)
    for x in (143, 150, 170, 177):
        line(draw, [(x, GROUND_Y - 4), (x + 1, GROUND_Y + 1)], OUTLINE_SOFT, 1)


def draw_head(draw: ImageDraw.ImageDraw, pose: FramePose) -> None:
    hy = pose.head_y
    ey = pose.ear_y
    draw_ear(
        draw,
        [
            (125, 183 + ey),
            (142 + pose.left_ear_tip_x, 150 + ey + pose.left_ear_tip_y),
            (155, 185 + ey),
        ],
    )
    draw_ear(
        draw,
        [
            (165, 185 + ey),
            (184 + pose.right_ear_tip_x, 150 + ey + pose.right_ear_tip_y),
            (197, 183 + ey),
        ],
    )
    ellipse(draw, (118, 167 + hy, 202, 239 + hy), FUR, OUTLINE, 3)
    ellipse(draw, (129, 190 + hy, 191, 235 + hy), FUR_MID)
    ellipse(draw, (135, 203 + hy, 185, 235 + hy), BELLY)

    stripes = [
        [(143, 181 + hy), (149, 196 + hy)],
        [(160, 177 + hy), (160, 195 + hy)],
        [(177, 181 + hy), (171, 196 + hy)],
    ]
    for stripe in stripes:
        line(draw, stripe, FUR_DARK, 4)

    if pose.eye_state == "closed":
        draw.arc(box((136, 198 + hy, 150, 210 + hy)), start=25, end=155, fill=EYE, width=s(3))
        draw.arc(box((170, 198 + hy, 184, 210 + hy)), start=25, end=155, fill=EYE, width=s(3))
    elif pose.eye_state == "half":
        rounded_rect(draw, (137, 202 + hy, 149, 208 + hy), 3, EYE)
        rounded_rect(draw, (171, 202 + hy, 183, 208 + hy), 3, EYE)
        line(draw, [(136, 201 + hy), (150, 201 + hy)], FUR_DARK, 2)
        line(draw, [(170, 201 + hy), (184, 201 + hy)], FUR_DARK, 2)
    else:
        ellipse(draw, (138, 200 + hy, 148, 210 + hy), EYE)
        ellipse(draw, (172, 200 + hy, 182, 210 + hy), EYE)
        ellipse(draw, (142, 202 + hy, 145, 205 + hy), EYE_SHINE)
        ellipse(draw, (176, 202 + hy, 179, 205 + hy), EYE_SHINE)
    polygon(draw, [(157, 212 + hy), (163, 212 + hy), (160, 217 + hy)], NOSE)
    line(draw, [(160, 217 + hy), (160, 223 + hy)], INK, 2)
    if pose.mouth_state == "open":
        ellipse(draw, (153, 219 + hy, 167, 233 + hy), TRANSPARENT, INK, 2)
    elif pose.mouth_state == "flat":
        line(draw, [(153, 224 + hy), (167, 224 + hy)], INK, 2)
    else:
        draw.arc(box((150, 218 + hy, 161, 230 + hy)), start=10, end=100, fill=INK, width=s(2))
        draw.arc(box((159, 218 + hy, 171, 230 + hy)), start=80, end=170, fill=INK, width=s(2))

    for side in (-1, 1):
        x1 = 154 if side < 0 else 166
        draw.line([xy((x1, 216 + hy)), xy((x1 + side * 27, 208 + hy))], fill=WHISKER, width=s(1))
        draw.line([xy((x1, 220 + hy)), xy((x1 + side * 30, 220 + hy))], fill=WHISKER, width=s(1))
        draw.line([xy((x1, 224 + hy)), xy((x1 + side * 25, 232 + hy))], fill=WHISKER, width=s(1))

    if pose.bubble_radius:
        r = pose.bubble_radius
        cx = 178
        cy = 218 + hy - r // 3
        ellipse(draw, (cx - r, cy - r, cx + r, cy + r), (186, 230, 253, 158), (14, 116, 144, 190), 2)
        ellipse(draw, (cx - r * .45, cy - r * .48, cx - r * .12, cy - r * .15), (255, 255, 255, 188))

    if pose.bubble_pop:
        for points in [
            [(176, 202 + hy), (164, 187 + hy)],
            [(184, 203 + hy), (202, 189 + hy)],
            [(190, 217 + hy), (210, 219 + hy)],
            [(170, 217 + hy), (153, 226 + hy)],
        ]:
            line(draw, points, (14, 116, 144, 210), 3)
        ellipse(draw, (176, 211 + hy, 184, 219 + hy), (255, 255, 255, 150))

    if pose.alert_marks:
        for points in [
            [(119, 168 + hy), (106, 148 + hy)],
            [(160, 158 + hy), (160, 133 + hy)],
            [(201, 168 + hy), (214, 148 + hy)],
        ]:
            line(draw, points, (245, 158, 11, 230), 4)


def scaled_polygon(points: list[tuple[float, float]], amount: float) -> list[tuple[float, float]]:
    cx = sum(x for x, _ in points) / len(points)
    cy = sum(y for _, y in points) / len(points)
    return [(cx + (x - cx) * amount, cy + (y - cy) * amount) for x, y in points]


def draw_premium_ear(draw: ImageDraw.ImageDraw, points: list[tuple[float, float]]) -> None:
    polygon(draw, points, OUTLINE)
    polygon(draw, scaled_polygon(points, 0.86), FUR_DARK)
    polygon(draw, scaled_polygon(points, 0.66), FUR)
    polygon(draw, scaled_polygon(points, 0.42), EAR_INNER)
    inner = scaled_polygon(points, 0.28)
    polygon(draw, [(inner[0][0], inner[0][1] + 2), inner[1], (inner[2][0], inner[2][1] + 2)], (255, 181, 126, 255))


def draw_premium_tail(draw: ImageDraw.ImageDraw, pose: FramePose) -> None:
    y = pose.tail_y
    points = [
        (210, 237 + y),
        (232 + pose.tail_mid_x, 248 + y + pose.tail_mid_y),
        (258 + pose.tail_mid_x, 248 + y + pose.tail_mid_y),
        (287 + pose.tail_tip_x, 237 + y + pose.tail_tip_y),
    ]
    line(draw, points, OUTLINE, 20)
    line(draw, points, FUR_DARK, 16)
    line(draw, points, FUR, 12)
    line(draw, [(224, 244 + y), (245 + pose.tail_mid_x, 249 + y + pose.tail_mid_y), (266 + pose.tail_tip_x, 245 + y + pose.tail_tip_y)], FUR_LIGHT, 5)
    for t in (0.28, 0.55, 0.79):
        x = points[0][0] + (points[-1][0] - points[0][0]) * t
        stripe_y = points[0][1] + (points[-1][1] - points[0][1]) * t
        line(draw, [(x - 3, stripe_y - 6), (x + 2, stripe_y + 6)], FUR_DARK, 3)
    ellipse(
        draw,
        (
            281 + pose.tail_tip_x,
            230 + y + pose.tail_tip_y,
            296 + pose.tail_tip_x,
            244 + y + pose.tail_tip_y,
        ),
        FUR_LIGHT,
        OUTLINE_SOFT,
        1,
    )


def draw_premium_body(draw: ImageDraw.ImageDraw, pose: FramePose) -> None:
    by = pose.body_y
    ellipse(draw, (91, 187 + by, 229, 273 + by), OUTLINE)
    ellipse(draw, (96, 190 + by, 224, 271 + by), FUR_DARK)
    ellipse(draw, (101, 192 + by, 219, 270 + by), FUR)
    ellipse(draw, (114, 199 + by, 205, 270 + by), FUR_MID)

    belly_cy = 239 + by
    belly_h = 66 * pose.belly_scale_y
    ellipse(draw, (122, belly_cy - belly_h / 2, 198, belly_cy + belly_h / 2), BELLY_SHADE)
    ellipse(draw, (127, belly_cy - belly_h / 2 + 3, 193, belly_cy + belly_h / 2 - 1), BELLY)
    ellipse(draw, (136, belly_cy - belly_h / 2 + 12, 184, belly_cy + belly_h / 2 - 8), (255, 232, 181, 255))

    for stripe in [
        [(126, 198 + by), (121, 212 + by)],
        [(145, 191 + by), (144, 209 + by)],
        [(163, 190 + by), (163, 208 + by)],
        [(181, 194 + by), (187, 211 + by)],
        [(103, 222 + by), (91, 216 + by)],
        [(213, 222 + by), (226, 216 + by)],
    ]:
        line(draw, stripe, FUR_DARK, 4)


def draw_premium_paws(draw: ImageDraw.ImageDraw, pose: FramePose) -> None:
    by = pose.body_y
    ellipse(draw, (98, 243 + by, 136, 273), OUTLINE)
    ellipse(draw, (184, 243 + by, 222, 273), OUTLINE)
    ellipse(draw, (102, 247 + by, 133, 272), FUR_LIGHT)
    ellipse(draw, (187, 247 + by, 218, 272), FUR_LIGHT)
    ellipse(draw, (108, 257, 128, 273), (255, 207, 119, 255))
    ellipse(draw, (193, 257, 213, 273), (255, 207, 119, 255))

    for x1, x2 in ((136, 155), (165, 184)):
        rounded_rect(draw, (x1, 224 + by, x2, GROUND_Y), 8, OUTLINE)
        rounded_rect(draw, (x1 + 3, 226 + by, x2 - 3, GROUND_Y), 7, FUR_LIGHT)
    for paw in ((134, GROUND_Y - 9, 159, GROUND_Y + 3), (161, GROUND_Y - 9, 186, GROUND_Y + 3)):
        ellipse(draw, paw, OUTLINE)
        ellipse(draw, (paw[0] + 3, paw[1] + 2, paw[2] - 2, paw[3] - 1), FUR_LIGHT)
    for x in (143, 150, 170, 177):
        line(draw, [(x, GROUND_Y - 4), (x + 1, GROUND_Y + 1)], OUTLINE_SOFT, 1)


def draw_premium_head(draw: ImageDraw.ImageDraw, pose: FramePose) -> None:
    hy = pose.head_y
    ey = pose.ear_y
    draw_premium_ear(
        draw,
        [
            (123, 184 + ey),
            (140 + pose.left_ear_tip_x, 147 + ey + pose.left_ear_tip_y),
            (158, 185 + ey),
        ],
    )
    draw_premium_ear(
        draw,
        [
            (162, 185 + ey),
            (184 + pose.right_ear_tip_x, 147 + ey + pose.right_ear_tip_y),
            (199, 184 + ey),
        ],
    )

    ellipse(draw, (114, 162 + hy, 206, 241 + hy), OUTLINE)
    ellipse(draw, (119, 166 + hy, 201, 237 + hy), FUR_DARK)
    ellipse(draw, (123, 168 + hy, 197, 236 + hy), FUR)
    ellipse(draw, (131, 190 + hy, 189, 235 + hy), FUR_MID)
    ellipse(draw, (137, 204 + hy, 183, 236 + hy), BELLY)
    ellipse(draw, (142, 211 + hy, 178, 235 + hy), (255, 232, 181, 255))

    for stripe in [
        [(140, 178 + hy), (147, 197 + hy)],
        [(160, 174 + hy), (160, 196 + hy)],
        [(180, 178 + hy), (173, 197 + hy)],
    ]:
        line(draw, stripe, FUR_DARK, 4)
    line(draw, [(128, 194 + hy), (116, 188 + hy)], FUR_DARK, 3)
    line(draw, [(192, 194 + hy), (204, 188 + hy)], FUR_DARK, 3)

    if pose.eye_state == "closed":
        draw.arc(box((135, 198 + hy, 151, 211 + hy)), start=20, end=160, fill=EYE, width=s(3))
        draw.arc(box((169, 198 + hy, 185, 211 + hy)), start=20, end=160, fill=EYE, width=s(3))
    elif pose.eye_state == "half":
        rounded_rect(draw, (136, 201 + hy, 151, 208 + hy), 3, EYE)
        rounded_rect(draw, (169, 201 + hy, 184, 208 + hy), 3, EYE)
        line(draw, [(135, 200 + hy), (152, 200 + hy)], FUR_DARK, 2)
        line(draw, [(168, 200 + hy), (185, 200 + hy)], FUR_DARK, 2)
    else:
        ellipse(draw, (136, 198 + hy, 150, 212 + hy), EYE)
        ellipse(draw, (170, 198 + hy, 184, 212 + hy), EYE)
        ellipse(draw, (140, 201 + hy, 144, 205 + hy), EYE_SHINE)
        ellipse(draw, (174, 201 + hy, 178, 205 + hy), EYE_SHINE)

    ellipse(draw, (154, 211 + hy, 166, 219 + hy), (255, 209, 151, 255))
    polygon(draw, [(156, 212 + hy), (164, 212 + hy), (160, 218 + hy)], NOSE)
    line(draw, [(160, 218 + hy), (160, 224 + hy)], INK, 2)
    draw.arc(box((149, 218 + hy, 162, 231 + hy)), start=10, end=100, fill=INK, width=s(2))
    draw.arc(box((158, 218 + hy, 172, 231 + hy)), start=80, end=170, fill=INK, width=s(2))

    for side in (-1, 1):
        x1 = 154 if side < 0 else 166
        draw.line([xy((x1, 216 + hy)), xy((x1 + side * 28, 208 + hy))], fill=WHISKER, width=s(1))
        draw.line([xy((x1, 221 + hy)), xy((x1 + side * 32, 221 + hy))], fill=WHISKER, width=s(1))
        draw.line([xy((x1, 225 + hy)), xy((x1 + side * 27, 233 + hy))], fill=WHISKER, width=s(1))


def draw_premium_sit_idle_frame(pose: FramePose) -> Image.Image:
    image = Image.new("RGBA", (CELL * SCALE, CELL * SCALE), TRANSPARENT)
    shadow_layer = Image.new("RGBA", image.size, TRANSPARENT)
    shadow_draw = ImageDraw.Draw(shadow_layer)
    ellipse(shadow_draw, (82, 261, 238, 280), SOFT_SHADOW)
    ellipse(shadow_draw, (99, 264, 221, 278), SHADOW)
    shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(s(1.1)))
    image.alpha_composite(shadow_layer)

    draw = ImageDraw.Draw(image)
    draw_premium_tail(draw, pose)
    draw_premium_body(draw, pose)
    draw_premium_paws(draw, pose)
    draw_premium_head(draw, pose)

    return image.resize((CELL, CELL), Image.Resampling.LANCZOS)


def draw_frame(pose: FramePose) -> Image.Image:
    image = Image.new("RGBA", (CELL * SCALE, CELL * SCALE), TRANSPARENT)
    shadow_layer = Image.new("RGBA", image.size, TRANSPARENT)
    shadow_draw = ImageDraw.Draw(shadow_layer)
    ellipse(shadow_draw, (86, 262, 234, 279), SOFT_SHADOW)
    ellipse(shadow_draw, (104, 264, 216, 277), SHADOW)
    shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(s(1.2)))
    image.alpha_composite(shadow_layer)

    draw = ImageDraw.Draw(image)
    draw_tail(draw, pose)
    draw_body(draw, pose)
    draw_back_paws(draw)
    draw_front_legs(draw, pose)
    draw_head(draw, pose)

    return image.resize((CELL, CELL), Image.Resampling.LANCZOS)


def paste_frame(sheet: Image.Image, frame: Image.Image, col: int, row: int) -> None:
    sheet.alpha_composite(frame, (col * CELL, row * CELL))


def build_sheet() -> None:
    SPRITES_DIR.mkdir(parents=True, exist_ok=True)
    sheet = Image.new("RGBA", (CELL * COLS, CELL * ROWS), TRANSPARENT)
    for row, frames in CLIPS:
        for col, pose in enumerate(frames):
            renderer = draw_premium_sit_idle_frame if row == 0 else draw_frame
            paste_frame(sheet, renderer(pose), col, row)
    sheet.save(OUT)


def checker_tile(size: int = 10) -> Image.Image:
    tile = Image.new("RGBA", (size * 2, size * 2), (255, 255, 255, 255))
    draw = ImageDraw.Draw(tile)
    draw.rectangle((0, 0, size - 1, size - 1), fill=(226, 226, 226, 255))
    draw.rectangle((size, size, size * 2 - 1, size * 2 - 1), fill=(226, 226, 226, 255))
    return tile


def make_preview(frames: list[FramePose], output: Path, renderer=draw_frame) -> None:
    sizes = [64, 72, 80]
    pad = 18
    label_w = 64
    width = label_w + len(frames) * (80 + pad) + pad
    height = pad + len(sizes) * (80 + pad)
    preview = Image.new("RGBA", (width, height), (244, 239, 227, 255))
    draw = ImageDraw.Draw(preview)
    tile = checker_tile(8)

    for row, size in enumerate(sizes):
        y = pad + row * (80 + pad)
        draw.text((pad, y + 27), f"{size}px", fill=(66, 46, 34, 255))
        for col, pose in enumerate(frames):
            x = label_w + col * (80 + pad)
            backdrop = Image.new("RGBA", (80, 80), (255, 255, 255, 255))
            for tx in range(0, 80, tile.width):
                for ty in range(0, 80, tile.height):
                    backdrop.alpha_composite(tile, (tx, ty))
            frame = renderer(pose).resize((size, size), Image.Resampling.LANCZOS)
            px = x + (80 - size) // 2
            py = y + (80 - size) // 2
            preview.alpha_composite(backdrop, (x, y))
            preview.alpha_composite(frame, (px, py))
    preview.save(output)


def make_animated_preview(poses: list[FramePose], output: Path, renderer=draw_frame) -> None:
    frames = []
    tile = checker_tile(8)
    canvas_size = 128
    display_size = 80
    for pose in poses + list(reversed(poses[1:-1])):
        frame = Image.new("RGBA", (canvas_size, canvas_size), (244, 239, 227, 255))
        for tx in range(0, canvas_size, tile.width):
            for ty in range(0, canvas_size, tile.height):
                frame.alpha_composite(tile, (tx, ty))
        cat = renderer(pose).resize((display_size, display_size), Image.Resampling.LANCZOS)
        frame.alpha_composite(cat, ((canvas_size - display_size) // 2, 26))
        frames.append(frame.convert("P", palette=Image.Palette.ADAPTIVE))

    frames[0].save(
        output,
        save_all=True,
        append_images=frames[1:],
        duration=160,
        loop=0,
        optimize=False,
        disposal=2,
    )


def make_foundation_sequence_preview() -> None:
    sequence = (
        IDLE_FRAMES
        + TAIL_SWAY_FRAMES
        + IDLE_FRAMES[:2]
        + BLINK_FRAMES
        + IDLE_FRAMES[:2]
        + DROWSY_FRAMES
        + IDLE_FRAMES[:2]
        + SLEEP_FRAMES
        + NOSE_BUBBLE_FRAMES
        + ALERT_WAKE_FRAMES
        + BLINK_FRAMES
        + IDLE_FRAMES[:2]
        + EAR_TWITCH_FRAMES
        + IDLE_FRAMES[:2]
    )
    frames = []
    tile = checker_tile(8)
    canvas_size = 128
    display_size = 80
    for pose in sequence:
        frame = Image.new("RGBA", (canvas_size, canvas_size), (244, 239, 227, 255))
        for tx in range(0, canvas_size, tile.width):
            for ty in range(0, canvas_size, tile.height):
                frame.alpha_composite(tile, (tx, ty))
        renderer = draw_premium_sit_idle_frame if pose in IDLE_FRAMES else draw_frame
        cat = renderer(pose).resize((display_size, display_size), Image.Resampling.LANCZOS)
        frame.alpha_composite(cat, ((canvas_size - display_size) // 2, 26))
        frames.append(frame.convert("P", palette=Image.Palette.ADAPTIVE))

    frames[0].save(
        FOUNDATION_SEQUENCE_PREVIEW,
        save_all=True,
        append_images=frames[1:],
        duration=145,
        loop=0,
        optimize=False,
        disposal=2,
    )


def main() -> None:
    build_sheet()
    make_preview(IDLE_FRAMES, IDLE_PREVIEW, draw_premium_sit_idle_frame)
    make_preview(TAIL_SWAY_FRAMES, TAIL_SWAY_PREVIEW)
    make_preview(BLINK_FRAMES, BLINK_PREVIEW)
    make_preview(DROWSY_FRAMES, DROWSY_PREVIEW)
    make_preview(EAR_TWITCH_FRAMES, EAR_TWITCH_PREVIEW)
    make_preview(PAW_TIDY_FRAMES, PAW_TIDY_PREVIEW)
    make_preview(SLEEP_FRAMES, SLEEP_PREVIEW)
    make_preview(NOSE_BUBBLE_FRAMES, NOSE_BUBBLE_PREVIEW)
    make_preview(ALERT_WAKE_FRAMES, ALERT_WAKE_PREVIEW)
    make_animated_preview(IDLE_FRAMES, IDLE_ANIMATED_PREVIEW, draw_premium_sit_idle_frame)
    make_animated_preview(TAIL_SWAY_FRAMES, TAIL_SWAY_ANIMATED_PREVIEW)
    make_animated_preview(BLINK_FRAMES, BLINK_ANIMATED_PREVIEW)
    make_animated_preview(DROWSY_FRAMES, DROWSY_ANIMATED_PREVIEW)
    make_animated_preview(EAR_TWITCH_FRAMES, EAR_TWITCH_ANIMATED_PREVIEW)
    make_animated_preview(PAW_TIDY_FRAMES, PAW_TIDY_ANIMATED_PREVIEW)
    make_animated_preview(SLEEP_FRAMES, SLEEP_ANIMATED_PREVIEW)
    make_animated_preview(NOSE_BUBBLE_FRAMES, NOSE_BUBBLE_ANIMATED_PREVIEW)
    make_animated_preview(ALERT_WAKE_FRAMES, ALERT_WAKE_ANIMATED_PREVIEW)
    make_foundation_sequence_preview()
    print(f"Wrote {OUT}")
    print(f"Wrote {IDLE_PREVIEW}")
    print(f"Wrote {IDLE_ANIMATED_PREVIEW}")
    print(f"Wrote {TAIL_SWAY_PREVIEW}")
    print(f"Wrote {TAIL_SWAY_ANIMATED_PREVIEW}")
    print(f"Wrote {BLINK_PREVIEW}")
    print(f"Wrote {BLINK_ANIMATED_PREVIEW}")
    print(f"Wrote {DROWSY_PREVIEW}")
    print(f"Wrote {DROWSY_ANIMATED_PREVIEW}")
    print(f"Wrote {EAR_TWITCH_PREVIEW}")
    print(f"Wrote {EAR_TWITCH_ANIMATED_PREVIEW}")
    print(f"Wrote {PAW_TIDY_PREVIEW}")
    print(f"Wrote {PAW_TIDY_ANIMATED_PREVIEW}")
    print(f"Wrote {SLEEP_PREVIEW}")
    print(f"Wrote {SLEEP_ANIMATED_PREVIEW}")
    print(f"Wrote {NOSE_BUBBLE_PREVIEW}")
    print(f"Wrote {NOSE_BUBBLE_ANIMATED_PREVIEW}")
    print(f"Wrote {ALERT_WAKE_PREVIEW}")
    print(f"Wrote {ALERT_WAKE_ANIMATED_PREVIEW}")
    print(f"Wrote {FOUNDATION_SEQUENCE_PREVIEW}")


if __name__ == "__main__":
    main()

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "assets" / "avatars" / "blueprint"

CELL_W = 320
CELL_H = 320
ANCHOR_X = 160
GROUND_Y = 270
SAFE_X = 20
SAFE_Y = 10
SAFE_W = 280
SAFE_H = 260
EDGE_PADDING = 8

PAD = 28
HEADER_H = 88
TITLE_H = 34

BG = (244, 239, 227, 255)
CELL_BG = (255, 252, 244, 255)
GRID = (220, 211, 193, 255)
SAFE = (70, 132, 184, 255)
GROUND = (201, 89, 58, 255)
ANCHOR = (74, 104, 184, 255)
INK = (75, 55, 42, 255)
BODY = (219, 129, 52, 255)
BODY_DARK = (167, 86, 34, 255)
BODY_LIGHT = (246, 179, 92, 255)
BELLY = (255, 220, 156, 255)
SHADOW = (118, 92, 66, 70)
MARKER = (44, 148, 93, 255)
HAND = (238, 188, 142, 255)
HAND_OUTLINE = (123, 78, 55, 255)


def font(size: int) -> ImageFont.ImageFont:
    try:
        return ImageFont.truetype("arial.ttf", size)
    except OSError:
        return ImageFont.load_default()


FONT_12 = font(12)
FONT_14 = font(14)
FONT_16 = font(16)
FONT_18 = font(18)


def dashed_line(
    draw: ImageDraw.ImageDraw,
    start: tuple[int, int],
    end: tuple[int, int],
    fill: tuple[int, int, int, int],
    width: int = 1,
    dash: int = 8,
    gap: int = 5,
) -> None:
    x1, y1 = start
    x2, y2 = end
    if x1 == x2:
        step = dash + gap
        direction = 1 if y2 >= y1 else -1
        for y in range(y1, y2, direction * step):
            y_end = y + direction * dash
            if direction > 0:
                y_end = min(y_end, y2)
            else:
                y_end = max(y_end, y2)
            draw.line((x1, y, x2, y_end), fill=fill, width=width)
    elif y1 == y2:
        step = dash + gap
        direction = 1 if x2 >= x1 else -1
        for x in range(x1, x2, direction * step):
            x_end = x + direction * dash
            if direction > 0:
                x_end = min(x_end, x2)
            else:
                x_end = max(x_end, x2)
            draw.line((x, y1, x_end, y2), fill=fill, width=width)


def dashed_rect(
    draw: ImageDraw.ImageDraw,
    box: tuple[int, int, int, int],
    fill: tuple[int, int, int, int],
    width: int = 2,
) -> None:
    x1, y1, x2, y2 = box
    dashed_line(draw, (x1, y1), (x2, y1), fill, width)
    dashed_line(draw, (x2, y1), (x2, y2), fill, width)
    dashed_line(draw, (x2, y2), (x1, y2), fill, width)
    dashed_line(draw, (x1, y2), (x1, y1), fill, width)


def local_box(origin: tuple[int, int], box: tuple[int, int, int, int]) -> tuple[int, int, int, int]:
    ox, oy = origin
    x1, y1, x2, y2 = box
    return ox + x1, oy + y1, ox + x2, oy + y2


def local_point(origin: tuple[int, int], point: tuple[int, int]) -> tuple[int, int]:
    ox, oy = origin
    x, y = point
    return ox + x, oy + y


def draw_cell(draw: ImageDraw.ImageDraw, origin: tuple[int, int], title: str, show_labels: bool) -> None:
    ox, oy = origin
    draw.text((ox, oy - 24), title, fill=INK, font=FONT_16)
    draw.rectangle((ox, oy, ox + CELL_W, oy + CELL_H), fill=CELL_BG, outline=GRID, width=2)

    for x in range(40, CELL_W, 40):
        draw.line((ox + x, oy, ox + x, oy + CELL_H), fill=(233, 226, 211, 255), width=1)
    for y in range(40, CELL_H, 40):
        draw.line((ox, oy + y, ox + CELL_W, oy + y), fill=(233, 226, 211, 255), width=1)

    draw.rectangle(
        (ox + EDGE_PADDING, oy + EDGE_PADDING, ox + CELL_W - EDGE_PADDING, oy + CELL_H - EDGE_PADDING),
        outline=(186, 176, 156, 255),
        width=1,
    )
    dashed_rect(
        draw,
        (ox + SAFE_X, oy + SAFE_Y, ox + SAFE_X + SAFE_W, oy + SAFE_Y + SAFE_H),
        SAFE,
        width=2,
    )
    draw.line((ox, oy + GROUND_Y, ox + CELL_W, oy + GROUND_Y), fill=GROUND, width=3)
    draw.line((ox + ANCHOR_X, oy, ox + ANCHOR_X, oy + CELL_H), fill=ANCHOR, width=2)

    if show_labels:
        draw.text((ox + 166, oy + GROUND_Y - 18), "groundY=270", fill=GROUND, font=FONT_12)
        draw.text((ox + ANCHOR_X + 6, oy + 34), "anchorX=160", fill=ANCHOR, font=FONT_12)
        draw.text((ox + SAFE_X + 8, oy + SAFE_Y + 9), "safeBox 280x260", fill=SAFE, font=FONT_12)


def marker(draw: ImageDraw.ImageDraw, origin: tuple[int, int], name: str, point: tuple[int, int]) -> None:
    x, y = local_point(origin, point)
    draw.ellipse((x - 4, y - 4, x + 4, y + 4), fill=MARKER, outline=(255, 255, 255, 255), width=1)
    draw.text((x + 6, y - 7), name, fill=(29, 105, 66, 255), font=FONT_12)


def shadow(draw: ImageDraw.ImageDraw, origin: tuple[int, int], x1: int, x2: int) -> None:
    draw.ellipse(local_box(origin, (x1, GROUND_Y - 5, x2, GROUND_Y + 10)), fill=SHADOW)


def tail_line(draw: ImageDraw.ImageDraw, origin: tuple[int, int], points: list[tuple[int, int]], width: int = 13) -> None:
    mapped = [local_point(origin, point) for point in points]
    draw.line(mapped, fill=BODY_DARK, width=width, joint="curve")
    draw.line(mapped, fill=BODY, width=max(2, width - 5), joint="curve")


def ear(draw: ImageDraw.ImageDraw, origin: tuple[int, int], points: list[tuple[int, int]]) -> None:
    mapped = [local_point(origin, point) for point in points]
    draw.polygon(mapped, fill=BODY, outline=INK)
    inner = []
    cx = sum(p[0] for p in points) / len(points)
    cy = sum(p[1] for p in points) / len(points)
    for x, y in points:
        inner.append(local_point(origin, (round(cx + (x - cx) * 0.55), round(cy + (y - cy) * 0.55))))
    draw.polygon(inner, fill=(242, 155, 122, 255))


def stripes(draw: ImageDraw.ImageDraw, origin: tuple[int, int], lines: list[tuple[int, int, int, int]]) -> None:
    for line in lines:
        draw.line(local_box(origin, line), fill=BODY_DARK, width=4)


def draw_head_side(draw: ImageDraw.ImageDraw, origin: tuple[int, int], cx: int, cy: int) -> None:
    ear(draw, origin, [(cx - 19, cy - 26), (cx - 5, cy - 51), (cx + 6, cy - 23)])
    ear(draw, origin, [(cx + 12, cy - 24), (cx + 30, cy - 46), (cx + 31, cy - 16)])
    draw.ellipse(local_box(origin, (cx - 35, cy - 31, cx + 35, cy + 29)), fill=BODY, outline=INK, width=3)
    draw.ellipse(local_box(origin, (cx - 12, cy - 7, cx - 5, cy + 1)), fill=INK)
    draw.line(local_box(origin, (cx + 19, cy + 1, cx + 30, cy + 4)), fill=INK, width=2)
    draw.arc(local_box(origin, (cx + 16, cy - 2, cx + 38, cy + 20)), 15, 80, fill=INK, width=2)
    stripes(draw, origin, [(cx - 24, cy - 14, cx - 10, cy - 18), (cx - 25, cy - 1, cx - 11, cy - 4)])


def draw_body_side(draw: ImageDraw.ImageDraw, origin: tuple[int, int], cx: int, cy: int, length: int = 132) -> None:
    draw.ellipse(local_box(origin, (cx - length // 2, cy - 36, cx + length // 2, cy + 35)), fill=BODY, outline=INK, width=3)
    draw.ellipse(local_box(origin, (cx - 28, cy - 8, cx + 38, cy + 29)), fill=BELLY)
    stripes(draw, origin, [(cx - 28, cy - 29, cx - 17, cy - 11), (cx - 1, cy - 34, cx + 4, cy - 13), (cx + 28, cy - 29, cx + 18, cy - 12)])


def draw_legs_side(draw: ImageDraw.ImageDraw, origin: tuple[int, int], front_x: int, rear_x: int) -> None:
    for x in (front_x, front_x + 16, rear_x, rear_x - 17):
        draw.rounded_rectangle(local_box(origin, (x - 6, 235, x + 8, GROUND_Y)), radius=6, fill=BODY_LIGHT, outline=INK, width=2)
        draw.ellipse(local_box(origin, (x - 9, GROUND_Y - 7, x + 15, GROUND_Y + 2)), fill=BODY_LIGHT, outline=INK, width=2)


def draw_stand_side(draw: ImageDraw.ImageDraw, origin: tuple[int, int], show_markers: bool = False) -> None:
    shadow(draw, origin, 64, 264)
    tail_line(draw, origin, [(220, 219), (253, 205), (282, 217)], width=14)
    draw_body_side(draw, origin, 166, 218)
    draw_legs_side(draw, origin, 112, 201)
    draw_head_side(draw, origin, 91, 205)
    if show_markers:
        for name, point in {
            "frontPaw": (113, GROUND_Y),
            "rearPaw": (201, GROUND_Y),
            "bodyCenter": (166, 218),
            "headCenter": (91, 205),
            "tailBase": (226, 218),
            "tailTip": (282, 217),
            "anchor": (ANCHOR_X, GROUND_Y),
        }.items():
            marker(draw, origin, name, point)


def draw_stand_front(draw: ImageDraw.ImageDraw, origin: tuple[int, int]) -> None:
    shadow(draw, origin, 88, 232)
    tail_line(draw, origin, [(210, 225), (242, 192), (256, 151)], width=13)
    draw.ellipse(local_box(origin, (103, 190, 217, 252)), fill=BODY, outline=INK, width=3)
    draw.ellipse(local_box(origin, (121, 206, 199, 258)), fill=BELLY)
    draw.rounded_rectangle(local_box(origin, (114, 237, 132, GROUND_Y)), radius=7, fill=BODY_LIGHT, outline=INK, width=2)
    draw.rounded_rectangle(local_box(origin, (188, 237, 206, GROUND_Y)), radius=7, fill=BODY_LIGHT, outline=INK, width=2)
    draw.ellipse(local_box(origin, (109, GROUND_Y - 7, 137, GROUND_Y + 2)), fill=BODY_LIGHT, outline=INK, width=2)
    draw.ellipse(local_box(origin, (183, GROUND_Y - 7, 211, GROUND_Y + 2)), fill=BODY_LIGHT, outline=INK, width=2)
    ear(draw, origin, [(127, 179), (143, 150), (154, 181)])
    ear(draw, origin, [(166, 181), (184, 150), (195, 181)])
    draw.ellipse(local_box(origin, (121, 168, 199, 234)), fill=BODY, outline=INK, width=3)
    draw.ellipse(local_box(origin, (139, 197, 147, 205)), fill=INK)
    draw.ellipse(local_box(origin, (174, 197, 182, 205)), fill=INK)
    draw.line(local_box(origin, (160, 206, 160, 213)), fill=INK, width=2)
    stripes(draw, origin, [(145, 181, 151, 192), (160, 178, 160, 191), (174, 181, 169, 192)])


def draw_stand_back(draw: ImageDraw.ImageDraw, origin: tuple[int, int]) -> None:
    shadow(draw, origin, 88, 232)
    tail_line(draw, origin, [(211, 229), (248, 203), (262, 164)], width=13)
    draw.ellipse(local_box(origin, (104, 191, 216, 253)), fill=BODY, outline=INK, width=3)
    draw.rounded_rectangle(local_box(origin, (116, 238, 134, GROUND_Y)), radius=7, fill=BODY_LIGHT, outline=INK, width=2)
    draw.rounded_rectangle(local_box(origin, (186, 238, 204, GROUND_Y)), radius=7, fill=BODY_LIGHT, outline=INK, width=2)
    draw.ellipse(local_box(origin, (110, GROUND_Y - 7, 139, GROUND_Y + 2)), fill=BODY_LIGHT, outline=INK, width=2)
    draw.ellipse(local_box(origin, (181, GROUND_Y - 7, 210, GROUND_Y + 2)), fill=BODY_LIGHT, outline=INK, width=2)
    ear(draw, origin, [(127, 180), (144, 151), (154, 181)])
    ear(draw, origin, [(166, 181), (184, 151), (195, 180)])
    draw.ellipse(local_box(origin, (122, 168, 198, 234)), fill=BODY, outline=INK, width=3)
    stripes(draw, origin, [(143, 193, 134, 207), (160, 190, 160, 207), (177, 193, 185, 207)])


def draw_sit_front(draw: ImageDraw.ImageDraw, origin: tuple[int, int], show_markers: bool = False) -> None:
    shadow(draw, origin, 82, 236)
    tail_line(draw, origin, [(209, 237), (247, 257), (282, 245)], width=14)
    draw.ellipse(local_box(origin, (97, 192, 223, GROUND_Y + 2)), fill=BODY, outline=INK, width=3)
    draw.ellipse(local_box(origin, (118, 212, 202, GROUND_Y + 4)), fill=BELLY)
    draw.ellipse(local_box(origin, (105, 244, 135, GROUND_Y + 3)), fill=BODY_LIGHT, outline=INK, width=2)
    draw.ellipse(local_box(origin, (185, 244, 215, GROUND_Y + 3)), fill=BODY_LIGHT, outline=INK, width=2)
    draw.rounded_rectangle(local_box(origin, (139, 226, 154, GROUND_Y)), radius=6, fill=BODY_LIGHT, outline=INK, width=2)
    draw.rounded_rectangle(local_box(origin, (166, 226, 181, GROUND_Y)), radius=6, fill=BODY_LIGHT, outline=INK, width=2)
    ear(draw, origin, [(125, 181), (143, 151), (154, 183)])
    ear(draw, origin, [(166, 183), (184, 151), (196, 181)])
    draw.ellipse(local_box(origin, (119, 169, 201, 238)), fill=BODY, outline=INK, width=3)
    draw.ellipse(local_box(origin, (139, 199, 148, 207)), fill=INK)
    draw.ellipse(local_box(origin, (174, 199, 183, 207)), fill=INK)
    draw.line(local_box(origin, (161, 210, 161, 218)), fill=INK, width=2)
    draw.arc(local_box(origin, (150, 213, 161, 224)), 0, 100, fill=INK, width=2)
    draw.arc(local_box(origin, (161, 213, 172, 224)), 80, 180, fill=INK, width=2)
    stripes(draw, origin, [(145, 183, 151, 196), (160, 180, 160, 195), (176, 183, 170, 196)])
    if show_markers:
        for name, point in {
            "frontPaw": (147, GROUND_Y),
            "rearPaw": (119, GROUND_Y),
            "bodyCenter": (160, 231),
            "headCenter": (160, 204),
            "tailBase": (211, 237),
            "tailTip": (282, 245),
            "anchor": (ANCHOR_X, GROUND_Y),
        }.items():
            marker(draw, origin, name, point)


def draw_sit_side(draw: ImageDraw.ImageDraw, origin: tuple[int, int], show_markers: bool = False) -> None:
    shadow(draw, origin, 70, 258)
    tail_line(draw, origin, [(215, 237), (252, 257), (285, 245)], width=14)
    draw.ellipse(local_box(origin, (101, 192, 222, GROUND_Y + 2)), fill=BODY, outline=INK, width=3)
    draw.ellipse(local_box(origin, (128, 212, 202, GROUND_Y + 3)), fill=BELLY)
    draw.ellipse(local_box(origin, (180, 244, 217, GROUND_Y + 4)), fill=BODY_LIGHT, outline=INK, width=2)
    draw.rounded_rectangle(local_box(origin, (119, 225, 135, GROUND_Y)), radius=6, fill=BODY_LIGHT, outline=INK, width=2)
    draw.ellipse(local_box(origin, (112, GROUND_Y - 7, 143, GROUND_Y + 2)), fill=BODY_LIGHT, outline=INK, width=2)
    draw_head_side(draw, origin, 100, 203)
    if show_markers:
        for name, point in {
            "frontPaw": (126, GROUND_Y),
            "rearPaw": (199, GROUND_Y),
            "bodyCenter": (162, 231),
            "headCenter": (100, 203),
            "tailBase": (215, 237),
            "tailTip": (285, 245),
            "anchor": (ANCHOR_X, GROUND_Y),
        }.items():
            marker(draw, origin, name, point)


def draw_sit_back(draw: ImageDraw.ImageDraw, origin: tuple[int, int]) -> None:
    shadow(draw, origin, 82, 236)
    tail_line(draw, origin, [(109, 239), (73, 256), (42, 244)], width=14)
    draw.ellipse(local_box(origin, (97, 192, 223, GROUND_Y + 2)), fill=BODY, outline=INK, width=3)
    draw.ellipse(local_box(origin, (105, 244, 135, GROUND_Y + 3)), fill=BODY_LIGHT, outline=INK, width=2)
    draw.ellipse(local_box(origin, (185, 244, 215, GROUND_Y + 3)), fill=BODY_LIGHT, outline=INK, width=2)
    ear(draw, origin, [(125, 181), (143, 151), (154, 183)])
    ear(draw, origin, [(166, 183), (184, 151), (196, 181)])
    draw.ellipse(local_box(origin, (119, 169, 201, 238)), fill=BODY, outline=INK, width=3)
    stripes(draw, origin, [(143, 191, 134, 207), (160, 187, 160, 207), (177, 191, 185, 207)])


def draw_lie_side(draw: ImageDraw.ImageDraw, origin: tuple[int, int], show_markers: bool = False) -> None:
    shadow(draw, origin, 52, 285)
    tail_line(draw, origin, [(218, 252), (251, 262), (287, 249)], width=13)
    draw.ellipse(local_box(origin, (91, 223, 229, GROUND_Y + 4)), fill=BODY, outline=INK, width=3)
    draw.ellipse(local_box(origin, (123, 239, 203, GROUND_Y + 6)), fill=BELLY)
    draw.ellipse(local_box(origin, (55, 215, 119, 266)), fill=BODY, outline=INK, width=3)
    ear(draw, origin, [(72, 222), (77, 193), (91, 222)])
    ear(draw, origin, [(96, 222), (113, 198), (115, 227)])
    draw.rounded_rectangle(local_box(origin, (117, 253, 178, 265)), radius=6, fill=BODY_LIGHT, outline=INK, width=2)
    draw.rounded_rectangle(local_box(origin, (158, 243, 218, 256)), radius=6, fill=BODY_LIGHT, outline=INK, width=2)
    draw.ellipse(local_box(origin, (77, 239, 84, 246)), fill=INK)
    draw.line(local_box(origin, (95, 249, 106, 250)), fill=INK, width=2)
    if show_markers:
        for name, point in {
            "bellyGround": (156, GROUND_Y),
            "bodyCenter": (159, 246),
            "headCenter": (87, 241),
            "tailBase": (218, 252),
            "tailTip": (287, 249),
            "anchor": (ANCHOR_X, GROUND_Y),
        }.items():
            marker(draw, origin, name, point)


def draw_max_horizontal(draw: ImageDraw.ImageDraw, origin: tuple[int, int], show_markers: bool = False) -> None:
    shadow(draw, origin, 30, 300)
    tail_line(draw, origin, [(204, 236), (250, 245), (300, 232)], width=13)
    draw.ellipse(local_box(origin, (93, 206, 217, 263)), fill=BODY, outline=INK, width=3)
    draw.ellipse(local_box(origin, (49, 194, 112, 249)), fill=BODY, outline=INK, width=3)
    ear(draw, origin, [(62, 201), (69, 174), (82, 201)])
    ear(draw, origin, [(88, 201), (104, 179), (107, 207)])
    draw.rounded_rectangle(local_box(origin, (32, 254, 122, GROUND_Y)), radius=8, fill=BODY_LIGHT, outline=INK, width=2)
    draw.rounded_rectangle(local_box(origin, (142, 254, 214, GROUND_Y)), radius=8, fill=BODY_LIGHT, outline=INK, width=2)
    draw.ellipse(local_box(origin, (71, 219, 78, 226)), fill=INK)
    draw.line(local_box(origin, (94, 230, 106, 231)), fill=INK, width=2)
    draw.line(local_box(origin, (30, 282, 300, 282)), fill=(131, 85, 54, 255), width=2)
    draw.text(local_point(origin, (31, 286)), "max horizontal inside safeBox", fill=(131, 85, 54, 255), font=FONT_12)
    if show_markers:
        for name, point in {
            "frontPaw": (77, GROUND_Y),
            "rearPaw": (176, GROUND_Y),
            "bodyCenter": (155, 235),
            "headCenter": (81, 222),
            "tailBase": (204, 236),
            "tailTip": (300, 232),
            "anchor": (ANCHOR_X, GROUND_Y),
        }.items():
            marker(draw, origin, name, point)


def draw_max_vertical(draw: ImageDraw.ImageDraw, origin: tuple[int, int], show_markers: bool = False) -> None:
    shadow(draw, origin, 84, 236)
    tail_line(draw, origin, [(212, 226), (239, 157), (221, 83)], width=13)
    draw.ellipse(local_box(origin, (101, 188, 219, 250)), fill=BODY, outline=INK, width=3)
    draw.ellipse(local_box(origin, (122, 205, 199, 258)), fill=BELLY)
    draw.rounded_rectangle(local_box(origin, (116, 235, 134, GROUND_Y)), radius=7, fill=BODY_LIGHT, outline=INK, width=2)
    draw.rounded_rectangle(local_box(origin, (185, 235, 203, GROUND_Y)), radius=7, fill=BODY_LIGHT, outline=INK, width=2)
    draw.ellipse(local_box(origin, (110, GROUND_Y - 7, 139, GROUND_Y + 2)), fill=BODY_LIGHT, outline=INK, width=2)
    draw.ellipse(local_box(origin, (180, GROUND_Y - 7, 209, GROUND_Y + 2)), fill=BODY_LIGHT, outline=INK, width=2)
    ear(draw, origin, [(126, 178), (143, 147), (154, 180)])
    ear(draw, origin, [(166, 180), (184, 147), (196, 178)])
    draw.ellipse(local_box(origin, (120, 165, 200, 234)), fill=BODY, outline=INK, width=3)
    draw.ellipse(local_box(origin, (139, 196, 148, 204)), fill=INK)
    draw.ellipse(local_box(origin, (174, 196, 183, 204)), fill=INK)
    draw.line(local_box(origin, (160, 207, 160, 215)), fill=INK, width=2)
    draw.line(local_box(origin, (309, 70, 309, GROUND_Y)), fill=(131, 85, 54, 255), width=2)
    draw.text(local_point(origin, (188, 72)), "max vertical", fill=(131, 85, 54, 255), font=FONT_12)
    if show_markers:
        for name, point in {
            "frontPaw": (125, GROUND_Y),
            "rearPaw": (195, GROUND_Y),
            "bodyCenter": (160, 219),
            "headCenter": (160, 200),
            "tailBase": (212, 226),
            "tailTip": (221, 83),
            "anchor": (ANCHOR_X, GROUND_Y),
        }.items():
            marker(draw, origin, name, point)


def draw_drag(draw: ImageDraw.ImageDraw, origin: tuple[int, int], show_markers: bool = False) -> None:
    draw.rounded_rectangle(local_box(origin, (135, 61, 185, 92)), radius=13, fill=HAND, outline=HAND_OUTLINE, width=3)
    draw.rounded_rectangle(local_box(origin, (153, 25, 169, 73)), radius=8, fill=HAND, outline=HAND_OUTLINE, width=2)
    draw.line(local_box(origin, (160, 92, 160, 124)), fill=HAND_OUTLINE, width=5)
    tail_line(draw, origin, [(205, 191), (247, 211), (276, 190)], width=12)
    draw.ellipse(local_box(origin, (102, 122, 218, 222)), fill=BODY, outline=INK, width=3)
    draw.ellipse(local_box(origin, (126, 152, 198, 219)), fill=BELLY)
    draw.ellipse(local_box(origin, (70, 100, 134, 160)), fill=BODY, outline=INK, width=3)
    ear(draw, origin, [(84, 105), (90, 79), (104, 105)])
    ear(draw, origin, [(110, 107), (126, 85), (128, 113)])
    for x in (108, 136, 178, 203):
        draw.rounded_rectangle(local_box(origin, (x, 209, x + 13, 257)), radius=7, fill=BODY_LIGHT, outline=INK, width=2)
        draw.ellipse(local_box(origin, (x - 5, 252, x + 18, 264)), fill=BODY_LIGHT, outline=INK, width=2)
    draw.ellipse(local_box(origin, (91, 128, 99, 136)), fill=INK)
    draw.line(local_box(origin, (113, 141, 124, 143)), fill=INK, width=2)
    draw.arc(local_box(origin, (190, 220, 247, 269)), 180, 350, fill=(131, 85, 54, 255), width=2)
    draw.text(local_point(origin, (205, 258)), "sway room", fill=(131, 85, 54, 255), font=FONT_12)
    if show_markers:
        for name, point in {
            "scruffPoint": (160, 124),
            "bodyCenter": (160, 174),
            "headCenter": (102, 132),
            "tailBase": (205, 191),
            "tailTip": (276, 190),
            "anchor": (ANCHOR_X, GROUND_Y),
        }.items():
            marker(draw, origin, name, point)


def paste_cell(
    canvas: Image.Image,
    draw: ImageDraw.ImageDraw,
    col: int,
    row: int,
    title: str,
    painter,
    show_labels: bool = False,
    show_markers: bool = False,
) -> None:
    x = PAD + col * (CELL_W + PAD)
    y = HEADER_H + row * (CELL_H + PAD + TITLE_H)
    draw_cell(draw, (x, y), title, show_labels)
    painter(draw, (x, y), show_markers) if accepts_markers(painter) else painter(draw, (x, y))


def accepts_markers(painter) -> bool:
    return painter.__name__ in {
        "draw_stand_side",
        "draw_sit_front",
        "draw_sit_side",
        "draw_lie_side",
        "draw_max_horizontal",
        "draw_max_vertical",
        "draw_drag",
    }


def make_canvas(cols: int, rows: int, title: str) -> tuple[Image.Image, ImageDraw.ImageDraw]:
    width = PAD + cols * CELL_W + (cols - 1) * PAD + PAD
    height = HEADER_H + rows * CELL_H + (rows - 1) * (PAD + TITLE_H) + PAD
    image = Image.new("RGBA", (width, height), BG)
    draw = ImageDraw.Draw(image)
    draw.text((PAD, 10), title, fill=INK, font=FONT_18)
    standard_text = "cell 320x320 / anchorX 160 / groundY 270 / safeBox 280x260"
    standard_pos = (PAD, 38) if cols <= 2 else (PAD + 360, 13)
    draw.text(standard_pos, standard_text, fill=INK, font=FONT_14)
    return image, draw


def build_body_guide() -> None:
    image, draw = make_canvas(2, 3, "Cheese Cat V2 Body Guide")
    cells = [
        (0, 0, "side stand + landmarks", draw_stand_side, True, True),
        (1, 0, "sit front + landmarks", draw_sit_front, True, True),
        (0, 1, "sit side + landmarks", draw_sit_side, True, True),
        (1, 1, "lie side + landmarks", draw_lie_side, True, True),
        (0, 2, "max horizontal", draw_max_horizontal, True, True),
        (1, 2, "drag scruff reference", draw_drag, True, True),
    ]
    for col, row, title, painter, labels, markers in cells:
        paste_cell(image, draw, col, row, title, painter, labels, markers)
    image.save(OUT_DIR / "body-guide.png")


def build_reference_sheet() -> None:
    image, draw = make_canvas(3, 3, "Cheese Cat V2 Reference Sheet")
    cells = [
        (0, 0, "stand front", draw_stand_front),
        (1, 0, "stand side", draw_stand_side),
        (2, 0, "stand back", draw_stand_back),
        (0, 1, "sit front", draw_sit_front),
        (1, 1, "sit side", draw_sit_side),
        (2, 1, "sit back", draw_sit_back),
        (0, 2, "lie side", draw_lie_side),
        (1, 2, "max vertical", draw_max_vertical),
        (2, 2, "drag scruff", draw_drag),
    ]
    for col, row, title, painter in cells:
        paste_cell(image, draw, col, row, title, painter, False, False)
    image.save(OUT_DIR / "reference-sheet.png")


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    build_body_guide()
    build_reference_sheet()
    print(f"Wrote {OUT_DIR / 'body-guide.png'}")
    print(f"Wrote {OUT_DIR / 'reference-sheet.png'}")


if __name__ == "__main__":
    main()

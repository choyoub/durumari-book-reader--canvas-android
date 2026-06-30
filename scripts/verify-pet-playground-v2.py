from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
HTML_PATH = ROOT / "assets" / "avatars" / "blueprint" / "playground.html"
MANIFEST_PATH = ROOT / "assets" / "avatars" / "blueprint" / "manifest.json"


FORBIDDEN_V1_MARKERS = [
    "assets/avatars/concepts",
    "assets/avatars/cheese/sprites",
    "cheese-cat-polished",
    "sitProduction",
    "dragProduction",
    "fallProduction",
    "landProduction",
]


REQUIRED_BUTTON_IDS = [
    "foundationTest",
    "visualQaTest",
    "detailTest",
    "pageAlertTest",
    "noseBubbleTest",
    "actionPanelToggle",
    "restTest",
    "dropTest",
    "recoverTest",
    "walkTest",
    "overlayTest",
]


REQUIRED_ACTION_CLIPS = {
    "sit.idle": "sit.idle",
    "sit.tail_sway": "sit.tail_sway",
    "sit.blink": "sit.blink",
    "sit.drowsy": "sit.drowsy",
    "sit.ear_twitch": "sit.ear_twitch",
    "sit.paw_tidy": "sit.paw_tidy",
    "sit.sleep": "sit.sleep",
    "sit.nose_bubble": "sit.nose_bubble",
    "sit.alert_wake": "sit.alert_wake",
    "stand.look": "stand.look",
    "stand.idle": "stand.idle",
    "sit_to_stand": "sit_to_stand",
    "stand_to_sit": "stand_to_sit",
    "stand_to_walk": "stand_to_walk",
    "walk.start": "walk.start",
    "walk.loop": "walk.loop",
    "walk.stop": "walk.stop",
    "walk.turn": "walk.turn",
    "walk_to_stand": "walk_to_stand",
    "alert.walk_touch": "alert.walk_touch",
    "alert.touch": "alert.touch",
    "lie.idle": "lie.idle",
    "lie.tail_tip": "lie.tail_tip",
    "lie.push_react": "lie.push_react",
    "sit_to_lie": "sit_to_lie",
    "lie_to_sleep": "lie_to_sleep",
    "sleep.breathe": "sleep.breathe",
    "sleep_to_lie": "sleep_to_lie",
    "lie_to_sit": "lie_to_sit",
    "drag.scruff_sway": "drag.scruff_sway",
    "drag_release": "drag_release",
    "fall.loop": "fall.loop",
    "fall_to_land": "fall_to_land",
    "land.recover": "land.recover",
    "land_to_sit": "land_to_sit",
}


def fail(errors: list[str], message: str) -> None:
    errors.append(message)


def object_body(source: str, const_name: str, errors: list[str]) -> str:
    match = re.search(rf"const\s+{re.escape(const_name)}\s*=\s*\{{(?P<body>.*?)\n\s*\}};", source, re.S)
    if not match:
        fail(errors, f"missing const object {const_name}")
        return ""
    return match.group("body")


def parse_action_sprites(source: str, errors: list[str]) -> dict[str, str]:
    body = object_body(source, "actionSprites", errors)
    return {
        (quoted or bare): value
        for quoted, bare, value in re.findall(r"(?:\"([^\"]+)\"|\b([A-Za-z0-9_]+))\s*:\s*\"([^\"]+)\"", body)
    }


def parse_actions_next(source: str, errors: list[str]) -> dict[str, str | None]:
    body = object_body(source, "actions", errors)
    result: dict[str, str | None] = {}
    pattern = r"(?:\"([^\"]+)\"|\b([A-Za-z0-9_]+))\s*:\s*\{[^}]*?\bnext\s*:\s*(\"([^\"]+)\"|null)"
    for match in re.finditer(pattern, body):
        result[match.group(1) or match.group(2)] = match.group(4)
    return result


def parse_actions_frames(source: str, errors: list[str]) -> dict[str, int]:
    body = object_body(source, "actions", errors)
    result: dict[str, int] = {}
    pattern = r"(?:\"([^\"]+)\"|\b([A-Za-z0-9_]+))\s*:\s*\{[^}]*?\bframes\s*:\s*(\d+)"
    for match in re.finditer(pattern, body):
        result[match.group(1) or match.group(2)] = int(match.group(3))
    return result


def all_clips(manifest: dict[str, Any]) -> dict[str, Any]:
    clips: dict[str, Any] = {}
    clips.update(manifest.get("clips", {}))
    clips.update(manifest.get("transitions", {}))
    return clips


def validate_html(source: str, errors: list[str]) -> None:
    for marker in FORBIDDEN_V1_MARKERS:
        if marker in source:
            fail(errors, f"playground still references V1 marker: {marker}")

    if 'fetch("manifest.json"' not in source:
        fail(errors, "playground does not load manifest.json")

    if "spriteManifest.transitions?.[spriteAction]" not in source:
        fail(errors, "activeClip must read spriteManifest.transitions")

    for marker in [
        "actionQueue",
        "queueActions",
        "updateActionQueue",
        "clearActionQueue",
        "behaviorRules",
        "behaviorScheduler",
        "weightedChoice",
        "schedulerTierForIdle",
        "runScheduledEntry",
        "requestInterrupt",
        "resolveInterrupt",
        "applyPendingInterrupt",
        "applyPageTurnInterrupt",
        "schedulePageReposition",
        "queueFrontAlertSequence",
        "queueNoseBubbleSequence",
        "pageAlert",
        "drawTemporaryEffects",
        "drawPageAlertEffect",
        "drawNoseBubbleEffect",
        "drawGroomEffect",
        "drawPlayEffect",
        "drawStretchEffect",
        "drawTurnEffect",
        "drawHopEffect",
        "viewerOverlay",
        "toggleViewerOverlay",
        "overlayOpen",
        "actionPanel",
        "actionGrid",
        "actionPanelOpen",
        "actionTestEntries",
        "renderActionButtons",
        "toggleActionPanel",
        "playActionTest",
        "interruptSignal",
        "lastInterrupt",
        "queueWalkSequence",
        "resolveWalkTarget",
        "faceWalkTarget",
        "walkPixelsPerSecond",
        "isStableWalkStopFrame",
        "simulateFoundationTest",
        "simulateVisualQaTest",
        "startDropDemo",
        "petPlaygroundDebug",
        "updateDebugState",
    ]:
        if marker not in source:
            fail(errors, f"playground is missing queued playback helper {marker}")

    for button_id in REQUIRED_BUTTON_IDS:
        if f'id="{button_id}"' not in source:
            fail(errors, f"missing test button #{button_id}")
        if f"{button_id}.addEventListener" not in source:
            fail(errors, f"missing click listener for #{button_id}")

    if 'class="actionPanel" id="actionPanel"' not in source:
        fail(errors, "missing action test panel")
    if 'data.actionTest' not in source and "dataset.actionTest" not in source:
        fail(errors, "action test buttons must expose the tested action")
    if 'actionGrid.replaceChildren' not in source:
        fail(errors, "action test panel must render buttons dynamically")
    for action_id in [
        "sit.idle",
        "sit.tail_sway",
        "sit.blink",
        "sit.ear_twitch",
        "sit.drowsy",
        "sit.sleep",
        "sit.paw_tidy",
        "sit.nose_bubble",
        "sit.alert_wake",
        "stand.look",
        "stand.idle",
        "sit_to_stand",
        "stand_to_sit",
        "stand_to_walk",
        "walk.start",
        "walk.loop",
        "walk.stop",
        "walk.turn",
        "walk_to_stand",
        "alert.walk_touch",
        "sit_to_lie",
        "lie.idle",
        "lie.tail_tip",
        "lie.push_react",
        "lie_to_sleep",
        "sleep.breathe",
        "sleep_to_lie",
        "lie_to_sit",
        "alert.touch",
        "drag.scruff_sway",
        "drag_release",
        "fall.loop",
        "fall_to_land",
        "land.recover",
        "land_to_sit",
        "hidden",
    ]:
        if f'action: "{action_id}"' not in source:
            fail(errors, f"action test panel is missing {action_id}")

    sheet_button_row = re.search(r"\.sheetBar\s+\.button-row\s*\{(?P<body>.*?)\}", source, re.S)
    if not sheet_button_row:
        fail(errors, "missing sheet button row styles")
    else:
        sheet_body = sheet_button_row.group("body")
        if "flex-wrap: wrap" not in sheet_body:
            fail(errors, "sheet type buttons must wrap to a new line")
        if "overflow-x: auto" in sheet_body:
            fail(errors, "sheet type buttons must not require horizontal scrolling")

    sheet_image = re.search(r"\.sheetImage\s*\{(?P<body>.*?)\}", source, re.S)
    if not sheet_image:
        fail(errors, "missing sheet image styles")
    else:
        image_body = sheet_image.group("body")
        for token in ["max-width: 100%", "max-height:", "object-fit: contain"]:
            if token not in image_body:
                fail(errors, f"sheet image must include {token}")

    queue_walk_match = re.search(r"function\s+queueWalkSequence\s*\([^)]*\)\s*\{(?P<body>.*?)\n\s*\}", source, re.S)
    if not queue_walk_match:
        fail(errors, "missing queueWalkSequence function")
    elif '"walk.start"' in queue_walk_match.group("body"):
        fail(errors, "queueWalkSequence must not play walkStart before coordinate movement")
    elif '"walk_to_stand"' in queue_walk_match.group("body"):
        fail(errors, "queueWalkSequence must not play walkToStand")
    elif "faceWalkTarget" not in queue_walk_match.group("body"):
        fail(errors, "queueWalkSequence must face the walk target before walk.loop")
    elif not all(token in queue_walk_match.group("body") for token in [
        '{ action: "sit_to_stand", faceWalkTarget: resolvedTarget }',
        '{ action: "stand.idle", holdMs: 700, faceWalkTarget: resolvedTarget }',
        '{ action: "stand_to_walk", faceWalkTarget: resolvedTarget }',
    ]):
        fail(errors, "queueWalkSequence must face sitToStand, stand, and standToWalk toward the walk target")
    elif not re.search(r'\{ action: "walk\.loop"[^}]*\},\s*\n\s*"walk\.stop"', queue_walk_match.group("body")):
        fail(errors, "queueWalkSequence must order walk as walk.loop -> walkStop")

    foundation_match = re.search(r"function\s+simulateFoundationTest\s*\([^)]*\)\s*\{(?P<body>.*?)\n\s*\}", source, re.S)
    if not foundation_match:
        fail(errors, "missing simulateFoundationTest function")
    elif '"walk.start"' in foundation_match.group("body"):
        fail(errors, "simulateFoundationTest must not play walkStart before coordinate movement")
    elif '"walk_to_stand"' in foundation_match.group("body"):
        fail(errors, "simulateFoundationTest must not play walkToStand")
    elif "faceWalkTarget" not in foundation_match.group("body"):
        fail(errors, "simulateFoundationTest must face the walk target before walk.loop")
    elif not all(token in foundation_match.group("body") for token in [
        '{ action: "sit_to_stand", faceWalkTarget: walkTarget }',
        '{ action: "stand.idle", holdMs: 700, faceWalkTarget: walkTarget }',
        '{ action: "stand_to_walk", faceWalkTarget: walkTarget }',
    ]):
        fail(errors, "simulateFoundationTest must face sitToStand, stand, and standToWalk toward the walk target")
    elif not re.search(r'\{ action: "walk\.loop"[^}]*\},\s*\n\s*"walk\.stop"', foundation_match.group("body")):
        fail(errors, "simulateFoundationTest must order walk as walk.loop -> walkStop")

    if 'requestInterrupt("targetReached")' not in source and 'requestInterrupt("edgeReached")' not in source:
        fail(errors, "walk target completion must use the common interrupt process")
    for signal in ['"tap"', '"dragStart"', '"drop"', '"pageTurn"']:
        if f"requestInterrupt({signal}" not in source:
            fail(errors, f"missing common interrupt request for {signal}")

    if 'pageTurn: "alert.touch"' not in source:
        fail(errors, "pageTurn must route through alert.touch")
    if 'tap: "alert.walk_touch"' not in source:
        fail(errors, "walk tap must route through the side-facing walk alert")
    if 'tap: "lie.push_react"' not in source:
        fail(errors, "resting lie tap must route through the push reaction")
    if "queueFrontAlertSequence();" not in source:
        fail(errors, "pageTurn and test alert must use the front-facing alert sequence")
    if '"alert.touch": { frames: 6, loop: false, next: "stand.look" }' not in source:
        fail(errors, "alert.touch must return to stand.look without hiding after the alert motion")
    if '{ action: "stand.look", holdMs: 280 }' not in source:
        fail(errors, "front alert sequence must start from stand.look")
    if 'queueNoseBubbleSequence();' not in source:
        fail(errors, "noseBubble test must use the V2 drowsy -> sleep -> bubble -> wake -> blink sequence")
    if 'viewerOverlay.classList.toggle("isOpen", open)' not in source:
        fail(errors, "viewer overlay test must toggle without touching the avatar canvas")


def validate_mapping(source: str, manifest: dict[str, Any], errors: list[str]) -> None:
    action_sprites = parse_action_sprites(source, errors)
    actions_next = parse_actions_next(source, errors)
    actions_frames = parse_actions_frames(source, errors)
    clips = all_clips(manifest)

    for action, clip_id in sorted(action_sprites.items()):
        if clip_id not in clips:
            fail(errors, f"actionSprites.{action} maps to missing clip {clip_id!r}")

    for action, clip_id in REQUIRED_ACTION_CLIPS.items():
        actual = action_sprites.get(action, action)
        if actual != clip_id:
            fail(errors, f"runtime action {action!r} must resolve to {clip_id!r}, got {actual!r}")
        expected_frames = clips.get(clip_id, {}).get("frames")
        actual_frames = actions_frames.get(action)
        if expected_frames != actual_frames:
            fail(errors, f"actions.{action}.frames must be {expected_frames!r}, got {actual_frames!r}")

    expected_next = {
        "stand_to_walk": "walk.loop",
        "walk.stop": "stand.idle",
        "alert.walk_touch": "stand.look",
        "lie.push_react": "lie.idle",
        "sit.nose_bubble": "sit.alert_wake",
        "sit.alert_wake": "sit.blink",
        "alert.touch": "stand.look",
        "fall_to_land": "land.recover",
        "land.recover": "land_to_sit",
        "land_to_sit": "sit.idle",
    }
    for action, expected in expected_next.items():
        actual = actions_next.get(action)
        if actual != expected:
            fail(errors, f"actions.{action}.next must be {expected!r}, got {actual!r}")

    expected_drop_clips = [
        action_sprites.get("fall.loop", "fall.loop"),
        action_sprites.get("fall_to_land", "fall_to_land"),
        action_sprites.get("land.recover", "land.recover"),
        action_sprites.get("land_to_sit", "land_to_sit"),
        action_sprites.get("sit.tail_sway", "sit.tail_sway"),
    ]
    if expected_drop_clips != ["fall.loop", "fall_to_land", "land.recover", "land_to_sit", "sit.tail_sway"]:
        fail(errors, f"runtime drop sequence mapping is unexpected: {expected_drop_clips!r}")

    expected_clip_locations = {
        "fall_to_land": ("transitions", 9),
        "land.recover": ("land", 0),
        "land_to_sit": ("transitions", 10),
    }
    for clip_id, (expected_sheet, expected_row) in expected_clip_locations.items():
        clip = clips.get(clip_id, {})
        if clip.get("sheet") != expected_sheet or clip.get("row") != expected_row:
            fail(
                errors,
                (
                    f"manifest {clip_id} must use {expected_sheet} row {expected_row}, "
                    f"got {clip.get('sheet')!r} row {clip.get('row')!r}"
                ),
            )


def main() -> int:
    errors: list[str] = []
    source = HTML_PATH.read_text(encoding="utf-8")
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))

    validate_html(source, errors)
    validate_mapping(source, manifest, errors)

    if errors:
        print("Pet playground V2 verification failed:")
        for error in errors:
            print(f"- {error}")
        return 1

    print("Pet playground V2 verification passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

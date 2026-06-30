from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
BLUEPRINT_DIR = ROOT / "assets" / "avatars" / "blueprint"
MANIFEST = BLUEPRINT_DIR / "manifest.json"

REQUIRED_TOP_LEVEL = {
    "version",
    "stage",
    "cell",
    "bodyGuide",
    "sheets",
    "clips",
    "transitions",
    "stateGraph",
}
REQUIRED_CLIP_FIELDS = {
    "id",
    "sheet",
    "row",
    "frames",
    "fps",
    "loop",
    "loopMode",
    "poseType",
    "entryPose",
    "exitPose",
    "anchor",
    "groundY",
    "landmarks",
    "allowedNext",
}
LOOP_MODES = {"forward", "pingpong", "once"}


def fail(errors: list[str], message: str) -> None:
    errors.append(message)


def load_manifest(errors: list[str]) -> dict[str, Any]:
    if not MANIFEST.exists():
        fail(errors, f"Missing manifest: {MANIFEST}")
        return {}
    try:
        duplicate_paths: list[str] = []

        def no_duplicate_object_pairs(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
            seen: set[str] = set()
            result: dict[str, Any] = {}
            for key, value in pairs:
                if key in seen:
                    duplicate_paths.append(key)
                seen.add(key)
                result[key] = value
            return result

        data = json.loads(MANIFEST.read_text(encoding="utf-8"), object_pairs_hook=no_duplicate_object_pairs)
        if duplicate_paths:
            fail(errors, f"Duplicate JSON keys found: {sorted(set(duplicate_paths))}")
        return data
    except json.JSONDecodeError as exc:
        fail(errors, f"Invalid JSON: {exc}")
        return {}


def all_clip_defs(manifest: dict[str, Any]) -> dict[str, dict[str, Any]]:
    merged: dict[str, dict[str, Any]] = {}
    merged.update(manifest.get("clips", {}))
    merged.update(manifest.get("transitions", {}))
    return merged


def validate_manifest_shape(manifest: dict[str, Any], errors: list[str]) -> None:
    missing = REQUIRED_TOP_LEVEL - set(manifest)
    if missing:
        fail(errors, f"Missing top-level fields: {sorted(missing)}")

    cell = manifest.get("cell", {})
    expected_cell = {
        "width": 320,
        "height": 320,
        "anchorX": 160,
        "groundY": 270,
        "edgePadding": 8,
    }
    for key, expected in expected_cell.items():
        if cell.get(key) != expected:
            fail(errors, f"cell.{key} must be {expected}, got {cell.get(key)!r}")

    safe_box = cell.get("safeBox", {})
    expected_safe_box = {"x": 20, "y": 10, "width": 280, "height": 260}
    for key, expected in expected_safe_box.items():
        if safe_box.get(key) != expected:
            fail(errors, f"cell.safeBox.{key} must be {expected}, got {safe_box.get(key)!r}")


def validate_clip_defs(manifest: dict[str, Any], errors: list[str]) -> None:
    sheets = manifest.get("sheets", {})
    clips = all_clip_defs(manifest)
    adjacency = manifest.get("stateGraph", {}).get("adjacency", {})

    for clip_id, clip in clips.items():
        if clip.get("id") != clip_id:
            fail(errors, f"{clip_id}: id field must match key")

        missing = REQUIRED_CLIP_FIELDS - set(clip)
        if missing:
            fail(errors, f"{clip_id}: missing fields {sorted(missing)}")

        if clip.get("loopMode") not in LOOP_MODES:
            fail(errors, f"{clip_id}: invalid loopMode {clip.get('loopMode')!r}")

        sheet_id = clip.get("sheet")
        sheet = sheets.get(sheet_id)
        if sheet is None:
            fail(errors, f"{clip_id}: unknown sheet {sheet_id!r}")
        else:
            row = clip.get("row")
            frames = clip.get("frames")
            if isinstance(row, int) and row >= sheet.get("rows", 0):
                fail(errors, f"{clip_id}: row {row} is outside sheet {sheet_id} rows")
            if isinstance(frames, int) and frames > sheet.get("cols", 0):
                fail(errors, f"{clip_id}: frames {frames} exceed sheet {sheet_id} cols")

        allowed_next = clip.get("allowedNext", [])
        if adjacency.get(clip_id) != allowed_next:
            fail(errors, f"{clip_id}: allowedNext differs from stateGraph.adjacency")

        for target_id in allowed_next:
            target = clips.get(target_id)
            if target is None:
                fail(errors, f"{clip_id}: allowedNext target {target_id!r} does not exist")
                continue
            if clip.get("exitPose") != target.get("entryPose"):
                fail(
                    errors,
                    (
                        f"{clip_id} -> {target_id}: pose mismatch "
                        f"{clip.get('exitPose')!r} != {target.get('entryPose')!r}"
                    ),
                )

    for graph_id in adjacency:
        if graph_id not in clips:
            fail(errors, f"stateGraph.adjacency has unknown node {graph_id!r}")


def validate_guides(manifest: dict[str, Any], errors: list[str]) -> None:
    body_guide = manifest.get("bodyGuide", {}).get("image")
    reference_sheet = manifest.get("referenceSheet")
    for label, relative_path in {
        "bodyGuide.image": body_guide,
        "referenceSheet": reference_sheet,
    }.items():
        if not relative_path:
            fail(errors, f"{label} is missing")
            continue
        path = BLUEPRINT_DIR / relative_path
        if not path.exists():
            fail(errors, f"{label} file does not exist: {path}")
            continue
        with Image.open(path) as image:
            if image.format != "PNG":
                fail(errors, f"{label} must be PNG")
            if image.mode != "RGBA":
                fail(errors, f"{label} must be RGBA, got {image.mode}")


def validate_playback_sequences(manifest: dict[str, Any], errors: list[str]) -> None:
    clips = all_clip_defs(manifest)
    adjacency = manifest.get("stateGraph", {}).get("adjacency", {})
    acceptance = manifest.get("acceptance", {})

    for sequence_key in ("foundationPlaybackSequences", "requiredPlaybackSequences"):
        for index, sequence in enumerate(acceptance.get(sequence_key, [])):
            if not isinstance(sequence, list) or len(sequence) < 2:
                fail(errors, f"acceptance.{sequence_key}[{index}] must contain at least two clips")
                continue
            for clip_id in sequence:
                if clip_id not in clips:
                    fail(errors, f"acceptance.{sequence_key}[{index}] has unknown clip {clip_id!r}")
            for source, target in zip(sequence, sequence[1:]):
                if target not in adjacency.get(source, []):
                    fail(errors, f"acceptance.{sequence_key}[{index}]: {source} cannot transition to {target}")


def validate_existing_production_sheets(manifest: dict[str, Any], errors: list[str]) -> None:
    cell = manifest.get("cell", {})
    cell_w = cell.get("width")
    cell_h = cell.get("height")
    edge = cell.get("edgePadding", 8)
    clips = all_clip_defs(manifest)

    for sheet_id, sheet in manifest.get("sheets", {}).items():
        path = BLUEPRINT_DIR / sheet.get("path", "")
        if not path.exists():
            continue
        with Image.open(path) as image:
            if image.format != "PNG":
                fail(errors, f"{sheet_id}: production sheet must be PNG")
            if image.mode != "RGBA":
                fail(errors, f"{sheet_id}: production sheet must be RGBA, got {image.mode}")
            if image.width % cell_w != 0 or image.height % cell_h != 0:
                fail(errors, f"{sheet_id}: dimensions must be multiples of {cell_w}x{cell_h}")
            expected_width = sheet.get("cols", 0) * cell_w
            expected_height = sheet.get("rows", 0) * cell_h
            if image.width != expected_width or image.height != expected_height:
                fail(
                    errors,
                    (
                        f"{sheet_id}: dimensions must be exactly "
                        f"{expected_width}x{expected_height}, got {image.width}x{image.height}"
                    ),
                )

            alpha = image.getchannel("A")
            for x in range(image.width):
                for y in range(image.height):
                    near_edge = (
                        x % cell_w < edge
                        or x % cell_w >= cell_w - edge
                        or y % cell_h < edge
                        or y % cell_h >= cell_h - edge
                    )
                    if near_edge and alpha.getpixel((x, y)) != 0:
                        fail(errors, f"{sheet_id}: opaque pixel inside {edge}px edge padding at {(x, y)}")
                        return

            for clip_id in sheet.get("availableClips", []):
                clip = clips.get(clip_id)
                if clip is None:
                    fail(errors, f"{sheet_id}: available clip {clip_id!r} does not exist")
                    continue
                if clip.get("sheet") != sheet_id:
                    fail(errors, f"{sheet_id}: available clip {clip_id!r} belongs to {clip.get('sheet')!r}")
                    continue
                row = clip.get("row")
                frames = clip.get("frames")
                if not isinstance(row, int) or not isinstance(frames, int):
                    continue
                for col in range(frames):
                    cell_box = (col * cell_w, row * cell_h, (col + 1) * cell_w, (row + 1) * cell_h)
                    cell_alpha = alpha.crop(cell_box)
                    if cell_alpha.getbbox() is None:
                        fail(errors, f"{clip_id}: frame {col} is empty")


def validate_ground_contact_frames(manifest: dict[str, Any], errors: list[str]) -> None:
    cell = manifest.get("cell", {})
    cell_w = cell.get("width")
    cell_h = cell.get("height")
    ground_y = cell.get("groundY")
    clips = all_clip_defs(manifest)
    required_contact = {
        "fall_to_land": "all",
        "land.recover": "all",
        "land_to_sit": "all",
    }

    for clip_id, mode in required_contact.items():
        clip = clips.get(clip_id)
        if not clip:
            continue
        sheet = manifest.get("sheets", {}).get(clip.get("sheet"), {})
        path = BLUEPRINT_DIR / sheet.get("path", "")
        if not path.exists():
            continue
        with Image.open(path) as image:
            alpha = image.getchannel("A")
            row = clip.get("row")
            frames = clip.get("frames")
            if not isinstance(row, int) or not isinstance(frames, int):
                continue
            frame_indexes = range(frames) if mode == "all" else mode
            for col in frame_indexes:
                cell_box = (col * cell_w, row * cell_h, (col + 1) * cell_w, (row + 1) * cell_h)
                bbox = alpha.crop(cell_box).getbbox()
                if bbox is None:
                    continue
                if bbox[3] < ground_y:
                    fail(errors, f"{clip_id}: frame {col} bottom {bbox[3]} is above groundY {ground_y}")


def main() -> int:
    errors: list[str] = []
    manifest = load_manifest(errors)
    if manifest:
        validate_manifest_shape(manifest, errors)
        validate_clip_defs(manifest, errors)
        validate_guides(manifest, errors)
        validate_playback_sequences(manifest, errors)
        validate_existing_production_sheets(manifest, errors)
        validate_ground_contact_frames(manifest, errors)

    if errors:
        print("Cheese V2 validation failed:")
        for error in errors:
            print(f"- {error}")
        return 1

    clips = len(manifest.get("clips", {}))
    transitions = len(manifest.get("transitions", {}))
    print(f"Cheese V2 validation passed: {clips} clips, {transitions} transitions.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

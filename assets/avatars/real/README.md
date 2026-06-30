# Real Cat Avatar Production Guide

이 폴더는 실제 앱에 적용할 최종 고양이 아바타 에셋을 종류별로 보관한다. 공통 행동 계약과 기준선은 `assets/avatars/blueprint/manifest.json`과 `assets/avatars/blueprint/DESIGN.md`를 따른다.

## Folder Structure

```text
assets/avatars/real/
  cheese/
    DESIGN.md
    MODEL_GUIDE.md
    manifest.json
    sprites/
  black/
    DESIGN.md
    manifest.json
    sprites/
```

## Contract

real 에셋은 blueprint와 같은 계약을 유지해야 한다.

- `cell.width`: 320
- `cell.height`: 320
- `anchorX`: 160
- `groundY`: 270
- `safeBox`: `{ x: 20, y: 10, width: 280, height: 260 }`
- sheet id, row index, clip id, frame count 유지
- `sprites/*.png`는 투명 PNG
- runtime action id는 blueprint manifest와 동일

신체 사이즈도 blueprint 기준을 따른다. real 고양이마다 색과 무늬는 달라도 아래 크기와 landmark 기준이 달라지면 안 된다.

| 항목 | 기준 |
|---|---:|
| bodyLength | 옆모습 기준 약 132px |
| bodyHeight | 서기 기준 약 70px |
| headWidth | 약 62px |
| headHeight | 약 58px |
| legLength | 서기 기준 약 50px |
| tailLength | 기본 약 96px, 최대 약 132px |
| tailThickness | 기본 10px - 14px |
| earHeight | 약 20px |

필수 접지/landmark 기준:

- `frontPaw`: sit/stand/walk에서 `groundY ±2px`
- `rearPaw`: sit/stand/walk에서 `groundY ±2px`
- `bellyGround`: lie/sleep에서 `groundY ±2px`
- `bodyCenter`: idle 루프 흔들림 `±3px` 이내
- `tailBase`: 몸통과 항상 연결
- `tailTip`: safeBox 안쪽 유지
- `scruffPoint`: drag 손 위치와 목덜미 연결

바꿔도 되는 것은 실제 고양이의 외형, 팔레트, 털 무늬, 얼굴 디테일, 같은 frame 수 안에서의 포즈 세밀도다.

## Production Order

한 번에 모든 sheet를 만들지 않는다.

1. 대상 고양이의 `DESIGN.md`에서 외형을 확정한다.
2. `sit.idle` 한 row만 먼저 만든다.
3. 64/72/80px 표시에서 얼굴, 귀, 꼬리, 발이 읽히는지 확인한다.
4. `sit.tail_sway`, `sit.blink`, `sit.drowsy` 순서로 같은 sheet를 확장한다.
5. `stand.look`, `alert.touch`, `alert.walk_touch`를 만든다.
6. `drag.scruff_sway`, `fall.loop`, `fall_to_land`, `land.recover`, `land_to_sit`를 만든다.
7. `walk.loop`, `walk.stop`, `stand_to_walk` 보폭과 좌표 동기화를 확인한다.

## Validation

real 제작 중에도 blueprint playground로 행동 계약을 검증한다. real 에셋을 playground에 임시 연결해서 볼 때도 scheduler, interrupt, walk/drop 로직은 바꾸지 않는다.

기본 검증:

```powershell
python scripts\validate-cheese-v2.py
python scripts\verify-pet-playground-v2.py
```

playground:

```text
http://127.0.0.1:8765/assets/avatars/blueprint/playground.html
```

## Naming

- 폴더명은 고양이 종류를 소문자 단수형으로 쓴다.
- 예: `cheese`, `black`, `white`, `cream`
- 실제 앱에서 선택되는 이름과 파일 경로 이름은 일치시킨다.

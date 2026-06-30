# Cheese Real Avatar Design

이 문서는 실제 앱에 적용할 치즈냥 real 에셋 제작 지침이다. 행동 계약은 `assets/avatars/blueprint/manifest.json`을 그대로 따른다. 실제 모델 외형 제작 기준은 `MODEL_GUIDE.md`를 먼저 따른다.

## Goal

치즈냥은 밝은 주황 털, 크림색 배, 읽기 쉬운 줄무늬와 표정이 있는 기본 고양이다. 북리더 하단 lane에서 64-80px로 표시되어도 얼굴, 귀, 앞발, 꼬리가 분명히 읽혀야 한다.

## Required Structure

```text
assets/avatars/real/cheese/
  DESIGN.md
  MODEL_GUIDE.md
  manifest.json
  sprites/
    sit.png
    stand.png
    walk.png
    lie.png
    sleep.png
    alert.png
    drag.png
    fall.png
    land.png
    transitions.png
```

초기 제작 전에는 `manifest.json`과 `sprites/*.png`가 없을 수 있다. 제작을 시작하면 blueprint manifest와 같은 sheet/clip 계약으로 채운다.

## Visual Direction

- 실제 적용용 최종 고양이여야 하며, blueprint 임시 고양이를 단순히 다듬는 방식으로 만들지 않는다.
- 털색은 치즈냥답게 주황 계열을 쓰되, 작은 표시 크기에서도 윤곽이 배경과 분리되어야 한다.
- 배와 입 주변은 크림색으로 둬서 표정과 앞발이 잘 보이게 한다.
- 줄무늬는 머리 3개, 몸통/꼬리 일부만 남겨 작게 줄였을 때 뭉개지지 않게 한다.
- 눈, 코, 입은 64px에서도 표정이 읽히는 크기와 대비를 유지한다.
- 꼬리는 몸통과 항상 연결되어야 하며 safeBox 안쪽을 유지한다.

## First Milestone

처음에는 `sit.idle` 한 row만 만든다.

성공 기준:

- `sprites/sit.png` row 0, frame 0-5만 실제 치즈냥으로 완성
- frame 수 6 유지
- 접지점은 `groundY=270` 유지
- body center 흔들림은 작고 자연스러움
- 64/72/80px preview에서 얼굴, 귀, 꼬리, 앞발이 구분됨
- 다른 row와 runtime 계약은 변경하지 않음

## Expansion Order

1. `sit.idle`
2. `sit.tail_sway`
3. `sit.blink`
4. `sit.drowsy`
5. `stand.look`
6. `alert.touch`
7. `alert.walk_touch`
8. drag/drop 계열
9. walk 계열

## Do Not Change

- blueprint action id
- sheet id
- row index
- frame count
- `320x320` cell
- `anchorX=160`
- `groundY=270`
- `safeBox`
- playground scheduler, interrupt, walk/drop runtime logic

# Cheese Cat Real Model Guide

이 문서는 실제 앱에 적용할 치즈냥 모델의 외형 제작 기준이다. 행동 계약, 셀 크기, 기준선은 `assets/avatars/blueprint/manifest.json`을 따른다.

## Model Goal

치즈냥은 "작고 선명하게 읽히는 따뜻한 주황 고양이"다. 64-80px 표시 크기에서도 고양이의 얼굴, 귀, 앞발, 꼬리, 치즈색 줄무늬가 바로 읽혀야 한다.

임시 blueprint 고양이를 예쁘게 다듬는 것이 아니라, 같은 행동 계약 위에 실제 앱에 넣을 최종 캐릭터 모델을 새로 만든다.

## Identity

- 종류: 치즈 태비 고양이
- 분위기: 조용하고 온순하지만 반응이 살아 있음
- 앱 안 역할: 독서 흐름을 방해하지 않는 하단 lane 동반자
- 첫인상: 동그랗고 부드러운 얼굴, 짧고 안정적인 몸, 선명한 꼬리
- 피해야 할 인상: 게임 마스코트처럼 과장된 표정, 사람 같은 얼굴, 지나치게 사실적인 털 묘사

## Shape Language

전체 실루엣은 작은 표시 크기에서 먼저 읽혀야 한다.

- 머리: 둥근 삼각형에 가까운 원형, 너무 납작하지 않게 한다.
- 귀: 큰 삼각형이지만 끝은 살짝 둥글게 처리한다.
- 몸통: 앉은 자세에서는 둥근 물방울형, 누운 자세에서는 낮고 긴 타원형.
- 앞발: 두 개가 분리되어 보여야 하며, 64px에서도 발 위치가 읽혀야 한다.
- 뒷발: 몸통 양쪽에 둥근 발 덩어리로 보이게 한다.
- 꼬리: 몸통과 명확히 연결되고, 치즈냥의 가장 읽기 쉬운 보조 실루엣이어야 한다.

## Proportions

아바타 제작자는 아래 blueprint 신체 사이즈를 그대로 기준으로 삼아야 한다. 이 치수에서 크게 벗어나면 playground에서는 그럴듯해 보여도 앱 런타임에서 접지, drag, drop, walk 동기화가 틀어진다.

| 항목 | 필수 기준 |
|---|---:|
| cellWidth | 320px |
| cellHeight | 320px |
| anchor | `{ x: 160, y: 270 }` |
| groundY | 270px |
| safeBox | `x=20, y=10, width=280, height=260` |
| bodyLength | 옆모습 기준 약 132px |
| bodyHeight | 서기 기준 약 70px |
| headWidth | 약 62px |
| headHeight | 약 58px |
| legLength | 서기 기준 약 50px |
| tailLength | 기본 약 96px, 최대 약 132px |
| tailThickness | 기본 10px - 14px |
| earHeight | 약 20px |

허용 범위:

- 접지점은 `groundY ±2px` 안에 있어야 한다.
- idle 계열 body center 흔들림은 `±3px` 이내여야 한다.
- 꼬리 끝, 귀 끝, 드래그 손, 놀람선, 코방울까지 safeBox를 넘지 않아야 한다.
- 낙하 중인 `fall.loop`만 공중 상태가 허용된다.
- `fall_to_land`, `land.recover`, `land_to_sit`는 visible bottom이 groundY보다 위에서 끝나면 안 된다.

필수 landmark:

| landmark | 제작 기준 |
|---|---|
| `frontPaw` | sit/stand/walk에서 `groundY ±2px` |
| `rearPaw` | sit/stand/walk에서 `groundY ±2px` |
| `bellyGround` | lie/sleep에서 `groundY ±2px` |
| `bodyCenter` | 프레임 간 크기/위치 튐 방지 기준 |
| `headCenter` | 표정, blink, drowsy 기준 |
| `tailBase` | 몸통과 항상 연결 |
| `tailTip` | safeBox 안쪽 유지 |
| `scruffPoint` | drag 손 위치와 목덜미 연결 |

위 숫자는 `assets/avatars/blueprint/body-guide.png`와 `assets/avatars/blueprint/manifest.json`이 source of truth다. real 제작 중 외형을 바꾸더라도 이 기준을 먼저 맞춘다.

blueprint 기준 landmark를 유지한 상태에서 실제 모델은 아래 인상을 따른다.

| 부위 | 제작 기준 |
|---|---|
| 머리 | 몸통보다 살짝 작거나 비슷하게, 표정이 읽힐 만큼 크게 |
| 귀 | 머리 높이의 약 28-34% |
| 몸통 | 앉은 자세에서 안정적인 둥근 덩어리 |
| 앞발 | groundY에 닿고 좌우가 분리되어 보임 |
| 꼬리 | 너무 가늘지 않게, 표시 크기에서 선으로 사라지지 않게 |
| 줄무늬 | 머리와 꼬리 중심, 몸통 줄무늬는 최소화 |

셀 안의 실제 그림은 크게 그리되 safeBox를 넘지 않는다. 표시 크기로 줄였을 때 디테일이 뭉개지면 디테일을 줄이고 실루엣을 우선한다.

## Palette

권장 팔레트는 기준값이며, 최종 제작 중 대비를 위해 조정할 수 있다.

| 역할 | 색상 |
|---|---|
| 외곽선 | `#5B361D` |
| 어두운 털 | `#A6521C` |
| 기본 털 | `#DF812F` |
| 밝은 털 | `#F6B35C` |
| 배/입 주변 | `#FFDA97` |
| 하이라이트 | `#FFE8B5` |
| 귀 안쪽 | `#F49074` |
| 눈/입 | `#33241B` |
| 코 | `#63342C` |
| 그림자 | `rgba(82,56,38,0.18)` |

원칙:

- 배경이 한지/화이트/다크/칠판이어도 외곽선이 읽혀야 한다.
- 주황색만으로 덩어리를 만들지 말고, 크림색 배와 어두운 줄무늬로 구조를 나눈다.
- 작은 크기에서 눈이 점으로 사라지면 눈 크기와 대비를 우선한다.

## Face

표정은 작고 안정적이어야 한다.

- 눈은 세로 타원 또는 둥근 점에 가깝게 만든다.
- 눈 간격은 너무 넓히지 않는다.
- 코는 작은 역삼각형.
- 입은 짧은 곡선 두 개나 아주 작은 `w` 형태.
- 수염은 64px에서 과하게 지저분하면 줄인다.
- `blink`, `drowsy`, `sleep`에서는 눈 모양 변화가 가장 먼저 읽혀야 한다.

## Fur Pattern

치즈냥 줄무늬는 "적지만 확실하게" 둔다.

- 이마 중앙 1개, 좌우 1개씩 총 3개 줄무늬를 기본으로 한다.
- 볼 옆 줄무늬는 작게 넣거나 생략한다.
- 몸통 줄무늬는 2-3개 이하.
- 꼬리 줄무늬는 2-4개로 리듬을 만든다.
- 줄무늬가 표정이나 발을 방해하면 줄무늬를 줄인다.

## Rendering Style

앱 적용용 sprite는 투명 PNG다.

- vector처럼 너무 매끈한 아이콘이 아니라, 작은 캐릭터 sprite처럼 보여야 한다.
- 픽셀 아트로 만들 경우 계단을 의도적으로 정리한다.
- 반픽셀 흐림이 심하면 64px에서 뿌옇게 보이므로 경계 대비를 올린다.
- 털 한 올 한 올을 그리지 않는다.
- 외곽선은 64px에서 끊기지 않아야 한다.
- 그림자는 몸과 분리된 바닥 접지 보조 요소로만 작게 쓴다.

## Pose Rules

모든 자세는 같은 고양이로 보여야 한다.

- 앉기: 가장 중요한 기준 모델. 이후 모든 행동의 얼굴/몸통 기준이 된다.
- 서기: 앉기보다 몸통이 길어져도 머리 크기와 귀 모양은 유지한다.
- 걷기: 다리만 바뀌고 몸통 크기가 매 프레임 튀면 안 된다.
- 눕기: 몸이 낮아져도 얼굴과 꼬리 정체성이 유지되어야 한다.
- 드래그: 목덜미 잡힘으로 몸이 늘어지지만, 고양이 스케일은 바뀌면 안 된다.
- 낙하/착지: 충격 표현은 자세 압축으로 처리하고, 위치 기준은 groundY를 유지한다.

## Animation Rules

real 모델은 움직임보다 일관성이 먼저다.

- `sit.idle`: 호흡은 1-2px 수준의 작고 느린 변화.
- `sit.tail_sway`: 꼬리 끝이 먼저 움직이고 몸통은 거의 고정.
- `sit.blink`: 눈만 명확히 바뀌고 머리 크기는 유지.
- `sit.drowsy`: 눈꺼풀과 머리 하강이 자연스럽게 연결.
- `alert.touch`: 눈/귀/몸 압축으로 놀람이 읽혀야 하지만 과장하지 않는다.
- `walk.loop`: 발 접지점이 미끄러지지 않게 한다.

## First Asset Target

첫 산출물은 `assets/avatars/real/cheese/sprites/sit.png`의 row 0이다.

필수 조건:

- sheet 크기: `2560x2880`
- cell: `320x320`
- row 0: `sit.idle`
- frames: 6
- 투명 PNG
- frame 0-5 모두 비어 있지 않음
- 접지점은 `groundY=270`
- frontPaw/rearPaw는 `groundY ±2px`
- bodyCenter 흔들림은 `±3px` 이내
- 머리, 몸통, 꼬리 크기는 위 필수 신체 기준을 따른다.
- 다른 row는 비워두거나 blueprint 임시 row를 복사해 둘 수 있지만, 최종 검증 전에는 모든 manifest frame이 비어 있으면 안 된다.

## Prompt Seed

이미지 생성이나 외부 제작자에게 전달할 때의 기준 프롬프트:

```text
small warm orange tabby cat character for a reading app companion, front sitting pose, round soft head, triangular ears with rounded tips, cream muzzle and belly, clear dark orange forehead stripes, striped tail connected to body, tiny readable paws on the ground, calm friendly expression, clean sprite silhouette, transparent background, designed to remain readable at 64 pixels, no text, no props, no scene background
```

금지 프롬프트:

```text
realistic fur detail, photorealistic, human expression, oversized mascot head, clothing, accessories, background, complex lighting, disconnected tail, aggressive pose, huge eyes, chibi proportions that break cat anatomy
```

## Review Checklist

- 64px에서 고양이로 즉시 읽히는가?
- 치즈냥 색과 줄무늬가 보이는가?
- 얼굴, 귀, 앞발, 꼬리가 구분되는가?
- 꼬리가 몸통과 연결되어 있는가?
- 발 또는 배가 `groundY=270`에 맞는가?
- 신체 크기가 blueprint 기준 표와 맞는가?
- frontPaw/rearPaw/bellyGround가 허용 오차 안에 있는가?
- safeBox 안에 들어오는가?
- 같은 row 안에서 몸통 크기가 튀지 않는가?
- blueprint 임시 고양이와 다른 최종 모델로 보이는가?
- 앱 배경 4종에서 윤곽이 읽히는가?

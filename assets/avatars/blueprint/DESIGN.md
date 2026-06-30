# Cat Avatar Blueprint Design And Handoff

Last updated: 2026-06-30

이 문서는 모든 냥이 real 에셋이 따라야 하는 공통 청사진의 제작 기준, 기술 구조, 명령, 행동 명칭, 행동 플로우, 검증 기준을 한곳에 모은 인수인계 문서다. 나중에 다른 세션에서 이어서 작업할 때는 먼저 이 파일과 `manifest.json`을 읽고 시작한다.

## 1. 목적과 현재 범위

아바타 청사진의 목적은 북리더 하단 lane에서 독서 흐름을 방해하지 않으면서 살아 있는 느낌을 주는 고양이 아바타의 공통 행동 계약을 제공하는 것이다.

현재 범위:

- 모든 냥이가 공유할 V2 셀 규격, 기준선, 신체 크기, 행동 ID, 상태 그래프를 확정했다.
- 테스트용 플레이그라운드 `assets/avatars/blueprint/playground.html`에서 모든 임시 행동을 버튼으로 즉시 테스트할 수 있다.
- 임시 production sheet는 PIL 기반 생성 스크립트로 만들고 있다.
- V1 192px 시트와 콘셉트 이미지는 V2 런타임에서 사용하지 않는다.
- 앱 뷰어 본체 연결, 텍스트 지형 인식, `assets/avatars/real/<cat>/` 실제 고양이 비주얼 제작은 다음 단계다.

현재 완료 상태:

- `manifest.json`: `blueprint-complete`
- clips: 24개
- transitions: 11개
- 총 테스트 가능한 runtime action: 35개
- playground는 V2 manifest를 읽고 동적 행동 버튼/시트 버튼/행동표를 만든다.

## 2. Source Of Truth

아바타 관련 기준의 우선순위는 다음과 같다.

1. `assets/avatars/blueprint/manifest.json`
2. `assets/avatars/blueprint/DESIGN.md`
3. `scripts/validate-cheese-v2.py`
4. `scripts/verify-pet-playground-v2.py`
5. `assets/avatars/blueprint/playground.html`
6. `scripts/build-cheese-v2-*.py`

V1 경로는 참고용이다. V2 런타임, 테스트, 문서에서는 아래 V1 흔적이 나오면 안 된다.

- `assets/avatars/cheese/sprites`
- `assets/avatars/concepts`
- `cheese-cat-polished`
- `sitProduction`
- `dragProduction`
- `fallProduction`
- `landProduction`

## 3. 파일 구조

| 파일 | 역할 |
|---|---|
| `assets/avatars/blueprint/DESIGN.md` | 이 문서. 제작/기술/행동/명령 인수인계 기준 |
| `assets/avatars/blueprint/manifest.json` | blueprint와 real 에셋이 공유해야 하는 클립/시트/상태 그래프 계약 |
| `assets/avatars/blueprint/body-guide.png` | 신체 크기, groundY, safeBox, landmark 기준 이미지 |
| `assets/avatars/blueprint/reference-sheet.png` | 대표 포즈 기준 시트 |
| `assets/avatars/blueprint/sprites/*.png` | production draft 투명 셀 시트 |
| `assets/avatars/blueprint/sprites/*preview*.png` | 표시 크기별 프리뷰 |
| `assets/avatars/blueprint/sprites/*animated-preview.gif` | 동작 확인용 GIF |
| `scripts/build-cheese-v2-guides.py` | body guide/reference sheet 생성 |
| `scripts/build-cheese-v2-sit.py` | 앉기 계열, 졸림, 코방울, 깜짝 기상 생성 |
| `scripts/build-cheese-v2-basic-motions.py` | 서기, 걷기, 눕기, 잠, 기본 전환 생성 |
| `scripts/build-cheese-v2-interactions.py` | 화들짝, 목덜미 드래그, 낙하, 착지 생성 |
| `scripts/validate-cheese-v2.py` | manifest와 이미지 규격 검증 |
| `scripts/verify-pet-playground-v2.py` | playground가 V2 계약을 지키는지 검증 |
| `assets/avatars/blueprint/playground.html` | 테스트 페이지와 현재 런타임 프로토타입 |

## 4. 핵심 제작 규격

V2는 처음부터 고정 셀, 고정 기준선, 고정 신체 스케일, 행동 연결 그래프를 기준으로 제작한다. 콘셉트 이미지를 나중에 잘라 쓰는 방식은 사용하지 않는다.

| 항목 | 값 |
|---|---:|
| cellWidth | 320 |
| cellHeight | 320 |
| anchorX | 160 |
| groundY | 270 |
| safeBoxX | 20 |
| safeBoxY | 10 |
| safeBoxWidth | 280 |
| safeBoxHeight | 260 |
| edgePadding | 8 |
| 기본 앱 표시 크기 | 72px |
| 허용 표시 크기 | 64px - 80px |

중요한 해석:

- 셀 하단 전체가 땅이 아니다.
- `groundY=270`이 땅 기준선이다.
- `groundY` 아래 50px은 그림자, 안티앨리어싱, 착지 압축, 꼬리 여유 공간이다.
- 정지, 앉기, 서기, 걷기, 눕기, 잠, 착지 후 회복은 접지점이 `groundY`에 맞아야 한다.
- 낙하 중인 `fall.loop`만 공중 상태가 허용된다.
- `fall_to_land`, `land.recover`, `land_to_sit`는 groundY 접지가 유지되어야 한다.

## 5. 신체 크기와 Landmark

모든 행동에서 같은 고양이로 보여야 하므로 신체 비율은 고정한다. 행동마다 고양이를 셀에 맞추려고 확대/축소하지 않는다.

| 부위 | 기준 |
|---|---|
| bodyLength | 옆모습 기준 약 132px |
| bodyHeight | 서기 기준 약 70px |
| headWidth | 약 62px |
| headHeight | 약 58px |
| legLength | 서기 기준 약 50px |
| tailLength | 기본 약 96px, 최대 약 132px |
| tailThickness | 기본 10px - 14px |
| earHeight | 약 20px |

필수 landmark:

| landmark | 의미 | 기준 |
|---|---|---|
| `anchor` | 재생 위치 기준점 | `{ x: 160, y: 270 }` |
| `frontPaw` | 앞발 접지점 | sit/stand/walk에서 `groundY ±2px` |
| `rearPaw` | 뒷발 접지점 | sit/stand/walk에서 `groundY ±2px` |
| `bellyGround` | 누운 자세의 배/몸 접지점 | lie/sleep에서 `groundY ±2px` |
| `bodyCenter` | 몸통 중심 | idle 루프 흔들림 `±3px` 이내 |
| `headCenter` | 머리 중심 | 표정/고개 움직임 기준 |
| `tailBase` | 꼬리 시작점 | 몸통과 항상 연결되어야 함 |
| `tailTip` | 꼬리 끝 | safeBox 안쪽 유지 |
| `scruffPoint` | 목덜미 잡힘 지점 | drag 손 위치와 연결 |

대표 포즈:

- `stand.front`, `stand.side`, `stand.back`
- `sit.front`, `sit.side`, `sit.back`
- `lie.side`
- 최대 가로 포즈: 앞발 쭉 + 몸통 + 꼬리 쭉
- 최대 세로 포즈: 서기 + 꼬리 세움
- `drag.scruff`: 목덜미 잡힘 + 몸 늘어짐

## 6. 시트 제작 규칙

시트 규칙:

- 한 파일은 하나의 큰 행동 또는 전환 묶음을 가진다.
- 한 row는 하나의 세부 행동 clip이다.
- column은 해당 clip의 frame이다.
- 셀 하나는 항상 `320x320`이다.
- production sheet는 투명 PNG여야 한다.
- 코방울, 놀람선 같은 작은 효과는 별도 이펙트 레이어가 아니라 해당 clip frame 안에 포함한다.
- 빈 column은 있어도 되지만, manifest의 `frames` 안에 포함된 frame은 비어 있으면 안 된다.

고품질 에셋으로 교체할 때도 다음은 바꾸지 않는다.

- cell size
- row index
- clip id
- entryPose/exitPose
- anchor
- groundY
- runtime action id

바꿔도 되는 것:

- 실제 고양이 그림 품질
- 도트 밀도
- 디테일 프레임 형태
- 같은 `frames` 수 안에서의 포즈 세밀도
- 필요하면 manifest 검증을 통과하는 조건에서 `fps` 조정

## 7. 현재 시트 목록

| sheet | path | rows x cols | stage | 포함 clip |
|---|---|---:|---|---|
| `sit` | `sprites/sit.png` | 9 x 8 | foundation-complete | `sit.idle`, `sit.tail_sway`, `sit.blink`, `sit.drowsy`, `sit.ear_twitch`, `sit.paw_tidy`, `sit.sleep`, `sit.nose_bubble`, `sit.alert_wake` |
| `stand` | `sprites/stand.png` | 1 x 6 | basic-complete | `stand.idle` |
| `walk` | `sprites/walk.png` | 5 x 8 | basic-complete | `walk.start`, `walk.loop`, `walk.stop`, `walk.turn` |
| `lie` | `sprites/lie.png` | 3 x 8 | basic-complete | `lie.idle`, `lie.tail_tip`, `lie.push_react` |
| `sleep` | `sprites/sleep.png` | 1 x 8 | basic-complete | `sleep.breathe` |
| `alert` | `sprites/alert.png` | 3 x 6 | interaction-complete | `stand.look`, `alert.touch`, `alert.walk_touch` |
| `drag` | `sprites/drag.png` | 1 x 8 | interaction-complete | `drag.scruff_sway`, `drag_release` |
| `fall` | `sprites/fall.png` | 1 x 6 | interaction-complete | `fall.loop` |
| `land` | `sprites/land.png` | 1 x 8 | interaction-complete | `land.recover` |
| `transitions` | `sprites/transitions.png` | 11 x 8 | basic-complete | `sit_to_stand`, `stand_to_sit`, `stand_to_walk`, `walk_to_stand`, `sit_to_lie`, `lie_to_sit`, `lie_to_sleep`, `sleep_to_lie`, `fall_to_land`, `land_to_sit` |

주의: `drag_release`는 `drag` sheet row 0의 첫 frame을 1 frame transition으로 사용한다. `fall_to_land`는 착지 충격 전환이므로 `transitions` sheet row 9를 사용하고, `land.recover`는 착지 후 회복 행동으로 `land` sheet row 0을 사용한다.

## 8. 명칭 규칙

명칭은 manifest clip id와 runtime action id가 같아야 한다.

큰 행동 안의 세부 행동:

- 형식: `<state>.<detail>`
- 예: `sit.tail_sway`, `lie.push_react`, `alert.walk_touch`

자세 전환:

- 형식: `<from>_to_<to>`
- 예: `sit_to_stand`, `land_to_sit`

상호작용:

- 터치, 페이지 넘김, 드래그, 낙하는 명확한 상황 이름을 쓴다.
- walking 중 터치는 `alert.walk_touch`를 쓴다.
- 정면 보고 놀람은 `alert.touch`를 쓴다.
- 누워 있을 때 옆구리 터치 반응은 `lie.push_react`를 쓴다.

금지:

- `idle`, `blink`, `walkAlert`, `pageAlert`, `landToSit`처럼 manifest와 다른 별칭을 UI에 노출하지 않는다.
- `hiden` 같은 오타 명칭은 금지한다. runtime-only 숨김 테스트는 `hidden`만 허용한다.

## 9. 전체 행동표

| action id | 의미 | 현실적인 고양이 행동 의도 | sheet row | frames/fps | loop | entry -> exit |
|---|---|---|---:|---:|---|---|
| `sit.idle` | 기본 앉기 | 독서 중 방해하지 않는 기본 대기. 몸통 호흡만 작게 움직인다. | `sit:0` | 6/5 | pingpong | `sit.front -> sit.front` |
| `sit.tail_sway` | 앉아서 꼬리 흔들기 | 편안하지만 주변을 의식하는 꼬리 움직임. 과격하면 안 된다. | `sit:1` | 6/5 | pingpong | `sit.front -> sit.front` |
| `sit.blink` | 눈 깜박임 | 짧은 생명감. idle 사이에 자주 섞는다. | `sit:2` | 4/8 | once | `sit.front -> sit.front` |
| `sit.drowsy` | 졸림 | 장시간 같은 페이지에서 눈꺼풀이 내려가고 고개가 살짝 처진다. | `sit:3` | 8/4 | pingpong | `sit.front -> sit.front` |
| `sit.ear_twitch` | 귀 까딱 | 작은 소리에 반응하듯 한쪽 귀가 움직인다. | `sit:4` | 4/8 | once | `sit.front -> sit.front` |
| `sit.paw_tidy` | 앞발 정리 | 앞발을 살짝 들어 정리하는 귀여운 세부 행동. | `sit:5` | 8/6 | once | `sit.front -> sit.front` |
| `sit.sleep` | 앉아서 잠 | 졸림 이후 짧게 잠든 상태. 완전 누운 잠과 구분한다. | `sit:6` | 6/4 | pingpong | `sit.front -> sit.front` |
| `sit.nose_bubble` | 코방울 | 졸림 -> 잠 이후 코방울이 커졌다 터진다. | `sit:7` | 8/5 | once | `sit.front -> sit.front` |
| `sit.alert_wake` | 앉아서 놀라 깸 | 코방울 터짐 뒤 깜짝 깨면서 눈을 크게 뜬다. | `sit:8` | 6/8 | once | `sit.front -> sit.front` |
| `stand.idle` | 옆모습 서기 | 걷기 전후의 자연스러운 대기. 머리 방향은 이동 방향을 따라야 한다. | `stand:0` | 6/5 | pingpong | `stand.side -> stand.side` |
| `stand.look` | 정면 보고 서기 | 페이지 넘김/터치 놀람 전후에 정면을 보는 기본 자세. | `alert:0` | 6/5 | pingpong | `stand.front -> stand.front` |
| `walk.start` | 걷기 시작 | 남아 있지만 현재 자동 걷기 flow에서는 좌표 이동 전 제자리 걷기 방지를 위해 직접 쓰지 않는다. | `walk:0` | 6/8 | once | `stand.side -> walk.side` |
| `walk.loop` | 걷기 루프 | 좌표가 실제로 이동하는 동안만 재생한다. frame은 이동 거리 기반으로 동기화한다. | `walk:1` | 8/8 | forward | `walk.side -> walk.side` |
| `walk.stop` | 걷기 멈춤 | 목표 좌표나 화면 끝 도달 즉시 멈추고 서기로 이어진다. | `walk:2` | 6/8 | once | `walk.side -> stand.side` |
| `walk.turn` | 방향 전환 | 수동 테스트/테마 변경 등에서 방향 바꿈 확인용. | `walk:3` | 8/8 | once | `walk.side -> stand.side` |
| `lie.idle` | 빵굽기/엎드림 | 하단 lane에서 편안히 누워 쉬는 상태. | `lie:0` | 6/5 | pingpong | `lie.side -> lie.side` |
| `lie.tail_tip` | 누워서 꼬리 끝 까딱 | 쉬는 중 꼬리 끝만 아주 작게 반응한다. | `lie:1` | 6/5 | pingpong | `lie.side -> lie.side` |
| `lie.push_react` | 누운 상태 옆구리 밀림 | 고양이가 통처럼 X축으로 살짝 굴러 배가 보였다가 원래 옆모습으로 돌아온다. | `lie:2` | 8/10 | once | `lie.side -> lie.side` |
| `sleep.breathe` | 누워서 잠 | 완전히 누운 잠. 배 숨쉬기와 작은 꼬리 움직임 중심. | `sleep:0` | 8/4 | pingpong | `sleep.side -> sleep.side` |
| `alert.touch` | 정면 화들짝 | 정면 보고 서기 -> 정면 화들짝 -> 정면 보고 서기. 페이지 넘김에도 사용한다. | `alert:1` | 6/10 | once | `stand.front -> stand.front` |
| `alert.walk_touch` | 걷다가 화들짝 | 옆모습으로 걷다가 머리/표정만 정면 반응 후 `stand.look`로 정리한다. | `alert:2` | 6/10 | once | `walk.side -> stand.front` |
| `drag.scruff_sway` | 목덜미 잡힘 | 손이 목덜미를 잡고 몸과 꼬리가 좌우로 흔들린다. | `drag:0` | 8/7 | pingpong | `drag.scruff -> drag.scruff` |
| `fall.loop` | 낙하 루프 | 드래그 해제 후 groundY까지 떨어지는 동안 공중 자세로 반복된다. | `fall:0` | 6/10 | forward | `fall.air -> fall.air` |
| `land.recover` | 착지 회복 | groundY에서 웅크림, 충격 흡수, 몸 정리. | `land:0` | 8/10 | once | `land.crouch -> land.crouch` |
| `sit_to_stand` | 앉기 -> 서기 | 앉은 고양이가 일어나 옆모습 서기로 전환한다. | `transitions:0` | 6/8 | once | `sit.front -> stand.side` |
| `stand_to_sit` | 서기 -> 앉기 | 서기에서 다시 앉는다. | `transitions:1` | 6/8 | once | `stand.side -> sit.front` |
| `stand_to_walk` | 서기 -> 걷기 자세 | 이동 방향으로 머리를 돌리고 걷기 자세로 진입한다. | `transitions:2` | 4/8 | once | `stand.side -> walk.side` |
| `walk_to_stand` | 걷기 -> 서기 | 현재 자동 걷기 flow에서는 사용하지 않는다. 필요 시 수동/미래 전환용이다. | `transitions:3` | 4/8 | once | `walk.side -> stand.side` |
| `sit_to_lie` | 앉기 -> 눕기 | 앉은 상태에서 자연스럽게 엎드린다. | `transitions:4` | 8/7 | once | `sit.front -> lie.side` |
| `lie_to_sit` | 눕기 -> 앉기 | 엎드린 상태에서 몸을 세워 앉는다. | `transitions:5` | 8/7 | once | `lie.side -> sit.front` |
| `lie_to_sleep` | 눕기 -> 잠 | 누운 휴식이 완전 수면으로 깊어진다. | `transitions:6` | 5/6 | once | `lie.side -> sleep.side` |
| `sleep_to_lie` | 잠 -> 눕기 | 완전 수면에서 눈을 뜨기 전 누운 휴식으로 돌아온다. | `transitions:7` | 5/6 | once | `sleep.side -> lie.side` |
| `drag_release` | 목덜미 놓임 | 잡힌 자세에서 공중 낙하 자세로 넘어가는 1 frame 연결. | `drag:0` | 1/12 | once | `drag.scruff -> fall.air` |
| `fall_to_land` | 낙하 -> 착지 | 공중 낙하가 groundY에 닿는 순간의 충격 전환이다. | `transitions:9` | 4/12 | once | `fall.air -> land.crouch` |
| `land_to_sit` | 착지 -> 앉기 | 웅크린 착지 자세에서 앉기 기본 자세로 회복한다. | `transitions:10` | 8/9 | once | `land.crouch -> sit.front` |

## 10. 현실감 있는 행동 설계 원칙

북리더 아바타는 게임 캐릭터처럼 계속 큰 행동을 하면 안 된다. 독서 중에는 "작게 살아 있음"이 핵심이다.

조용한 독서 상태:

- 기본 pool은 `sit.idle`, `sit.tail_sway`, `sit.blink`, `sit.ear_twitch`다.
- 화면 아래에서 큰 이동 없이 작은 생명감만 준다.
- 꼬리, 귀, 눈 깜박임은 사용자의 시선을 본문에서 빼앗지 않을 정도로 작아야 한다.

장시간 같은 페이지:

- 일정 시간 같은 페이지에 머물면 `sit.drowsy` 확률을 올린다.
- 졸림이 길어지면 `sit.sleep`으로 이어질 수 있다.
- 더 오래 머물면 `sit.nose_bubble -> sit.alert_wake -> sit.blink -> sit.idle`로 귀여운 이벤트를 만든다.
- 누운 휴식으로 갈 때는 `sit_to_lie -> lie.idle -> lie.tail_tip` 순서를 쓴다.
- 완전 수면은 `lie_to_sleep -> sleep.breathe`로만 진입한다.

걷기:

- 좌표가 실제로 움직일 때만 `walk.loop`를 재생한다.
- `dt`는 시간 기반 좌표 이동에 쓰고, 걷기 frame은 `walkDistance` 기반으로 계산한다.
- 목표 좌표나 화면 끝에 도달하면 남은 시간이 있어도 `targetReached` 또는 `edgeReached` interrupt로 즉시 `walk.stop`에 들어간다.
- 자동 걷기 flow는 `walk.start`를 쓰지 않는다. 제자리 걷기처럼 보일 수 있기 때문이다.

터치:

- 기본 터치/페이지 넘김은 정면 flow를 쓴다.
- 걷기 중 터치는 `walk.loop -> alert.walk_touch -> stand.look`가 자연스럽다.
- 누워 있을 때 터치는 `lie.push_react`가 맞다. 머리와 꼬리가 흔들리는 것이 아니라, X축으로 몸 전체가 굴러 배가 보였다가 돌아오는 반응이다.

드래그와 드롭:

- 드래그는 목덜미 잡힘이다. 손, 목덜미, 늘어진 몸, 흔들리는 꼬리가 함께 보여야 한다.
- 위에서 놓으면 숨기지 않고 계속 보여야 한다.
- 낙하 중에는 `fall.loop`를 반복한다.
- groundY에 도착하면 `fall_to_land -> land.recover -> land_to_sit -> sit.idle`로 이어진다.

페이지 넘김:

- 페이지 넘김 시 아바타는 숨기지 않는다.
- flow는 `stand.look -> alert.touch -> stand.look`이다.
- 뷰어에서 설정, 이동, 북마크 같은 레이어가 떠도 아바타 canvas는 유지되어야 한다.

## 11. 주요 행동 Flow

조용한 독서:

```text
sit.idle
  -> sit.tail_sway
  -> sit.blink
  -> sit.ear_twitch
  -> sit.idle
```

장시간 대기 코방울:

```text
sit.drowsy
  -> sit.sleep
  -> sit.nose_bubble
  -> sit.alert_wake
  -> sit.blink
  -> sit.idle
```

걷기:

```text
sit_to_stand
  -> stand.idle
  -> stand_to_walk
  -> walk.loop  // 좌표 이동 중만
  -> walk.stop  // 목표 또는 화면 끝 도달 즉시
  -> stand.idle
  -> stand_to_sit
```

휴식:

```text
sit_to_lie
  -> lie.idle
  -> lie.tail_tip
  -> lie_to_sleep
  -> sleep.breathe
```

휴식 중 터치:

```text
lie.idle 또는 lie.tail_tip
  -> lie.push_react
  -> lie.idle
```

걷기 중 터치:

```text
walk.loop
  -> alert.walk_touch
  -> stand.look
  -> 이후 랜덤 행동
```

페이지 넘김/정면 화들짝:

```text
stand.look
  -> alert.touch
  -> stand.look
  -> 이후 랜덤 행동
```

드래그 후 드롭:

```text
drag.scruff_sway
  -> drag_release
  -> fall.loop
  -> fall_to_land
  -> land.recover
  -> land_to_sit
  -> sit.idle
```

금지 direct transition:

- `sleep.breathe -> walk.loop`
- `lie.idle -> jump`
- `walk.loop -> sleep.breathe`
- `sit.idle -> walk.loop`
- `drag.scruff_sway -> land.recover`

## 12. Playground 시각 QA

`assets/avatars/blueprint/playground.html`에는 `시각 QA` 버튼이 있다. 이 버튼은 real 제작 전 청사진 아바타의 행동 설계가 깨지지 않았는지 빠르게 보는 통합 재생 시퀀스다.

시각 QA 버튼이 재생하는 대표 흐름:

```text
sit.idle
  -> sit.tail_sway
  -> sit.blink
  -> sit.ear_twitch
  -> sit.paw_tidy
  -> sit.drowsy
  -> sit.sleep
  -> sit.nose_bubble
  -> sit.alert_wake
  -> sit.blink
  -> stand.look
  -> alert.touch
  -> stand.look
  -> sit_to_stand
  -> stand.idle
  -> stand_to_walk
  -> walk.loop
  -> walk.stop
  -> stand.idle
  -> stand_to_sit
  -> sit_to_lie
  -> lie.idle
  -> lie.push_react
  -> lie.tail_tip
  -> lie_to_sit
  -> fall.loop
  -> fall_to_land
  -> land.recover
  -> land_to_sit
  -> sit.idle
```

시각 QA 체크리스트:

- `sit` 계열은 하단 lane에서 조용하게 보여야 한다.
- `sit.drowsy -> sit.sleep -> sit.nose_bubble -> sit.alert_wake -> sit.blink`가 졸림, 잠, 코방울, 놀람, 깜빡 순서로 읽혀야 한다.
- `alert.touch`는 정면 보고 서기에서 시작하고 정면 보고 서기로 돌아와야 한다.
- `walk.loop`는 좌표 이동 중에만 보여야 하며 제자리 걷기처럼 보이면 실패다.
- 걷기 목표나 화면 끝에 도달하면 바로 `walk.stop -> stand.idle`로 이어져야 한다.
- `lie.push_react`는 좌우 흔들림이 아니라 X축 굴림처럼 배가 보였다가 옆모습으로 돌아와야 한다.
- drop 중에는 아바타가 사라지면 실패다.
- `fall_to_land -> land.recover -> land_to_sit`는 같은 ground 위치에서 이어져야 한다.
- 설정/이동/북마크 같은 viewer overlay가 떠도 avatar canvas는 유지되어야 한다.

개별 clip은 `행동 테스트` 패널에서 manifest에 있는 모든 action button으로 확인한다. 시트 단위 이미지는 `시트 보기`의 production sheet와 preview/GIF로 확인한다.

## 13. 행동 스케줄러

현재 playground는 `behaviorScheduler` 객체로 랜덤 행동 규칙을 관리한다. 이 규칙은 앱 뷰어로 옮길 때도 유지하는 것이 기본이다.

스케줄러 공통 규칙:

- action queue가 재생 중이면 랜덤 행동을 끼워 넣지 않는다.
- 드래그, 낙하, 숨김 상태에서는 랜덤 행동을 고르지 않는다.
- pageTurn, tap, dragStart, drop, targetReached, edgeReached 같은 interrupt가 랜덤 행동보다 우선한다.
- 걷기는 직접 `walk.loop`를 틀지 않고 `queueWalkSequence()`를 통해 `sit_to_stand -> stand.idle -> stand_to_walk -> walk.loop`로 들어간다.
- 코방울은 직접 `sit.nose_bubble`만 틀지 않고 `queueNoseBubbleSequence()`를 통해 졸림부터 재생한다.

현재 스케줄러 tier:

| tier | 조건 | 최소 유지 시간 | 후보 |
|---|---:|---:|---|
| `quietReading` | 페이지 대기 0초 이상 | 3.8초 | `sit.tail_sway` 4, `sit.blink` 3, `sit.ear_twitch` 2, `sit.paw_tidy` 1 |
| `pageIdle` | 페이지 대기 15초 이상 | 4.2초 | `sit.drowsy` 3, `sit.blink` 2, `sit.ear_twitch` 2, `sit.paw_tidy` 2, `walk` 1, `sit_to_lie` 1 |
| `longIdle` | 페이지 대기 45초 이상 | 5.2초 | `sit.drowsy` 3, `noseBubble` 2, `sit_to_lie` 2, `walk` 2, `sit.paw_tidy` 1, `sit.ear_twitch` 1 |
| `rest` | `lie.idle` 또는 `lie.tail_tip` 상태 | 5.2초 | `lie.tail_tip` 4, `lie_to_sleep` 2, `lie_to_sit` 1 |
| `sleep` | `sleep.breathe` 상태 | 9초 | `sleep_to_lie` |

가중치는 상대값이다. 예를 들어 `quietReading`에서 `sit.tail_sway` 4와 `sit.paw_tidy` 1은 꼬리 흔들기가 앞발 정리보다 약 4배 자주 선택된다는 뜻이다.

## 14. Runtime 구조

`assets/avatars/blueprint/playground.html`의 핵심 구조:

- `spriteManifest`: 같은 폴더의 `manifest.json`을 fetch해서 읽는다.
- `actions`: runtime action별 frame/loop/next 정보를 가진다.
- `actionSprites`: 현재는 `{}`다. runtime action id와 manifest clip id가 같기 때문이다.
- `activeClip()`: `spriteManifest.clips`와 `spriteManifest.transitions`에서 현재 action의 clip을 찾는다.
- `drawPet()`: 현재 action, frame, 방향, alpha에 맞춰 canvas에 sprite frame을 그린다.
- `queueActions()`: 행동 sequence를 예약한다.
- `requestInterrupt()`: tap, dragStart, drop, pageTurn, targetReached, edgeReached 같은 interrupt를 공통 처리한다.
- `resolveInterrupt()` / `applyPendingInterrupt()`: 현재 행동의 중단 가능 여부와 target action을 결정한다.
- `renderActionButtons()`: manifest의 clips/transitions로 테스트 버튼을 동적 생성한다.
- `renderSheetButtons()` / `renderCatalog()`: 시트 화면과 행동표를 manifest 기준으로 렌더링한다.

canvas 설계:

- 아바타 canvas는 viewer page content 안에 종속되면 안 된다.
- 페이지 넘김이나 viewer overlay가 생겨도 아바타 canvas는 unmount/hide 되면 안 된다.
- viewer 설정/목차/북마크/이동 레이어보다 유지되어야 하며, 필요 시 z-index만 조정한다.
- pointer 입력은 아바타 hit 영역에서만 처리하고, 본문 터치/스크롤을 과도하게 막지 않아야 한다.

## 15. Interrupt 정책

모든 행동은 공통 interrupt pipeline을 탄다. 특정 행동의 랜덤 지속 시간이 남아 있어도 조건이 발생하면 즉시 멈춰야 하는 경우가 있다.

대표 signal:

| signal | 의미 | 기본 결과 |
|---|---|---|
| `tap` | 사용자 터치 | 일반: `alert.touch`, 걷기: `alert.walk_touch`, 눕기: `lie.push_react` |
| `dragStart` | 사용자가 잡기 시작 | `drag.scruff_sway` |
| `drop` | 드래그 해제 | `fall.loop` 후 착지 sequence |
| `pageTurn` | 페이지 넘김 | `stand.look -> alert.touch -> stand.look` |
| `targetReached` | 걷기 목표 도달 | `walk.stop` |
| `edgeReached` | 화면 끝 도달 | `walk.stop` |

규칙:

- `pageTurn`은 global interrupt로 취급한다.
- 낙하/착지 계열은 `canInterrupt=false`다. 중간에 끊으면 위치가 튄다.
- `walk.loop`는 목표/끝 도달 시 즉시 `walk.stop`으로 끊긴다.
- `drag.scruff_sway`는 drop만 자연스러운 종료다.
- `hidden`은 runtime-only 테스트 action이다. 기본 V2 drop/pageTurn flow에는 쓰지 않는다.

## 16. 걷기 좌표 동기화

걷기는 시간만으로 frame을 넘기면 같은 자리에서 걷는 것처럼 보인다. 현재 방식은 좌표 이동과 보폭을 맞춘다.

핵심 함수:

- `resolveWalkTarget(target)`
- `faceWalkTarget(target)`
- `walkStridePixels()`
- `walkPixelsPerSecond()`
- `updateWalkFrameFromDistance(frameCount)`
- `isStableWalkStopFrame(frame, frameCount)`

원칙:

- `dt`는 이전 frame과 현재 frame 사이의 시간 차이다.
- `dt`로 이동할 픽셀 거리를 계산한다.
- 이동한 픽셀을 `pet.walkDistance`에 누적한다.
- animation frame은 `walkDistance % stride`에서 계산한다.
- 이동 방향이 정해지면 `sit_to_stand`, `stand.idle`, `stand_to_walk`부터 머리 방향이 목표 방향을 보게 한다.
- 목표나 화면 끝에 도달하면 `requestInterrupt("targetReached")` 또는 `requestInterrupt("edgeReached")`를 호출한다.

현재 자동 걷기 sequence:

```text
sit_to_stand
stand.idle
stand_to_walk
walk.loop
walk.stop
stand.idle
stand_to_sit
```

`walk.start`와 `walk_to_stand`는 남아 있지만 자동 걷기 flow에서는 제외한다.

## 17. Drop / Ground 연결 기준

드래그에서 놓은 뒤에는 화면에서 사라지지 않아야 한다. drop flow는 runtime 위치와 sprite pose가 같이 이어져야 한다.

정상 flow:

```text
drag.scruff_sway
drag_release
fall.loop
fall_to_land
land.recover
land_to_sit
sit.idle
```

구현 기준:

- 드래그 중에는 `clampDraggedPet()`로 화면 밖으로 완전히 나가지 않게 한다.
- drop 순간에는 현재 y를 유지하고 `fall.loop`를 시작한다.
- 낙하 중 y좌표는 물리/속도 값으로 ground lane까지 내려간다.
- groundY에 도달하면 sprite action을 `fall_to_land`로 넘긴다.
- `fall_to_land`의 모든 frame은 groundY보다 위에서 멈추면 안 된다.
- `land.recover`와 `land_to_sit`는 같은 ground position에서 이어져야 한다.
- `land_to_sit` 마지막 frame은 `sit.idle` 첫 frame과 위치/크기가 맞아야 한다.

이전에 발생했던 문제:

- V1 시트가 같이 보이며 animation이 이상하게 보였다.
- `fall_to_land`가 ground보다 위에서 멈춘 것처럼 보였다.
- `land.recover`, `land_to_sit`, `tail_sway`가 다른 위치에서 시작하는 것처럼 튀었다.
- drop release 순간 `hidden`이 끼어 아바타가 사라져 보였다.

현재 기준:

- V2만 사용한다.
- pageTurn/drop에서 아바타를 숨기지 않는다.
- drop 연결 검증은 `validate-cheese-v2.py`의 `validate_ground_contact_frames()`가 담당한다.

## 18. 제작 명령

PowerShell 기준 명령이다. workspace root는 `C:\workspace\durumari-app-v2`다.

가이드 이미지 생성:

```powershell
python scripts\build-cheese-v2-guides.py
```

앉기/졸림/코방울 계열 생성:

```powershell
python scripts\build-cheese-v2-sit.py
```

서기/걷기/눕기/잠/기본 전환 생성:

```powershell
python scripts\build-cheese-v2-basic-motions.py
```

상호작용/드래그/낙하/착지 생성:

```powershell
python scripts\build-cheese-v2-interactions.py
```

전체 임시 에셋 재생성 순서:

```powershell
python scripts\build-cheese-v2-guides.py
python scripts\build-cheese-v2-sit.py
python scripts\build-cheese-v2-basic-motions.py
python scripts\build-cheese-v2-interactions.py
```

검증:

```powershell
python scripts\validate-cheese-v2.py
python scripts\verify-pet-playground-v2.py
```

HTML script syntax 확인:

```powershell
$html = Get-Content -Raw assets\avatars\blueprint\playground.html
$script = [regex]::Match($html, '<script>([\s\S]*)</script>').Groups[1].Value
$env:PET_SCRIPT = $script
node -e "new Function(process.env.PET_SCRIPT); console.log('script syntax ok')"
```

테스트 서버:

```powershell
python -m http.server 8765
```

브라우저 URL:

```text
http://127.0.0.1:8765/assets/avatars/blueprint/playground.html
```

캐시 회피용 query를 붙여도 된다.

```text
http://127.0.0.1:8765/assets/avatars/blueprint/playground.html?check=YYYYMMDDHHMM
```

manifest와 action 버튼 수 일치 확인:

```powershell
@'
const fs = require('fs');
const manifest = JSON.parse(fs.readFileSync('assets/avatars/blueprint/manifest.json','utf8'));
const html = fs.readFileSync('assets/avatars/blueprint/playground.html','utf8');
const manifestIds = [...Object.keys(manifest.clips || {}), ...Object.keys(manifest.transitions || {})].sort();
const actionBody = html.match(/const actions = \{([\s\S]*?)\n    \};/)[1];
const actionIds = [...actionBody.matchAll(/\"([^\"]+)\"\s*:/g)].map(m => m[1]).filter(id => id !== 'hidden').sort();
const missing = manifestIds.filter(id => !actionIds.includes(id));
const extra = actionIds.filter(id => !manifestIds.includes(id));
console.log(JSON.stringify({manifest: manifestIds.length, actions: actionIds.length, missing, extra}, null, 2));
'@ | node -
```

정상 기대값:

```json
{
  "manifest": 35,
  "actions": 35,
  "missing": [],
  "extra": []
}
```

## 19. 검증 기준

이미지 검증:

- 모든 production sheet는 `320x320` 셀 배수여야 한다.
- sheet 크기는 manifest의 `rows * 320`, `cols * 320`과 정확히 일치해야 한다.
- PNG는 RGBA여야 한다.
- 셀 가장자리 8px 안에 불투명 픽셀이 있으면 실패한다.
- manifest `frames` 안의 셀은 비어 있으면 안 된다.

기준점 검증:

- `sit`, `stand`, `walk` 접지점은 `groundY ±2px` 안에 있어야 한다.
- `lie`, `sleep`은 `bellyGround`가 `groundY ±2px` 안에 있어야 한다.
- `fall_to_land`, `land.recover`, `land_to_sit`의 visible bottom은 groundY보다 위에서 끝나면 안 된다.
- idle 계열의 body center 흔들림은 작아야 한다.

연결 검증:

- `entryPose`와 이전 `exitPose`가 맞아야 한다.
- 연결 불가능한 경우 전환 clip을 삽입해야 한다.
- stateGraph adjacency에 없는 직접 전환은 금지한다.
- 루프 첫 frame과 마지막 frame이 튀면 실패한다.

시각 검증:

- `64px`, `72px`, `80px`에서 행동이 읽혀야 한다.
- 발 미끄러짐, 순간이동, 갑작스러운 크기 변화가 없어야 한다.
- drop 후 사라짐이 없어야 한다.
- pageTurn 후 숨김/복귀 동작이 끼면 실패다.

## 20. Real 아바타 제작 단계

현재 `assets/avatars/blueprint/` 이미지는 실제 앱 적용용이 아니라 행동 계약과 기준선을 검증하기 위한 청사진 시트다. 실제 고양이 비주얼은 `assets/avatars/real/<cat>/` 아래에 종류별로 만든다.

기본 구조:

```text
assets/avatars/
  blueprint/
    DESIGN.md
    manifest.json
    body-guide.png
    reference-sheet.png
    sprites/
  real/
    cheese/
      DESIGN.md
      manifest.json
      sprites/
```

real 제작 전에는 `assets/avatars/real/README.md`와 대상 고양이의 `assets/avatars/real/<cat>/DESIGN.md`를 먼저 읽는다.

real 제작은 아래 순서로 진행한다.

1. `body-guide.png`와 `reference-sheet.png` 기준으로 대상 냥이의 최종 외형을 확정한다.
2. `assets/avatars/real/<cat>/manifest.json`은 blueprint manifest의 action id, sheet id, row, frames, fps 계약을 그대로 따른다.
3. `sit.idle` 한 row만 먼저 실제 앱 적용 품질로 만든다.
4. 64/72/80px 표시에서 얼굴, 귀, 꼬리, 발이 읽히는지 검증한다.
5. `sit.idle`이 통과하면 같은 sheet의 `sit.tail_sway`, `sit.blink`, `sit.drowsy` 순서로 확장한다.
6. 한 sheet가 안정되면 다음 sheet로 넘어간다.
7. 모든 sheet를 한 번에 갈아엎지 않는다.
8. row/frame/clip id는 유지한다.
9. `validate-cheese-v2.py`와 playground 시각 검증을 모두 통과해야 한다.

real 에셋으로 바뀌어도 runtime이 바뀌면 안 되는 것:

- `manifest.json`의 ID 체계
- action button 생성 방식
- 상태 그래프
- 걷기 좌표 동기화
- interrupt pipeline
- drop ground 연결 규칙

real 제작자가 반드시 알아야 할 것:

- sprite는 셀 안에서 크게 그린 뒤 표시 시 64-80px로 줄인다.
- 줄여서 보여줄 때 디테일이 살아야 한다.
- 고양이가 아무 action에서나 다른 체형으로 보이면 실패다.
- 누움/드래그/최대 꼬리 길이까지 `safeBox`에 들어와야 한다.
- 드래그 손은 포함해도 되지만 고양이 신체 스케일이 바뀌면 안 된다.
- real 제작 세션은 `sit.idle` 한 row만 먼저 만들고 `시각 QA`, `행동 테스트`, `시트 보기`, validation을 모두 통과시킨 뒤 다음 row로 넘어간다.
- real 제작자는 스케줄러, interrupt, walk 좌표 동기화, drop ground 연결 규칙을 바꾸지 않는다.
- frame 수를 바꾸고 싶으면 먼저 manifest, playground actions, verify 스크립트를 함께 바꿔야 한다. 단순 이미지 교체 단계에서는 frame 수를 유지한다.
- real 결과물도 해당 냥이 폴더 안의 `sprites/*.png` 경로와 row index를 유지해야 한다.

## 21. 테마별 아바타 확장 원칙

앱 연결 시 설정에는 "고양이 아바타 선택" 섹션을 만들지 않는다. 설정은 on/off만 둔다.

테마별 고양이는 앱 테마가 자동으로 고른다.

원칙:

- 흰 배경/화이트 테마에서는 흰 고양이가 아니라 대비가 좋은 어두운 고양이가 맞다.
- 어두운 테마에서는 밝은 고양이나 치즈냥처럼 윤곽이 읽히는 팔레트를 쓴다.
- 테마별 고양이 4종을 만들더라도 blueprint manifest contract는 동일하게 유지한다.
- 다른 고양이도 `320x320`, `groundY=270`, `anchorX=160`, 같은 action id를 사용한다.
- 테마별 차이는 팔레트, 무늬, 얼굴 디테일, outline 대비에 한정한다.

## 22. 앱 뷰어 연결 시 주의사항

아직 앱 본체 연결은 하지 않았다. 연결할 때는 다음 원칙을 지켜야 한다.

뷰어 구조:

- 아바타 canvas는 page content와 분리된 viewer-level overlay로 둔다.
- 페이지 이동 시 page component가 교체되어도 avatar engine은 유지한다.
- 설정/목차/북마크/페이지 이동 레이어가 열려도 avatar canvas는 숨기지 않는다.
- avatar on/off는 설정에서 제어한다.
- theme 변경 시 cat asset set은 자동 결정한다.

성능:

- 아바타는 64-80px 표시 크기이므로 canvas draw 비용은 낮다.
- sprite sheet는 미리 로드한다.
- 매 frame마다 image를 새로 만들지 않는다.
- `requestAnimationFrame` 루프 안에서는 현재 frame crop/draw만 수행한다.
- pageTurn 같은 reader 동작과 avatar animation을 강하게 결합하지 않는다.

터치:

- avatar hit test는 아바타 bounding box 중심으로 한다.
- 본문 영역 전체를 막으면 안 된다.
- drag 중에는 pointer capture를 사용해 화면 위쪽까지 이동 가능하게 한다.
- drop 후에는 runtime y좌표에서 ground lane까지 자연스럽게 떨어진다.

## 23. 다음 세션 시작 체크리스트

다른 세션에서 이어서 할 때:

1. `AGENTS.md`를 읽는다.
2. Expo SDK 56 문서를 확인한다.
3. 이 문서를 읽는다.
4. `assets/avatars/blueprint/manifest.json`을 읽는다.
5. `python scripts\validate-cheese-v2.py`를 실행한다.
6. `python scripts\verify-pet-playground-v2.py`를 실행한다.
7. playground URL에서 `시각 QA`를 실행해 현재 동작을 눈으로 확인한다.
8. V1 경로나 V1 sprite가 섞여 있지 않은지 확인한다.
9. 변경은 한 action 또는 한 sheet 단위로만 한다.
10. 변경 후 validation과 playground verification을 다시 실행한다.

## 24. 현재 우선순위

기초 엔진/임시 행동은 끝까지 잡힌 상태다. 다음 큰 단계는 고품질 치즈냥 제작이다.

추천 순서:

1. `sit.idle` 고품질 row 제작
2. `sit.tail_sway`, `sit.blink`, `sit.drowsy` 고품질 제작
3. `stand.look`, `alert.touch`, `alert.walk_touch` 고품질 제작
4. `drag.scruff_sway`, `fall.loop`, `fall_to_land`, `land.recover`, `land_to_sit` 고품질 제작
5. `walk.loop`, `walk.stop`, `stand_to_walk` 보폭/좌표 재검증
6. 앱 뷰어 연결
7. 테마별 고양이 4종 확장

이 순서를 지키는 이유는 사용자가 가장 자주 보게 되는 행동이 `sit`, `alert`, `drop`, `walk` 순서이기 때문이다. 고품질 제작도 이 순서로 가면 검증 비용이 낮고, 문제가 생겼을 때 원인을 분리하기 쉽다.

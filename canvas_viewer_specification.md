# 두루마리(Durumari) React Native UI + 캔버스 뷰어 전환 공수 및 설계 분석서

구글 드라이브 연동을 배제하고 **인트로, 폴더 목록(로컬 폴더 스캔), 히스토리, 책갈피, 설정 메뉴**로 기능 범위를 압축한 상태에서, 전체 UI를 **React Native**로 작성하고 뷰어만 **캔버스**로 구현하는 아키텍처의 현실적인 개발 소요 기간 및 난이도를 분석합니다.

---

## 1. 아키텍처 선택에 따른 개발 공수 및 위험도 비교

React Native(RN)로 UI를 전부 구성할 때, **캔버스 뷰어를 어떻게 구현하느냐**에 따라 개발 기간이 4배 이상 차이 나게 됩니다. 이에 대한 두 가지 구체적 경로를 제시합니다.

### 💡 [추천] 모델 A: 하이브리드 네이티브 모델
> **UI 및 파일 시스템 제어는 100% React Native로 개발하고, 뷰어 영역만 풀스크린 WebView 내 HTML5 Canvas를 사용하는 방식**

* **구조**: UI(네이티브 스크롤, 네이티브 메뉴 및 탭) $\rightarrow$ WebView 컨테이너 $\rightarrow$ HTML5 Canvas 렌더링.
* **난이도**: **보통 (3단계)**
* **예상 소요 시간**: **약 2주 ~ 3주** (1인 개발 기준)
* **상세 분석**:
  * 기존 `TextReader.tsx`에 작성된 `glyphWidth` 자간 연산 알고리즘과 `paginateInline` 페이징 코드를 **100% 재사용**할 수 있습니다.
  * 뷰어 화면을 그릴 때 기기 내장 브라우저 엔진의 풍부한 텍스트 셰이핑(텍스트 측정 및 한글/영어 폰트 로드) 성능을 그대로 쓰기 때문에, 텍스트가 깨지거나 기기별로 레이아웃이 엇나가는 버그가 발생하지 않습니다.
  * 사용자가 느끼는 앱의 겉모습(폴더 목록, 히스토리, 설정 패널)은 React Native 네이티브 UI이기 때문에 **로딩 속도가 즉각적이고 스크롤이 극도로 부드럽습니다.**

---

### ⚠️ [비추천] 모델 B: 100% 완전 네이티브 모델
> **UI는 React Native로 짜고, 뷰어 캔버스도 React Native Skia (`@shopify/react-native-skia`) 또는 네이티브 그래픽 모듈로 바닥부터 구현하는 방식**

* **구조**: UI(RN) $\rightarrow$ React Native Skia Canvas $\rightarrow$ Skia Paragraph API로 직접 텍스트 드로잉.
* **난이도**: **매우 높음 (5단계 - C++ 네이티브 빌드 트러블슈팅 필요)**
* **예상 소요 시간**: **최소 2개월 ~ 3개월 이상**
* **상세 분석**:
  * **텍스트 엔진 재개발의 한계**: React Native Skia의 C++ `ParagraphBuilder` 엔진은 한글 단어 줄바꿈(Word Wrapping), 자간(`letter-spacing`) 누적 연산, 폰트 패밀리 동적 적용 시 엄청난 파편화와 메모리 누수 위험이 있습니다.
  * 기존에 완성도 높게 짜여 있던 JS 기반 페이징 코드(`paginateInline`)를 Skia API에 맞춰 전부 네이티브 좌표 연산 코드로 새로 설계해야 합니다.
  * 빌드 과정에서 C++ 라이브러리 결합으로 인해 Gradle 빌드 에러 및 Android NDK 버전 충돌이 빈번하게 발생하여 디버깅 시간이 기하급수적으로 증가합니다.

---

## 2. 기존 두루마리 기능의 React Native 이식 난이도 (구글 드라이브 제외)

구글 드라이브가 제외되면서 데이터 파이프라인이 대폭 단순해져 UI 포팅 난이도는 매우 낮아진 상태입니다.

```
[ 기존 Web ]  FileSystem API / Web Storage 
                     ▼
[ RN 포팅 ]   Expo FileSystem / AsyncStorage / SQLite (동등 매핑)
```

| 기능 모듈 | 기존 구현 방식 (React Web) | React Native 포팅 방식 및 난이도 | 예상 공수 |
| :--- | :--- | :--- | :--- |
| **인트로 & 로딩** | React State + CSS 애니메이션 | `expo-splash-screen` 활용 네이티브 구현 (쉬움) | 1일 |
| **폴더 목록 / 스캔** | `showDirectoryPicker()` (Web API) | `expo-file-system` 및 `document-picker` 연동 (보통) | 3~4일 |
| **히스토리 & 책갈피** | 로컬 스토리지 / IndexedDB | `AsyncStorage` 또는 가벼운 `expo-sqlite`로 매핑 (쉬움) | 2일 |
| **설정 메뉴** | React UI + CSS Variables | React Native StyleSheet 및 Context State 연동 (쉬움) | 2~3일 |
| **뷰어 (모델 A 채택)** | 기존 `TextReader.tsx` DOM 출력 | `react-native-webview` 내 HTML5 Canvas 연동 (보통) | 5일 |
| **총합 개발 기간** | | **UI 포팅 및 뷰어 캔버스화 연동 완료까지 약 2주 ~ 3주 소요** | |

---

## 3. 하이브리드 네이티브 모델(모델 A) 상세 통신 설계

React Native UI와 웹뷰 내 캔버스 뷰어가 안전하고 신속하게 데이터를 주고받는 통신 스펙입니다.

```
+------------------------------------------+
|            React Native UI               |
|  - 책갈피 추가 버튼 클릭                   |
|  - 설정(FontSize: 20px) 변경             |
+------------------------------------------+
                     │  WebView.postMessage(JSON)
                     ▼
+------------------------------------------+
|       react-native-webview Container     |
+------------------------------------------+
                     │
                     ▼
+------------------------------------------+
|        HTML5 Canvas Viewer Engine        |
|  - paginateInline() 재실행                |
|  - 캔버스 클리어 및 재드로잉               |
|  - 현재 CFI 및 진행률 계산                 |
+------------------------------------------+
                     │  window.ReactNativeWebView.postMessage(JSON)
                     ▼
+------------------------------------------+
|            React Native UI               |
|  - 히스토리 갱신 (Progress 반영)          |
|  - 현재 페이지 정보 상태 업데이트           |
+------------------------------------------+
```

1. **설정 및 데이터 전달 (RN $\rightarrow$ WebView)**:
   * 사용자가 RN의 설정 패널에서 폰트 크기나 줄간격을 바꾸면, RN은 웹뷰 인스턴스에 JSON 메시지를 전달합니다.
   * `webViewRef.current.postMessage(JSON.stringify({ type: "UPDATE_SETTINGS", settings }))`
   * 웹뷰 내 캔버스 엔진은 메시지를 받아 `paginateInline`을 돌려 페이지 위치를 즉시 재계산하고 다시 그립니다.
2. **독서 진행 상황 피드백 (WebView $\rightarrow$ RN)**:
   * 사용자가 캔버스를 터치해 페이지를 넘기면 캔버스는 페이지 위치 변화를 감지하고 RN 측으로 이벤트를 보냅니다.
   * `window.ReactNativeWebView.postMessage(JSON.stringify({ type: "PAGE_CHANGED", progress, cfi, pageInfo }))`
   * RN은 전달받은 `progress`와 `pageInfo`를 사용해 네이티브 히스토리 데이터베이스(Storage)를 즉시 업데이트합니다.

---

## 4. 최종 판단 및 제안

* **이미 기존 설계(UI 구성 및 상태 흐름)가 React Web 기반으로 잘 정의되어 있으므로**, UI 부분을 React Native 코드로 옮기는 것은 **오래 걸리지 않습니다 (약 2주 내외 완료 가능).**
* 그러나 **안정성과 속도**를 모두 쥐기 위해서는 **"UI는 100% React Native로 개발하되, 뷰어 캔버스는 웹뷰 내부의 HTML5 Canvas를 사용하는 하이브리드 방식(모델 A)"**을 취하셔야 합니다.
* 만약 뷰어 내부의 캔버스마저 네이티브 Skia로 넘어가게 되면, 텍스트 줄바꿈 계산 및 폰트 셰이핑 버그를 잡는 데만 **수개월의 지연**이 발생할 수 있습니다. 

따라서 **모델 A(RN UI + HTML5 Canvas WebView)**를 강력히 권장하며, 이 구조라면 높은 안정성과 부드러운 속도를 확보하면서도 빠른 시일 내에 개발을 완료할 수 있습니다.

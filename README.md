# 두루마리 v2

두루마리 v2는 긴 한글 텍스트 문서를 모바일에서 편하게 읽기 위한 Expo 기반 전자책/문서 뷰어입니다. Android에서는 SAF(Storage Access Framework)로 폴더를 연결하고, 문서 목록과 읽기 상태를 로컬 SQLite에 저장합니다.

## 주요 기능

- 폴더 단위 문서 가져오기 및 라이브러리 관리
- 제목 검색, 정렬, 읽기 상태별 색상 표시
- 읽기 이력과 책갈피 관리
- Canvas/WebView 기반 장문 텍스트 뷰어
- 페이지 이동, 목차 이동, 책갈피 이동
- 터치, 스와이프, 볼륨 키 기반 페이지 넘김
- 글꼴, 글자 크기, 줄 간격, 자간, 여백, 굵기 조정
- 라이트, 다크, 종이, 칠판 테마
- UTF-8, EUC-KR, CP949, UTF-16 인코딩 재선택
- EPUB/ZIP/TXT 계열 문서 텍스트 추출 및 캐싱

## 기술 스택

- Expo SDK 56
- React Native 0.85
- React 19
- TypeScript
- expo-sqlite
- expo-file-system
- expo-document-picker
- react-native-webview
- react-native-pager-view
- Jest / jest-expo

## 요구 사항

- Node.js
- npm
- Android Studio 및 Android SDK
- Android 기기 또는 에뮬레이터

Expo SDK 56 기준 문서는 다음 버전을 확인합니다.

- https://docs.expo.dev/versions/v56.0.0/

## 설치

```bash
npm install
```

## 개발 실행

개발 서버를 시작합니다.

```bash
npm start
```

Android 네이티브 빌드로 실행합니다.

```bash
npm run android
```

웹 환경에서 확인합니다.

```bash
npm run web
```

## 테스트

```bash
npm test
```

## APK 빌드

릴리스 APK를 생성하고 루트 경로의 `durumari-app-release.apk`로 복사합니다.

```bash
npm run build:apk
```

빌드 결과 원본 경로는 다음과 같습니다.

```text
android/app/build/outputs/apk/release/app-release.apk
```

## 프로젝트 구조

```text
.
├── App.tsx
├── index.ts
├── app.json
├── android/
├── assets/
├── plugins/
└── src/
    ├── components/
    ├── contexts/
    ├── lib/
    ├── screens/
    ├── viewer/
    └── types.ts
```

## 주요 디렉터리

- `src/screens`: 라이브러리, 읽기 이력, 책갈피, 뷰어 화면
- `src/components`: 설정 모달, 탭 페이저, Canvas 리더, 공통 화면 컴포넌트
- `src/lib`: SQLite 저장소, 설정, 문서 가져오기, SAF 폴더 연동
- `src/viewer`: WebView 안에서 실행되는 Canvas 기반 뷰어 HTML과 테스트
- `plugins`: Expo config plugin
- `assets/fonts`: 앱에 포함되는 한글 글꼴

## 데이터와 권한

- 문서 메타데이터, 읽기 위치, 책갈피, 설정은 기기 로컬 SQLite에 저장됩니다.
- Android에서는 폴더 접근 권한을 SAF로 획득합니다.
- 앱에서 폴더 연결을 해제해도 원본 파일은 삭제되지 않습니다.
- 권한이 만료되거나 폴더가 이동되면 다시 연결해야 할 수 있습니다.

## 참고

현재 앱은 Android 사용 흐름을 중심으로 구성되어 있습니다. iOS와 웹 실행 스크립트는 제공되지만, 폴더 접근 방식과 일부 네이티브 기능은 플랫폼에 따라 다르게 동작할 수 있습니다.

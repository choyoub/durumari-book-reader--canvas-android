# 두루마리 뷰어 핵심 개발 설계서

이 문서는 현재 앱을 기준으로 클론 앱을 새 프로젝트에서 재구현할 때 필요한 핵심 구조, 데이터 모델, 주요 로직, 기능 계약을 정리한 개발 설계서입니다. UI 디테일보다 앱이 동작하기 위해 반드시 유지해야 하는 흐름과 상태 설계를 중심으로 설명합니다.

## 1. 제품 개요

두루마리 뷰어는 Android 로컬 저장소의 텍스트 계열 문서를 폴더 단위로 등록하고, 긴 한글 문서를 모바일에서 페이지 단위로 읽게 해주는 전자책/문서 뷰어입니다.

핵심 목표는 다음과 같습니다.

- 로컬 폴더를 등록하면 지원 문서 목록을 빠르게 만든다.
- 실제 본문 파싱은 문서를 열 때 지연 처리해서 큰 라이브러리에서도 앱이 가볍게 동작한다.
- 읽던 위치, 완독 상태, 책갈피, 설정을 기기 로컬에 저장한다.
- 앱이 뷰어에서 종료되면 다음 실행 시 인트로 중에 마지막 책을 미리 로딩하고, 인트로 종료 후 바로 뷰어를 보여준다.
- 글꼴, 여백, 줄간격, 테마, 페이지 넘김 방식이 바뀌어도 읽던 위치와 책갈피가 최대한 유지된다.

## 2. 기술 스택

- Expo SDK 56
- React Native 0.85 / React 19
- TypeScript
- expo-sqlite: 문서 메타데이터, 읽기 기록, 책갈피 저장
- AsyncStorage: 앱 설정, 마지막 뷰어 세션 저장
- expo-file-system: SAF URI 파일 읽기
- expo-document-picker: 비 Android 환경 또는 파일 직접 가져오기
- react-native-webview: Canvas 기반 뷰어 실행
- JSZip / pako / iconv-lite: EPUB, ZIP, GZ, 한글 인코딩 처리

Android 중심 앱이며, 클론 앱도 Android를 1차 타깃으로 잡는 것이 가장 안전합니다.

## 3. 최상위 아키텍처

```text
App.tsx
  AppProvider
    AppContent
      Boot / Intro
        initStore
        loadSettings
        rescanFolders
        restoreLastViewerIfNeeded
      Main Tabs
        LibraryScreen
        HistoryScreen
        BookmarksScreen
      ViewerRestoreLoader
        ViewerScreen
          CanvasReader
            WebView
              createCanvasHtml
```

역할은 다음처럼 나뉩니다.

- `App.tsx`: 앱 부팅, 인트로, 마지막 뷰어 복원, 탭/설정 모달 라우팅.
- `src/contexts/AppContext.tsx`: 전역 상태와 도메인 액션 제공.
- `src/lib/store.ts`: SQLite/AsyncStorage 영속화 계층.
- `src/lib/safImport.ts`: Android SAF 폴더 권한, 폴더 스캔, 파일 바이트 읽기.
- `src/lib/documentImport.ts`: 문서 바이트를 텍스트와 목차로 변환.
- `src/lib/viewerDocument.ts`: 뷰어 진입 시 문서 본문을 가져오는 공통 로더.
- `src/screens/ViewerScreen.tsx`: 뷰어 UI, 로딩 상태, 읽기/책갈피 저장, 메뉴.
- `src/components/CanvasReader.tsx`: RN과 WebView 사이 브리지.
- `src/viewer/canvasHtml.ts`: 실제 페이지 계산, Canvas 렌더링, 페이지 넘김 처리.

## 4. 데이터 모델

### 4.1 FolderRecord

폴더 단위 라이브러리의 루트입니다.

```ts
interface FolderRecord {
  folderId: string;
  treeUri: string;
  displayName: string;
  createdAt: number;
  lastSyncedAt?: number;
  permissionStatus: "granted" | "required" | "failed";
}
```

중요 규칙:

- Android는 `treeUri`에 SAF directory URI를 저장합니다.
- 권한이 만료되거나 폴더 접근에 실패하면 `permissionStatus`를 `required`로 바꿔 목록에 경고 표시를 합니다.
- 폴더 연결 해제 시 원본 파일은 삭제하지 않고, 앱 내부 DB 레코드만 삭제합니다.

### 4.2 DocumentRecord

목록에 표시되는 문서 메타데이터입니다.

```ts
interface DocumentRecord {
  documentId: string;
  folderId: string;
  sourceUri: string;
  archiveEntryPath?: string;
  title: string;
  kind: "txt" | "epub" | "zip" | "gz";
  fileSize: number;
  modifiedAt: number;
  contentHash: string;
  text?: string;
  toc?: { label: string; href: string; charOffset: number }[];
  textEncoding?: string;
  textEncodingSource?: "auto" | "manual";
  detectedTextEncoding?: string;
}
```

중요 규칙:

- 목록 조회 시에는 `text` 컬럼을 제외합니다. 큰 문서가 많을 때 OOM을 피하기 위함입니다.
- `text`와 `toc`는 뷰어 진입 시에만 로딩하거나 캐시합니다.
- `documentId`는 폴더, 파일명, 크기/해시를 조합해 만들며, 폴더 재스캔 시 동일 문서 식별에 사용합니다.
- `detectedTextEncoding`은 원본 바이트에서 자동 감지한 인코딩입니다.
- `textEncoding`은 현재 뷰어 본문에 실제 적용된 인코딩입니다.
- `textEncodingSource`는 현재 적용 인코딩이 원본 감지값과 다른 경우 `manual`, 같으면 `auto`로 봅니다.
- EPUB처럼 사용자가 인코딩을 선택하지 않는 문서는 인코딩 값을 `not-applicable`로 취급합니다.

### 4.3 ReadingRecord

최근 읽은 위치와 진행률입니다.

```ts
interface ReadingRecord {
  documentId: string;
  lastPage: number;
  totalPages: number;
  progress: number;
  openedAt: number;
  completed: boolean;
  completedAt?: number;
  anchorOffset?: number | null;
}
```

중요 규칙:

- `lastPage`만 믿으면 글꼴/여백/줄간격 변경 후 위치가 틀어집니다.
- `anchorOffset`을 함께 저장해서 페이지 수가 바뀌어도 같은 텍스트 오프셋 근처로 복원합니다.
- Canvas 페이지 계산이 끝난 뒤 기존 `ReadingRecord`의 `totalPages` 또는 `anchorOffset`이 낡았으면 WebView가 `readingSynced` 메시지로 RN에 보정값을 보냅니다.

### 4.4 BookmarkRecord

책갈피입니다.

```ts
interface BookmarkRecord {
  bookmarkId: string;
  documentId: string;
  page: number;
  totalPages: number;
  progress: number;
  preview: string;
  createdAt: number;
  anchorOffset?: number | null;
}
```

중요 규칙:

- 책갈피도 `anchorOffset`을 저장합니다.
- 과거 데이터처럼 `anchorOffset`이 없으면 `preview`, `progress`, `page` 순서로 위치를 추정합니다.
- 책갈피 화면에서 항목을 열 때 `openDocument(document, { type: "bookmark", bookmarkId })`로 target을 전달합니다.

### 4.5 ReaderSettings

뷰어 설정과 목록 설정을 함께 저장합니다.

주요 필드:

- 현재 폴더: `activeFolderId`
- 뷰어 타이포그래피: `fontFamily`, `fontSize`, `isBold`, `lineHeight`, `letterSpacing`
- 여백: `paddingTop`, `paddingBottom`, `paddingLeft`, `paddingRight`, `paddingLinked`
- 페이지 넘김: `pageTurnTouch`, `pageTurnSwipe`, `volumeKeyPaging`, `pageTurnFeedback`, `pageTurnStyle`
- 화면: `theme`, `hideCompleted`
- 정렬: `librarySort`, `historySort`, `bookmarksSort`

설정은 AsyncStorage에 저장하고, 뷰어 설정 변경은 WebView에 `updateSettings` 메시지로 전달합니다.

### 4.6 기본 설정값

클론 앱에서는 아래 값을 최초 실행 기본값으로 사용합니다. 저장된 설정이 있으면 `defaultSettings` 위에 저장값을 merge해서 누락 필드가 있어도 앱이 깨지지 않게 합니다.

```ts
const defaultSettings: ReaderSettings = {
  activeFolderId: null,
  fontFamily: "NanumGothic, 'Malgun Gothic', sans-serif",
  fontSize: 18,
  isBold: false,
  lineHeight: 1.6,
  letterSpacing: 0,
  paddingTop: 40,
  paddingBottom: 40,
  paddingLeft: 20,
  paddingRight: 20,
  paddingLinked: true,
  pageTurnTouch: true,
  pageTurnSwipe: true,
  pageTurnVolume: true,
  volumeKeyPaging: true,
  pageTurnFeedback: "vibration",
  pageTurnStyle: "curl",
  hideCompleted: false,
  theme: "paper",
  librarySort: { column: "modifiedAt", direction: "desc" },
  historySort: { column: "openedAt", direction: "desc" },
  bookmarksSort: { column: "createdAt", direction: "desc" },
};
```

기본값 의도:

- `theme: "paper"`: 장문 독서에 맞춘 종이톤을 첫 화면으로 사용합니다.
- `fontFamily: NanumGothic`: 기본 한글 표시 안정성을 우선합니다.
- `fontSize: 18`, `lineHeight: 1.6`: 모바일 세로 화면에서 긴 문장을 읽기 편한 기준값입니다.
- `paddingTop/Bottom: 40`, `paddingLeft/Right: 20`: 페이지 번호와 터치 영역을 고려한 기본 여백입니다.
- `pageTurnTouch`, `pageTurnSwipe`, `volumeKeyPaging`: 기본으로 모두 켜서 사용자가 별도 설정 없이 페이지를 넘길 수 있게 합니다.
- `pageTurnFeedback: "vibration"`: 페이지 넘김 피드백은 진동을 기본으로 합니다.
- `pageTurnStyle: "curl"`: 두루마리/책 느낌을 주는 기본 페이지 전환입니다.
- `hideCompleted: false`: 완독 문서를 기본 목록에서 숨기지 않습니다.
- 목록 정렬은 최근 수정/최근 열람/최근 책갈피가 먼저 보이도록 `desc`를 기본값으로 둡니다.

기본 폰트 후보:

- 나눔고딕: `NanumGothic`
- Noto Serif KR: `NotoSerifKR`
- Noto Sans KR: `NotoSansKR`
- 마루부리: `MaruBuri`
- 도현체: `DoHyeon`
- 고운돋움: `GowunDodum`
- IBM Plex Serif KR: `IBMPlexSerifKR`
- 프리텐다드: `Pretendard`
- 스포카 한 산스 Neo: `SpoqaHanSansNeo`
- KoPubWorld 바탕체: `KoPubWorldBatang`
- 리디바탕: `RidiBatang`

설정 UI 허용 범위:

- 글자 크기: 10~36pt
- 줄 간격: 1.0~2.5, 0.1 단위
- 자간: -2~5px
- 위/아래 여백: 0~120px, 5px 단위
- 왼쪽/오른쪽 여백: 0~150px, 5px 단위
- 피드백: 없음, 진동, 소리
- 넘김 방식: 없음, 책장, 슬라이드
- 조작 방식: 터치, 스와이프, 볼륨키 각각 on/off
- 테마: 화이트, 다크, 종이, 칠판
- 필터: 완독한 책 목록에서 숨김 on/off

`paddingLinked`가 켜진 상태에서 왼쪽 여백을 바꾸면 오른쪽 여백도 같은 값으로 맞추고, 오른쪽 여백을 바꾸면 왼쪽도 같은 값으로 맞춥니다. `volumeKeyPaging`을 토글할 때는 과거 호환 필드인 `pageTurnVolume`도 같은 값으로 같이 갱신합니다.

## 5. 저장소 설계

SQLite 테이블:

- `folders`
- `documents`
- `readings`
- `bookmarks`

AsyncStorage 키:

- `durumari.settings`: `ReaderSettings`
- `durumari.lastViewerSession`: 마지막으로 활성화된 뷰어 문서 ID와 갱신 시각

저장소 구현 규칙:

- SQLite 쓰기는 `enqueueWrite` 큐를 통해 직렬화합니다.
- Android/Native에서는 `withExclusiveTransactionAsync`, Web에서는 `withTransactionAsync`를 사용합니다.
- `listDocuments()`는 `text` 컬럼을 조회하지 않습니다.
- `getDocumentText(documentId)`만 뷰어 로딩 시 본문을 조회합니다.
- 폴더 삭제 또는 전체 초기화 시, 해당 문서가 마지막 세션이면 `lastViewerSession`도 삭제합니다.

### 5.1 스키마 마이그레이션

앱 업데이트로 컬럼이 추가될 수 있으므로 `initStore()`는 테이블 생성 후 idempotent migration을 실행합니다.

현재 추가 마이그레이션:

- `documents.toc`
- `documents.textEncoding`
- `documents.textEncodingSource`
- `documents.detectedTextEncoding`
- `readings.anchorOffset`
- `bookmarks.anchorOffset`

구현 규칙:

- `CREATE TABLE IF NOT EXISTS`로 기본 테이블을 보장합니다.
- `ALTER TABLE ... ADD COLUMN ...`은 이미 존재할 수 있으므로 실패를 무시합니다.
- 앱 시작 시 항상 `initStore()`를 먼저 실행해서 구버전 DB도 최신 코드와 호환되게 합니다.
- `PRAGMA journal_mode = WAL`을 켜서 읽기/쓰기 안정성을 높입니다.
- 구버전 캐시에 `text`만 있고 인코딩 메타데이터가 없을 수 있으므로, 뷰어 진입 시 원본 바이트를 다시 읽어 인코딩 정보를 채웁니다.

### 5.2 폴더 재스캔 시 데이터 보존

폴더 재스캔은 단순히 기존 문서를 지우고 새 문서를 넣으면 안 됩니다. 파일명, URI, 메타데이터가 조금 바뀌어 `documentId`가 달라져도 같은 문서라면 읽기 기록과 책갈피를 보존해야 합니다.

`replaceFolderDocuments()`의 핵심 규칙:

- 새 스캔 결과와 기존 DB 문서를 `documentId` 기준으로 먼저 비교합니다.
- 같은 `documentId`이고 `contentHash`, `sourceUri`, `title`, `kind`, `fileSize`, `modifiedAt`이 같으면 업데이트를 건너뜁니다.
- 새 문서에 본문 `text`가 없으면 기존 `text`, `toc` 캐시를 유지합니다.
- 새 문서에 본문 `text`가 없으면 기존 `textEncoding`, `textEncodingSource`, `detectedTextEncoding`도 유지합니다.
- `documentId`가 바뀌었지만 `contentHash`가 같은 기존 문서를 찾으면 같은 문서로 간주합니다.
- 이 경우 기존 문서의 `text`, `toc`, 인코딩 메타데이터, `readings`, `bookmarks`를 새 `documentId`로 이관합니다.
- 새 스캔 결과에 없는 기존 문서는 문서, 읽기 기록, 책갈피를 함께 삭제합니다.

이 규칙이 없으면 폴더 재스캔, 파일 provider 메타데이터 변화, 파일명 변경 후 사용자의 읽던 위치와 책갈피가 사라질 수 있습니다.

### 5.3 삭제와 초기화 정책

폴더 해제:

- 원본 파일은 삭제하지 않습니다.
- 앱 DB의 해당 폴더, 문서, 읽기 기록, 책갈피만 삭제합니다.
- 삭제 후 마지막 뷰어 세션이 더 이상 존재하지 않는 문서를 가리키면 `lastViewerSession`을 삭제합니다.

폴더 전체 해제:

- 모든 folders/documents/readings/bookmarks를 삭제합니다.
- 마지막 뷰어 세션도 삭제합니다.
- 현재 뷰어가 열려 있으면 `setActiveDocument(null)`로 목록 상태로 되돌립니다.

책갈피 삭제:

- 책갈피 탭에서는 롱프레스로 삭제 확인 Alert를 띄웁니다.
- 삭제 직후 짧은 시간 동안 탭 열기 이벤트를 무시해, Alert 닫힘과 동시에 책이 열리는 오동작을 막습니다.

## 6. 앱 부팅 및 인트로 흐름

부팅은 `App.tsx`의 `boot()`가 담당합니다.

순서:

1. 글꼴 로딩과 `initStore()` 실행.
2. 웹 테스트 라이브러리 seed.
3. 설정 로딩.
4. 저장된 폴더 목록 확인.
5. 활성 폴더를 우선 재스캔.
6. 마지막 뷰어 세션 확인.
7. 복원할 문서가 있으면 본문 로딩과 읽기 상태 복원.
8. 인트로 애니메이션과 뷰어 준비가 모두 끝난 뒤 화면 전환.

진행률 구간:

- 0.10: 앱 초기화
- 0.45: 테스트 문서 확인
- 0.55~0.95: 폴더 동기화
- 0.96: 마지막 문서 확인
- 0.97~1.00: 마지막 뷰어 본문/페이지 계산

### 6.1 뒤로가기와 화면 닫기 정책

Android hardware back은 현재 화면 계층에 따라 다르게 처리합니다.

앱 공통:

- 설정 모달이 열려 있으면 설정 모달만 닫고 이벤트를 소비합니다.
- 뷰어가 열려 있으면 최상위 앱 back handler는 처리하지 않고 ViewerScreen에 위임합니다.
- 뷰어가 아니고 현재 탭이 `library`가 아니면 `library` 탭으로 이동하고 이벤트를 소비합니다.
- `library` 탭이면 시스템 기본 back 동작을 허용합니다.

뷰어:

- 뷰어 메뉴, 목차, 페이지 이동, 인코딩 모달 중 하나가 열려 있으면 해당 모달만 닫습니다.
- 열린 뷰어 모달이 없으면 `setActiveDocument(null)`로 뷰어를 닫고 목록으로 돌아갑니다.
- WebView 내부 ESC/back 요청은 `backRequested` 메시지로 RN에 전달하고 같은 닫기 정책을 사용합니다.

설정 취소와 back:

- 설정 모달을 닫는 동작은 취소와 동일하게 취급합니다.
- `draftSettings` 변경은 버리고 `settings`와 저장소는 유지합니다.
- 뷰어 페이지 재계산이나 WebView `updateSettings`를 실행하지 않습니다.

## 7. 이어보기 설계

이어보기는 두 종류가 있습니다.

### 7.1 목록에서 책을 다시 열 때

동작:

1. 목록/히스토리에서 `setActiveDocument(document)` 호출.
2. `AppContext.setActiveDocument()`가 `saveLastViewerSession(documentId)` 호출.
3. `ViewerScreen`에서 `readingsById.get(documentId)`를 찾아 `initialPage`로 사용.
4. `CanvasReader`에 `reading`을 전달.
5. WebView가 페이지 계산 후 `reading.anchorOffset` 기준으로 페이지를 보정합니다.

### 7.2 앱 재실행 시 마지막 뷰어 자동 복원

동작:

1. 뷰어가 열린 상태에서 앱이 종료되면 `durumari.lastViewerSession`에 마지막 `documentId`가 남아 있습니다.
2. 다음 실행 시 인트로 중 `loadLastViewerSession()`을 읽습니다.
3. `listDocuments()`에서 해당 문서를 찾습니다.
4. 문서가 없으면 세션을 삭제합니다.
5. 문서가 있으면 `loadViewerDocument(document)`로 본문을 hydrate합니다.
6. `listReadings()`에서 기존 읽기 위치를 찾아 context에 반영합니다.
7. `setActiveDocument(hydratedDocument)`를 호출합니다.
8. 화면에는 `ViewerRestoreLoader`가 `ViewerScreen`을 렌더링하지만, `suppressInitialLoadingOverlay`로 뷰어 로딩 UI는 숨깁니다.
9. `ViewerScreen`과 `CanvasReader`의 로딩 진행률을 인트로 진행상태바로 전달합니다.
10. Canvas가 `ready`를 보내면 인트로를 닫고 바로 뷰어를 보여줍니다.

핵심 제약:

- 인트로 뒤에 별도 뷰어 로딩 화면이 나오면 안 됩니다.
- 뷰어 로딩 로직은 실행하되, 로딩 UI는 인트로가 담당해야 합니다.
- 사용자가 뷰어가 아닌 목록 화면에서 앱을 종료했다면 마지막 페이지를 강제로 보여주면 안 됩니다. 현재 구조에서는 `setActiveDocument(null)` 시 `clearLastViewerSession()`을 호출해서 이 조건을 만족합니다.

## 8. 문서 가져오기와 폴더 동기화

Android 주 흐름:

1. `chooseSafFolder()` 호출.
2. `StorageAccessFramework.requestDirectoryPermissionsAsync()`로 폴더 권한 획득.
3. `readDirectoryAsync(treeUri)`로 폴더 내 파일 URI 조회.
4. 지원 확장자만 필터링: `txt`, `epub`, `zip`, `gz`.
5. 목록 스캔 단계에서는 파일 본문을 읽지 않고 메타데이터만 저장합니다.
6. `replaceFolderDocuments(folder, documents)`로 DB 반영.

메타데이터:

- SAF provider에 따라 파일 크기/수정일이 빠질 수 있습니다.
- 네이티브 `SafMetadataModule`로 Android ContentResolver 메타데이터를 먼저 읽고, 실패하면 Expo FileSystem metadata로 fallback합니다.

재스캔:

- 앱 부팅 시 활성 폴더를 재스캔합니다.
- 앱 foreground 복귀 시 라이브러리 탭이면 백그라운드 동기화를 요청합니다.
- 같은 폴더/전체 재스캔은 5분 쿨다운을 둡니다.
- 재스캔 중 권한 오류가 발생하면 폴더는 삭제하지 않고 `permissionStatus: "required"`로 표시합니다.

### 8.1 활성 폴더와 폴더 표시명

폴더 등록 후에는 사용자가 탭에서 구분할 수 있는 표시명을 지정합니다.

동작:

- Android에서는 SAF 폴더 선택 후 기본 표시명을 URI에서 추출합니다.
- 등록 직후 폴더 이름 지정 모달을 띄워 사용자가 표시명을 바꿀 수 있게 합니다.
- 확인 시 `replaceFolderDocuments(folder, documents)`로 저장하고, 새 폴더를 `activeFolderId`로 설정합니다.
- 폴더 chip에는 표시명과 해제 버튼을 함께 둡니다.
- 권한 문제가 있는 폴더는 삭제하지 않고 경고 표시를 붙입니다.

활성 폴더 해석:

- 저장된 `activeFolderId`가 있고 현재 folders 목록에 존재하면 그대로 사용합니다.
- 저장된 `activeFolderId`가 없거나 더 이상 존재하지 않으면 첫 번째 폴더를 활성 폴더로 사용합니다.
- 폴더가 하나도 없으면 `activeFolderId`는 null입니다.
- 설정 변경이나 폴더 삭제 후에도 `resolveActiveFolderId()`로 유효한 폴더를 다시 계산합니다.

## 9. 문서 파싱 설계

지원 형식:

- TXT: UTF-8, UTF-8 BOM, EUC-KR, CP949, UTF-16 LE/BE 자동 감지
- GZ: 압축 해제 후 텍스트 디코딩
- ZIP: 내부 TXT/EPUB를 파일명순으로 병합
- EPUB: spine 순서대로 XHTML/HTML 본문 추출, NCX 목차 추출

보호 규칙:

- 원본 파일 100MB 초과 거부
- 압축 해제 결과 500MB 초과 거부
- ZIP entry 2,000개 초과 거부
- 경로 탐색 entry 거부
- DRM EPUB 거부
- fixed-layout EPUB 거부
- 오디오/비디오/스크립트 중심 EPUB 거부

본문 로딩:

```text
ViewerScreen
  -> loadViewerDocument(document)
    -> getDocumentText(documentId)
    -> 캐시가 있으면 즉시 반환
    -> 없으면 readWebTestDocumentBytes 또는 readSafBytes
    -> hydrateDocumentFromBytes
    -> upsertDocuments([hydrated])
```

### 9.1 인코딩 메타데이터

인코딩 정보는 문서별로 세 값으로 분리합니다.

- `detectedTextEncoding`: 원본 파일 바이트를 자동 감지한 인코딩.
- `textEncoding`: 현재 뷰어에 실제 적용된 인코딩.
- `textEncodingSource`: 현재 적용 인코딩이 원본 감지값과 다르면 `manual`, 같으면 `auto`.

인코딩 대상:

- TXT: 원본 바이트를 자동 감지하고 세 값을 저장합니다.
- GZ: 압축 해제된 텍스트 바이트를 자동 감지하고 세 값을 저장합니다.
- ZIP: ZIP 내부 TXT 항목의 인코딩을 감지합니다. 내부 텍스트 인코딩이 여러 개면 `mixed`로 취급할 수 있습니다.
- ZIP 내부 EPUB 또는 일반 EPUB: 사용자가 인코딩을 선택하는 대상이 아니므로 `not-applicable`로 취급합니다.

자동 감지 규칙:

- UTF-8 BOM이면 내부 감지값은 `utf8-bom`, 선택지 비교용 값은 `utf8`로 취급합니다.
- UTF-16 LE/BE BOM을 우선 감지합니다.
- BOM이 없으면 `utf8`, `euc-kr`, `cp949` 순서로 디코딩을 시도합니다.
- 디코딩 결과가 깨짐 문자 없이 유효하면 해당 인코딩을 감지값으로 사용합니다.
- 모든 자동 감지에 실패하면 UTF8 fallback을 사용합니다.

캐시 보정:

- 기존 캐시에 본문 `text`만 있고 `textEncoding` 또는 `detectedTextEncoding`이 없을 수 있습니다.
- TXT/GZ/ZIP 문서에서 인코딩 메타데이터가 비어 있으면, 뷰어 진입 시 캐시 본문이 있더라도 원본 파일을 다시 읽어 인코딩 정보를 채웁니다.
- 인코딩 메타데이터가 모두 있으면 기존 캐시를 그대로 사용합니다.

### 9.2 인코딩 선택 화면

뷰어 메뉴의 인코딩 선택 화면은 아래 정책을 따릅니다.

- 타이틀은 `인코딩 선택`입니다.
- 타이틀 아래에는 원본 자동 감지값만 `원본 : UTF8` 형식으로 표시합니다.
- `자동 감지` 버튼은 표시하지 않습니다.
- 선택지는 `UTF8`, `EUC-KR`, `CP949`, `UTF16-LE`, `UTF16-BE`만 표시합니다.
- 현재 적용 중인 인코딩은 테두리, 배경, 텍스트 색으로만 강조합니다.
- `현재` 텍스트나 오른쪽 점 표시는 사용하지 않습니다.
- 현재 선택된 인코딩 버튼은 disabled 처리해서 다시 눌러도 재파싱하지 않습니다.
- EPUB처럼 인코딩 선택 대상이 아닌 문서는 원본을 `해당 없음`으로 표시합니다.

표시명 규칙:

- `utf8` -> `UTF8`
- `utf8-bom` -> 원본 표시에서는 `UTF-8 BOM`, 선택지 비교에서는 `UTF8`
- `euc-kr` -> `EUC-KR`
- `cp949` -> `CP949`
- `utf16-le` -> `UTF16-LE`
- `utf16-be` -> `UTF16-BE`
- `mixed` -> `여러 인코딩`
- `not-applicable` -> `해당 없음`
- 값이 없으면 `알 수 없음`

### 9.3 직접 인코딩 선택 처리

사용자가 인코딩을 직접 선택할 때의 처리입니다.

- 현재 적용 인코딩과 같은 값을 누르는 처리는 막습니다.
- 다른 인코딩을 선택하면 원본 파일을 해당 인코딩으로 다시 파싱합니다.
- 재파싱은 `loadViewerDocument(activeDocument, encoding)`으로 처리하고, 기존 캐시를 우선 사용하지 않습니다.
- 재파싱 성공 후 `setActiveDocument(newDoc)`로 뷰어 문서를 교체합니다.
- CanvasReader key에는 `documentId`, `textEncoding`, `textEncodingSource`, reload signal을 포함해 WebView가 새 본문으로 다시 생성되게 합니다.
- 재파싱 실패 시 `ENCODING_FAILED` 오류를 뷰어 로딩 상태에 표시합니다.

자동/수동 상태 판정:

- 선택한 인코딩이 `detectedTextEncoding`과 같으면 자동 감지 상태로 간주합니다.
- 예: 원본 `UTF8`, 사용자가 나중에 다시 `UTF8` 선택 -> `UTF8` 강조, `textEncodingSource`는 `auto`.
- 선택한 인코딩이 원본 감지값과 다르면 직접 선택 상태입니다.
- 예: 원본 `UTF8`, 현재 `CP949` -> `CP949` 강조, 원본 표시는 `원본 : UTF8`, `textEncodingSource`는 `manual`.

## 10. 뷰어 렌더링 설계

뷰어는 React Native Text로 렌더링하지 않고 WebView 내부 Canvas로 렌더링합니다.

이유:

- 긴 텍스트를 일정한 페이지 단위로 계산해야 합니다.
- 페이지 넘김 애니메이션을 직접 제어해야 합니다.
- 폰트/여백/줄간격 변경 시 페이지 재계산이 필요합니다.

흐름:

1. `ViewerScreen`이 `CanvasReader`를 렌더링합니다.
2. `CanvasReader`가 `createCanvasHtml(payload)`로 HTML 문자열을 생성합니다.
3. WebView 내부에서 폰트 로딩을 기다립니다.
4. `paginateInline()`이 텍스트를 문자 단위로 측정해 page start offset 배열을 만듭니다.
5. 페이지 계산 진행률을 `loadingProgress`로 RN에 보냅니다.
6. 계산 완료 후 `ready`를 보냅니다.
7. Canvas는 현재 페이지를 그리고, RN은 로딩 오버레이를 닫습니다.

페이지 계산 기준:

- 실제 viewport 너비/높이
- 상하좌우 여백
- 글꼴, 글자 크기, 굵기
- 줄간격, 자간
- 하단 페이지 번호 영역

페이지 전환 방식:

- `none`: 즉시 이동
- `slide`: 슬라이드 애니메이션
- `curl`: 책장 말림 애니메이션

입력:

- 터치: 화면 위치에 따라 앞/뒤 또는 위/아래 이동
- 스와이프: drag 방향에 따라 페이지 이동
- 롱프레스/contextmenu: 뷰어 메뉴 열기
- 볼륨키: Android native module event를 받아 페이지 이동
- ESC/Back: 메뉴 닫기 또는 뷰어 종료

## 11. RN-WebView 메시지 계약

RN -> WebView:

- `updateSettings`: 설정 변경 반영
- `goToPage`: 특정 페이지 이동
- `goToOffset`: 텍스트 offset 기준 이동
- `turnPage`: 앞/뒤 페이지 넘김
- `toggleBookmark`: 현재 페이지 책갈피 토글
- `disposeDocument`: 문서 정리

WebView -> RN:

- `loadingProgress`: 페이지 계산 진행률
- `ready`: 초기 렌더링 준비 완료
- `pageChanged`: 현재 페이지/진행률 변경
- `bookmarkChanged`: 책갈피 토글 결과
- `readingSynced`: 기존 reading을 새 페이지 계산 기준으로 보정
- `bookmarksSynced`: 기존 bookmark를 새 페이지 계산 기준으로 보정
- `menuRequested`: 롱프레스/contextmenu로 메뉴 요청
- `backRequested`: WebView 내부 back 요청
- `error`: 페이지 계산 오류

모든 메시지는 `{ version: 1, type, requestId, payload }` 형태를 유지합니다.

## 12. 읽기 기록 저장 흐름

페이지가 변경되면 WebView가 `pageChanged`를 보냅니다.

RN 처리:

1. boundary 이벤트면 저장하지 않습니다.
2. `ReadingRecord` 생성.
3. `completed`는 기존 완료 상태 또는 마지막 페이지 도달 여부로 계산합니다.
4. `saveReading(nextReading)`으로 SQLite 저장.
5. `upsertReadingState(nextReading)`으로 context 상태 즉시 반영.
6. 설정에 따라 햅틱 피드백을 실행합니다.

저장 필드:

- `lastPage`
- `totalPages`
- `progress`
- `openedAt`
- `completed`
- `completedAt`
- `anchorOffset`

## 13. 책갈피 저장 흐름

뷰어 메뉴에서 책갈피를 누르면 RN이 WebView에 `toggleBookmark`를 보냅니다.

WebView 처리:

1. 현재 페이지에 기존 책갈피가 있는지 확인합니다.
2. 없으면 임시 `bookmarkId`와 현재 페이지 preview, anchorOffset 생성.
3. 있으면 제거 대상으로 표시합니다.
4. `bookmarkChanged`를 RN에 보냅니다.

RN 처리:

1. 임시 ID면 `documentId:p{page}:{Date.now()}` 형식의 실제 ID를 만듭니다.
2. `toggleBookmark()` 트랜잭션으로 SQLite insert/delete를 수행합니다.
3. `setBookmarkState()`로 context 상태를 즉시 반영합니다.

책갈피 목록에서 항목을 누르면:

```text
BookmarksScreen.openBookmark
  -> openDocument(document, { type: "bookmark", bookmarkId })
  -> ViewerScreen targetBookmark
  -> CanvasReader targetBookmarkId
  -> WebView syncBookmarks 후 해당 책갈피 page로 이동
```

## 14. 목록/히스토리/책갈피 화면

공통:

- 상단 탭: 목록, 히스토리, 책갈피
- 검색어는 `App.tsx`의 단일 `search` state를 공유합니다.
- 각 화면은 검색 input과 정렬 버튼을 같은 줄에 배치합니다.
- 정렬 상태는 `ReaderSettings`에 저장됩니다.
- 정렬 버튼은 같은 컬럼을 누를 때 `asc -> desc -> none -> asc` 순서로 순환합니다.
- 다른 컬럼을 누르면 `asc`부터 시작합니다.

탭 전환:

- Native에서는 `react-native-pager-view`를 사용해서 좌우 스와이프로 목록, 히스토리, 책갈피를 전환합니다.
- Web에서는 PagerView 대신 조건부 렌더링으로 현재 탭만 표시합니다.
- 상단 탭 버튼과 PagerView의 현재 페이지는 `tab` state 하나로 동기화합니다.

목록:

- `documents + readings + folders`를 join해서 `LibraryRow`를 만듭니다.
- 활성 폴더만 표시합니다.
- `hideCompleted`가 켜지면 완독 문서를 숨깁니다.
- 읽기 상태는 `unread`, `reading`, `completed`로 계산합니다.
- 정렬: 제목, 수정일, 상태.

히스토리:

- `readings`와 `documents`를 join합니다.
- 읽은 기록이 있는 문서만 표시합니다.
- 정렬: 제목, 최근 열람일, 진행률.

책갈피:

- `bookmarks`와 `documents`를 join합니다.
- 짧은 preview와 페이지 badge를 표시합니다.
- 탭: 해당 책갈피 위치로 열기.
- 롱프레스: 책갈피 삭제.
- 정렬: 제목, 생성일, 위치.

반응형 프레임:

- 앱 전체는 `ResponsiveFrame`으로 책 페이지처럼 세로 비율을 유지합니다.
- 기본 최대 책 비율은 `2 / 3`입니다.
- 뷰어는 `reader` 모드로 화면 높이를 최대한 쓰고, 너비는 `height * 2 / 3`을 넘지 않게 제한합니다.
- BottomSheet와 Dialog는 `useResponsiveFrameMetrics()`의 `bottomSheetWidth`, `bottomSheetMaxHeight`, `dialogMargin`을 사용해 작은 화면에서도 잘리지 않게 합니다.
- 앱 설정은 `app.json`의 `orientation: "portrait"`를 기본으로 사용해 스마트폰 가로모드 진입을 방지합니다.

## 15. 설정과 테마

설정 모달은 `draftSettings`를 먼저 수정하고, 확인 시 `settings`에 반영한 뒤 저장합니다.

구분:

- `settings`: 실제 앱에 적용된 설정.
- `draftSettings`: 설정 모달에서 편집 중인 값.

### 15.1 설정 취소/확인 처리 원칙

설정 화면은 반드시 draft/apply 구조로 동작해야 합니다.

취소:

- `draftSettings`만 버리고 `settings`는 변경하지 않습니다.
- AsyncStorage에 저장하지 않습니다.
- WebView에 `updateSettings`를 보내지 않습니다.
- 뷰어 페이지 재계산, 뷰어 로딩 UI, 인트로 로딩 처리를 모두 실행하지 않습니다.
- 설정 모달만 닫고 기존 뷰어/목록 상태를 그대로 유지합니다.

확인:

- `draftSettings`를 `settings`로 반영합니다.
- `saveSettings(draftSettings)`로 AsyncStorage에 저장합니다.
- 뷰어가 열려 있으면 `CanvasReader`가 변경된 `settings`를 감지해서 WebView에 `updateSettings`를 보냅니다.
- 이때 모든 설정 변경이 뷰어 로딩을 필요로 하지는 않습니다. 변경 종류에 따라 아래처럼 처리합니다.

### 15.2 설정 변경별 뷰어 처리

페이지 재계산이 필요한 설정:

- `fontFamily`
- `fontSize`
- `isBold`
- `lineHeight`
- `letterSpacing`
- `paddingTop`
- `paddingBottom`
- `paddingLeft`
- `paddingRight`

이 값들은 한 페이지에 들어가는 글자 수와 줄 수를 바꾸므로 WebView 내부에서 `paginateInline()`을 다시 실행해야 합니다. 재계산 시 현재 페이지 번호를 그대로 유지하면 위치가 틀어질 수 있으므로, 기존 현재 페이지의 `anchorOffset`을 `targetOffset`으로 잡고 재계산 후 `pageForOffset(targetOffset)`으로 다시 이동합니다.

재렌더만 필요한 설정:

- `theme`

테마는 배경색, 글자색, accent 색만 바꾸므로 페이지 수가 바뀌지 않습니다. Canvas page surface cache를 비우고 현재 페이지를 다시 그리면 됩니다. 별도 뷰어 로딩 화면은 필요 없습니다.

로딩/재계산이 필요 없는 설정:

- `pageTurnTouch`
- `pageTurnSwipe`
- `pageTurnFeedback`
- `pageTurnStyle`
- `volumeKeyPaging`
- `pageTurnVolume`
- `hideCompleted`
- `librarySort`
- `historySort`
- `bookmarksSort`
- `activeFolderId`
- `paddingLinked`

이 값들은 뷰어 본문 페이지 계산에 직접 영향을 주지 않습니다. WebView에 설정은 전달될 수 있지만, 문서 본문을 다시 읽거나 뷰어 로딩 UI를 띄우면 안 됩니다. `pageTurnStyle`은 다음 페이지 전환부터 적용하면 되고, `pageTurnFeedback`은 다음 피드백부터 적용하면 됩니다.

현재 WebView의 설정 변경 판단 기준:

```ts
function paginationSettingsChanged(previous, next) {
  return previous.fontFamily !== next.fontFamily
    || previous.fontSize !== next.fontSize
    || previous.isBold !== next.isBold
    || previous.lineHeight !== next.lineHeight
    || previous.letterSpacing !== next.letterSpacing
    || previous.paddingTop !== next.paddingTop
    || previous.paddingBottom !== next.paddingBottom
    || previous.paddingLeft !== next.paddingLeft
    || previous.paddingRight !== next.paddingRight;
}

function visualSettingsChanged(previous, next) {
  return paginationSettingsChanged(previous, next)
    || previous.theme !== next.theme;
}
```

설정 확인 시 UX 규칙:

- 페이지 재계산 대상이 바뀐 경우에만 "전체 페이지를 계산하는 중..." 진행 상태를 사용할 수 있습니다.
- 테마만 바뀐 경우에는 즉시 색상만 바뀌어야 하며 로딩 화면을 띄우지 않습니다.
- 목록 정렬, 완료 숨김, 활성 폴더 변경은 뷰어가 아닌 목록 화면에만 영향을 주므로 뷰어 로딩과 무관합니다.
- 설정 취소는 어떤 경우에도 WebView 메시지나 저장소 쓰기를 발생시키지 않는 것이 원칙입니다.

테마는 `themeTokens`에서 화면 배경, 카드, 텍스트, accent, 상태 색상, system bar 색상을 제공합니다. 테마 색상값은 `src/lib/settings.ts`의 `themeTokens`를 기준으로 하며, WebView Canvas 본문 렌더링 색은 `src/viewer/canvasHtml.ts`의 `themes`와 같은 값으로 맞춥니다.

### 15.3 테마별 색상표

테마 이름:

| 내부 값 | 화면 표시명 | 기본 여부 | 용도 |
| --- | --- | --- | --- |
| `paper` | 한지 | 기본값 | 장문 독서 기본 테마 |
| `light` | 화이트 | 아니오 | 밝은 배경의 일반 테마 |
| `dark` | 다크 | 아니오 | 어두운 환경용 테마 |
| `chalk` | 칠판 | 아니오 | 저채도 녹색 배경의 독서 테마 |

화면 표면과 시스템 바:

| 토큰 | 적용 지점 | `paper` 한지 | `light` 화이트 | `dark` 다크 | `chalk` 칠판 |
| --- | --- | --- | --- | --- | --- |
| `bg` | 기본 앱 본문 배경, 목록/설정 내부 배경, 뷰어 페이지 배경 | `#f2ead3` | `#f8f4ed` | `#121212` | `#183b32` |
| `outer` | `ResponsiveFrame` 외곽, 뷰어 shell 배경, 테마 미리보기 외곽 | `#cfbe90` | `#e2dbcc` | `#090909` | `#0d241f` |
| `card` | 카드, 시트, 설정 섹션, 입력/선택 컨테이너 배경 | `#eae0c4` | `#FFFFFF` | `#1e1e1e` | `#21483e` |
| `statusBar` | `ThemedScreen` 상단 safe area 상태바 영역 배경 | `#cfbe90` | `#e2dbcc` | `#090909` | `#0d241f` |
| `navigationBar` | `ThemedScreen` 하단 safe area, Android navigation bar, `SystemUI` 배경 stack | `#cfbe90` | `#e2dbcc` | `#090909` | `#0d241f` |
| `statusBarStyle` | Expo `StatusBar` 아이콘/텍스트 스타일 | `dark` | `dark` | `light` | `light` |
| `navigationBarStyle` | Expo `NavigationBar` 버튼 스타일, native `SystemBarModule`의 dark button 여부 | `dark` | `dark` | `light` | `light` |

텍스트, 선, 강조 색:

| 토큰 | 적용 지점 | `paper` 한지 | `light` 화이트 | `dark` 다크 | `chalk` 칠판 |
| --- | --- | --- | --- | --- | --- |
| `text` | 기본 텍스트, 제목, 본문 UI 텍스트 | `#2a2a2a` | `#1a1a2e` | `#e0e0e0` | `#f1ead0` |
| `secondary` | 보조 텍스트, 메타 정보, placeholder, 비활성 선택지 | `#2a2a2a80` | `#1a1a2e80` | `#e0e0e080` | `#f1ead094` |
| `border` | 카드/검색창/구분선/진행 트랙/시트 handle | `#d5c5a0` | `#e0d8c8` | `#2d2d2d` | `#3b665b` |
| `accent` | 선택된 탭/세그먼트 배경, 주요 버튼 배경, 진행 막대, 체크박스 채움 | `#9a5a10` | `#2563eb` | `#8ab4f8` | `#f3c969` |
| `accentText` | 강조 텍스트, 링크형 버튼, 배지 텍스트, 설정 섹션 제목 | `#9a5a10` | `#2563eb` | `#8ab4f8` | `#f3c969` |
| `accentForeground` | `accent` 배경 위의 텍스트/아이콘, 선택 상태 체크 표시 | `#FFFFFF` | `#FFFFFF` | `#121212` | `#183b32` |
| `danger` | 위험 버튼/경고 테두리/삭제 텍스트 | `#B3342D` | `#B3261E` | `#FFB4AB` | `#F1A6A6` |

읽기 상태 의미 색상:

| 토큰 | 적용 지점 | `paper` 한지 | `light` 화이트 | `dark` 다크 | `chalk` 칠판 |
| --- | --- | --- | --- | --- | --- |
| `unread` | `미독` 상태 레이블, 미독 보조 상태색 | `#2a2a2a80` | `#1a1a2e80` | `#e0e0e080` | `#f1ead094` |
| `reading` | `읽는 중` 상태 레이블, 진행 중 의미색 | `#9a5a10` | `#2563eb` | `#8ab4f8` | `#f3c969` |
| `completed` | `완독` 상태 레이블, 완료 의미색 | `#476B3C` | `#217A3C` | `#72C48A` | `#B7D7A8` |

WebView Canvas 뷰어 전용 팔레트:

| Canvas 토큰 | 적용 지점 | `paper` 한지 | `light` 화이트 | `dark` 다크 | `chalk` 칠판 |
| --- | --- | --- | --- | --- | --- |
| `bg` | `html/body`, `canvas`, 페이지 표면, 책장 넘김 중 빈 면 | `#f2ead3` | `#f8f4ed` | `#121212` | `#183b32` |
| `text` | Canvas 본문 텍스트, 페이지 번호 | `#2a2a2a` | `#1a1a2e` | `#e0e0e0` | `#f1ead0` |
| `accent` | 책갈피 접힘 표시의 강조 선 | `#9a5a10` | `#2563eb` | `#8ab4f8` | `#f3c969` |
| `dog` | 책갈피 접힘 면, 접힌 모서리 채움 | `#cfbe90` | `#e2dbcc` | `#090909` | `#0d241f` |
| `crease` | 책갈피 접힘선, 페이지 경계선 | `#d5c5a0` | `#e0d8c8` | `#2d2d2d` | `#3b665b` |

Canvas 토큰 가공 규칙:

| 항목 | 규칙 | 적용 지점 |
| --- | --- | --- |
| 책갈피 접힘선 | 다크 테마만 `crease`에 alpha `0.86` 적용, 나머지는 원색 사용 | 책갈피가 있는 페이지 우상단 접힘선 |
| 책갈피 강조선 | 다크/칠판은 `accent` alpha `0.62`, 한지/화이트는 `accent` alpha `0.72` 적용 | 책갈피 접힘 안쪽 사선 |

Canvas 뷰어 고정 색상:

| 항목 | 값 | 적용 지점 |
| --- | --- | --- |
| Canvas 초기 CSS 배경 | `#f2ead3` | WebView 로딩 직후 테마 스크립트가 적용되기 전의 `html/body`, `canvas` 기본 배경 |
| 토스트 텍스트 | `#fff` | 페이지 경계 토스트 텍스트 |
| 토스트 배경 | `rgba(0,0,0,.68)` | 페이지 경계 토스트 배경 |
| 책갈피 drop shadow | `rgba(0,0,0,.24)` | dog-ear canvas 그림자 |
| 슬라이드 그림자 | `rgba(0,0,0,0)`부터 `rgba(0,0,0,0.28 * strength)` | 슬라이드 페이지 전환 경계 그림자 |
| 책장 넘김 접힘 그림자 | `rgba(0,0,0,0.38 * strength)`부터 `rgba(0,0,0,0)` | 책장 넘김 페이지 접힘 외곽 그림자 |
| 책장 넘김 spine 그림자 | `rgba(0,0,0,0.24 * strength)`부터 `rgba(0,0,0,0)` | 책장 넘김 왼쪽 spine 그림자 |
| 책장 넘김 sheet 음영 | `rgba(0,0,0,shade)`, `shade = sin(pi * progress) * (0.08 + 0.24 * (1 - abs(cos(angle))))` | 책장 넘김 중 휘어진 페이지 조각의 입체 음영 |

테마 밖의 고정 시스템/오버레이 색상:

| 항목 | 값 | 적용 지점 |
| --- | --- | --- |
| 부팅/인트로 시스템 배경 | `#0D1B2A` | 앱 초기화 중 `SafeAreaView`, `SystemUI.setBackgroundColorAsync`, 일반 `ThemedScreen` 진입 전 시스템 배경 |
| 부팅/인트로 system bar 스타일 | `light` | 앱 초기화 중 `StatusBar`, `NavigationBar` 스타일 |
| 렌더링 오류 제목 | `#E53935` | 최상위 에러 화면 제목 |
| 렌더링 오류 본문 | `#FFF` | 최상위 에러 화면 본문 |
| 렌더링 오류 상세 | `rgba(255,255,255,0.5)` | 최상위 에러 화면 상세 메시지 |
| 기본 바텀시트 backdrop | `rgba(0,0,0,0.56)` | `ResponsiveBottomSheet` 기본 dim 배경 |
| 중앙 다이얼로그 backdrop | `rgba(0,0,0,0.6)` | 폴더 표시명 입력 등 중앙 모달 배경 |
| 폰트 선택 overlay | `rgba(0,0,0,0.45)` | 설정 모달 내부 폰트 선택 화면 배경 |
| 활성 폴더 제거 버튼 overlay | `rgba(255,255,255,0.24)` | 선택된 폴더 chip의 제거 버튼 배경 |
| 비활성 폴더 제거 버튼 overlay | `rgba(0,0,0,0.06)` | 선택되지 않은 폴더 chip의 제거 버튼 배경 |
| 폴더 권한 오류 표시 | `#E53935` | 접근 권한 오류 폴더 chip 테두리와 텍스트 |

시스템 UI:

- 앱 부팅 중에는 어두운 인트로 배경을 사용합니다.
- 일반 화면에서는 현재 테마의 navigation bar 색상으로 설정합니다.
- Android navigation bar 버튼 색상은 native `SystemBarModule`로 보정합니다.
- `ThemedScreen`은 status bar 영역, 앱 영역, navigation bar 영역을 분리해서 각 테마 색을 적용합니다.
- 모달/뷰어처럼 화면이 중첩될 수 있으므로 system background는 stack 방식으로 관리합니다. 가장 위에 있는 `ThemedScreen`의 navigation bar 색을 적용하고, 화면이 unmount되면 이전 색으로 복원합니다.

### 15.4 상태바/네비게이션바 영역 처리

앱은 시스템 상태바와 Android 하단 네비게이션바를 본문 레이아웃 안에 섞지 않고, `ThemedScreen`에서 명시적인 3단 구조로 처리합니다.

```tsx
<View style={{ flex: 1, backgroundColor: theme.navigationBar }}>
  <StatusBar style={theme.statusBarStyle} />
  <NavigationBar.NavigationBar style={theme.navigationBarStyle} />
  <View style={{ height: insets.top, backgroundColor: theme.statusBar }} />
  <View style={{ flex: 1, backgroundColor: contentColor ?? theme.bg }}>
    {children}
  </View>
  <View style={{ height: insets.bottom, backgroundColor: theme.navigationBar }} />
</View>
```

영역별 역할:

- 상태바 영역: `useSafeAreaInsets().top` 높이만큼 확보하고 `theme.statusBar` 색을 칠합니다.
- 앱 본문 영역: 실제 목록, 설정, 뷰어가 렌더링되는 영역입니다. 상태바/네비게이션바 높이를 제외한 공간만 사용합니다.
- 네비게이션바 영역: `useSafeAreaInsets().bottom` 높이만큼 확보하고 `theme.navigationBar` 색을 칠합니다.

핵심 규칙:

- 본문 콘텐츠가 상태바나 하단 네비게이션바 뒤로 들어가면 안 됩니다.
- `SafeAreaProvider`를 앱 최상단에 둬야 `useSafeAreaInsets()`가 정상 동작합니다.
- `StatusBar`의 light/dark 스타일은 `theme.statusBarStyle`을 사용합니다.
- `NavigationBar.NavigationBar`의 light/dark 스타일은 `theme.navigationBarStyle`을 사용합니다.
- Android 네비게이션바 배경색과 버튼 색상은 Expo API만으로 부족할 수 있으므로 `SystemBarModule.setNavigationBarTheme(color, useDarkButtons)`로 한 번 더 보정합니다.
- 인트로 화면은 일반 `ThemedScreen`을 거치지 않고 전체 화면 overlay 구조를 쓰므로, 부팅 중에는 `StatusBar style="light"`, `NavigationBar style="light"`, `SystemUI.setBackgroundColorAsync("#0D1B2A")`를 사용합니다.

모달/바텀시트 처리:

- 설정 모달과 뷰어 바텀시트는 `statusBarTranslucent`, `navigationBarTranslucent`를 켜서 전체 화면 Modal로 띄웁니다.
- Modal 내부에서도 하단 safe area를 고려해 `insets.bottom` 높이의 여백 또는 overlay를 둡니다.
- `ResponsiveBottomSheet`는 sheet 아래에 `insets.bottom` 높이만큼 `theme.card` 영역을 추가하고, 화면 맨 아래에는 `theme.navigationBar` 색 overlay를 깔아 Android 네비게이션바와 시각적으로 이어지게 합니다.
- Dialog/BottomSheet의 최대 높이는 `windowHeight - dialogMargin * 2` 기준으로 계산해서 상태바/네비게이션바와 겹치지 않게 합니다.

네이티브 텍스트 기본값:

- 앱 시작 시 `configureNativeTextDefaults()`를 한 번 호출합니다.
- `Text`와 `TextInput`의 `allowFontScaling`을 false로 고정합니다.
- Android 설정 화면 preview는 시스템 폰트 fallback을 사용해 커스텀 폰트 렌더링 차이로 레이아웃이 깨지는 것을 줄입니다.

## 16. 네이티브 보강 사항

Expo config plugin `plugins/withKeyboardConfigChanges.js`가 Android native 프로젝트를 패치합니다.

포함 기능:

- MainActivity configChanges에 keyboard/navigation 관련 항목 추가.
- `SafMetadataModule`: SAF 문서 크기/수정일 조회.
- `SystemBarModule`: Android navigation bar 색상/버튼 스타일 변경.
- ESC key up을 Android back dispatcher로 연결.

추가 앱 설정:

- `app.json`에서 `orientation: "portrait"`로 세로 모드를 기본 지정합니다.
- Android predictive back gesture는 비활성화되어 있습니다.

### 16.1 볼륨키 페이지 이동

볼륨키 페이지 이동은 WebView가 아니라 Android native key event를 통해 처리합니다.

Native 요구사항:

- `MainActivity.onKeyDown()`에서 `KEYCODE_VOLUME_UP`, `KEYCODE_VOLUME_DOWN`을 감지합니다.
- `isVolumePagingEnabled`와 `isViewerActive`가 모두 true일 때만 볼륨키를 앱이 소비합니다.
- volume up은 `"volumeUp"`, volume down은 `"volumeDown"` 이벤트로 JS에 emit합니다.
- `onKeyUp()`에서도 viewer active 상태면 볼륨키 기본 동작을 막습니다.
- `VolumeKeyModule.setVolumeKeyPaging(enabled, viewerActive)`를 JS에서 호출할 수 있어야 합니다.
- `VolumeKeyPackage`를 `MainApplication`의 package list에 등록해야 합니다.

JS 처리:

- `ViewerScreen` mount 시 `NativeModules.VolumeKeyModule?.setVolumeKeyPaging(settings.volumeKeyPaging, true)`를 호출합니다.
- `DeviceEventEmitter`의 `onVolumeKey` 이벤트를 구독합니다.
- `volumeDown`은 다음 페이지, `volumeUp`은 이전 페이지로 보냅니다.
- 첫 페이지/마지막 페이지에서는 warning haptic을 실행합니다.
- ViewerScreen unmount 시 `setVolumeKeyPaging(false, false)`로 원복합니다.

이 기능은 optional native module처럼 접근해야 합니다. 모듈이 없는 Web/iOS/테스트 환경에서는 크래시하지 않고 무시해야 합니다.

### 16.2 블루투스 키보드 연결/해제 리로드 방지

Android에서는 블루투스 키보드나 물리 키보드가 연결/해제될 때 `keyboard`, `keyboardHidden`, `navigation` configuration change가 발생할 수 있습니다. 이 변경을 Activity가 직접 처리하지 않으면 `MainActivity`가 재생성되고, React Native/Expo 앱이 처음부터 리로드되는 문제가 생깁니다.

따라서 클론 앱에서도 Android Manifest의 `MainActivity`에 아래 configChanges를 반드시 포함해야 합니다.

```xml
android:configChanges="keyboard|keyboardHidden|navigation|..."
```

현재 앱은 `plugins/withKeyboardConfigChanges.js` Expo config plugin에서 이 값을 자동 보강합니다.

구현 규칙:

- 수동으로 `android/app/src/main/AndroidManifest.xml`만 수정하지 말고 config plugin으로 유지합니다. Expo prebuild나 native 재생성 시 수동 수정이 사라질 수 있기 때문입니다.
- 기존 `configChanges` 값을 덮어쓰지 말고 Set처럼 병합해야 합니다.
- 최소 추가 항목은 `keyboard`, `keyboardHidden`, `navigation`입니다.
- 이 처리는 JS 레벨에서 해결할 수 없습니다. Activity 재생성은 JS가 개입하기 전에 발생합니다.
- 블루투스 키보드 연결/해제 후에도 현재 화면, 뷰어 페이지, 설정 모달 상태가 그대로 유지되어야 합니다.

검증 방법:

- 앱을 뷰어 화면에 둡니다.
- 블루투스 키보드를 연결합니다.
- 같은 키보드를 연결 해제합니다.
- 앱 인트로가 다시 나오거나 Metro/JS bundle이 재로딩되면 실패입니다.
- 현재 보던 페이지가 유지되고 앱이 깜빡임 없이 계속 동작하면 정상입니다.

## 17. 오류 처리 원칙

- 앱 최상단에 ErrorBoundary를 두어 렌더링 오류를 사용자에게 표시합니다.
- 글로벌 JS ErrorUtils handler로 초기화 단계 fatal error를 Alert로 표시합니다.
- 문서 파싱 실패는 뷰어 로딩 오버레이에서 "목록으로"와 "다시 시도"를 제공합니다.
- 마지막 세션 복원 실패 시 앱을 죽이지 않고 세션을 삭제한 뒤 일반 목록으로 진입합니다.
- 폴더 권한 실패는 폴더를 지우지 않고 재연결 필요 상태로 표시합니다.

## 18. 성능 설계

중요한 성능 결정:

- 목록 조회에서 `text` 컬럼 제외.
- 폴더 스캔 때 본문을 읽지 않음.
- 본문은 뷰어 진입 시 지연 hydrate.
- SQLite 쓰기 직렬화로 race condition 방지.
- WebView 페이지 계산은 일정 시간마다 yield해서 UI freeze를 줄임.
- Canvas page surface cache를 현재 페이지 주변으로 제한.
- 폰트 로딩 완료 후 페이지 계산해서 첫 페이지 오차를 줄임.

## 19. 웹 테스트 모드

웹 브라우저는 로컬 파일 시스템을 직접 읽을 수 없으므로, 개발 테스트 전용 파일 서버를 둡니다.

실행:

```bash
npm run web:test
```

구성:

- `scripts/start-test-web.js`가 로컬 HTTP 서버를 먼저 띄웁니다.
- 기본 소설 폴더는 `G:\내 드라이브\소설`입니다.
- 다른 경로를 쓰려면 `TEST_NOVELS_DIR` 환경 변수를 지정합니다.
- 기본 파일 서버 포트는 `8787`이며, `TEST_NOVELS_PORT`로 바꿀 수 있습니다.
- Expo web 서버에는 `EXPO_PUBLIC_TEST_MODE=1`, `EXPO_PUBLIC_TEST_NOVELS_BASE_URL=http://localhost:8787` 환경 변수를 주입합니다.

파일 서버 API:

- `GET /manifest.json`: 지원 문서 목록을 반환합니다.
- `GET /file?path=...`: 선택 문서 바이트를 반환합니다.

보안 규칙:

- `txt`, `epub`, `zip`, `gz`만 허용합니다.
- 요청 경로가 테스트 소설 폴더 밖으로 벗어나면 403을 반환합니다.
- CORS는 개발 편의를 위해 허용하고, cache는 `no-store`로 둡니다.

앱 처리:

- `seedWebTestLibrary()`는 Web + test env에서만 동작합니다.
- 테스트 폴더 ID는 `web-test-novels`, 표시명은 `테스트 소설`입니다.
- manifest를 `DocumentRecord` 목록으로 변환하고 `replaceFolderDocuments()`로 저장합니다.
- 테스트 문서 본문은 `readWebTestDocumentBytes()`가 fetch로 읽습니다.
- 실제 Android SAF 흐름과 같은 `loadViewerDocument()`를 공유하므로 뷰어/이어보기 로직을 웹에서도 검증할 수 있습니다.

## 20. 빌드, 버전, 배포 운영

버전:

- 앱 버전은 `package.json`, `package-lock.json`, `app.json`, `android/app/build.gradle`이 함께 맞아야 합니다.
- patch bump는 `npm run version:patch`로 처리합니다.
- `versionCode`는 `major * 10000 + minor * 100 + patch` 규칙을 사용합니다.
- 현재처럼 특정 버전으로 직접 올릴 때도 네 파일의 값이 일치해야 합니다.

APK 빌드:

```bash
npm run build:release
```

동작:

- Android Gradle task `assembleRelease`를 실행합니다.
- 원본 APK는 `android/app/build/outputs/apk/release/app-release.apk`에 생성됩니다.
- 배포용 복사본은 `apk/release/durumari-book-view-v{version}-release.apk` 형식으로 저장합니다.

Debug 빌드:

```bash
npm run build:debug
```

전체 빌드:

```bash
npm run build:apk
```

검증 원칙:

- 릴리즈 빌드 전 `npx tsc --noEmit`과 `npm test`를 먼저 실행합니다.
- 빌드 산출물 파일명에는 앱 버전을 반드시 포함합니다.
- FTP 등 외부 배포 대상에 올릴 때는 업로드 후 파일 목록 또는 파일 크기를 확인합니다.

## 21. 클론 앱 구현 순서

권장 구현 순서:

1. Expo/RN 프로젝트 생성 및 기본 Android 실행 확인.
2. 타입 정의: Folder, Document, Reading, Bookmark, Settings.
3. SQLite/AsyncStorage 저장소 구현.
4. 설정 기본값과 테마 토큰 구현.
5. SAF 폴더 선택/스캔 구현.
6. 문서 파싱 구현: TXT부터 시작하고 EPUB/ZIP/GZ 확장.
7. 목록 화면 구현.
8. ViewerScreen과 CanvasReader 연결.
9. WebView Canvas 페이지 계산 구현.
10. 읽기 기록 저장 구현.
11. 책갈피 구현.
12. 히스토리/책갈피 목록 구현.
13. 인트로와 마지막 뷰어 자동 복원 구현.
14. 설정 모달과 WebView 설정 업데이트 구현.
15. native plugin 보강: SAF metadata, system bar, keyboard/back.
16. 릴리즈 빌드 스크립트와 버전 관리 스크립트 구현.

최소 MVP 범위:

- TXT 문서만 지원
- 폴더 등록
- 목록
- Canvas 뷰어
- 읽던 위치 저장
- 앱 재실행 시 마지막 뷰어 복원

그 다음 확장:

- EPUB/ZIP/GZ
- 목차
- 책갈피
- 인코딩 재선택
- 볼륨키
- 테마/폰트 상세 설정

## 22. 클론 구현 시 반드시 지켜야 할 핵심 계약

1. `DocumentRecord.text`는 목록 상태에 항상 들고 있지 않습니다.
2. 마지막 뷰어 복원은 인트로 단계에서 처리하고, 인트로 뒤에 별도 뷰어 로딩 화면을 보여주지 않습니다.
3. 읽기 위치와 책갈피는 `page`만 저장하지 말고 `anchorOffset`을 함께 저장합니다.
4. 뷰어 설정 변경으로 페이지 수가 바뀌면 WebView가 reading/bookmark를 보정해 RN 저장소에 다시 동기화합니다.
5. 폴더 스캔은 빠르게 끝나야 하며, 본문 파싱은 문서 열기 시점으로 미룹니다.
6. SQLite 쓰기는 직렬화합니다.
7. WebView 메시지에는 버전과 type을 넣고, 허용된 type만 처리합니다.
8. 뷰어가 아닌 화면에서 앱을 종료한 경우 마지막 뷰어 자동 복원을 하지 않습니다.
9. 폴더 권한 실패는 데이터 삭제가 아니라 재권한 필요 상태로 처리합니다.
10. 큰 파일/압축 파일에는 크기와 압축 해제 제한을 둡니다.
11. 설정 취소는 저장, WebView 업데이트, 페이지 재계산을 발생시키지 않습니다.
12. 볼륨키, SAF metadata, system bar native module은 없는 환경에서도 optional fallback으로 동작해야 합니다.
13. Web 테스트 모드는 실제 SAF 흐름을 대체하지 않고, 같은 문서 로딩/뷰어 로직을 검증하는 개발 전용 경로로만 둡니다.
14. 텍스트 인코딩은 `detectedTextEncoding`, `textEncoding`, `textEncodingSource`를 분리해서 저장하고, 캐시 본문만 있는 구버전 문서는 뷰어 진입 시 원본을 다시 읽어 메타데이터를 채웁니다.
15. 인코딩 선택에서 현재 적용 중인 인코딩은 재선택할 수 없고, 원본 감지값과 같은 인코딩을 선택하면 수동 상태가 아니라 자동 감지 상태로 간주합니다.

## 23. 주요 파일 매핑

현재 프로젝트 기준 핵심 파일:

- `App.tsx`: 부팅, 인트로, 탭 라우팅, 마지막 뷰어 복원.
- `src/contexts/AppContext.tsx`: 전역 상태, activeDocument, openDocument, 정렬, 재스캔.
- `src/lib/store.ts`: SQLite schema, settings, lastViewerSession, CRUD.
- `src/lib/safImport.ts`: Android SAF 폴더 선택/스캔/파일 읽기.
- `src/lib/documentImport.ts`: 문서 파싱, 텍스트 추출, 인코딩 처리.
- `src/lib/viewerDocument.ts`: 뷰어 본문 로딩 공통 함수.
- `src/screens/LibraryScreen.tsx`: 폴더 등록, 문서 목록, 검색/정렬.
- `src/screens/HistoryScreen.tsx`: 읽기 이력.
- `src/screens/BookmarksScreen.tsx`: 책갈피 목록/삭제/진입.
- `src/screens/ViewerScreen.tsx`: 뷰어 상태, 메뉴, 읽기/책갈피 저장.
- `src/components/CanvasReader.tsx`: WebView 브리지.
- `src/viewer/canvasHtml.ts`: 페이지 계산, Canvas 렌더링, 입력 처리.
- `src/components/ViewerRestoreLoader.tsx`: 인트로 중 뷰어 로딩 로직 연결.
- `src/lib/settings.ts`: 기본 설정, 폰트 목록, 테마 토큰.
- `src/lib/testMode.ts`: Web 테스트 문서 seed와 fetch 로더.
- `src/components/ResponsiveFrame.tsx`: 세로 책 프레임, bottom sheet/dialog 크기 계산.
- `src/components/ThemedScreen.tsx`: status/navigation bar 색상과 system background stack.
- `src/lib/nativeText.ts`: Text/TextInput 폰트 스케일 기본값 고정.
- `src/components/MainTabPager.native.tsx`: Native PagerView 탭 전환.
- `src/components/MainTabPager.tsx`: Web 조건부 탭 렌더링.
- `plugins/withKeyboardConfigChanges.js`: Android native 보강.
- `scripts/start-test-web.js`: Web 테스트 파일 서버와 Expo web 실행.
- `scripts/bump-version.js`: patch version/versionCode 동시 갱신.
- `scripts/build-apk.js`: release/debug APK 빌드와 산출물 복사.

## 24. 검증 체크리스트

기능 검증:

- 앱 첫 실행 시 인트로 후 목록 진입.
- 폴더 등록 후 문서 목록 표시.
- 문서 열기 시 본문 로딩 후 첫 페이지 표시.
- 페이지 넘김 시 히스토리에 진행률 반영.
- 앱을 뷰어 상태에서 종료 후 재실행하면 인트로 다음 바로 같은 책 뷰어 표시.
- 앱을 목록 상태에서 종료 후 재실행하면 목록 표시.
- 책갈피 추가 후 책갈피 탭에서 해당 위치로 이동.
- 글꼴/글자 크기/여백 변경 후 읽기 위치와 책갈피 위치가 보정.
- TXT/GZ/ZIP TXT 문서에서 원본 자동 감지 인코딩이 저장되는지 확인.
- 캐시 본문만 있고 인코딩 정보가 없는 문서가 뷰어 진입 시 인코딩 메타데이터를 채우는지 확인.
- 인코딩 변경 시 깨진 한글이 복구되고, 현재 인코딩 버튼이 disabled 되는지 확인.
- 원본 감지 인코딩과 같은 값을 다시 선택하면 `manual` 상태로 남지 않는지 확인.
- 폴더 권한이 사라졌을 때 앱이 크래시하지 않고 재연결 필요 상태 표시.

릴리즈 검증:

- `npm test`
- `npx tsc --noEmit`
- `npm run build:release`
- 실제 Android 기기 설치 후 SAF 폴더 접근, 뷰어, 이어보기 확인.

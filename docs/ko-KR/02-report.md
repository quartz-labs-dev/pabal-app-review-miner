# 리포트 명령

## `report:translate`

수집된 리뷰 JSON을 한국어로 번역합니다.

- `npm run report:translate -- --my-app <owner> ...`
- `node dist/translateReviews.js ...`

### CLI 옵션

- `--my-app` (필수)
- `--registered-apps-path`
- `--input-dir` (기본값: `data/{myAppId}/reviews`)
- `--output-dir` (기본값: `data/{myAppId}/reviews-ko`)
- `--target-lang` (기본값 `ko`)
- `--provider` (`google-web` | `none`, 기본값 `google-web`)
- `--overwrite` (기본값 `false`)
- `--concurrency` (기본값 `4`)
- `--output text|json`

### 예시

```bash
npm run report:translate -- --my-app golden-horizon
```

### 출력

- `data/{myAppId}/reviews-ko/{competitor}.json`
- `data/{myAppId}/reviews-ko/.translation-cache.json`

## `report:render-html`

액셔너블 마크다운 리포트를 공용 뷰어용 bundle JSON으로 변환합니다.

- `npm run report:render-html -- --my-app <owner> ...`
- `npm run report:render-html -- --all`
- `node dist/renderReportHtml.js ...`
- 기본 출력은 JSON bundle만 생성합니다. 앱별 HTML 파일은 옵션(`--with-html`)으로만 생성합니다.
- HTML 문서 제목(H1/`<title>`)은 탭 기준으로 바뀝니다: `review` 탭은 `{myAppId} 리뷰`(영문은 `{myAppId} Review`), `backlog` 탭은 `{myAppId} 백로그`(영문은 `{myAppId} Backlog`)를 사용합니다.
- 생성되는 HTML 상단 왼쪽에는 홈으로 이동하는 `Home` 버튼(`/`)이 포함됩니다.
- 필터는 상단 `필터` 버튼으로 여는 별도 패널에서 관리합니다.
- 좁은 화면에서는 필터 패널이 바텀 시트로 열립니다.
- 좁은 화면에서는 노트 패널도 우측 사이드바 대신 바텀 시트로 열립니다.
- 검색은 기본 `🔎` 버튼으로 표시되며, 버튼을 누르면 검색 입력창이 확장됩니다.
- 검색 입력창은 헤더 남는 공간을 `flex`로 채워 버튼 영역과 함께 반응형으로 정렬됩니다.
- 상단 컨트롤은 탭에 따라 표시됩니다: `리뷰`와 `백로그` 모두 `필터`와 `노트`를 표시합니다.
- `백로그`의 `리뷰 펼치기`는 필터 패널 내부에서 사용할 수 있습니다.
- 상단 네비게이션 상태는 쿼리 파라미터로 동기화되며, 새로고침 시에도 동일한 UI 상태가 유지됩니다.
  - `tab` (`review|backlog`)
  - `q` (검색어)
  - `tags` (다중 선택 태그, 콤마 구분)
  - `exclude` (`all|active|excluded`)
  - `min100` (`100자 이상` 활성 시 `1`)
  - `orig` (`원어 보기` 활성 시 `1`)
  - `priority` (`백로그` 탭 `all|must|should|could`)
  - `effort` (`백로그` 탭 `all|high|medium|low`)
- 헤더 아래 상태줄은 두 탭 모두 표시됩니다.
  - 좌측: 현재 적용 필터 칩(없으면 `필터 없음`)
  - 우측: 전체 대비 선택/필터 결과 수(`리뷰 x/y` 또는 `백로그 x/y`)
- `백로그`는 앱별 섹션이 아닌 전체 통합 백로그 테이블로 표시됩니다.
- `백로그`에서는 앱이 달라도 동일한 백로그 항목이면 하나의 행으로 통합해 표시합니다.
- `백로그`에서는 제목/액션 정규화 기준으로 유사한 백로그 항목도 저장 정규화 단계에서 병합합니다.
- `백로그`의 기본 백로그 정렬은 `우선순위(MUST > SHOULD > COULD) → Status(Not Started > In Progress > Done) → Effort(High > Medium > Low) → 리뷰 수(전체 기준, 내림차순)` 순서입니다.
- `백로그`의 각 백로그 행에는 `Status`(`Not Started | In Progress | Done`) 컬럼이 추가되었고, 인라인으로 즉시 변경할 수 있습니다.
- `Status`는 빠른 식별을 위해 색상으로 구분됩니다: `Not Started`(빨강), `In Progress`(노랑), `Done`(초록).
- 백로그 표의 인라인 셀렉터는 `Priority`(`MUST/SHOULD/COULD`)와 `Effort`(`High/Medium/Low`)도 색상으로 구분됩니다.
- 각 백로그 행의 앱 목록은 1줄 텍스트로 표시되며, 길면 말줄임(`...`) 처리됩니다.
- `백로그`에서는 `리뷰`와 동일한 필터 패널 UX로 `Priority / Effort`를 필터링할 수 있습니다.
- `백로그` 테이블에는 별도 `리뷰 상세` 컬럼이 없으며, `리뷰 수` 옆 화살표 버튼으로 리뷰 행을 펼치고/접습니다.
- `리뷰 수` 컬럼은 `활성/전체` 형식으로 표시됩니다(예: `2/8`).
- `리뷰 수`의 `전체` 값은 원문 인용 라인 수가 아니라, `reviewId` 기준으로 중복 제거한 고유 리뷰 수입니다.
- 리뷰 행을 펼치면 한국어 문장만 기본 표시되며(`KR:` 접두사 없음), `자세히보기`에서 리뷰 ID/메타/원문을 확인할 수 있습니다.
- 리뷰 행을 펼치면 우선순위가 높은 리뷰만 렌더합니다(백로그 항목당 최대 8개).
- 백로그 테마는 고정 하드코딩 목록이 아니라, 앱별 리뷰 텍스트를 기반으로 동적으로 추출됩니다(토큰 빈도 기반 휴리스틱).
- 합성 백로그 입력 단계에서 저신호 리뷰(요청/이슈 없는 짧은 칭찬 등)는 제외하고, 액션 가능한 리뷰를 우선 사용합니다.
- 백로그 `action` 문구는 단순 건수 문장이 아니라, 리뷰 패턴에서 추론한 구체 체크리스트(최대 3개) 형태로 생성됩니다.
- 백로그 `action` 문구 끝의 `(리뷰 N건)` / `(evidence N reviews)` 같은 건수 표기는 더 이상 붙이지 않으며, 건수는 `리뷰 수` 컬럼에서 확인합니다.
- `리뷰`에서는 해시태그 필터를 `#❤️ / #요청기능 / #만족 / #불만족` 다중 선택할 수 있고, `태그 전체`로 초기화할 수 있습니다.
- `리뷰`에서는 활성 상태 필터를 `전체 / 활성 / 비활성`으로 전환할 수 있습니다(기본값 `전체`).
- `리뷰`의 앱 섹션은 최신 등록일 리뷰가 있는 앱이 먼저 나오고, 등록일이 같으면 앱 별점이 높은 순으로 정렬됩니다.
- `리뷰` 카드는 등록일 최신순이 기본이며, 등록일이 같으면 별점 높은순으로 정렬됩니다.
- `리뷰` 카드는 페이지네이션(페이지당 50개)으로 표시되며, 상단 상태줄의 `이전/다음` 버튼으로 이동할 수 있습니다. `이전` 클릭 시 페이지 하단으로, `다음` 클릭 시 리뷰 카드 섹션 상단으로 스크롤됩니다.
- `리뷰`에서는 `100자 이상` 토글로 긴 리뷰만 빠르게 볼 수 있습니다.
- `필터 초기화` 버튼으로 검색/상태/태그/길이 필터를 한 번에 해제할 수 있습니다.
- 필터 패널의 `전체 리뷰 비활성 리셋` 버튼으로 모든 리뷰를 `비활성` 상태로 일괄 전환하고 해시태그를 초기화할 수 있습니다.
- 리뷰 필터 사이드바/바텀시트 헤더에 `필터링 리뷰 수/전체 리뷰 수`가 실시간으로 표시됩니다.
- `리뷰` 탭의 각 앱 행 우측 카운트도 `필터링 리뷰 수/전체 리뷰 수`로 표시됩니다.
- 제목 아래 컨텍스트 블록은 탭에 따라 전환되어, 각 탭에 필요한 정보만 표시됩니다.
- `백로그` 탭 컨텍스트는 카드형 통계/메타 없이, 백로그 건수·우선순위 규칙(해시태그 기준)을 간단한 텍스트로 표시합니다.
- `리뷰` 탭 상단 요약 블록은 카드 없이 줄글로 `앱 수`, `해시태그 정의`, `활성 상태 정의`를 표시합니다.
- 리뷰 카드에서 `#❤️ / #요청기능 / #만족 / #불만족`, `비활성/활성`을 직접 관리할 수 있습니다.
- 선별 리뷰는 카테고리 섹션 대신 `선별 리뷰 (해시태그 기반)` 1개 섹션으로 표시됩니다.
- 리뷰 카드의 `원어` 열기/닫기는 부드러운 펼침/접힘 애니메이션으로 동작합니다.
- 카드 상태가 `비활성`이어도 해시태그를 포함한 카드 버튼을 그대로 누를 수 있습니다(상태 기반 클릭 차단 없음).
- 상단 우측 컨트롤에 `노트` 버튼이 있으며, 우측 사이드바에서 노트 CRUD(생성/선택/수정/삭제)를 직접 수행할 수 있습니다.
- 헤더 액션 버튼 `➕ 백로그 생성`은 `리뷰` 탭과 `백로그` 탭 모두에서 사용할 수 있습니다.
- 노트 패널은 백로그 셀렉터가 아니라 전용 노트 목록 UI를 사용합니다.
- 각 노트는 `제목`과 `내용`을 독립적으로 편집할 수 있습니다.
- 노트 `생성`은 즉시 저장됩니다.
- 노트 `저장`은 현재 활성 노트 1개에만 적용됩니다(내용 입력창 아래 `저장` 버튼 또는 노트 패널 열린 상태에서 `Ctrl/Cmd + S`).
- 노트 `삭제`는 현재 활성 노트를 즉시 삭제/저장합니다.
- `백로그` 탭에서 백로그를 페이지에서 직접 편집할 수 있습니다.
  - 백로그 항목 추가/삭제
  - 표 컬럼 순서는 `Priority → 백로그 항목 → Status → Effort → 리뷰 수(활성/전체) → 작업`입니다
  - 각 행의 `Priority / Status / Effort`를 인라인 셀렉터로 즉시 변경
  - 인라인 셀렉터는 쨍한 빨강/노랑/초록 텍스트와 볼드 처리로 상태 구분을 강화합니다(상태 배경 채움 없음)
  - `Status` 라벨도 동일한 쨍한 빨강/노랑/초록 텍스트 전용 스타일을 사용합니다
  - 백로그 표의 해당 행(row) 클릭 시 편집기가 바로 열립니다(셀렉터/토글/버튼 같은 인라인 컨트롤 클릭은 제외)
  - 행 액션 버튼은 아이콘 전용으로 우측 끝에 배치되며, 순서는 `삭제 → 편집`입니다
  - 백로그 행 삭제 시 브라우저 기본 알럿이 아닌, 중앙 커스텀 확인 모달이 표시됩니다
  - 리뷰 선택은 중앙 모달(페이지네이션)에서 수행하며, 모달에는 `활성` 리뷰만 표시되고 열기/닫기 애니메이션이 적용됩니다
  - 리뷰 선택 모달은 검색 결과 개수와 무관하게 고정 높이를 유지하고, 목록 영역만 내부 스크롤됩니다
  - 편집기 상단 요약은 `선택 개수`와 함께 `저장 전체 개수`를 함께 표시하며, 비활성 리뷰가 있으면 안내 문구로 표시됩니다
  - 백로그 편집기 `리뷰` 목록에서 각 리뷰별로 `활성↔비활성` 상태를 직접 전환할 수 있습니다(즉시 `preview-state` 반영)
  - `비활성`으로 전환해도 백로그 연결은 유지되며, 연결 해제(`×`)를 눌러야 evidence에서 제거됩니다
  - 백로그 편집 본문에는 현재 선택된 리뷰가 ID 칩이 아닌 컴팩트한 리뷰 본문(텍스트만, 앱명 제외) 형태로 표시됩니다
  - 백로그 편집기 헤더 액션은 `삭제`, `적용`, 닫기(`✕`) 순서이며 `삭제` 버튼은 `적용` 왼쪽에 배치됩니다
  - 백로그 편집기에서는 `적용` 버튼으로 `Status` 포함 즉시 영구 저장됩니다
  - 백로그 편집기 외 리포트 표 편집(행 삭제, 인라인 우선순위/상태/난이도 변경, `리뷰` 탭 빠른 추가)도 자동으로 영구 저장됩니다
- `리뷰` 탭의 각 리뷰 카드에는 단일 빠른 추가 셀렉터가 있으며, 백로그를 선택하면 즉시 해당 리뷰가 추가됩니다.
- 빠른 추가 셀렉터에서는 이미 연결된 백로그 항목이 우선순위 없이 `✓`로 표시되고, 카드에는 우측 정렬된 `(N개 연결: 제목, 제목)` 형식의 연결 상태 텍스트가 표시됩니다.
- 빠른 추가 셀렉터는 카드 액션 행 아래의 백로그 전용 행으로 분리되어 표시됩니다(태그/활성 토글과 분리).
- `리뷰` 탭에서 백로그에 추가된 리뷰는 자동으로 `활성` 상태로 전환됩니다.
- 빠른 추가 셀렉터는 페이지 새로고침 없이 백로그 옵션을 자동 갱신합니다: 셀렉터 포커스/열기 시 재검증하고, 탭이 다시 활성화될 때와 화면 표시 중 주기적으로 동기화합니다.
- 리뷰 뷰는 앱별 전체 리뷰 데이터(`data/{myAppId}/reviews-ko/*.json`, 없으면 `reviews/*.json`)를 함께 불러옵니다.
  - 리포트 선별 리뷰는 기본 `활성`
  - 미선별 리뷰는 기본 `비활성` 상태로 포함되어 수동 큐레이션 가능
- preview 모드에서는 카드 상태와 노트가 `data/{myAppId}/reports/preview-state.json`에 저장됩니다(둘 다 즉시 반영).
- `preview-state.json`은 리뷰 카드의 전체 상태(full-state)를 저장합니다(diff-only override 아님).
- `preview-state.json`은 v4 스키마(`reviews.tags`, `reviews.excluded`, `notes.{id}.title`, `notes.{id}.content`)를 사용합니다.
- `data/{myAppId}/icon.png`가 존재하면 HTML에 아이콘 메타 태그(`icon`, `og:image`, `twitter:image`)가 자동 반영됩니다.

### CLI 옵션

- `--my-app` (`--all` 미사용 시 필수)
- `--all` (기본값 `false`): 리뷰 JSON(`data/{appId}/reviews-ko/*.json`, 없으면 `reviews/*.json`)이 있는 앱 전체 일괄 렌더링
- `--registered-apps-path`
- `--input` (선택): 소스 파일(`.md` 또는 `.json`). 생략하면 raw 리뷰 JSON에서 앱 소스를 자동 구성합니다.
- `--output` (기본값: `data/{myAppId}/reports/competitor-raw-actionable.ko.json`)
- `--with-html` (기본값 `false`): 레거시 HTML 파일도 함께 생성
- `--html-output` (`--with-html`일 때 사용, 기본값: `data/{myAppId}/reports/competitor-raw-actionable.ko.html`)
- `--all`은 `--my-app`, `--input`, `--output`, `--html-output`과 함께 사용할 수 없습니다.

### 예시

```bash
npm run report:render-html -- --my-app aurora-eos
npm run report:render-html -- --all
```

### 출력

- `data/{myAppId}/reports/competitor-raw-actionable.ko.json` (공용 뷰어 번들 데이터)
- `data/{myAppId}/reports/backlog.ko.json` (`status`를 포함한 통합 백로그 `items` 데이터, 리뷰는 `sourceToken::reviewId` scoped ID로 저장)
- `--with-html` 사용 시에만: `data/{myAppId}/reports/competitor-raw-actionable.ko.html`

## `report:init-backlog`

앱별 `backlog.ko.json`을 초기화합니다(`preview-state` 초기화와 별도).

- `npm run report:init-backlog -- --my-app <owner> ...`
- `npm run report:init-backlog -- --all`
- `node dist/initReportBacklog.js ...`
- 기본값으로 기존 backlog는 유지하고, 없는 파일만 초기화합니다.
- 내부적으로 `report:render-html`을 호출해 backlog를 생성/정규화합니다.

### CLI 옵션

- `--my-app` (`--all` 미사용 시 필수)
- `--all` (기본값 `false`): `data/` 하위에서 렌더 가능한 앱 전체 초기화
- `--registered-apps-path`
- `--data-dir` (기본값: `data/`)
- `--input` (단일 앱 모드 전용): `report:render-html`로 전달할 소스 파일(`.md`/`.json`)
- `--force` (기본값 `false`): `backlog.ko.json`이 있어도 재생성
- `--dry-run` (기본값 `false`)
- `--all`은 `--my-app`, `--input`과 함께 사용할 수 없습니다.

### 예시

```bash
npm run report:init-backlog -- --my-app aurora-eos
npm run report:init-backlog -- --my-app aurora-eos --force
npm run report:init-backlog -- --all
```

### 출력

- `data/{myAppId}/reports/backlog.ko.json`

## `report:init-state`

리포트 bundle의 기본값을 기준으로 `preview-state.json`을 초기화합니다.

- `npm run report:init-state -- --my-app <owner> ...`
- `npm run report:init-state -- --all`
- `node dist/initReportState.js ...`
- 모든 리뷰 상태를 `data/{myAppId}/reports/preview-state.json`으로 시드합니다.
  - `reviewDefaults[reviewId].excluded` (기본 활성/비활성)
  - `reviewDefaults[reviewId].tags` (기본 해시태그)
- 이 명령은 초기 마이그레이션/리셋 용도입니다. 초기화 이후에는 preview UI에서 상태를 수동 관리하면 됩니다.
- `report:render-html`은 리포트 번들(JSON)과 옵션 레거시 HTML만 생성하며 `preview-state.json`을 리셋하지 않습니다.

### CLI 옵션

- `--my-app` (`--all` 미사용 시 필수)
- `--all` (기본값 `false`): `data/{appId}/reports/competitor-raw-actionable.ko.json`가 있는 앱 전체 초기화
- `--registered-apps-path`
- `--data-dir` (기본값: `data/`)
- `--input` (기본값: `data/{myAppId}/reports/competitor-raw-actionable.ko.json`)
- `--output` (기본값: `data/{myAppId}/reports/preview-state.json`)
- `--keep-notes` (기본값 `true`): 리뷰 상태를 다시 초기화할 때 기존 사용자 노트 유지
- `--all`은 `--my-app`, `--input`, `--output`과 함께 사용할 수 없습니다.

### 예시

```bash
npm run report:init-state -- --my-app aurora-eos
npm run report:init-state -- --all
```

### 출력

- `data/{myAppId}/reports/preview-state.json`

## `report:preview`

localhost 프리뷰 서버를 실행합니다.

- 대시보드 모드: 앱 목록 + 생성된 리포트 파일(`.md`, `.json`, 옵션 레거시 `.html`) 표시
- 권장 흐름: 앱별 데이터는 JSON bundle만 유지하고 `/v/:appId` 공용 뷰어로 확인
- 대시보드의 기본 `View Report` 링크는 공용 뷰어 라우트(`/v/:appId`)를 사용합니다.
- `/v/:appId`는 서버에서 `competitor-raw-actionable.ko.json`을 읽어 `html` 내용을 직접 응답합니다(클라이언트 번들 부트스트랩 없음).
- 대시보드 모드에서 `data/{appId}/icon.png`가 있으면 앱 아이콘 표시
- 리포트 화면 상단도 `data/{appId}/icon.png`를 사용하며, 아이콘이 없으면 `appId` 텍스트로 fallback
- 대시보드 배경은 뷰포트 전체 높이를 채우도록 렌더링됩니다(짧은 콘텐츠에서도 배경이 끊기지 않음).
- 단일 파일 모드: `--file`로 레거시 HTML 1개 서빙
- 리뷰 카드 상태 관리를 위한 API를 제공합니다.
  - `GET /api/preview-state/:appId`
  - `PUT /api/preview-state/:appId`
  - 저장 파일: `data/{myAppId}/reports/preview-state.json`
- 백로그 편집 저장 API를 제공합니다.
  - `GET /api/backlog/:appId`
  - `PUT /api/backlog/:appId`
  - 요청/응답의 `items[].evidenceReviewIds`는 scoped ID(`sourceToken::reviewId`)를 사용합니다.
  - 저장 파일: `data/{myAppId}/reports/backlog.ko.json`

- `npm run report:preview -- [options]`
- `node dist/previewReport.js ...`

### CLI 옵션

- `--my-app` (선택): 대시보드 필터
- `--registered-apps-path`
- `--file`: 단일 파일 모드 경로
- `--data-dir` (기본값: `data/`)
- `--host` (기본값: `127.0.0.1`)
- `--port` (기본값: `4173`)

### 예시

```bash
npm run report:preview -- --port 4173
npm run report:preview -- --my-app aurora-eos --port 4173
npm run report:preview -- --file data/aurora-eos/reports/competitor-raw-actionable.ko.html --port 4173  # 레거시 모드
```

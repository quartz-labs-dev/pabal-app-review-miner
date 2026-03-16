# 리포트 명령 (ko-KR)

사전 준비와 `registered-apps.json` 설정은 [README](./README.md)를 참고하세요.

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

## `report:analyze`

번역 리뷰를 기반으로 경쟁앱 인사이트 리포트를 생성합니다.

- `npm run report:analyze -- --my-app <owner> ...`
- `node dist/analyzeCompetitors.js ...`

### CLI 옵션

- `--my-app` (필수)
- `--registered-apps-path`
- `--input-dir` (기본값: `data/{myAppId}/reviews-ko`, 없으면 `reviews/` 폴백)
- `--output-dir` (기본값: `data/{myAppId}/reports`)
- `--include-self` (기본값 `false`)
- `--top-quotes` (기본값 `3`)
- `--output text|json`

### 예시

```bash
npm run report:analyze -- --my-app golden-horizon
npm run report:analyze -- --my-app golden-horizon --include-self
```

### 출력

- `data/{myAppId}/reports/competitor-report.ko.md`
- `data/{myAppId}/reports/competitor-report.ko.json`
- 생성되는 마크다운 제목(H1)은 `{myAppId} 리뷰 리포트` 형식입니다.

## `report:render-html`

액셔너블 마크다운 리포트를 인터랙티브 HTML로 변환합니다.

- `npm run report:render-html -- --my-app <owner> ...`
- `npm run report:render-html -- --all`
- `node dist/renderReportHtml.js ...`
- HTML 문서 제목(H1/`<title>`)은 `{myAppId} 리뷰 리포트`(영문 리포트는 `{myAppId} Review Report`) 형식으로 고정됩니다.
- 생성되는 HTML 상단 왼쪽에는 홈으로 이동하는 `Home` 버튼(`/`)이 포함됩니다.
- 필터는 상단 `필터` 버튼으로 여는 별도 패널에서 관리합니다.
- 좁은 화면에서는 필터 패널이 바텀 시트로 열립니다.
- 좁은 화면에서는 노트 패널도 우측 사이드바 대신 바텀 시트로 열립니다.
- 검색은 기본 `🔎` 버튼으로 표시되며, 버튼을 누르면 검색 입력창이 확장됩니다.
- 상단 컨트롤은 탭에 따라 표시됩니다: `리뷰`에서는 `필터`와 `노트`, `리포트`에서는 `근거 펼치기`/`우선순위 필터`와 동일한 `노트` 버튼(사이드바·바텀시트)이 표시됩니다.
- 탭 상태는 쿼리 파라미터 `?tab=reviews|reports`로 동기화되며(`review/raw`, `report/backlog` 별칭 허용), 새로고침 시에도 선택한 탭이 유지됩니다.
- `리포트`에서는 보조 상태줄(2단)이 숨겨져 네비게이션이 1단으로만 표시되며, `리포트 N/N` 카운트 라벨은 표시하지 않습니다.
- `리포트`는 앱별 섹션이 아닌 전체 통합 백로그 테이블로 표시됩니다.
- `리포트`에서는 앱이 달라도 동일한 백로그 항목이면 하나의 행으로 통합해 표시합니다.
- 각 백로그 행의 앱 목록은 1줄 텍스트로 표시되며, 길면 말줄임(`...`) 처리됩니다.
- `리포트`에서는 우선순위 필터(`전체 / MUST / SHOULD / COULD`)로 행을 빠르게 걸러볼 수 있습니다.
- `리포트` 테이블에는 별도 `근거` 컬럼이 없으며, `근거 수` 옆 화살표 버튼으로 근거 행을 펼치고/접습니다.
- `근거 수`는 원문 인용 라인 수가 아니라, `reviewId` 기준으로 중복 제거한 고유 리뷰 수로 계산됩니다.
- 근거 행을 펼치면 한국어 문장만 기본 표시되며(`KR:` 접두사 없음), `자세히보기`에서 리뷰 ID/메타/원문을 확인할 수 있습니다.
- 근거 행을 펼치면 해당 백로그 항목에 매칭된 근거 리뷰를 샘플링 없이 전부 렌더합니다.
- `리뷰`에서는 해시태그 필터를 `#❤️ / #만족 / #불만족` 다중 선택할 수 있고, `태그 전체`로 초기화할 수 있습니다.
- `리뷰`에서는 활성 상태 필터를 `전체 / 활성 / 비활성`으로 전환할 수 있습니다(기본값 `전체`).
- `리뷰`에서는 `100자 이상` 토글로 긴 리뷰만 빠르게 볼 수 있습니다.
- `필터 초기화` 버튼으로 검색/상태/태그/길이 필터를 한 번에 해제할 수 있습니다.
- 필터 패널의 `전체 리뷰 비활성 리셋` 버튼으로 모든 리뷰를 `비활성` 상태로 일괄 전환하고 해시태그를 초기화할 수 있습니다.
- 리뷰 필터 사이드바/바텀시트 헤더에 `필터링 리뷰 수/전체 리뷰 수`가 실시간으로 표시됩니다.
- `리뷰` 탭은 페이지네이션을 지원하며 페이지 크기는 `100개/페이지`로 고정됩니다.
- 페이지네이션은 현재 검색/필터 결과를 기준으로 동작하며, 페이지네이션 영역에 `필터링 리뷰 수/전체 리뷰 수`가 표시됩니다.
- `리뷰` 탭의 각 앱 행 우측 카운트도 `필터링 리뷰 수/전체 리뷰 수`로 표시됩니다.
- 제목 아래 컨텍스트 블록은 탭에 따라 전환되어, 각 탭에 필요한 정보만 표시됩니다.
- `리포트` 탭 컨텍스트는 카드형 통계/메타 없이, 백로그 건수·우선순위 규칙을 간단한 텍스트로 표시합니다.
- `리뷰` 탭 상단 요약 블록은 카드 없이 줄글로 `앱 수`, `해시태그 정의`, `활성 상태 정의`를 표시합니다.
- 리뷰 카드에서 `#❤️ / #만족 / #불만족`, `비활성/활성`을 직접 관리할 수 있습니다.
- 리뷰 카드의 `원어` 열기/닫기는 부드러운 펼침/접힘 애니메이션으로 동작합니다.
- 해시태그는 카드가 `활성` 상태일 때만 수정할 수 있습니다.
- 상단 우측 컨트롤에 `노트` 버튼이 있으며, 우측 사이드바에서 앱 셀렉터를 전환해 앱 단위 메모를 관리할 수 있습니다.
- 노트 패널의 앱 셀렉터에서 현재 적용할 앱을 선택해 메모를 관리할 수 있습니다.
- 노트 사이드바에는 선택한 앱의 스토어 링크(App Store/Google Play)만 표시됩니다.
- 노트는 자동 저장되지 않으며, `저장` 버튼(또는 `Ctrl/Cmd + S`)으로 수동 저장합니다.
- 리뷰 뷰는 앱별 전체 리뷰 데이터(`data/{myAppId}/reviews-ko/*.json`, 없으면 `reviews/*.json`)를 함께 불러옵니다.
  - 리포트 선별 리뷰는 기본 `활성`
  - 미선별 리뷰는 기본 `비활성` 상태로 포함되어 수동 큐레이션 가능
- preview 모드에서는 카드 상태와 앱 노트가 `data/{myAppId}/reports/preview-state.json`에 저장됩니다(카드 상태는 즉시 반영, 노트는 저장 버튼으로 반영).
- `preview-state.json`은 v2 스키마(`reviews.tags`, `reviews.excluded`, `appNotes`)만 사용합니다. 기존 `favorite`/`notes` 필드는 더 이상 사용하지 않습니다.
- `data/{myAppId}/icon.png`가 존재하면 HTML에 아이콘 메타 태그(`icon`, `og:image`, `twitter:image`)가 자동 반영됩니다.

### CLI 옵션

- `--my-app` (`--all` 미사용 시 필수)
- `--all` (기본값 `false`): `data/{appId}/reports/competitor-raw-actionable.ko.md`가 있는 앱 전체 일괄 렌더링
- `--registered-apps-path`
- `--input` (기본값: `data/{myAppId}/reports/competitor-raw-actionable.ko.md`)
- `--output` (기본값: `data/{myAppId}/reports/competitor-raw-actionable.ko.html`)
- `--all`은 `--my-app`, `--input`, `--output`과 함께 사용할 수 없습니다.

### 예시

```bash
npm run report:render-html -- --my-app aurora-eos
npm run report:render-html -- --all
```

### 출력

- `data/{myAppId}/reports/competitor-raw-actionable.ko.html`

## `report:preview`

localhost 프리뷰 서버를 실행합니다.

- 대시보드 모드: 앱 목록 + 생성된 리포트 파일(`.html`, `.md`, `.json`) 표시
- 대시보드 모드에서 `data/{appId}/icon.png`가 있으면 앱 아이콘 표시
- 리포트 화면 상단도 `data/{appId}/icon.png`를 사용하며, 아이콘이 없으면 `appId` 텍스트로 fallback
- 대시보드 배경은 뷰포트 전체 높이를 채우도록 렌더링됩니다(짧은 콘텐츠에서도 배경이 끊기지 않음).
- 단일 파일 모드: `--file`로 HTML 1개 서빙
- 리뷰 카드 상태 관리를 위한 API를 제공합니다.
  - `GET /api/preview-state/:appId`
  - `PUT /api/preview-state/:appId`
  - 저장 파일: `data/{myAppId}/reports/preview-state.json`

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
npm run report:preview -- --file data/aurora-eos/reports/competitor-raw-actionable.ko.html --port 4173
```

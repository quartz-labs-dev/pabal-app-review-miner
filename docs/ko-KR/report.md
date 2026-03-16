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
- `node dist/renderReportHtml.js ...`
- HTML 문서 제목(H1/`<title>`)은 `{myAppId} 리뷰 리포트`(영문 리포트는 `{myAppId} Review Report`) 형식으로 고정됩니다.
- 생성되는 HTML 상단 왼쪽에는 홈으로 이동하는 `Home` 버튼(`/`)이 포함됩니다.
- 필터는 상단 `필터` 버튼으로 여는 별도 패널에서 관리합니다.
- 좁은 화면에서는 필터 패널이 바텀 시트로 열립니다.
- 좁은 화면에서는 노트 패널도 우측 사이드바 대신 바텀 시트로 열립니다.
- 상단 컨트롤은 탭에 따라 표시됩니다: `리뷰`에서는 `필터`와 `노트`, `리포트`에서는 `근거 펼치기`가 표시됩니다.
- `리뷰`에서는 해시태그 필터를 `#❤️ / #만족 / #불만족` 다중 선택할 수 있고, `태그 전체`로 초기화할 수 있습니다.
- `리뷰`에서는 활성 상태 필터를 `전체 / 활성 / 비활성`으로 전환할 수 있습니다(기본값 `전체`).
- `리뷰`에서는 `100자 이상` 토글로 긴 리뷰만 빠르게 볼 수 있습니다.
- `필터 초기화` 버튼으로 검색/상태/태그/길이 필터를 한 번에 해제할 수 있습니다.
- `리뷰` 탭은 페이지네이션을 지원합니다(기본 `100개/페이지`, `50/100/200` 변경 가능).
- 페이지네이션은 현재 검색/필터 결과를 기준으로 동작하며, 요약에는 `현재 페이지 표시 수 / 필터 결과 수 / 전체 수`가 표시됩니다.
- 제목 아래 요약/통계 블록도 탭에 따라 전환되어, 각 탭에 필요한 정보만 표시됩니다.
- 리뷰 카드에서 `#❤️ / #만족 / #불만족`, `비활성/활성`을 직접 관리할 수 있습니다.
- 해시태그는 카드가 `활성` 상태일 때만 수정할 수 있습니다.
- 상단 우측 컨트롤에 `노트` 버튼이 있으며, 우측 사이드바에서 앱 탭을 전환해 앱 단위 메모를 관리할 수 있습니다.
- 노트 사이드바에는 선택한 앱 이름과 스토어 링크(App Store/Google Play)가 표시됩니다.
- 노트는 자동 저장되지 않으며, `저장` 버튼(또는 `Ctrl/Cmd + S`)으로 수동 저장합니다.
- 리뷰 뷰는 앱별 전체 리뷰 데이터(`data/{myAppId}/reviews-ko/*.json`, 없으면 `reviews/*.json`)를 함께 불러옵니다.
  - 리포트 선별 리뷰는 기본 `활성`
  - 미선별 리뷰는 기본 `비활성` 상태로 포함되어 수동 큐레이션 가능
- preview 모드에서는 카드 상태와 앱 노트가 `data/{myAppId}/reports/preview-state.json`에 저장됩니다(카드 상태는 즉시 반영, 노트는 저장 버튼으로 반영).
- `preview-state.json`은 v2 스키마(`reviews.tags`, `reviews.excluded`, `appNotes`)만 사용합니다. 기존 `favorite`/`notes` 필드는 더 이상 사용하지 않습니다.
- `data/{myAppId}/icon.png`가 존재하면 HTML에 아이콘 메타 태그(`icon`, `og:image`, `twitter:image`)가 자동 반영됩니다.

### CLI 옵션

- `--my-app` (필수)
- `--registered-apps-path`
- `--input` (기본값: `data/{myAppId}/reports/competitor-raw-actionable.ko.md`)
- `--output` (기본값: `data/{myAppId}/reports/competitor-raw-actionable.ko.html`)

### 예시

```bash
npm run report:render-html -- --my-app aurora-eos
```

### 출력

- `data/{myAppId}/reports/competitor-raw-actionable.ko.html`

## `report:preview`

localhost 프리뷰 서버를 실행합니다.

- 대시보드 모드: 앱 목록 + 생성된 리포트 파일(`.html`, `.md`, `.json`) 표시
- 대시보드 모드에서 `data/{appId}/icon.png`가 있으면 앱 아이콘 표시
- 리포트 화면 상단도 `data/{appId}/icon.png`를 사용하며, 아이콘이 없으면 `appId` 텍스트로 fallback
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

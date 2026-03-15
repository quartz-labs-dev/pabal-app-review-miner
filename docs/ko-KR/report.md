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

## `report:render-html`

액셔너블 마크다운 리포트를 인터랙티브 HTML로 변환합니다.

- `npm run report:render-html -- --my-app <owner> ...`
- `node dist/renderReportHtml.js ...`
- 생성되는 HTML 상단 왼쪽에는 홈으로 이동하는 `Home` 버튼(`/`)이 포함됩니다.
- 상단 컨트롤은 탭에 따라 표시됩니다: `Raw 리뷰`에서는 `원어 전체 보기`, `실행 백로그`에서는 `근거 펼치기`만 노출됩니다.
- `Raw 리뷰`에서는 제외 상태 필터를 `전체 / 활성만 / 제외만`으로 전환할 수 있습니다(기본값 `전체`).
- `Raw 리뷰`에서는 `100자 이상만` 토글로 긴 리뷰만 빠르게 볼 수 있습니다.
- 제목 아래 요약/통계 블록도 탭에 따라 전환되어, 각 탭에 필요한 정보만 표시됩니다.
- Raw 리뷰 카드에서 `즐겨찾기`, `제외/복원`을 직접 관리할 수 있습니다.
- Raw 뷰는 앱별 전체 리뷰 데이터(`data/{myAppId}/reviews-ko/*.json`, 없으면 `reviews/*.json`)를 함께 불러옵니다.
  - 리포트 선별 리뷰는 기본 `활성`
  - 미선별 리뷰는 기본 `제외` 상태로 포함되어 수동 큐레이션 가능
- preview 모드에서는 카드 상태가 `data/{myAppId}/reports/preview-state.json`에 저장됩니다.

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
- 단일 파일 모드: `--file`로 HTML 1개 서빙
- Raw 리뷰 카드 상태 관리를 위한 API를 제공합니다.
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

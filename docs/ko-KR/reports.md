# 리포트 가이드 (ko-KR)

사전 준비는 [셋업](./setup.md)을 먼저 확인하세요.

이 문서 하나에서 리뷰/리포트 스크립트를 모두 설명합니다.

## `review:collect`

경쟁 앱 리뷰를 수집하는 메인 스크립트입니다.

- `npm run review:collect -- --my-app <owner> ...`
- `node dist/cli.js ...`

### CLI 옵션

- `--my-app` (필수): 내 앱 ID 해석 키
- `--play`: 경쟁 앱 Google Play app id
- `--ios`: 경쟁 앱 App Store app id
- `--platform`: `both` | `ios` | `android` (기본값 `both`)
- `--auto-top`: 자동 탐색 시 스토어별 상위 N개 (기본값 `5`)
- `--limit`: 소스 요청당 리뷰 수 (기본값 `200`)
- `--global`: 글로벌 마켓 순회 수집 (기본 활성화)
- `--no-global`: 글로벌 순회 비활성화 (Play `us/en`, App Store `us`만)
- `--apps`: 경쟁 앱 목록 JSON 경로
- `--registered-apps-path`: 등록 앱 파일 경로 커스텀
- `--output text|json`: 출력 모드 (기본값 `text`)
- `--dry-run`: 실행 계획만 출력
- `--validate-only`: 검증만 수행

### 예시

```bash
npm run review:collect -- --my-app golden-horizon --apps apps.json --limit 200
npm run review:collect -- --my-app golden-horizon --auto-top 5 --limit 200
npm run review:collect -- --my-app golden-horizon --apps apps.json --platform ios --limit 200
npm run review:collect -- --my-app golden-horizon --apps apps.json --output json
```

### 출력

- `data/{myAppId}/reviews/{competitor}.json`

## `review:collect-by-name`

앱 이름으로 id를 찾은 뒤 리뷰를 수집합니다.

- `npm run review:collect-by-name -- --my-app <owner> --name "<query>" ...`
- `node dist/addByName.js ...`

### CLI 옵션

- `--my-app` (필수): 소유 앱 키
- `--name` (필수): 앱 이름 검색어
- `--play-id`: Play id 강제 지정(선택)
- `--ios-id`: App Store id 강제 지정(선택)
- `--platform`: `both` | `ios` | `android` (기본값 `both`)
- `--limit`: 소스 요청당 리뷰 수 (기본값 `200`)
- `--global` / `--no-global`: 글로벌 순회 토글
- `--registered-apps-path`: 등록 앱 파일 경로 커스텀
- `--output text|json`: 출력 모드

### 예시

```bash
npm run review:collect-by-name -- --my-app golden-horizon --name "BJJBuddy" --limit 200
npm run review:collect-by-name -- --my-app golden-horizon --name "BJJBuddy" --platform ios
npm run review:collect-by-name -- --my-app golden-horizon --name "BJJBuddy" --output json
```

### 출력

- `data/{myAppId}/reviews/manual__play-<id>__ios-<id>.json` (해석된 id 조합에 따라 달라짐)

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

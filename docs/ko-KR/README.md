# pabal-app-review-miner 문서 (ko-KR)

## 개요

`pabal-app-review-miner`는 Google Play / App Store 경쟁 앱 리뷰를 raw 데이터로 수집하고, 내 앱 ID 기준으로 정리해 저장하는 CLI입니다.

## 주요 기능

- Google Play / App Store 최신 리뷰 수집
- 단일 경쟁 앱, 멀티 경쟁 앱 수집 지원
- `--my-app`만으로 스토어별 상위 경쟁 앱 자동 탐색 지원
- 내 앱 기준 스코프로 경쟁 앱별 JSON 저장
- 수집된 리뷰를 한국어로 번역해 `reviews-ko/`에 저장
- 번역 리뷰 기반 경쟁앱 인사이트 리포트 생성 (`reports/`)

출력 구조:

- `data/{myAppId}/reviews/{competitor}.json`

## 빠른 시작

```bash
npm install
npm run build
npm run setup:config
npm run review:collect -- --my-app golden-horizon --apps apps.json --limit 200
npm run review:collect -- --my-app golden-horizon --auto-top 5 --limit 200
npm run review:collect -- --my-app golden-horizon --apps apps.json --platform ios --limit 200
npm run review:collect-by-name -- --my-app golden-horizon --name "BJJBuddy"
npm run report:translate -- --my-app golden-horizon
npm run report:analyze -- --my-app golden-horizon
npm run report:render-html -- --my-app golden-horizon
npm run report:preview -- --my-app golden-horizon --port 4173
```

## 문서 안내

- [셋업](./setup.md): 사전 준비 및 `registered-apps.json` 설정
- [리포트 가이드](./reports.md): 모든 리뷰/리포트 명령을 하나의 문서에서 섹션별로 안내

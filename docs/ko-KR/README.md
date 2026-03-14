# pabal-app-review-miner 문서 (ko-KR)

## 개요

`pabal-app-review-miner`는 Google Play / App Store 경쟁 앱 리뷰를 raw 데이터로 수집하고, 내 앱 ID 기준으로 정리해 저장하는 CLI입니다.

## 주요 기능

- Google Play / App Store 최신 리뷰 수집
- 단일 경쟁 앱, 멀티 경쟁 앱 수집 지원
- `--my-app`만으로 스토어별 상위 경쟁 앱 자동 탐색 지원
- 내 앱 기준 스코프로 경쟁 앱별 JSON 저장

출력 구조:

- `data/{myAppId}/reviews/{competitor}.json`

## 빠른 시작

```bash
npm install
npm run build
npm run setup:config
npm run collect-reviews -- --my-app golden-horizon --apps apps.json --limit 200
npm run collect-reviews -- --my-app golden-horizon --auto-top 5 --limit 200
npm run collect-reviews -- --my-app golden-horizon --apps apps.json --platform ios --limit 200
npm run collect-reviews-by-name -- --my-app golden-horizon --name "BJJBuddy"
```

## 문서 안내

- [셋업](./setup.md): 사전 준비 및 `registered-apps.json` 설정
- [collect-reviews](./collect-reviews.md): 메인 경쟁앱 리뷰 수집 흐름
- [collect-reviews-by-name](./collect-reviews-by-name.md): 앱 이름 기반 ID 탐색 + 수집 흐름

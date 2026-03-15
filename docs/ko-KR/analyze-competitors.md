# 사용법: `analyze-competitors`

사전 준비와 소유 앱 키 해석은 [셋업](./setup.md)을 먼저 확인하세요.

이 문서는 경쟁앱 인사이트 리포트를 생성하는 스크립트를 설명합니다.

- `npm run analyze-competitors -- --my-app <owner> ...`
- `node dist/analyzeCompetitors.js ...`

## CLI 옵션

- `--my-app` (필수): 소유 앱 키 (`slug`, `name`, `bundleId`, `packageName`, `appId` 매칭)
- `--registered-apps-path`: 등록 앱 파일 경로 커스텀
- `--input-dir`: 분석 입력 경로 (기본값: `data/{myAppId}/reviews-ko`, 없으면 `reviews/`로 폴백)
- `--output-dir`: 리포트 출력 경로 (기본값: `data/{myAppId}/reports`)
- `--include-self`: `*-self.json`도 분석 포함 (기본값 `false`)
- `--top-quotes`: 경쟁앱별 대표 저평점 리뷰 개수 (기본값 `3`)
- `--output text|json`: 출력 모드 (기본값 `text`)

## 기본 실행

```bash
npm run analyze-competitors -- --my-app golden-horizon
```

## 내 앱(self) 포함 벤치마크

```bash
npm run analyze-competitors -- --my-app golden-horizon --include-self
```

## JSON 출력

```bash
npm run analyze-competitors -- --my-app golden-horizon --output json
```

## 출력

- `data/{myAppId}/reports/competitor-report.ko.md`
- `data/{myAppId}/reports/competitor-report.ko.json`

리포트에는 아래 내용이 포함됩니다.

- 경쟁앱별 평균 평점 및 저평점 비율
- 최근 90일 저평점 추세
- 키워드 기반 부정/긍정 토픽 요약
- 대표 저평점 리뷰 인용

# 사용법: `report:translate`

사전 준비와 소유 앱 키 해석은 [셋업](../setup.md)을 먼저 확인하세요.

이 문서는 수집된 리뷰 JSON을 한국어로 번역하는 스크립트를 설명합니다.

- `npm run report:translate -- --my-app <owner> ...`
- `node dist/translateReviews.js ...`

## CLI 옵션

- `--my-app` (필수): 소유 앱 키 (`slug`, `name`, `bundleId`, `packageName`, `appId` 매칭)
- `--registered-apps-path`: 등록 앱 파일 경로 커스텀
- `--input-dir`: 원본 리뷰 JSON 경로 (기본값: `data/{myAppId}/reviews`)
- `--output-dir`: 번역 결과 저장 경로 (기본값: `data/{myAppId}/reviews-ko`)
- `--target-lang`: 번역 대상 언어 (기본값 `ko`)
- `--provider`: 번역 제공자 `google-web` | `none` (기본값 `google-web`)
- `--overwrite`: 기존 번역 파일 덮어쓰기 (기본값 `false`)
- `--concurrency`: 번역 동시 작업 수 (기본값 `4`)
- `--output text|json`: 출력 모드 (기본값 `text`)

## 기본 실행

```bash
npm run report:translate -- --my-app golden-horizon
```

## 기존 번역 덮어쓰기

```bash
npm run report:translate -- --my-app golden-horizon --overwrite
```

## JSON 출력

```bash
npm run report:translate -- --my-app golden-horizon --output json
```

## 출력

- `data/{myAppId}/reviews-ko/{competitor}.json`
- `data/{myAppId}/reviews-ko/.translation-cache.json` (문장 단위 번역 캐시)

각 리뷰는 원본 `text`를 유지하고 아래 필드가 추가됩니다.

- `textKo`: 한국어 번역문
- `detectedLang`: 감지된 원문 언어(가능한 경우)
- `translatedAt`: 번역 시각

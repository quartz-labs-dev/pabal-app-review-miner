# 사용법: `collect-reviews-by-name`

사전 준비는 [셋업](./setup.md)을 먼저 확인하세요.

이 문서는 이름 기반 수집 스크립트를 설명합니다.

- `npm run collect-reviews-by-name -- --my-app <owner> --name "<query>" ...`
- `node dist/addByName.js ...`

## CLI 옵션

- `--my-app` (필수): 소유 앱 키 (`slug`, `name`, `bundleId`, `packageName`, `appId` 매칭)
- `--name` (필수): 앱 이름 검색어
- `--play-id`: Google Play app id 강제 지정(선택)
- `--ios-id`: App Store app id 강제 지정(선택)
- `--platform`: 수집 플랫폼 필터 `both` | `ios` | `android` (기본값 `both`)
- `--limit`: 소스 요청당 리뷰 수 (기본값 `200`)
- `--global`: 글로벌 스토어 마켓/국가 순회 수집 (기본값 활성화)
- `--no-global`: 글로벌 순회를 끄고 기본 마켓 요청(Play `us/en`, App Store `us`)만 수집
- `--registered-apps-path`: 등록 앱 파일 경로 커스텀
- `--output text|json`: 출력 모드 (기본값 `text`)

## 기본 실행

```bash
npm run collect-reviews-by-name -- --my-app golden-horizon --name "BJJBuddy" --limit 200
```

## 스토어 제한 실행

iOS만 수집:

```bash
npm run collect-reviews-by-name -- --my-app golden-horizon --name "BJJBuddy" --platform ios
```

Android만 수집:

```bash
npm run collect-reviews-by-name -- --my-app golden-horizon --name "BJJBuddy" --platform android
```

## ID 직접 지정

```bash
npm run collect-reviews-by-name -- --my-app golden-horizon --name "BJJBuddy" \
  --play-id com.bjja.buddy \
  --ios-id 123456789
```

## JSON 출력

```bash
npm run collect-reviews-by-name -- --my-app golden-horizon --name "BJJBuddy" --output json
```

## 출력

- `data/{myAppId}/reviews/manual__play-<id>__ios-<id>.json` (해결된 id 조합에 따라 파일명 형태가 달라짐)

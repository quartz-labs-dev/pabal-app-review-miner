# 리뷰 명령 (ko-KR)

사전 준비와 `registered-apps.json` 설정은 [README](./README.md)를 참고하세요.

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
- `--limit`: 소스 요청당 리뷰 수 (기본값 `200`, 고정 상한 아님)
- `--global`: 글로벌 마켓 순회 수집 (기본 활성화)
- `--no-global`: 글로벌 순회 비활성화 (Play `us/en`, App Store `us`만)
- `--append-existing`: 기존 출력 JSON과 병합 후 `reviewId` 기준 dedupe (기본값 `false`)
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
npm run review:collect -- --my-app golden-horizon --apps apps.json --limit 200 --append-existing
npm run review:collect -- --my-app golden-horizon --apps apps.json --output json
```

### 출력

- `data/{myAppId}/reviews/{competitor}.json`
- `reviews[]` 항목에는 아래 필드가 포함됩니다.
  - `reviewId`: dedupe 및 preview 상태 연동용 안정 ID
  - `storeReviewId` (선택): 스토어가 제공하는 원본 리뷰 ID (가능한 경우)

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
- `--limit`: 소스 요청당 리뷰 수 (기본값 `200`, 고정 상한 아님)
- `--global` / `--no-global`: 글로벌 순회 토글
- `--append-existing`: 기존 출력 JSON과 병합 후 `reviewId` 기준 dedupe (기본값 `false`)
- `--registered-apps-path`: 등록 앱 파일 경로 커스텀
- `--output text|json`: 출력 모드

### 예시

```bash
npm run review:collect-by-name -- --my-app golden-horizon --name "BJJBuddy" --limit 200
npm run review:collect-by-name -- --my-app golden-horizon --name "BJJBuddy" --platform ios
npm run review:collect-by-name -- --my-app golden-horizon --name "BJJBuddy" --append-existing
npm run review:collect-by-name -- --my-app golden-horizon --name "BJJBuddy" --output json
```

### 출력

- `data/{myAppId}/reviews/manual__play-<id>__ios-<id>.json` (해석된 id 조합에 따라 달라짐)

## `review:backfill-ids`

이미 저장된 리뷰 JSON에서 누락된 `reviewId`를 재다운로드 없이 채웁니다.

- `npm run review:backfill-ids -- --my-app <owner> ...`
- `node dist/backfillReviewIds.js ...`

### CLI 옵션

- `--my-app` (필수): 소유 앱 키
- `--registered-apps-path`: 등록 앱 파일 경로 커스텀
- `--input-dir` (기본값: `data/{myAppId}/reviews`)
- `--dry-run`: 파일 수정 없이 점검만 수행
- `--output text|json`: 출력 모드

### 예시

```bash
npm run review:backfill-ids -- --my-app golden-horizon
npm run review:backfill-ids -- --my-app golden-horizon --dry-run
npm run review:backfill-ids -- --my-app golden-horizon --input-dir data/golden-horizon/reviews-ko
```

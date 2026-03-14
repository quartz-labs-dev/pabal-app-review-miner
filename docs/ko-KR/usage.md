# 사용법

사전 준비는 [셋업](./setup.md)을 먼저 확인하세요.

## CLI 옵션

- `--my-app` (필수): 내 앱 ID를 찾기 위한 키
- `--play`: 경쟁 앱 Google Play app id
- `--ios`: 경쟁 앱 App Store app id
- `--auto-top`: 자동 탐색 시 스토어별 상위 N개 수집 (기본값 `5`)
- `--limit`: 스토어별 리뷰 수 (기본값 `200`)
- `--global`: 스토어별 글로벌 마켓 목록(Play: 국가+언어, App Store: 국가)을 순회하며 리뷰 수집. 글로벌 모드에서는 `--limit`이 마켓별로 적용됩니다.
- `--apps`: 경쟁 앱 목록 JSON 경로
- `--registered-apps-path`: 등록 앱 파일 경로 커스텀
- `--output text|json`: 출력 모드 (기본값 `text`)
- `--dry-run`: 실제 수집/저장 없이 실행 계획만 출력
- `--validate-only`: 입력/매핑 검증만 수행 (수집/저장 없음)

## 단일 경쟁 앱

```bash
node dist/cli.js photopills \
  --my-app golden-horizon \
  --play com.photopills.photopills \
  --ios 596027698 \
  --limit 200
```

## 멀티 경쟁 앱

```bash
node dist/cli.js --my-app golden-horizon --apps apps.json --limit 200
```

## 자동 탐색 (`--my-app`만 사용)

```bash
node dist/cli.js --my-app golden-horizon --auto-top 5 --limit 200
```

글로벌 국가 순회 수집:

```bash
node dist/cli.js --my-app golden-horizon --auto-top 5 --limit 200 --global
```

- `--apps`, `--play`, `--ios`, positional `appName`이 없으면 자동 경쟁앱 탐색 모드로 동작합니다.
- `registered-apps.json`의 내 앱 스토어 식별자를 기준으로 스토어별 탐색합니다.
  - Google Play: `googlePlay.packageName`
  - App Store: `appStore.appId` (`You Might Also Like` 우선, 부족 시 검색 폴백)
- 자동 탐색 실수행(run)에서는 총 수집 리뷰가 `30개 이하`인 경쟁앱은 저장하지 않고, 같은 스토어의 다음 후보로 대체합니다.

## 출력

- `data/{myAppId}/reviews/{competitor}.json`

## 에이전트 친화 모드

머신 리더블 JSON 보고서 출력:

```bash
node dist/cli.js --my-app golden-horizon --apps apps.json --output json
```

Dry-run (네트워크 요청/파일 저장 없음):

```bash
node dist/cli.js --my-app golden-horizon --apps apps.json --dry-run --output json
```

Validate-only (입력/타겟 검증만):

```bash
node dist/cli.js --my-app golden-horizon --apps apps.json --validate-only --output json
```

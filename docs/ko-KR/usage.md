# 사용법

사전 준비는 [셋업](./setup.md)을 먼저 확인하세요.

## CLI 옵션

- `--my-app` (필수): 내 앱 ID를 찾기 위한 키
- `--play`: 경쟁 앱 Google Play app id
- `--ios`: 경쟁 앱 App Store app id
- `--limit`: 스토어별 리뷰 수 (기본값 `200`)
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

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

## 셋업

### 1. 설치

런타임 요구사항:

- Node.js `>=20.19.0`

```bash
npm install
npm run build
```

### 2. `registered-apps.json` 준비

이 프로젝트는 아래 파일에서 `myAppId`를 찾습니다.

- `~/.config/pabal-mcp/registered-apps.json`

방법 A: 자동 템플릿 생성 (권장)

```bash
npm run setup:config
```

이 명령이 수행하는 작업:
- `~/.config/pabal-mcp` 폴더 생성
- `chmod 700` 적용 (환경에 따라 실패해도 계속 진행)
- `registered-apps.json`이 없으면 기본 템플릿 생성
- `~/.config/pabal-mcp` 폴더 내 파일 권한을 `600`으로 잠금

방법 B: 수동 명령으로 생성

```bash
mkdir -p ~/.config/pabal-mcp
chmod 700 ~/.config/pabal-mcp
cat > ~/.config/pabal-mcp/registered-apps.json <<'JSON'
{
  "apps": [
    {
      "slug": "golden-horizon",
      "name": "Golden Horizon",
      "appStore": {
        "bundleId": "com.quartz.goldenhorizon",
        "appId": "1234567890",
        "name": "Golden Horizon",
        "supportedLocales": ["en-US", "ko-KR"]
      },
      "googlePlay": {
        "packageName": "com.quartz.goldenhorizon",
        "name": "Golden Horizon",
        "supportedLocales": ["en-US", "ko-KR"]
      }
    }
  ]
}
JSON
open ~/.config/pabal-mcp
chmod 600 ~/.config/pabal-mcp/*
```

### 3. JSON 규칙

- 앱 항목 최소 필수 필드는 `slug`입니다.
- `--my-app`은 `slug`, `name`, `appStore.bundleId`, `appStore.appId`, `googlePlay.packageName` 중 하나로 매칭됩니다.
- 출력 경로의 `{myAppId}`로 `slug`가 사용되므로 일관되게 유지하세요.
- 자동 경쟁앱 탐색(`--my-app`만 사용)은 `googlePlay.packageName` 또는 `appStore.appId` 중 최소 1개가 필요합니다.

### 4. (선택) 등록 파일 경로 커스텀

```bash
--registered-apps-path /your/path/registered-apps.json
```

### 5. 빠른 검증

```bash
npm run review:collect -- --my-app golden-horizon --apps apps.json --limit 1
```

## 문서 안내

- [리뷰 명령](./review.md): `review:*` 스크립트
- [리포트 명령](./report.md): `report:*` 스크립트

# 셋업

## 1. 설치

런타임 요구사항:

- Node.js `>=20.19.0`

```bash
npm install
npm run build
```

## 2. `registered-apps.json` 준비

이 프로젝트는 아래 파일에서 `myAppId`를 찾습니다.

- `~/.config/pabal-mcp/registered-apps.json`

### 방법 A: 자동 템플릿 생성 (권장)

```bash
npm run setup:config
```

이 명령이 수행하는 작업:
- `~/.config/pabal-mcp` 폴더 생성
- `chmod 700` 적용 (환경에 따라 실패해도 계속 진행)
- `registered-apps.json`이 없으면 기본 템플릿 생성
- `~/.config/pabal-mcp` 폴더 내 파일 권한을 `600`으로 잠금

### 방법 B: 수동 명령으로 생성

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

## 3. JSON 규칙

- 앱 항목 최소 필수 필드는 `slug`입니다.
- `--my-app`은 `slug`, `name`, `appStore.bundleId`, `appStore.appId`, `googlePlay.packageName` 중 하나로 매칭됩니다.
- 출력 경로의 `{myAppId}`로 `slug`가 사용되므로 일관되게 유지하세요.
- 자동 경쟁앱 탐색(`--my-app`만 사용)은 아래 중 최소 1개가 필요합니다.
  - `googlePlay.packageName`
  - `appStore.appId`

## 4. (선택) 등록 파일 경로 커스텀

```bash
--registered-apps-path /your/path/registered-apps.json
```

## 5. 빠른 검증

```bash
npm run review:collect -- --my-app golden-horizon --apps apps.json --limit 1
```

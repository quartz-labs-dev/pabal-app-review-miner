# Setup

## 1. Install

```bash
npm install
npm run build
```

## 2. Prepare `registered-apps.json`

This project resolves `myAppId` from:

- `~/.config/pabal-mcp/registered-apps.json`

### Option A: Automatic template (recommended)

```bash
npm run setup:config
```

This command:
- creates `~/.config/pabal-mcp`
- applies `chmod 700` (best effort)
- creates `registered-apps.json` with a starter template if missing
- locks file permissions to `600` for files in `~/.config/pabal-mcp`

### Option B: Manual shell commands

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

## 3. JSON Rules

- Minimum required field per app is `slug`.
- `--my-app` can match `slug`, `name`, `appStore.bundleId`, `appStore.appId`, or `googlePlay.packageName`.
- Keep `slug` stable because it is used as `{myAppId}` in output paths.
- Auto competitor discovery (`--my-app` only mode) requires at least one of:
  - `googlePlay.packageName`
  - `appStore.appId`

## 4. Optional Custom Path

```bash
--registered-apps-path /your/path/registered-apps.json
```

## 5. Quick Validation

```bash
npm run collect-reviews -- --my-app golden-horizon --apps apps.json --limit 1
```

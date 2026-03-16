# pabal-app-review-miner 문서

## 셋업

1. 이 저장소를 clone 해서 사용하세요.

```bash
git clone https://github.com/quartz-labs-dev/pabal-app-review-miner.git
cd pabal-app-review-miner
```

2. 의존성 설치 및 빌드.

```bash
npm install
npm run build
```

3. `pabal-store-api-mcp`로 `registered-apps.json`을 먼저 준비하세요.

먼저 아래 문서를 따라 `pabal-store-api-mcp`를 설정하세요.
- [pabal-store-api-mcp README](https://pabal.quartz.best/docs/pabal-store-api-mcp/README)

그 다음 이 저장소에서 아이콘 셋업을 실행하세요.

```bash
npm run setup:icon
```

<details>
<summary>수동 셋업 (pabal-store-api-mcp를 사용하지 않는 경우)</summary>

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
        "appId": "1234567890"
      },
      "googlePlay": {
        "packageName": "com.quartz.goldenhorizon"
      }
    }
  ]
}
JSON
chmod 600 ~/.config/pabal-mcp/registered-apps.json
npm run setup:icon
```

</details>

<details>
<summary>옵셔널: 참고 및 빠른 검증</summary>

`--my-app` 값은 `~/.config/pabal-mcp/registered-apps.json`에서 찾습니다.

```bash
npm run review:collect -- --my-app golden-horizon --apps apps.json --limit 1
```

</details>

## 문서 안내

- [리뷰 명령](./01-review.md): App Store/Google Play에서 경쟁 앱 리뷰를 수집해 raw JSON으로 저장합니다.
- [리포트 명령](./02-report.md): 수집된 리뷰를 번역/분석해 리포트 산출물(HTML 포함)을 생성합니다.

# 사용법: `preview-report`

사전 준비와 소유 앱 키 해석은 [셋업](./setup.md)을 먼저 확인하세요.

이 스크립트는 생성된 HTML 리포트를 localhost 서버로 띄워 브라우저에서 확인할 수 있게 합니다.

- `npm run preview-report -- --my-app <owner> ...`
- `node dist/previewReport.js ...`

## 사전 조건

먼저 HTML 리포트를 생성해야 합니다.

```bash
npm run render-report-html -- --my-app aurora-eos
```

## CLI 옵션

- `--my-app` (필수): 소유 앱 키 (`slug`, `name`, `bundleId`, `packageName`, `appId` 매칭)
- `--registered-apps-path`: 등록 앱 파일 경로 커스텀
- `--file`: 서빙할 html 파일 경로
  - 기본값: `data/{myAppId}/reports/competitor-raw-actionable.ko.html`
- `--host`: 바인딩 호스트 (기본값: `127.0.0.1`)
- `--port`: 바인딩 포트 (기본값: `4173`)

## 기본 실행

```bash
npm run preview-report -- --my-app aurora-eos --port 4173
```

브라우저에서:

- `http://127.0.0.1:4173/`

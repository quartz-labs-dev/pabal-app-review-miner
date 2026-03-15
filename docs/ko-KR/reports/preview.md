# 사용법: `report:preview`

사전 준비와 소유 앱 키 해석은 [셋업](../setup.md)을 먼저 확인하세요.

이 스크립트는 localhost 프리뷰 서버를 실행합니다.

- 대시보드 모드(기본): 홈에서 앱 목록과 생성된 리포트 파일(`.html`, `.md`, `.json`) 링크 제공
- 단일 파일 모드(`--file`): 지정한 HTML 리포트 1개를 `/`로 서빙

- `npm run report:preview -- [options]`
- `node dist/previewReport.js ...`

## 사전 조건

먼저 HTML 리포트를 생성해야 합니다.

```bash
npm run report:render-html -- --my-app aurora-eos
```

## CLI 옵션

- `--my-app` (선택): 대시보드에서 특정 앱만 필터링
- `--registered-apps-path`: 등록 앱 파일 경로 커스텀
- `--file`: 단일 파일 모드에서 서빙할 html 파일 경로
- `--data-dir`: 대시보드 데이터 루트 (기본값: `data/`)
- `--host`: 바인딩 호스트 (기본값: `127.0.0.1`)
- `--port`: 바인딩 포트 (기본값: `4173`)

## 대시보드 실행 (전체 앱)

```bash
npm run report:preview -- --port 4173
```

브라우저에서:

- `http://127.0.0.1:4173/`

## 대시보드 실행 (앱 필터)

```bash
npm run report:preview -- --my-app aurora-eos --port 4173
```

## 단일 파일 실행

```bash
npm run report:preview -- \
  --file data/aurora-eos/reports/competitor-raw-actionable.ko.html \
  --port 4173
```

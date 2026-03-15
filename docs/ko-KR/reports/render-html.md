# 사용법: `report:render-html`

사전 준비와 소유 앱 키 해석은 [셋업](../setup.md)을 먼저 확인하세요.

이 스크립트는 actionable raw 마크다운 리포트를 인터랙티브 HTML로 변환합니다.

- `npm run report:render-html -- --my-app <owner> ...`
- `node dist/renderReportHtml.js ...`

## CLI 옵션

- `--my-app` (필수): 소유 앱 키 (`slug`, `name`, `bundleId`, `packageName`, `appId` 매칭)
- `--registered-apps-path`: 등록 앱 파일 경로 커스텀
- `--input`: 입력 마크다운 리포트 경로
  - 기본값: `data/{myAppId}/reports/competitor-raw-actionable.ko.md`
- `--output`: 출력 HTML 경로
  - 기본값: `data/{myAppId}/reports/competitor-raw-actionable.ko.html`

## 기본 실행

```bash
npm run report:render-html -- --my-app aurora-eos
```

## 출력

- `data/{myAppId}/reports/competitor-raw-actionable.ko.html`

## 뷰어 기능

- 기본 한국어 우선 보기
- 원문 전체 토글 + 카드별 원문 토글
- `Raw 리뷰` 탭: 만족/불만/요청 기능 근거 문장 확인
- `실행 백로그` 탭: `must/should/could`, 예상 임팩트, 구현 난이도, 근거를 한 눈에 확인
- 검색: 한국어/원문/앱명/백로그 항목 통합 검색

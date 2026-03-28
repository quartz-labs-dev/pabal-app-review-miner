export const backlogReviewPickerStyles = `
      .backlog-editor-picker-actions {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        flex-wrap: wrap;
      }
      .backlog-editor-open-picker {
        min-height: 34px;
        border-radius: 8px;
        border: 1px solid #7dd3fc;
        background: #e0f2fe;
        color: #075985;
        font-size: 12px;
        font-weight: 700;
        padding: 6px 10px;
      }
      .backlog-editor-open-picker:hover {
        border-color: #0ea5e9;
        background: #bae6fd;
      }
      .backlog-review-picker-root[hidden] {
        display: none !important;
      }
      .backlog-review-picker-root {
        position: fixed;
        inset: 0;
        z-index: 55;
        opacity: 0;
        pointer-events: none;
        transition: opacity 180ms ease;
      }
      .backlog-review-picker-root.is-open {
        opacity: 1;
        pointer-events: auto;
      }
      .backlog-review-picker-backdrop {
        position: absolute;
        inset: 0;
        border: 0;
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        background: rgba(15, 23, 42, 0.5);
        opacity: 0;
        transition: opacity 180ms ease;
      }
      .backlog-review-picker-root.is-open .backlog-review-picker-backdrop {
        opacity: 1;
      }
      .backlog-review-picker {
        position: absolute;
        top: 50%;
        left: 50%;
        width: min(960px, calc(100vw - 36px));
        max-height: min(84vh, 820px);
        transform: translate(-50%, calc(-50% + 10px)) scale(0.98);
        border: 1px solid var(--line);
        border-radius: 16px;
        background: #ffffff;
        box-shadow: 0 24px 46px rgba(15, 23, 42, 0.35);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        opacity: 0;
        transition: transform 180ms ease, opacity 180ms ease;
      }
      .backlog-review-picker-root.is-open .backlog-review-picker {
        transform: translate(-50%, -50%) scale(1);
        opacity: 1;
      }
      .backlog-review-picker-head {
        padding: 12px 14px;
        border-bottom: 1px solid var(--line);
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 10px;
      }
      .backlog-review-picker-head h3 {
        margin: 0;
        font-size: 15px;
      }
      .backlog-review-picker-head button {
        min-height: 32px;
        padding: 6px 10px;
        border-radius: 8px;
        font-size: 12px;
      }
      .backlog-review-picker-body {
        padding: 12px 14px;
        display: grid;
        gap: 10px;
      }
      .backlog-review-picker-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        flex-wrap: wrap;
      }
      .backlog-review-picker-actions {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
      }
      .backlog-review-picker-actions button {
        min-height: 30px;
        border-radius: 8px;
        padding: 5px 8px;
        font-size: 11px;
        font-weight: 700;
      }
      .backlog-review-picker-pagination {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        margin-left: auto;
      }
      .backlog-review-picker-pagination button {
        min-height: 30px;
        padding: 5px 9px;
        border-radius: 8px;
        font-size: 11px;
      }
      .backlog-review-picker-page-info {
        color: #334155;
        font-size: 12px;
        font-weight: 700;
        min-width: 108px;
        text-align: center;
      }
      .backlog-review-picker-foot {
        padding: 10px 14px;
        border-top: 1px solid var(--line);
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }
      .backlog-review-picker-selected-count {
        color: #334155;
        font-size: 12px;
        font-weight: 700;
      }
      @media (max-width: 900px) {
        .backlog-review-picker {
          width: calc(100vw - 18px);
          max-height: 88vh;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .backlog-review-picker-root,
        .backlog-review-picker-backdrop,
        .backlog-review-picker {
          transition: none;
        }
      }
`;

export function renderBacklogEvidenceSelectorHtml(): string {
  return `
          <div class=\"backlog-editor-field\">
            <span>리뷰</span>
            <div class=\"backlog-editor-picker-actions\">
              <span id=\"backlogEditorSelectionSummary\" class=\"backlog-review-selection-summary\">선택 0개</span>
              <button id=\"openBacklogReviewPicker\" class=\"backlog-editor-open-picker\" type=\"button\">활성 리뷰 선택</button>
            </div>
          </div>
          <div id=\"backlogEditorSelectedList\" class=\"backlog-editor-selected-list\"></div>
  `;
}

export function renderBacklogReviewPickerModalHtml(): string {
  return `
    <div id=\"backlogReviewPickerRoot\" class=\"backlog-review-picker-root\" hidden aria-hidden=\"true\">
      <button id=\"backlogReviewPickerBackdrop\" class=\"backlog-review-picker-backdrop\" type=\"button\" aria-label=\"리뷰 선택 닫기\"></button>
      <aside class=\"backlog-review-picker\" role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"backlogReviewPickerTitle\">
        <div class=\"backlog-review-picker-head\">
          <h3 id=\"backlogReviewPickerTitle\">활성 리뷰 선택</h3>
          <button id=\"backlogReviewPickerClose\" type=\"button\">닫기</button>
        </div>
        <div class=\"backlog-review-picker-body\">
          <label class=\"backlog-editor-field\">
            <span>리뷰 검색</span>
            <input id=\"backlogEditorReviewSearch\" type=\"search\" placeholder=\"앱명, 리뷰 ID, 본문 검색\" />
          </label>
          <div class=\"backlog-review-picker-toolbar\">
            <div class=\"backlog-review-picker-actions\">
              <button id=\"backlogEditorSelectVisible\" type=\"button\">현재 페이지 전체 선택</button>
              <button id=\"backlogEditorClearSelection\" type=\"button\">선택 해제</button>
            </div>
            <div class=\"backlog-review-picker-pagination\">
              <button id=\"backlogReviewPickerPrev\" type=\"button\">이전</button>
              <span id=\"backlogReviewPickerPageInfo\" class=\"backlog-review-picker-page-info\">1 / 1</span>
              <button id=\"backlogReviewPickerNext\" type=\"button\">다음</button>
            </div>
          </div>
          <div id=\"backlogEditorReviewList\" class=\"backlog-review-list\"></div>
        </div>
        <div class=\"backlog-review-picker-foot\">
          <span id=\"backlogReviewPickerSelectedCount\" class=\"backlog-review-picker-selected-count\">선택 0개</span>
          <button id=\"backlogReviewPickerDone\" type=\"button\">선택 완료</button>
        </div>
      </aside>
    </div>
  `;
}

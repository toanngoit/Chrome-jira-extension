// Dims child work item rows whose status is "Dev Done".
// Jira is a SPA that re-renders tables often, so rows are re-checked on every DOM mutation.
(() => {
  const ROW_SELECTOR = 'tr[data-testid="native-issue-table.ui.issue-row"]';
  const DIM_ATTR = "data-jira-helper-dev-done";
  const STYLE_ID = "jira-helper-style";

  let settings = { ...JIRA_HELPER_DEFAULTS };
  let doneSet = new Set();

  const normalize = (text) => (text || "").replace(/\s+/g, " ").trim().toLowerCase();

  function applySettings(stored) {
    settings = { ...JIRA_HELPER_DEFAULTS, ...stored };
    doneSet = new Set(settings.devDoneStatuses.map(normalize).filter(Boolean));
    renderStyle();
    scanAll();
  }

  // Opacity lives in one CSS rule, so changing it in the popup does not require re-scanning rows
  function renderStyle() {
    let style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement("style");
      style.id = STYLE_ID;
      (document.head || document.documentElement).append(style);
    }
    const opacity = Math.min(1, Math.max(0, Number(settings.dimOpacity) || 0));
    style.textContent = settings.dimEnabled
      ? `
        ${ROW_SELECTOR}[${DIM_ATTR}] { opacity: ${opacity}; transition: opacity 0.15s ease; }
        ${settings.revealOnHover ? `${ROW_SELECTOR}[${DIM_ATTR}]:hover { opacity: 1; }` : ""}
      `
      : "";
  }

  // Index of the "Status" column in the row's table. Header text also holds the
  // sort/menu labels (e.g. "StatusStatus • Sort in ascending order..."), so match the prefix.
  function statusColumnIndex(table) {
    const headers = table?.querySelectorAll("thead tr > *") || [];
    return [...headers].findIndex((th) => {
      const text = normalize(th.textContent);
      return text.startsWith("status") && !text.startsWith("status category");
    });
  }

  // Returns the status text of a row, or null when it cannot be found
  function getRowStatus(row) {
    // 1. Jira's status lozenge, e.g. data-testid="issue.fields.status.common.ui.status-lozenge.4--text"
    const lozenge =
      row.querySelector('[data-testid^="issue.fields.status"][data-testid$="--text"]') ||
      row.querySelector('[data-testid^="issue.fields.status"][data-testid*="status-lozenge"]');
    if (lozenge && normalize(lozenge.textContent)) return lozenge.textContent;

    // 2. Cell under the "Status" column header (the first cell of a row is a <th>)
    const index = statusColumnIndex(row.closest("table"));
    if (index >= 0) {
      const cell = row.children[index];
      if (cell && normalize(cell.textContent)) return cell.textContent;
    }

    return null;
  }

  function isDevDone(row) {
    const status = getRowStatus(row);
    if (status != null) return doneSet.has(normalize(status));

    // 3. Fallback: a leaf element whose whole text is exactly a Dev Done status
    for (const el of row.querySelectorAll("span, div, button")) {
      if (el.children.length === 0 && doneSet.has(normalize(el.textContent))) return true;
    }
    return false;
  }

  function updateRow(row) {
    const done = isDevDone(row);
    if (done !== row.hasAttribute(DIM_ATTR)) row.toggleAttribute(DIM_ATTR, done);
  }

  function scanAll() {
    document.querySelectorAll(ROW_SELECTOR).forEach(updateRow);
  }

  // Batch mutations into one scan per animation frame
  let scheduled = false;
  function scheduleScan() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      scanAll();
    });
  }

  new MutationObserver(scheduleScan).observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  chrome.storage.sync.get(JIRA_HELPER_DEFAULTS, applySettings);
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    chrome.storage.sync.get(JIRA_HELPER_DEFAULTS, applySettings);
  });
})();

// Dims (or hides) child work item rows whose status, or assignee, is in the user's lists.
// Jira is a SPA that re-renders tables often, so rows are re-checked on every DOM mutation.
(() => {
  const ROW_SELECTOR = 'tr[data-testid="native-issue-table.ui.issue-row"]';
  const DIM_ATTR = "data-jira-helper-match";
  const STYLE_ID = "jira-helper-style";

  let settings = { ...JIRA_HELPER_DEFAULTS };
  let doneSet = new Set();
  let assigneeWords = []; // each entry: one typed name split into lowercase words

  const normalize = (text) => (text || "").replace(/\s+/g, " ").trim().toLowerCase();
  const toWords = (text) => normalize(text).split(/[^\p{L}\p{N}'’]+/u).filter(Boolean);

  function applySettings(stored) {
    settings = { ...JIRA_HELPER_DEFAULTS, ...stored };
    doneSet = new Set(settings.devDoneStatuses.map(normalize).filter(Boolean));
    assigneeWords = settings.assignees.map(toWords).filter((w) => w.length);
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
    // Hide wins over Dim if both are somehow on
    style.textContent = settings.hideEnabled
      ? `${ROW_SELECTOR}[${DIM_ATTR}] { display: none !important; }`
      : settings.dimEnabled
      ? `
        ${ROW_SELECTOR}[${DIM_ATTR}] { opacity: ${opacity}; transition: opacity 0.15s ease; }
        ${settings.revealOnHover ? `${ROW_SELECTOR}[${DIM_ATTR}]:hover { opacity: 1; }` : ""}
      `
      : "";
  }

  // Index of a column in the row's table. Header text also holds the sort/menu
  // labels (e.g. "StatusStatus • Sort in ascending order..."), so match the prefix.
  function columnIndex(table, isHeader) {
    const headers = table?.querySelectorAll("thead tr > *") || [];
    return [...headers].findIndex((th) => isHeader(normalize(th.textContent)));
  }
  const isStatusHeader = (t) => t.startsWith("status") && !t.startsWith("status category");
  const isAssigneeHeader = (t) => t.startsWith("assignee");

  // Every place a person's name can show up inside an element: each text node on
  // its own (Jira renders the name twice with no space between, so the combined
  // textContent reads "Juan LiJuan Li"), plus avatar alt text, aria-labels
  // (e.g. "Juan Li- edit Assignee") and tooltips
  function nameTexts(el) {
    const texts = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) texts.push(walker.currentNode.nodeValue);
    for (const node of [el, ...el.querySelectorAll("[alt], [aria-label], [title]")]) {
      for (const attr of ["alt", "aria-label", "title"]) {
        const value = node.getAttribute(attr);
        if (value) texts.push(value);
      }
    }
    return texts.filter((t) => normalize(t));
  }

  // Returns the status text of a row, or null when it cannot be found
  function getRowStatus(row) {
    // 1. Jira's status lozenge, e.g. data-testid="issue.fields.status.common.ui.status-lozenge.4--text"
    const lozenge =
      row.querySelector('[data-testid^="issue.fields.status"][data-testid$="--text"]') ||
      row.querySelector('[data-testid^="issue.fields.status"][data-testid*="status-lozenge"]');
    if (lozenge && normalize(lozenge.textContent)) return lozenge.textContent;

    // 2. Cell under the "Status" column header (the first cell of a row is a <th>)
    const index = columnIndex(row.closest("table"), isStatusHeader);
    if (index >= 0) {
      const cell = row.children[index];
      if (cell && normalize(cell.textContent)) return cell.textContent;
    }

    return null;
  }

  // Texts that may hold the row's assignee name, gathered from:
  // 1. the Assignee cell, <td data-column-type="assignee">
  // 2. the cell under the "Assignee" column header
  // 3. any element whose data-testid mentions "assignee" (e.g. "issue.fields.assignee...")
  function getRowAssigneeTexts(row) {
    const sources = new Set(
      row.querySelectorAll('[data-column-type="assignee"], [data-testid*="assignee" i]')
    );
    const index = columnIndex(row.closest("table"), isAssigneeHeader);
    if (index >= 0 && row.children[index]) sources.add(row.children[index]);
    return [...sources].flatMap(nameTexts);
  }

  // True when the typed name's words appear, in order and side by side, in the full name
  function nameMatches(fullName, typedWords) {
    const words = toWords(fullName);
    for (let i = 0; i + typedWords.length <= words.length; i++) {
      if (typedWords.every((w, j) => words[i + j] === w)) return true;
    }
    return false;
  }

  function hasMatchingAssignee(row) {
    if (!assigneeWords.length) return false;
    const texts = getRowAssigneeTexts(row);
    return texts.some((text) => assigneeWords.some((typed) => nameMatches(text, typed)));
  }

  function hasMatchingStatus(row) {
    if (!doneSet.size) return false;
    const status = getRowStatus(row);
    if (status != null) return doneSet.has(normalize(status));

    // 3. Fallback: a leaf element whose whole text is exactly a Dev Done status
    for (const el of row.querySelectorAll("span, div, button")) {
      if (el.children.length === 0 && doneSet.has(normalize(el.textContent))) return true;
    }
    return false;
  }

  function updateRow(row) {
    const match = hasMatchingStatus(row) || hasMatchingAssignee(row);
    if (match !== row.hasAttribute(DIM_ATTR)) row.toggleAttribute(DIM_ATTR, match);
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

  // ---- Refresh "Child work items" without reloading the page ----
  // Jira's child panel has no refresh button, but clicking a column's sort button
  // re-runs the panel's own query (fresh data from the server). Cycling the sort
  // (none -> asc -> desc -> none) until the label is back to where it started
  // reloads the rows and leaves the user's sort order unchanged.
  const CHILD_HEADING = '[data-testid="issue.views.common.child-issues-panel.heading.title"]';
  const CHILD_TOGGLE = '[data-testid="issue.views.common.collapsible-section.CHILD_WORK_ITEM.toggle"]';
  const SORT_BUTTON =
    '[data-testid="native-issue-table.ui.issue-table.header.header-cell.header-cell-actions.sort-button.icon-button"]';

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const label = (el) => normalize(el?.textContent);
  const columnOf = (el) => label(el).split("•")[0].trim();

  // Smallest ancestor of the panel heading that also holds the table's sort buttons
  function childPanel() {
    let el = document.querySelector(CHILD_HEADING);
    for (let i = 0; el && i < 15; i++, el = el.parentElement) {
      if (el.querySelector(SORT_BUTTON)) return el;
    }
    return null;
  }

  async function waitFor(check, timeout) {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      if (check()) return true;
      await wait(50);
    }
    return false;
  }

  // Resolves once the panel has stopped changing for `quietMs`
  function waitForQuiet(target, quietMs = 400, timeout = 8000) {
    return new Promise((resolve) => {
      let timer;
      const done = () => { observer.disconnect(); clearTimeout(timer); clearTimeout(cap); resolve(); };
      const observer = new MutationObserver(() => { clearTimeout(timer); timer = setTimeout(done, quietMs); });
      observer.observe(target, { childList: true, subtree: true, characterData: true });
      timer = setTimeout(done, quietMs);
      const cap = setTimeout(done, timeout);
    });
  }

  let refreshing = false;
  async function refreshChildItems() {
    if (refreshing) return { ok: false, error: "Already refreshing" };
    const panel = childPanel();
    if (!panel) {
      // The section toggle reads "Expand Child work items" while collapsed
      const collapsed = label(document.querySelector(CHILD_TOGGLE)).startsWith("expand");
      const error = !document.querySelector(CHILD_HEADING)
        ? "No Child work items on this page"
        : collapsed
        ? "Expand Child work items first"
        : "No child work items to reload";
      return { ok: false, error };
    }
    refreshing = true;
    try {
      const column = columnOf(panel.querySelector(SORT_BUTTON));
      const button = () =>
        [...(childPanel()?.querySelectorAll(SORT_BUTTON) || [])].find((b) => columnOf(b) === column);
      const start = label(button());
      for (let i = 0; i < 4; i++) {
        const before = label(button());
        button()?.click();
        await waitFor(() => button() && label(button()) !== before, 3000);
        if (label(button()) === start) break;
      }
      await waitForQuiet(childPanel() || document.body);
      const rows = childPanel()?.querySelectorAll(ROW_SELECTOR).length ?? 0;
      console.info(`[Jira Helper] Reloaded Child work items (${rows} rows, sorted by ${column})`);
      return { ok: true, rows };
    } finally {
      refreshing = false;
    }
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type !== "refreshChildItems") return;
    refreshChildItems().then(sendResponse, (e) => sendResponse({ ok: false, error: String(e) }));
    return true; // respond asynchronously
  });

  chrome.storage.sync.get(JIRA_HELPER_DEFAULTS, applySettings);
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    chrome.storage.sync.get(JIRA_HELPER_DEFAULTS, applySettings);
  });
})();

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

  chrome.storage.sync.get(JIRA_HELPER_DEFAULTS, applySettings);
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    chrome.storage.sync.get(JIRA_HELPER_DEFAULTS, applySettings);
  });
})();

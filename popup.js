// Popup settings: every change is saved to chrome.storage.sync right away,
// and open Jira tabs pick it up through chrome.storage.onChanged.
const $ = (id) => document.getElementById(id);

const els = {
  dimEnabled: $("dimEnabled"),
  hideEnabled: $("hideEnabled"),
  dimOptions: $("dimOptions"),
  dimToggle: $("dimToggle"),
  dimOpacity: $("dimOpacity"),
  revealOnHover: $("revealOnHover"),
  devDoneStatuses: $("devDoneStatuses"),
  assignees: $("assignees"),
  opacityValue: $("opacityValue"),
  saved: $("saved"),
  menuButton: $("menuButton"),
  menu: $("menu"),
};

function render(settings) {
  els.dimEnabled.checked = settings.dimEnabled && !settings.hideEnabled;
  els.hideEnabled.checked = settings.hideEnabled;
  els.dimOpacity.value = settings.dimOpacity;
  els.revealOnHover.checked = settings.revealOnHover;
  els.devDoneStatuses.value = settings.devDoneStatuses.join("\n");
  els.assignees.value = settings.assignees.join("\n");
  renderOpacity();
  renderDimOptions();
}

function renderOpacity() {
  els.opacityValue.textContent = Number(els.dimOpacity.value).toFixed(2);
}

// Dim's options are collapsed by default; the expanded state is a popup-only
// UI preference, so it lives in localStorage rather than synced settings.
const DIM_EXPANDED_KEY = "dimOptionsExpanded";
let dimExpanded = false;
try { dimExpanded = localStorage.getItem(DIM_EXPANDED_KEY) === "1"; } catch {}

// Dim's own options (and the chevron) are only shown while Dim is on
function renderDimOptions() {
  const on = els.dimEnabled.checked;
  els.dimToggle.hidden = !on;
  els.dimToggle.setAttribute("aria-expanded", String(dimExpanded));
  els.dimToggle.title = dimExpanded ? "Hide options" : "Show options";
  els.dimOptions.hidden = !(on && dimExpanded);
}

els.dimToggle.addEventListener("click", () => {
  dimExpanded = !dimExpanded;
  try { localStorage.setItem(DIM_EXPANDED_KEY, dimExpanded ? "1" : "0"); } catch {}
  renderDimOptions();
});

let savedTimer;
function save(patch) {
  chrome.storage.sync.set(patch, () => {
    els.saved.textContent = "Saved";
    clearTimeout(savedTimer);
    savedTimer = setTimeout(() => (els.saved.textContent = ""), 1200);
  });
}

function parseLines(text) {
  return [...new Set(text.split("\n").map((s) => s.trim()).filter(Boolean))];
}

// Dim and Hide are mutually exclusive: turning one on turns the other off
els.dimEnabled.addEventListener("change", () => {
  const patch = { dimEnabled: els.dimEnabled.checked };
  if (els.dimEnabled.checked && els.hideEnabled.checked) {
    els.hideEnabled.checked = false;
    patch.hideEnabled = false;
  }
  renderDimOptions();
  save(patch);
});

els.hideEnabled.addEventListener("change", () => {
  const patch = { hideEnabled: els.hideEnabled.checked };
  if (els.hideEnabled.checked && els.dimEnabled.checked) {
    els.dimEnabled.checked = false;
    patch.dimEnabled = false;
  }
  renderDimOptions();
  save(patch);
});

els.dimOpacity.addEventListener("input", () => {
  renderOpacity();
  save({ dimOpacity: Number(els.dimOpacity.value) });
});

els.revealOnHover.addEventListener("change", () => {
  save({ revealOnHover: els.revealOnHover.checked });
});

// Save list textareas shortly after typing stops
function saveListOnInput(textarea, key) {
  let timer;
  textarea.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(() => save({ [key]: parseLines(textarea.value) }), 400);
  });
}
saveListOnInput(els.devDoneStatuses, "devDoneStatuses");
saveListOnInput(els.assignees, "assignees");

// "More" (…) menu
const menuItems = () => [...els.menu.querySelectorAll('[role="menuitem"]')];

function setMenuOpen(open, { focusButton = false } = {}) {
  els.menu.hidden = !open;
  els.menuButton.setAttribute("aria-expanded", String(open));
  if (open) menuItems()[0]?.focus();
  else if (focusButton) els.menuButton.focus();
}

const menuActions = {
  reset() {
    render(JIRA_HELPER_DEFAULTS);
    save({ ...JIRA_HELPER_DEFAULTS });
  },
  about() {
    const { name, version, description } = chrome.runtime.getManifest();
    $("aboutTitle").textContent = name;
    $("aboutVersion").textContent = `v${version}`;
    $("aboutDescription").textContent = description;
    $("aboutDialog").showModal();
  },
};

els.menuButton.addEventListener("click", () => setMenuOpen(els.menu.hidden));

els.menu.addEventListener("click", (e) => {
  const item = e.target.closest('[role="menuitem"]');
  if (!item) return;
  setMenuOpen(false, { focusButton: true });
  menuActions[item.dataset.action]?.();
});

// Up/Down move between items, Escape closes
els.menu.addEventListener("keydown", (e) => {
  const items = menuItems();
  const i = items.indexOf(document.activeElement);
  if (e.key === "Escape") {
    e.preventDefault();
    setMenuOpen(false, { focusButton: true });
  } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    const step = e.key === "ArrowDown" ? 1 : -1;
    items[(i + step + items.length) % items.length]?.focus();
  }
});

// Close when clicking anywhere else
document.addEventListener("click", (e) => {
  if (!els.menu.hidden && !e.target.closest(".menu")) setMenuOpen(false);
});

chrome.storage.sync.get(JIRA_HELPER_DEFAULTS, render);

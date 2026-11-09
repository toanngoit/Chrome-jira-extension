// Popup settings: every change is saved to chrome.storage.sync right away,
// and open Jira tabs pick it up through chrome.storage.onChanged.
const $ = (id) => document.getElementById(id);

const els = {
  dimEnabled: $("dimEnabled"),
  dimOpacity: $("dimOpacity"),
  revealOnHover: $("revealOnHover"),
  devDoneStatuses: $("devDoneStatuses"),
  opacityValue: $("opacityValue"),
  saved: $("saved"),
  reset: $("reset"),
};

function render(settings) {
  els.dimEnabled.checked = settings.dimEnabled;
  els.dimOpacity.value = settings.dimOpacity;
  els.revealOnHover.checked = settings.revealOnHover;
  els.devDoneStatuses.value = settings.devDoneStatuses.join("\n");
  renderOpacity();
  renderDisabled();
}

function renderOpacity() {
  els.opacityValue.textContent = Number(els.dimOpacity.value).toFixed(2);
}

function renderDisabled() {
  const off = !els.dimEnabled.checked;
  els.dimOpacity.disabled = off;
  els.revealOnHover.disabled = off;
}

let savedTimer;
function save(patch) {
  chrome.storage.sync.set(patch, () => {
    els.saved.textContent = "Saved";
    clearTimeout(savedTimer);
    savedTimer = setTimeout(() => (els.saved.textContent = ""), 1200);
  });
}

function parseStatuses(text) {
  return [...new Set(text.split("\n").map((s) => s.trim()).filter(Boolean))];
}

els.dimEnabled.addEventListener("change", () => {
  renderDisabled();
  save({ dimEnabled: els.dimEnabled.checked });
});

els.dimOpacity.addEventListener("input", () => {
  renderOpacity();
  save({ dimOpacity: Number(els.dimOpacity.value) });
});

els.revealOnHover.addEventListener("change", () => {
  save({ revealOnHover: els.revealOnHover.checked });
});

let statusTimer;
els.devDoneStatuses.addEventListener("input", () => {
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => save({ devDoneStatuses: parseStatuses(els.devDoneStatuses.value) }), 400);
});

els.reset.addEventListener("click", () => {
  render(JIRA_HELPER_DEFAULTS);
  save({ ...JIRA_HELPER_DEFAULTS });
});

chrome.storage.sync.get(JIRA_HELPER_DEFAULTS, render);

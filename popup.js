// Popup settings: every change is saved to chrome.storage.sync right away,
// and open Jira tabs pick it up through chrome.storage.onChanged.
const $ = (id) => document.getElementById(id);

const els = {
  dimEnabled: $("dimEnabled"),
  hideEnabled: $("hideEnabled"),
  dimOptions: $("dimOptions"),
  dimOpacity: $("dimOpacity"),
  revealOnHover: $("revealOnHover"),
  devDoneStatuses: $("devDoneStatuses"),
  opacityValue: $("opacityValue"),
  saved: $("saved"),
  reset: $("reset"),
};

function render(settings) {
  els.dimEnabled.checked = settings.dimEnabled && !settings.hideEnabled;
  els.hideEnabled.checked = settings.hideEnabled;
  els.dimOpacity.value = settings.dimOpacity;
  els.revealOnHover.checked = settings.revealOnHover;
  els.devDoneStatuses.value = settings.devDoneStatuses.join("\n");
  renderOpacity();
  renderDimOptions();
}

function renderOpacity() {
  els.opacityValue.textContent = Number(els.dimOpacity.value).toFixed(2);
}

// Dim's own options are only shown while Dim is on
function renderDimOptions() {
  els.dimOptions.hidden = !els.dimEnabled.checked;
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

// Popup quick navigation: [Home] [issue key] [Go]
// Click / Enter opens in the current tab; Ctrl/Cmd+click, Ctrl/Cmd+Enter or
// middle-click opens a new tab instead.
(() => {
  const home = document.getElementById("navHome");
  const input = document.getElementById("navKey");
  const go = document.getElementById("navGo");

  const site = JIRA_HELPER_SITE.baseUrl.replace(/\/+$/, "");

  // "9652" -> "ARWF-9652"; "arwf-9652", "ARWF 9652" or a pasted
  // ".../browse/ARWF-9652" URL -> "ARWF-9652". Returns null if unrecognised.
  function toIssueKey(raw) {
    const text = raw.trim();
    const num = text.match(/^#?(\d+)$/);
    if (num) return `${JIRA_HELPER_SITE.defaultProject}-${num[1]}`;
    const key = text.match(/\b([A-Za-z][A-Za-z0-9_]*)[-\s](\d+)\b/);
    return key ? `${key[1].toUpperCase()}-${key[2]}` : null;
  }

  function open(url, newTab) {
    if (newTab) {
      // Like Ctrl+click on a link: open in the background and keep the popup open
      chrome.tabs.create({ url, active: false });
    } else {
      chrome.tabs.update({ url });
      window.close();
    }
  }

  function setInvalid(invalid) {
    input.classList.toggle("invalid", invalid);
    input.setAttribute("aria-invalid", String(invalid));
  }

  function openIssue(newTab) {
    const key = toIssueKey(input.value);
    if (!key) {
      setInvalid(true);
      input.focus();
      return;
    }
    input.value = key;
    open(`${site}/browse/${key}`, newTab);
  }

  const wantsNewTab = (e) => e.ctrlKey || e.metaKey || e.button === 1;

  home.addEventListener("click", (e) => open(`${site}/`, wantsNewTab(e)));
  go.addEventListener("click", (e) => openIssue(wantsNewTab(e)));

  // Middle-click doesn't fire "click" on buttons
  home.addEventListener("auxclick", (e) => e.button === 1 && open(`${site}/`, true));
  go.addEventListener("auxclick", (e) => e.button === 1 && openIssue(true));

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      openIssue(e.ctrlKey || e.metaKey);
    }
  });
  input.addEventListener("input", () => setInvalid(false));
})();

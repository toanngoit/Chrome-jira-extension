# Jira Helper

Chrome extension (Manifest V3) that makes Jira issue pages easier to scan for developers.

## Features

### Quick navigation

The top of the popup has **[Home] [issue key] [Go]**:

- **Home** opens `https://cosihq.atlassian.net/`
- Type an issue key (`ARWF-9652`) or just the number (`9652`, which becomes `ARWF-9652`), then press **Enter** or click **Go** to open `https://cosihq.atlassian.net/browse/ARWF-9652`
- **Ctrl+click** (Cmd+click on Mac), middle-click, or **Ctrl+Enter** opens the page in a new tab instead of the current one

The site URL and default project live in `JIRA_HELPER_SITE` in `config.js`.

### Dim or hide Dev Done child items

On an Epic (or any issue with a child work item table), matching rows are shown at reduced opacity (0.4 by default), so the remaining work stands out. Alternatively, turn on **Hide work items** to remove those rows from view entirely.

A row matches when **either** rule applies:

- **Its status is one of** the listed statuses (exact match, case-insensitive). Defaults: Done, Released, Ready for dev testing, Ready for UAT
- **Or its assignee is one of** the listed names (whole-word match, case-insensitive: "Juan" matches "Juan Pérez", "Matt" does not match "Matthew"). Empty by default

An empty list turns that rule off.

Settings in the popup (saved to `chrome.storage.sync`, applied to open Jira tabs immediately):

- Dim work items on or off, with Opacity (0.1 to 1) and Full opacity on hover under the chevron
- Hide work items on or off (turning one on turns the other off)
- Status list and assignee list (one per line)

## How it works

`content.js` runs on `https://*.atlassian.net/*`. For each `tr[data-testid="native-issue-table.ui.issue-row"]` it reads:

- **Status** from the status lozenge (`data-testid="issue.fields.status.common.ui.status-lozenge.*--text"`), otherwise the cell under the "Status" column header, otherwise any leaf element whose whole text is a listed status
- **Assignee** from any element whose `data-testid` contains `assignee`, plus the cell under the "Assignee" column header; the visible text, avatar `alt`, `aria-label` and `title` are all checked

Matching rows get a `data-jira-helper-match` attribute, and one injected `<style>` dims or hides them. A `MutationObserver` re-checks rows whenever Jira re-renders the table.

## Install (developer mode)

1. Open `chrome://extensions`
2. Turn on **Developer mode**
3. Click **Load unpacked** and select this folder

## Files

| File | Purpose |
| --- | --- |
| `manifest.json` | Extension manifest |
| `config.js` | Default settings shared by the content script and popup, plus the Jira site used by quick navigation |
| `content.js` | Dims or hides Dev Done rows on Jira pages |
| `popup.html` / `popup.css` / `popup.js` | Settings popup |
| `quicknav.js` | Popup quick navigation (Home / issue key / Go) |
| `icons/jira-helper.svg` | Source icon |
| `tools/generate-icons.js` | Renders the SVG to `icons/icon{16,32,48,128}.png` (`node tools/generate-icons.js`) |

# Jira Helper

Chrome extension (Manifest V3) that makes Jira issue pages easier to scan for developers.

## Features

### Dim or hide Dev Done child items

On an Epic (or any issue with a child work item table), rows whose status is "Dev Done" are shown at reduced opacity (0.4 by default), so the work that is still open stands out. Alternatively, turn on **Hide Dev Done items** to remove those rows from view entirely.

Default Dev Done statuses (case-insensitive):

- Done
- Released
- Ready for dev testing
- Ready for UAT
- Ready for release

Settings in the popup (saved to `chrome.storage.sync`, applied to open Jira tabs immediately):

- Dim Dev Done items on or off
- Hide Dev Done items on or off (turning one on turns the other off)
- Opacity (0.1 to 1)
- Full opacity on hover
- Dev Done statuses list (one per line)

## How it works

`content.js` runs on `https://*.atlassian.net/*`. For each `tr[data-testid="native-issue-table.ui.issue-row"]` it reads the status from:

1. The status lozenge (`data-testid="issue.fields.status.common.ui.status-lozenge.*--text"`)
2. Otherwise, the cell under the "Status" column header
3. Otherwise, any leaf element whose whole text is a Dev Done status

Matching rows get a `data-jira-helper-dev-done` attribute, and one injected `<style>` sets their opacity. A `MutationObserver` re-checks rows whenever Jira re-renders the table.

## Install (developer mode)

1. Open `chrome://extensions`
2. Turn on **Developer mode**
3. Click **Load unpacked** and select this folder

## Files

| File | Purpose |
| --- | --- |
| `manifest.json` | Extension manifest |
| `config.js` | Default settings shared by the content script and popup |
| `content.js` | Dims or hides Dev Done rows on Jira pages |
| `popup.html` / `popup.css` / `popup.js` | Settings popup |
| `icons/jira-helper.svg` | Source icon |
| `tools/generate-icons.js` | Renders the SVG to `icons/icon{16,32,48,128}.png` (`node tools/generate-icons.js`) |

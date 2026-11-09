// Shared defaults for the content script and the popup.
const JIRA_HELPER_DEFAULTS = {
  dimEnabled: true,
  dimOpacity: 0.4,
  // Hide matching rows entirely; turning this on turns Dim off (and vice versa)
  hideEnabled: false,
  // Restore full opacity while the mouse is over a dimmed row
  revealOnHover: true,
  // A row matches when its status is one of these (compared case-insensitively)...
  devDoneStatuses: [
    "Done",
    "Released",
    "Ready for dev testing",
    "Ready for UAT",
  ],
  // ...or its assignee is one of these. Whole-word match, case-insensitive:
  // "Juan" matches "Juan Pérez", "Matt" does not match "Matthew". Empty = rule off.
  assignees: [],
};

// Jira site used by the popup's quick navigation
const JIRA_HELPER_SITE = {
  baseUrl: "https://cosihq.atlassian.net/",
  // Project prefix added when only an issue number is typed (e.g. "9652")
  defaultProject: "ARWF",
};

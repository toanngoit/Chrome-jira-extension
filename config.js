// Shared defaults for the content script and the popup.
const JIRA_HELPER_DEFAULTS = {
  dimEnabled: true,
  dimOpacity: 0.4,
  // Hide Dev Done rows entirely; turning this on turns Dim off (and vice versa)
  hideEnabled: false,
  // Restore full opacity while the mouse is over a dimmed row
  revealOnHover: true,
  // Statuses considered "Dev Done" (compared case-insensitively)
  devDoneStatuses: [
    "Done",
    "Released",
    "Ready for dev testing",
    "Ready for UAT",
    "Ready for release",
  ],
};

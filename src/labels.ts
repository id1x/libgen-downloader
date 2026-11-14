export const Label = {
  SEARCH: "? Search",
  NEXT_PAGE: "→ Next Page",
  PREV_PAGE: "← Prev Page",
  START_BULK_DOWNLOAD: "@ Start Bulk Download",
  EXIT: "✖ Exit",
  SEE_DETAILS: "See Details",
  DOWNLOAD_DIRECTLY: "Download Directly",
  DOWNLOADING: "Downloading...",
  ADD_TO_BULK_DOWNLOAD_QUEUE: "Add To Bulk Download Queue",
  REMOVE_FROM_BULK_DOWNLOAD_QUEUE: "Remove From Bulk Download Queue",
  ADDED_TO_BULK_DOWNLOAD_QUEUE: "Added To Bulk Download Queue",
  TURN_BACK_TO_THE_LIST: "Turn Back To The List",
  TURN_BACK_TO_THE_LIST_KEEPING_FAILED: "Turn Back To The List (Failed Ones Stay Selected)",
  RETRY_FAILED_DOWNLOADS: "↻ Retry Failed Downloads",
  FETCHING_CONFIG: "Fetching configuration file...",
  FINDING_MIRROR: "Finding an available mirror...",
  COULDNT_REACH_TO_MIRROR: "Couldn't reach to mirror",
  GETTING_RESULTS: "Getting results",
  CONNECTION_ERROR: "Connection error",
  TRYING_OTHER_MIRRORS: "Trying other mirrors...",
  ALL_MIRRORS_FAILED: "All mirrors failed. Please try again later.",
  NEXT_PAGE_CHECKING: "→ Next Page",
  NEXT_PAGE_ERROR: "→ Next Page (?) (Retry)",
  NEXT_PAGE_UNAVAILABLE: "→ Next Page (no results on next page)",
  RETRY: "↻ Retry",
  CHECKING_LIBGEN_MIRRORS: "Checking libgen mirrors...",
  NEXT_LIBGEN_CHECK_IN: "Waiting for libgen, next check in",
  LIBGEN_CHECKS: "checks",
  LIBGEN_WAITING_FOR: "waiting",
  LIBGEN_GIVES_UP_IN: "gives up in",
  LIBGEN_WAIT_CONTROLS: "[ctrl+r] check now  [esc] stop waiting",
  YES: "Yes",
  NO: "No",

  // Master/detail browse screen (spec §3, §4)
  RESULTS_PANEL_TITLE: "Results",
  RESULT_COLUMN_NUMBER: "#",
  RESULT_COLUMN_EXTENSION: "ext",
  RESULT_COLUMN_TITLE: "title",
  RESULT_COLUMN_AUTHOR: "author",
  RESULT_COLUMN_SIZE: "size",
  RESULT_COLUMN_STATUS: "st",
  SEARCH_LINE_PROMPT: "/",
  PAGE_INFO: "page",
  NO_RESULTS: "No results for",
  TERMINAL_TOO_SMALL: "Terminal too small (min 40×12)",
  FOOTER_LIST_WIDE: [
    ["↑↓", "move"],
    ["space", "bulk"],
    ["d", "download"],
    ["←→", "page"],
    ["/", "search"],
    ["b", "start bulk"],
    ["v", "queue"],
    ["?", "help"],
    ["q", "quit"],
  ] as ReadonlyArray<readonly [string, string]>,
  FOOTER_LIST_NARROW: [
    ["↑↓", "move"],
    ["space", "bulk"],
    ["d", "dl"],
    ["←→", "page"],
    ["/", "search"],
    ["b", "bulk dl"],
    ["?", "help"],
  ] as ReadonlyArray<readonly [string, string]>,
  FOOTER_QUEUE: [
    ["v", "detail"],
    ["↑↓", "move"],
    ["x", "remove"],
    ["r", "retry failed"],
    ["space", "bulk"],
    ["/", "search"],
    ["?", "help"],
    ["q", "quit"],
  ] as ReadonlyArray<readonly [string, string]>,
  FOOTER_HELP: [["esc", "close help"]] as ReadonlyArray<readonly [string, string]>,
  FOOTER_QUIT: [
    ["y", "quit"],
    ["n / esc", "stay"],
  ] as ReadonlyArray<readonly [string, string]>,
  FOOTER_FULL_DETAIL: [
    ["esc", "back"],
    ["↑↓", "prev/next"],
    ["space", "bulk"],
    ["d", "download"],
  ] as ReadonlyArray<readonly [string, string]>,

  // Warnings for the list-mode keys (spec §4).
  NO_MORE_RESULTS: "No more results",
  BULK_ALREADY_RUNNING: "Bulk download already running",

  // Side panel (spec §3)
  SIDE_PANEL_TAB_DETAIL: "Detail",
  SIDE_PANEL_TAB_QUEUE: "Queue",
  SIDE_PANEL_TOGGLE_HINT: "v",

  // Detail panel fields (spec §3); Format is the entry's extension, MD5 is
  // derived through mirrorAdapter.getEntryMD5 and never the raw mirror URL.
  DETAIL_FIELD_PUBLISHER: "Publisher",
  DETAIL_FIELD_YEAR: "Year",
  DETAIL_FIELD_PAGES: "Pages",
  DETAIL_FIELD_LANGUAGE: "Language",
  DETAIL_FIELD_FORMAT: "Format",
  DETAIL_FIELD_SIZE: "Size",
  DETAIL_FIELD_MD5: "MD5",
  DETAIL_MISSING_VALUE: "—",
  DETAIL_FIELD_SEPARATOR: "·",
  DETAIL_PAGES_SUFFIX: "pp",

  // One-line download statuses in the detail panel (spec §3: "For queued,
  // failed or done items, show one status line instead").
  DETAIL_STATUS_QUEUED: "Queued",
  DETAIL_STATUS_CONNECTING: "Connecting",
  DETAIL_STATUS_PROCESSING: "Processing",
  DETAIL_STATUS_FETCHING: "Fetching",
  DETAIL_STATUS_WAITING: "Waiting for libgen",
  DETAIL_STATUS_FAILED: "Failed",
  DETAIL_STATUS_DONE: "Downloaded",

  // Bulk membership line in the detail panel (spec §3).
  DETAIL_BULK_MEMBER: "In bulk queue",
  DETAIL_BULK_MEMBER_HINT: "space to remove",
  DETAIL_BULK_NONMEMBER: "Not in bulk queue",
  DETAIL_BULK_NONMEMBER_HINT: "space to add",

  // Detail panel hint pinned to the bottom row (spec §3).
  DETAIL_PANEL_HINTS: [
    ["space", "bulk"],
    ["d", "download"],
    ["enter", "full screen"],
  ] as ReadonlyArray<readonly [string, string]>,

  // Queue panel (spec §3, §5.3): section titles, the run summary words, the
  // saved-to line and the pinned bottom hint.
  QUEUE_SECTION_BULK: "Bulk download",
  QUEUE_SECTION_DIRECT: "Direct downloads",
  QUEUE_SAVED_TO: "Saved to",
  QUEUE_LISTS_PREFIX: "Lists:",
  QUEUE_SUMMARY_DONE_WORD: "done",
  QUEUE_SUMMARY_FAILED_WORD: "failed",
  QUEUE_PANEL_HINTS: [
    ["x", "remove"],
    ["r", "retry failed"],
    ["esc", "back"],
  ] as ReadonlyArray<readonly [string, string]>,

  // Help overlay (spec §5.5). Rows are [keys, description] pairs; keys render
  // bold cyan and descriptions gray like the footer. The full-screen detail
  // panel (§5.7) reuses SIDE_PANEL_TAB_DETAIL as its title.
  HELP_TITLE: "Keys",
  HELP_SECTION_NAVIGATE: "Navigate",
  HELP_SECTION_ACT_ON_ITEM: "Act on item",
  HELP_SECTION_GLOBAL: "Global",
  HELP_NAVIGATE_ROWS: [
    ["↑ ↓  k j", "move cursor"],
    ["pgup pgdn", "jump 10"],
    ["g G", "first / last"],
    ["← →  h l", "prev / next page"],
  ] as ReadonlyArray<readonly [string, string]>,
  HELP_ACT_ON_ITEM_ROWS: [
    ["space", "add / remove from bulk"],
    ["d", "download now"],
    ["enter", "full-screen detail"],
    ["tab", "same as space (legacy)"],
  ] as ReadonlyArray<readonly [string, string]>,
  HELP_GLOBAL_ROWS: [
    ["/", "search"],
    ["b", "start bulk download"],
    ["v", "toggle queue panel"],
    ["r", "retry failed downloads"],
    ["ctrl+r", "re-check libgen now"],
    ["?", "this help"],
    ["q", "quit"],
  ] as ReadonlyArray<readonly [string, string]>,
  HELP_CLOSE_HINT: "esc or ? to close",

  // Quit overlay (spec §5.6): only the lines that apply are shown, with
  // correct singular and plural forms.
  QUIT_TITLE: "Quit?",
  QUIT_DOWNLOADS_ONE: "1 download is still running or queued",
  QUIT_DOWNLOADS_MANY: "downloads are still running or queued",
  QUIT_BULK_ITEMS_ONE: "1 item is in the bulk queue",
  QUIT_BULK_ITEMS_MANY: "items are in the bulk queue",
  QUIT_BULK_RUN: "Bulk download is",
  QUIT_BULK_RUN_DONE: "done",
  // The explanation renders as the mockup's two lines (spec §5.6).
  QUIT_EXPLANATION_LINES: [
    "Quitting stops the download and",
    "forgets the bulk selection.",
  ] as ReadonlyArray<string>,
  QUIT_ANYWAY: "quit anyway",
  QUIT_STAY: "stay",
};

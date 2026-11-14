import type { Entry } from "../../../api/models/entry";

// Store actions the key router dispatches to. The per-mode `handle*Keys`
// dispatchers and the `useInput` router in use-browse-keys.ts share this
// contract; the router builds one object per keypress (spec §4).
export interface KeyActions {
  moveCursor: (delta: number) => void;
  setCursorToEdge: (edge: "first" | "last") => void;
  toggleBulkSelection: (entry: Entry) => void;
  downloadEntry: (entry: Entry) => void;
  prevPage: () => void;
  nextPage: () => void;
  startBulkDownload: () => void;
  openHelp: () => void;
  closeOverlay: () => void;
  enterFullDetail: () => void;
  leaveFullDetail: () => void;
  requestQuit: () => void;
  handleExit: () => void;
  enterQueue: () => void;
  leaveQueue: () => void;
  moveQueueCursor: (delta: number) => void;
  removeBulkUnderCursor: () => void;
  retryFailedBulk: () => void;
  actOnCursorEntry: (action: "toggle" | "download") => void;
  enterSearch: () => void;
  cancelSearch: () => void;
  submitSearch: () => void;
  searchHistoryUp: () => void;
  searchHistoryDown: () => void;
  clearSearchDraft: () => void;
}

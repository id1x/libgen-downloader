import type { Key } from "ink";
import type { Entry } from "../../../api/models/entry";
import type { KeyActions } from "./key-actions";

// Spec §4: PgUp/PgDn move the cursor 10 rows.
const PAGE_STEP = 10;

// Keys in `list` mode (spec §4). `cursorEntry` is the entry under the cursor;
// item actions no-op when the list is empty.
export const handleListKeys = (
  input: string,
  key: Key,
  actions: KeyActions,
  cursorEntry: Entry | undefined
): void => {
  if (key.upArrow || input === "k") {
    actions.moveCursor(-1);
    return;
  }

  if (key.downArrow || input === "j") {
    actions.moveCursor(1);
    return;
  }

  if (key.pageUp) {
    actions.moveCursor(-PAGE_STEP);
    return;
  }

  if (key.pageDown) {
    actions.moveCursor(PAGE_STEP);
    return;
  }

  // Case-sensitive: `g` first row, `G` (shift+g) last row.
  if (input === "g") {
    actions.setCursorToEdge("first");
    return;
  }

  if (input === "G") {
    actions.setCursorToEdge("last");
    return;
  }

  if (key.leftArrow || input === "h") {
    actions.prevPage();
    return;
  }

  if (key.rightArrow || input === "l") {
    actions.nextPage();
    return;
  }

  // `space` and `tab` (legacy) toggle the cursor item's bulk selection.
  if (input === " " || key.tab) {
    if (cursorEntry) {
      actions.toggleBulkSelection(cursorEntry);
    }
    return;
  }

  // Exact-case letters (spec §4 rule 3): `d` downloads, `D` does nothing.
  if (input === "d") {
    if (cursorEntry) {
      actions.downloadEntry(cursorEntry);
    }
    return;
  }

  if (key.return) {
    if (cursorEntry) {
      actions.enterFullDetail();
    }
    return;
  }

  if (input === "/") {
    actions.enterSearch();
    return;
  }

  if (input === "b") {
    actions.startBulkDownload();
    return;
  }

  if (input === "v") {
    actions.enterQueue();
    return;
  }

  // `r` (spec §4): retry a settled run's failures; the action itself no-ops
  // unless the bulk run is complete and has failures.
  if (input === "r") {
    actions.retryFailedBulk();
    return;
  }

  if (input === "?") {
    actions.openHelp();
    return;
  }

  if (input === "q") {
    actions.requestQuit();
  }
};

// Keys in `fullDetail` mode (spec §4): esc/enter go back, the item actions
// keep working on the shown entry, ↑↓ move to the previous or next entry
// without leaving the view.
export const handleFullDetailKeys = (
  input: string,
  key: Key,
  actions: KeyActions,
  shownEntry: Entry | undefined
): void => {
  if (key.escape || key.return) {
    actions.leaveFullDetail();
    return;
  }

  if (key.upArrow || input === "k") {
    actions.moveCursor(-1);
    return;
  }

  if (key.downArrow || input === "j") {
    actions.moveCursor(1);
    return;
  }

  if (input === " " || key.tab) {
    if (shownEntry) {
      actions.toggleBulkSelection(shownEntry);
    }
    return;
  }

  if (input === "d" && shownEntry) {
    actions.downloadEntry(shownEntry);
  }
};

import { useInput } from "ink";
import type { Key } from "ink";
import objectHash from "object-hash";
import type { Entry } from "../../../api/models/entry";
import { Label } from "../../../labels";
import { useBoundStore } from "../../store";

// Spec §4: PgUp/PgDn move the cursor 10 rows.
const PAGE_STEP = 10;

// Store actions the key router dispatches to.
interface KeyActions {
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
}

// Keys in `list` mode (spec §4). `cursorEntry` is the entry under the cursor;
// item actions no-op when the list is empty.
const handleListKeys = (
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

  if (input === "b") {
    actions.startBulkDownload();
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
const handleFullDetailKeys = (
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

// Keys in `help` mode (spec §4): esc or ? closes it, nothing else does
// anything.
const handleHelpKeys = (input: string, key: Key, actions: KeyActions): void => {
  if (key.escape || input === "?") {
    actions.closeOverlay();
  }
};

// Keys in `quit` mode (spec §4): y quits, n or esc closes the prompt, and
// enter closes it too because the default focus is on "stay".
const handleQuitKeys = (input: string, key: Key, actions: KeyActions): void => {
  if (input === "y") {
    actions.handleExit();
    return;
  }

  if (input === "n" || key.escape || key.return) {
    actions.closeOverlay();
  }
};

// The single `useInput` router of the browse screen (spec §4): every key
// dispatches on the current focus mode, and no component below the router
// registers its own `useInput` for these keys.
export function useBrowseKeys() {
  const browseFocus = useBoundStore((state) => state.browseFocus);
  const isLoading = useBoundStore((state) => state.isLoading);
  const entries = useBoundStore((state) => state.entries);
  const listItemsCursor = useBoundStore((state) => state.listItemsCursor);
  const currentPage = useBoundStore((state) => state.currentPage);
  const nextPageStatus = useBoundStore((state) => state.nextPageStatus);
  const searchValue = useBoundStore((state) => state.searchValue);
  const bulkDownloadSelectedEntries = useBoundStore((state) => state.bulkDownloadSelectedEntries);
  const bulkDownloadQueue = useBoundStore((state) => state.bulkDownloadQueue);
  const isBulkDownloadComplete = useBoundStore((state) => state.isBulkDownloadComplete);

  const moveCursor = useBoundStore((state) => state.moveCursor);
  const setCursorToEdge = useBoundStore((state) => state.setCursorToEdge);
  const addToBulkDownloadQueue = useBoundStore((state) => state.addToBulkDownloadQueue);
  const removeFromBulkDownloadQueue = useBoundStore((state) => state.removeFromBulkDownloadQueue);
  const pushDownloadQueue = useBoundStore((state) => state.pushDownloadQueue);
  const previousPage = useBoundStore((state) => state.prevPage);
  const nextPage = useBoundStore((state) => state.nextPage);
  const checkNextPage = useBoundStore((state) => state.checkNextPage);
  const setWarningMessage = useBoundStore((state) => state.setWarningMessage);
  const startBulkDownload = useBoundStore((state) => state.startBulkDownload);
  const openOverlay = useBoundStore((state) => state.openOverlay);
  const closeOverlay = useBoundStore((state) => state.closeOverlay);
  const setBrowseFocus = useBoundStore((state) => state.setBrowseFocus);
  const requestQuit = useBoundStore((state) => state.requestQuit);
  const handleExit = useBoundStore((state) => state.handleExit);

  useInput((input, key) => {
    // The entry under the cursor, clamped the same way the results panel and
    // the side panel clamp it.
    const maxCursor = entries.length - 1;
    let cursor = listItemsCursor;
    if (cursor > maxCursor) {
      cursor = Math.max(maxCursor, 0);
    }
    const cursorEntry = entries[cursor];

    // Whether a bulk run is downloading right now (spec §4's `b` guard; the
    // same condition M4's startBulkDownload guard uses).
    const bulkRunRunning = bulkDownloadQueue.length > 0 && !isBulkDownloadComplete;

    const actions: KeyActions = {
      moveCursor,
      setCursorToEdge,
      toggleBulkSelection: (entry) => {
        if (bulkDownloadSelectedEntries[objectHash(entry)]) {
          removeFromBulkDownloadQueue(entry);
          return;
        }
        addToBulkDownloadQueue(entry);
      },
      // pushDownloadQueue already no-ops for an entry that is queued or
      // downloading; a settled entry may be downloaded again (spec §8.4).
      downloadEntry: (entry) => {
        pushDownloadQueue(entry);
      },
      // Ignored on page 1 (spec §4); while loading the router gate already
      // swallowed the key.
      prevPage: () => {
        if (currentPage > 1) {
          previousPage();
        }
      },
      // The §4 nextPageStatus state machine.
      nextPage: () => {
        switch (nextPageStatus) {
          case "ready":
          case "idle": {
            nextPage();
            break;
          }
          case "error": {
            checkNextPage(searchValue, currentPage + 1);
            break;
          }
          case "checking": {
            // Ignored while a check is in flight.
            break;
          }
          case "unavailable": {
            setWarningMessage(Label.NO_MORE_RESULTS);
            break;
          }
        }
      },
      startBulkDownload: () => {
        if (bulkRunRunning) {
          setWarningMessage(Label.BULK_ALREADY_RUNNING);
          return;
        }
        // An empty selection keeps startBulkDownload's own "queue is empty"
        // warning; at this milestone the run still lands on the old bulk
        // screen (spec §7.4, M3), so browseFocus stays untouched.
        startBulkDownload();
      },
      openHelp: () => {
        openOverlay("help");
      },
      closeOverlay,
      enterFullDetail: () => {
        setBrowseFocus("fullDetail");
      },
      leaveFullDetail: () => {
        setBrowseFocus("list");
      },
      requestQuit,
      handleExit,
    };

    switch (browseFocus) {
      case "list": {
        // Priority rule 4: while a search or page change is in flight only
        // quit, help and ctrl+c work (ctrl+c keeps Ink's default exit
        // behaviour). Overlay modes keep their own keys live — esc must
        // still close help or the quit prompt during the outage wait
        // (spec §8.3 flow 7, priority rule 1).
        if (isLoading && input !== "q" && input !== "?") {
          break;
        }
        handleListKeys(input, key, actions, cursorEntry);
        break;
      }
      case "fullDetail": {
        handleFullDetailKeys(input, key, actions, cursorEntry);
        break;
      }
      case "help": {
        handleHelpKeys(input, key, actions);
        break;
      }
      case "quit": {
        handleQuitKeys(input, key, actions);
        break;
      }
    }
  });
}

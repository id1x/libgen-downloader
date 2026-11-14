import { useInput } from "ink";
import type { Key } from "ink";
import objectHash from "object-hash";
import type { Entry } from "../../../api/models/entry";
import { SEARCH_MIN_CHAR } from "../../../constants";
import { Label } from "../../../labels";
import { useBoundStore } from "../../store";
import { buildQueueModel, type QueueModel } from "./queue-rows";

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

  if (input === "?") {
    actions.openHelp();
    return;
  }

  if (input === "q") {
    actions.requestQuit();
  }
};

// Keys in `queue` mode (spec §4): the cursor moves over the panel's
// actionable rows, `x` removes the cursor item from the bulk selection before
// a run starts, `r` retries a finished run's failures, `d`/`space` act on the
// cursor entry when it maps to a result, and esc/v return to list mode with
// the Detail panel. While the availability banner is active it owns esc (M3's
// recorded semantics: the banner keeps esc in list/queue modes), so esc only
// stops the wait and does not also close the panel.
const handleQueueKeys = (input: string, key: Key, actions: KeyActions, bannerActive: boolean): void => {
  if (key.upArrow || input === "k") {
    actions.moveQueueCursor(-1);
    return;
  }

  if (key.downArrow || input === "j") {
    actions.moveQueueCursor(1);
    return;
  }

  if (input === "x") {
    actions.removeBulkUnderCursor();
    return;
  }

  if (input === "r") {
    actions.retryFailedBulk();
    return;
  }

  if (input === " ") {
    actions.actOnCursorEntry("toggle");
    return;
  }

  if (input === "d") {
    actions.actOnCursorEntry("download");
    return;
  }

  if (key.escape && !bannerActive) {
    actions.leaveQueue();
    return;
  }

  if (input === "v") {
    actions.leaveQueue();
    return;
  }

  if (input === "/") {
    actions.enterSearch();
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

// Keys in `search` mode (spec §4): enter runs the query when it has 3+
// characters (otherwise the search screen's minimum-chars warning), esc
// cancels and restores the previous query, ↑↓ move through the session
// history and ctrl+u clears the input. Every other key belongs to the
// `ink-text-input`, so typing `q` or `d` inserts the letter.
const handleSearchKeys = (input: string, key: Key, actions: KeyActions): void => {
  if (key.escape) {
    actions.cancelSearch();
    return;
  }

  if (key.return) {
    actions.submitSearch();
    return;
  }

  if (key.upArrow) {
    actions.searchHistoryUp();
    return;
  }

  if (key.downArrow) {
    actions.searchHistoryDown();
    return;
  }

  if (key.ctrl && input === "u") {
    actions.clearSearchDraft();
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

// The queue panel's actionable rows, rebuilt from the freshest store state
// per keypress (download ticks mutate it between renders).
const queueModel = (): QueueModel => {
  const store = useBoundStore.getState();
  return buildQueueModel({
    entries: store.entries,
    mirrorAdapter: store.mirrorAdapter,
    bulkDownloadSelectedEntries: store.bulkDownloadSelectedEntries,
    bulkDownloadQueue: store.bulkDownloadQueue,
    bulkFailureReasons: store.bulkFailureReasons,
    downloadProgressMap: store.downloadProgressMap,
    downloadDirectory: process.cwd(),
    createdMD5ListFileName: store.createdMD5ListFileName,
    createdFailedMD5ListFileName: store.createdFailedMD5ListFileName,
  });
};

const queueRowAtCursor = (model: QueueModel) => {
  const store = useBoundStore.getState();
  const maxRow = Math.max(model.actions.length - 1, 0);
  return model.actions[Math.min(Math.max(store.queueCursor, 0), maxRow)];
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
  const toggleSidePanel = useBoundStore((state) => state.toggleSidePanel);
  const setQueueCursor = useBoundStore((state) => state.setQueueCursor);
  const requestQuit = useBoundStore((state) => state.requestQuit);
  const handleExit = useBoundStore((state) => state.handleExit);

  const toggleBulkSelectionFor = (entry: Entry): void => {
    if (bulkDownloadSelectedEntries[objectHash(entry)]) {
      removeFromBulkDownloadQueue(entry);
      return;
    }
    addToBulkDownloadQueue(entry);
  };

  useInput((input, key) => {
    // The entry under the cursor, clamped the same way the results panel and
    // the side panel clamp it.
    const maxCursor = entries.length - 1;
    let cursor = listItemsCursor;
    if (cursor > maxCursor) {
      cursor = Math.max(maxCursor, 0);
    }
    const cursorEntry = entries[cursor];

    const actions: KeyActions = {
      moveCursor,
      setCursorToEdge,
      toggleBulkSelection: toggleBulkSelectionFor,
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
      // The running and empty-selection guards live in startBulkDownload
      // itself (spec §6.1); the store also moves focus to the Queue panel in
      // interactive mode.
      startBulkDownload: () => {
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
      // `v` from list mode (spec §4): toggle the side panel to Queue and move
      // the focus with it.
      enterQueue: () => {
        const store = useBoundStore.getState();
        toggleSidePanel();
        if (store.sidePanel === "detail") {
          setQueueCursor(0);
          setBrowseFocus("queue");
          return;
        }
        setBrowseFocus("list");
      },
      // esc or `v` from queue mode: back to list mode with the Detail panel.
      leaveQueue: () => {
        toggleSidePanel();
        setBrowseFocus("list");
      },
      moveQueueCursor: (delta) => {
        const model = queueModel();
        const maxRow = Math.max(model.actions.length - 1, 0);
        const current = useBoundStore.getState().queueCursor;
        setQueueCursor(Math.min(Math.max(current + delta, 0), maxRow));
      },
      // Before a run starts only (spec §4): the hint renders dim during a
      // run and the key is ignored there.
      removeBulkUnderCursor: () => {
        const store = useBoundStore.getState();
        if (store.bulkDownloadQueue.length > 0 && !store.isBulkDownloadComplete) {
          return;
        }
        const row = queueRowAtCursor(queueModel());
        if (row?.type === "bulk" && row.selected && row.entry) {
          removeFromBulkDownloadQueue(row.entry);
        }
      },
      // Only for a finished run that has failures (spec §4); otherwise a
      // no-op.
      retryFailedBulk: () => {
        const store = useBoundStore.getState();
        if (store.isBulkDownloadComplete && store.failedBulkDownloadItemCount > 0) {
          store.retryFailedBulkDownloads();
        }
      },
      actOnCursorEntry: (action) => {
        const row = queueRowAtCursor(queueModel());
        if (!row?.entry) {
          return;
        }
        if (action === "download") {
          pushDownloadQueue(row.entry);
          return;
        }
        toggleBulkSelectionFor(row.entry);
      },
      // `/` from list or queue mode (spec §4): focus the search input,
      // starting from the live query so it can be edited in place.
      enterSearch: () => {
        const store = useBoundStore.getState();
        store.setSearchDraft(store.searchValue);
        setBrowseFocus("search");
      },
      // esc in search mode: back to the list with the previous query
      // restored (spec §4).
      cancelSearch: () => {
        const store = useBoundStore.getState();
        store.setSearchDraft(store.searchValue);
        setBrowseFocus("list");
      },
      submitSearch: () => {
        const store = useBoundStore.getState();
        if (store.searchDraft.length < SEARCH_MIN_CHAR) {
          store.setWarningMessage(Label.SEARCH_MIN_CHAR_WARNING);
          return;
        }
        store.submitSearchFromBrowse();
      },
      searchHistoryUp: () => {
        useBoundStore.getState().searchHistoryPrevious();
      },
      searchHistoryDown: () => {
        useBoundStore.getState().searchHistoryNext();
      },
      // ctrl+u clears the input (spec §4). ink-text-input also receives the
      // key — it inserts the letter — and its handler may run before or after
      // this one depending on subscription order, so the clear is deferred
      // past the whole keypress and is always the last write.
      clearSearchDraft: () => {
        queueMicrotask(() => {
          useBoundStore.getState().setSearchDraft("");
        });
      },
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
      case "queue": {
        if (isLoading && input !== "q" && input !== "?") {
          break;
        }
        const bannerActive = useBoundStore.getState().availabilityStatus.state !== "available";
        handleQueueKeys(input, key, actions, bannerActive);
        break;
      }
      case "fullDetail": {
        handleFullDetailKeys(input, key, actions, cursorEntry);
        break;
      }
      case "search": {
        handleSearchKeys(input, key, actions);
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

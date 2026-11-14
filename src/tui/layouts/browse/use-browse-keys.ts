import { useInput } from "ink";
import objectHash from "object-hash";
import type { Entry } from "../../../api/models/entry";
import { Label } from "../../../labels";
import { useBoundStore } from "../../store";
import type { KeyActions } from "./key-actions";
import { handleFullDetailKeys, handleListKeys } from "./list-keys";
import {
  actOnCursorRow,
  enterQueue,
  handleQueueKeys,
  leaveQueue,
  moveQueueCursorBy,
  removeBulkUnderCursor,
  retryFailedBulk,
} from "./queue-keys";
import {
  cancelSearch,
  clearSearchDraft,
  enterSearch,
  handleHelpKeys,
  handleQuitKeys,
  handleSearchKeys,
  submitSearch,
} from "./overlay-keys";

// Priority rule 4: while a search or page change is in flight only quit,
// help and ctrl+c work (ctrl+c keeps Ink's default exit behaviour). The
// three non-overlay focus modes gate to this dispatcher while `isLoading`:
// `q` and `?` keep their global meanings (quit prompt, help overlay) — in
// fullDetail, which binds neither key of its own, this dispatch is what
// keeps them live. Overlay modes (help, quit, search) keep their own keys
// live — esc must still close help or the quit prompt during the outage wait
// (spec §8.3 flow 7, priority rule 1; NOTES.md M3).
const handleLoadingExemptKey = (input: string, actions: KeyActions): void => {
  if (input === "q") {
    actions.requestQuit();
    return;
  }
  if (input === "?") {
    actions.openHelp();
  }
};

// The single `useInput` router of the browse screen (spec §4): every key
// dispatches on the current focus mode, and no component below the router
// registers its own `useInput` for these keys. The per-mode dispatchers live
// in list-keys.ts, queue-keys.ts and overlay-keys.ts.
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
  const requestQuit = useBoundStore((state) => state.requestQuit);
  const handleExit = useBoundStore((state) => state.handleExit);
  const searchHistoryPrevious = useBoundStore((state) => state.searchHistoryPrevious);
  const searchHistoryNext = useBoundStore((state) => state.searchHistoryNext);

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
      downloadEntry: pushDownloadQueue,
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
      startBulkDownload,
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
      enterQueue,
      leaveQueue,
      moveQueueCursor: moveQueueCursorBy,
      removeBulkUnderCursor,
      retryFailedBulk,
      actOnCursorEntry: (action) => actOnCursorRow(action, toggleBulkSelectionFor),
      enterSearch,
      cancelSearch,
      submitSearch,
      searchHistoryUp: searchHistoryPrevious,
      searchHistoryDown: searchHistoryNext,
      clearSearchDraft,
    };

    switch (browseFocus) {
      case "list": {
        if (isLoading) {
          handleLoadingExemptKey(input, actions);
          break;
        }
        handleListKeys(input, key, actions, cursorEntry);
        break;
      }
      case "queue": {
        if (isLoading) {
          handleLoadingExemptKey(input, actions);
          break;
        }
        const bannerActive = useBoundStore.getState().availabilityStatus.state !== "available";
        handleQueueKeys(input, key, actions, bannerActive);
        break;
      }
      case "fullDetail": {
        // fullDetail is not an overlay, so the load gate covers it too: its
        // own keys (esc/enter/space/d/↑↓) go inert while a search or page
        // change runs (spec §4 priority rule 4).
        if (isLoading) {
          handleLoadingExemptKey(input, actions);
          break;
        }
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

import { TCombinedStore } from "./index";

export type BrowseFocus = "list" | "queue" | "search" | "help" | "quit" | "fullDetail";
export type SidePanelMode = "detail" | "queue";

// Session-only history of the last searches, newest first (spec §6.1).
const SEARCH_HISTORY_LIMIT = 10;

export interface IBrowseState {
  browseFocus: BrowseFocus;
  focusBeforeOverlay: BrowseFocus;
  sidePanel: SidePanelMode;
  queueCursor: number;
  searchHistory: string[];
  searchDraft: string;

  setBrowseFocus: (browseFocus: BrowseFocus) => void;
  openOverlay: (overlay: BrowseFocus) => void;
  closeOverlay: () => void;
  toggleSidePanel: () => void;
  setQueueCursor: (queueCursor: number) => void;
  pushSearchHistory: (query: string) => void;
  requestQuit: () => void;
}

export const initialBrowseState = {
  browseFocus: "list" as BrowseFocus,
  focusBeforeOverlay: "list" as BrowseFocus,
  sidePanel: "detail" as SidePanelMode,
  queueCursor: 0,
  searchHistory: [] as string[],
  searchDraft: "",
};

export const createBrowseStateSlice = (
  set: (
    partial: Partial<TCombinedStore> | ((state: TCombinedStore) => Partial<TCombinedStore>)
  ) => void,
  get: () => TCombinedStore
) => {
  return {
    ...initialBrowseState,

    setBrowseFocus: (browseFocus: BrowseFocus) => {
      return set({ browseFocus });
    },

    openOverlay: (overlay: BrowseFocus) => {
      // Help and quit remember the mode they opened from and return to it on
      // close (spec §4).
      return set({ focusBeforeOverlay: get().browseFocus, browseFocus: overlay });
    },

    closeOverlay: () => {
      return set({ browseFocus: get().focusBeforeOverlay });
    },

    toggleSidePanel: () => {
      if (get().sidePanel === "detail") {
        return set({ sidePanel: "queue" });
      }
      return set({ sidePanel: "detail" });
    },

    setQueueCursor: (queueCursor: number) => {
      return set({ queueCursor });
    },

    pushSearchHistory: (query: string) => {
      if (query.length === 0) {
        return;
      }
      const history = [query, ...get().searchHistory.filter((item) => item !== query)].slice(
        0,
        SEARCH_HISTORY_LIMIT
      );
      return set({ searchHistory: history });
    },

    // `q` (spec §4, §6.1): exit straight away when nothing is pending, open
    // the quit overlay otherwise. Pending work: a direct download queued or
    // running, a non-empty bulk selection, a bulk run still going.
    requestQuit: () => {
      const store = get();
      const bulkRunRunning =
        store.bulkDownloadQueue.length > 0 && !store.isBulkDownloadComplete;
      const pending =
        store.inDownloadQueueEntryIds.length > 0 ||
        Object.keys(store.bulkDownloadSelectedEntries).length > 0 ||
        bulkRunRunning;

      if (!pending) {
        store.handleExit();
        return;
      }

      store.openOverlay("quit");
    },
  };
};

import { TCombinedStore } from "./index";
import { Entry } from "../../api/models/entry";
import { NextPageStatus } from "../../utilities";
import { LAYOUT_KEY } from "../layouts/keys";
import { clearScreen } from "../helpers/display";

export type MirrorCheckStatus = "pending" | "checking" | "ok" | "failed";

export interface MirrorCheckState {
  src: string;
  status: MirrorCheckStatus;
}

export interface IAppState {
  CLIMode: boolean;

  isLoading: boolean;
  showSearchMinCharWarning: boolean;

  loaderMessage: string;
  searchValue: string;
  errorMessage: string | undefined;
  warningMessage: string | undefined;
  warningTimeout: NodeJS.Timeout | undefined;

  currentPage: number;
  listItemsCursor: number;

  entries: Entry[];
  activeLayout: LAYOUT_KEY;

  nextPageStatus: NextPageStatus;
  connectionError: string | undefined;
  mirrorCheckStates: MirrorCheckState[];

  setCLIMode: (CLIMode: boolean) => void;

  setIsLoading: (isLoading: boolean) => void;

  setLoaderMessage: (loaderMessage: string) => void;
  setSearchValue: (searchValue: string) => void;
  setErrorMessage: (errorMessage: string | undefined) => void;
  setWarningMessage: (warningMessage: string | undefined) => void;

  setCurrentPage: (currentPage: number) => void;
  setListItemsCursor: (listItemsCursor: number) => void;

  setEntries: (entries: Entry[]) => void;
  setActiveLayout: (activeLayout: LAYOUT_KEY) => void;

  moveCursor: (delta: number) => void;
  setCursorToEdge: (edge: "first" | "last") => void;

  setNextPageStatus: (nextPageStatus: NextPageStatus) => void;
  setConnectionError: (connectionError: string | undefined) => void;
  setMirrorCheckStates: (mirrorCheckStates: MirrorCheckState[]) => void;

  resetAppState: () => void;
}

export const initialAppState = {
  isLoading: false,
  showSearchMinCharWarning: true,

  loaderMessage: "",
  searchValue: "",
  errorMessage: undefined,
  warningMessage: undefined,
  warningTimeout: undefined,

  currentPage: 1,
  listItemsCursor: 0,

  entries: [],
  activeLayout: LAYOUT_KEY.SEARCH_LAYOUT,

  nextPageStatus: "idle" as NextPageStatus,
  connectionError: undefined as string | undefined,
  mirrorCheckStates: [] as MirrorCheckState[],
};

export const createAppStateSlice = (
  set: (
    partial: Partial<TCombinedStore> | ((state: TCombinedStore) => Partial<TCombinedStore>)
  ) => void,
  get: () => TCombinedStore
) => {
  return {
    CLIMode: false,
    setCLIMode: (CLIMode: boolean) => {
      return set({ CLIMode });
    },

    ...initialAppState,

    setIsLoading: (isLoading: boolean) => {
      return set({ isLoading });
    },

    setLoaderMessage: (loaderMessage: string) => {
      return set({ loaderMessage });
    },
    setSearchValue: (searchValue: string) => {
      set(() => ({ showSearchMinCharWarning: searchValue.length < 3 }));
      set({ searchValue });
    },
    setErrorMessage: (errorMessage: string | undefined) => {
      return set({ errorMessage });
    },
    setWarningMessage: (warningMessage: string | undefined) => {
      const WARNING_DURATION = 5000;

      const timeout = get().warningTimeout;
      if (timeout) {
        clearTimeout(timeout);
      }

      set({ warningMessage });
      const newTimeout = setTimeout(() => {
        set({ warningMessage: undefined });
      }, WARNING_DURATION);
      set({ warningTimeout: newTimeout });
    },

    setCurrentPage: (currentPage: number) => {
      return set({ currentPage });
    },
    setListItemsCursor: (listItemsCursor: number) => {
      return set({ listItemsCursor });
    },

    setEntries: (entries: Entry[]) => {
      // The browse list renders `entries` directly and `listItemsCursor`
      // indexes into `entries`; menu options no longer get mixed into the
      // list (spec §6.1).
      return set({ entries });
    },

    moveCursor: (delta: number) => {
      const entries = get().entries;
      let upperBound = entries.length - 1;
      if (upperBound < 0) {
        // An empty list keeps the cursor at 0.
        upperBound = 0;
      }
      const nextCursor = Math.min(Math.max(get().listItemsCursor + delta, 0), upperBound);
      return set({ listItemsCursor: nextCursor });
    },

    setCursorToEdge: (edge: "first" | "last") => {
      const entries = get().entries;
      let target = 0;
      if (edge === "last" && entries.length > 0) {
        target = entries.length - 1;
      }
      return set({ listItemsCursor: target });
    },
    setActiveLayout: (activeLayout: LAYOUT_KEY) => {
      const store = get();
      if (!store.CLIMode) {
        clearScreen();
      }

      set({ activeLayout });
    },

    setNextPageStatus: (nextPageStatus: NextPageStatus) => {
      return set({ nextPageStatus });
    },
    setConnectionError: (connectionError: string | undefined) => {
      return set({ connectionError });
    },
    setMirrorCheckStates: (mirrorCheckStates: MirrorCheckState[]) => {
      return set({ mirrorCheckStates });
    },

    resetAppState: () => {
      return set(initialAppState);
    },
  };
};

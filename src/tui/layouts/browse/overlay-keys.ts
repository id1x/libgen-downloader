import type { Key } from "ink";
import { SEARCH_MIN_CHAR } from "../../../constants";
import { Label } from "../../../labels";
import { useBoundStore } from "../../store";
import type { KeyActions } from "./key-actions";

// `/` from list or queue mode (spec §4): focus the search input, starting
// from the live query so it can be edited in place.
export const enterSearch = (): void => {
  const store = useBoundStore.getState();
  store.setSearchDraft(store.searchValue);
  store.setBrowseFocus("search");
};

// esc in search mode: back to the list with the previous query restored
// (spec §4).
export const cancelSearch = (): void => {
  const store = useBoundStore.getState();
  store.setSearchDraft(store.searchValue);
  store.setBrowseFocus("list");
};

// enter in search mode: run the query when it has 3+ characters, otherwise
// the search screen's minimum-chars warning (spec §4).
export const submitSearch = (): void => {
  const store = useBoundStore.getState();
  if (store.searchDraft.length < SEARCH_MIN_CHAR) {
    store.setWarningMessage(Label.SEARCH_MIN_CHAR_WARNING);
    return;
  }
  store.submitSearchFromBrowse();
};

// ctrl+u clears the input (spec §4). ink-text-input also receives the key —
// it inserts the letter — and its handler may run before or after this one
// depending on subscription order, so the clear is deferred past the whole
// keypress and is always the last write.
export const clearSearchDraft = (): void => {
  queueMicrotask(() => {
    useBoundStore.getState().setSearchDraft("");
  });
};

// Keys in `search` mode (spec §4): enter runs the query when it has 3+
// characters (otherwise the search screen's minimum-chars warning), esc
// cancels and restores the previous query, ↑↓ move through the session
// history and ctrl+u clears the input. Every other key belongs to the
// `ink-text-input`, so typing `q` or `d` inserts the letter.
export const handleSearchKeys = (input: string, key: Key, actions: KeyActions): void => {
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

// Keys in `help` mode (spec §4): esc or ? closes it, nothing else does
// anything.
export const handleHelpKeys = (input: string, key: Key, actions: KeyActions): void => {
  if (key.escape || input === "?") {
    actions.closeOverlay();
  }
};

// Keys in `quit` mode (spec §4): y quits, n or esc closes the prompt, and
// enter closes it too because the default focus is on "stay".
export const handleQuitKeys = (input: string, key: Key, actions: KeyActions): void => {
  if (input === "y") {
    actions.handleExit();
    return;
  }

  if (input === "n" || key.escape || key.return) {
    actions.closeOverlay();
  }
};

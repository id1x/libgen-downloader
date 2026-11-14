import { describe, expect, it } from "bun:test";
import type { Key } from "ink";
import type { Entry } from "../src/api/models/entry";
import type { KeyActions } from "../src/tui/layouts/browse/key-actions";
import { handleFullDetailKeys, handleListKeys } from "../src/tui/layouts/browse/list-keys";

const entry: Entry = {
  id: "entry-1",
  authors: "A. Author",
  title: "A Title",
  publisher: "Publisher",
  year: "2019",
  pages: "388",
  language: "English",
  size: "14 MB",
  extension: "pdf",
  mirror: "https://mirror-a.example/ads.php?md5=9f3c2a7eb41d00000000000000000000",
};

const key = (overrides: Partial<Key> = {}): Key => {
  return {
    upArrow: false,
    downArrow: false,
    leftArrow: false,
    rightArrow: false,
    pageDown: false,
    pageUp: false,
    home: false,
    end: false,
    return: false,
    escape: false,
    ctrl: false,
    shift: false,
    tab: false,
    backspace: false,
    delete: false,
    meta: false,
    ...overrides,
  };
};

// Records which action fired; every action starts as a no-op spy.
const recorder = (): KeyActions & { fired: string[] } => {
  const fired: string[] = [];
  const note = (name: string) => {
    return () => {
      fired.push(name);
    };
  };
  return {
    fired,
    moveCursor: note("moveCursor"),
    setCursorToEdge: note("setCursorToEdge"),
    toggleBulkSelection: note("toggleBulkSelection"),
    downloadEntry: note("downloadEntry"),
    prevPage: note("prevPage"),
    nextPage: note("nextPage"),
    startBulkDownload: note("startBulkDownload"),
    openHelp: note("openHelp"),
    closeOverlay: note("closeOverlay"),
    enterFullDetail: note("enterFullDetail"),
    leaveFullDetail: note("leaveFullDetail"),
    requestQuit: note("requestQuit"),
    handleExit: note("handleExit"),
    enterQueue: note("enterQueue"),
    leaveQueue: note("leaveQueue"),
    moveQueueCursor: note("moveQueueCursor"),
    removeBulkUnderCursor: note("removeBulkUnderCursor"),
    retryFailedBulk: note("retryFailedBulk"),
    actOnCursorEntry: note("actOnCursorEntry"),
    enterSearch: note("enterSearch"),
    cancelSearch: note("cancelSearch"),
    submitSearch: note("submitSearch"),
    searchHistoryUp: note("searchHistoryUp"),
    searchHistoryDown: note("searchHistoryDown"),
    clearSearchDraft: note("clearSearchDraft"),
  };
};

describe("handleListKeys", () => {
  it("routes `r` to the failed-download retry (spec §4 list table)", () => {
    const actions = recorder();

    handleListKeys("r", key(), actions, entry);

    expect(actions.fired).toEqual(["retryFailedBulk"]);
  });

  it("leaves `R` unbound (spec §4 rule 3: exact case)", () => {
    const actions = recorder();

    handleListKeys("R", key(), actions, entry);

    expect(actions.fired).toEqual([]);
  });

  it("downloads the cursor entry on `d` and nothing on an empty list", () => {
    const withEntry = recorder();
    handleListKeys("d", key(), withEntry, entry);
    expect(withEntry.fired).toEqual(["downloadEntry"]);

    // The empty-list case: the router's cursorEntry is `entries[cursor]`,
    // which is undefined when the list has no rows.
    const emptyList: Entry[] = [];
    const withoutEntryActions = recorder();
    handleListKeys("d", key(), withoutEntryActions, emptyList[0]);
    expect(withoutEntryActions.fired).toEqual([]);
  });

  it("keeps `q` on the quit flow", () => {
    const actions = recorder();

    handleListKeys("q", key(), actions, entry);

    expect(actions.fired).toEqual(["requestQuit"]);
  });
});

describe("handleFullDetailKeys", () => {
  it("leaves the view on esc and enter", () => {
    const onEscape = recorder();
    handleFullDetailKeys("", key({ escape: true }), onEscape, entry);
    expect(onEscape.fired).toEqual(["leaveFullDetail"]);

    const onReturn = recorder();
    handleFullDetailKeys("", key({ return: true }), onReturn, entry);
    expect(onReturn.fired).toEqual(["leaveFullDetail"]);
  });

  it("downloads the shown entry on `d`", () => {
    const actions = recorder();

    handleFullDetailKeys("d", key(), actions, entry);

    expect(actions.fired).toEqual(["downloadEntry"]);
  });

  it("ignores `q` and `?` outside a load (spec §4 fullDetail table)", () => {
    const onQ = recorder();
    handleFullDetailKeys("q", key(), onQ, entry);
    expect(onQ.fired).toEqual([]);

    const onQuestion = recorder();
    handleFullDetailKeys("?", key(), onQuestion, entry);
    expect(onQuestion.fired).toEqual([]);
  });
});

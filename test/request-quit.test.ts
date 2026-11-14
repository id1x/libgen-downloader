import { afterEach, describe, expect, it } from "bun:test";
import { useBoundStore } from "../src/tui/store";
import type { TCombinedStore } from "../src/tui/store";
import type { Entry } from "../src/api/models/entry";
import { DownloadStatus } from "../src/download-statuses";

const originalStoreState = useBoundStore.getState();

const createEntry = (id: string): Entry => {
  return {
    id,
    authors: "",
    title: id,
    publisher: "",
    year: "",
    pages: "",
    language: "",
    size: "",
    extension: "",
    mirror: "",
  };
};

// handleExit is process.exit(0) on the real store; the tests replace it with
// a spy so "quit" is observable without ending the test process.
let exits = 0;

afterEach(() => {
  useBoundStore.setState(originalStoreState, true);
  exits = 0;
});

const requestQuit = (): void => {
  useBoundStore.getState().requestQuit();
};

const expectExit = (): void => {
  expect(exits).toBe(1);
  expect(useBoundStore.getState().browseFocus).toBe("list");
};

const expectQuitOverlay = (): void => {
  expect(useBoundStore.getState().browseFocus).toBe("quit");
  expect(exits).toBe(0);
};

describe("requestQuit", () => {
  it("quits immediately with nothing pending", () => {
    useBoundStore.setState({
      handleExit: () => {
        exits += 1;
      },
    } as Partial<TCombinedStore>);

    requestQuit();

    expectExit();
  });

  it("opens the overlay with a pending download", () => {
    useBoundStore.setState({
      handleExit: () => {
        exits += 1;
      },
      inDownloadQueueEntryIds: ["fake-entry-1"],
    } as Partial<TCombinedStore>);

    requestQuit();

    expectQuitOverlay();
  });

  it("opens the overlay with a non-empty bulk selection", () => {
    useBoundStore.setState({
      handleExit: () => {
        exits += 1;
      },
      bulkDownloadSelectedEntries: { "hash-1": createEntry("fake-entry-1") },
    } as Partial<TCombinedStore>);

    requestQuit();

    expectQuitOverlay();
  });

  it("opens the overlay with a running bulk run", () => {
    useBoundStore.setState({
      handleExit: () => {
        exits += 1;
      },
      bulkDownloadQueue: [
        {
          md5: "0a000000000000000000000000000000",
          filename: "",
          total: 0,
          progress: 0,
          status: DownloadStatus.DOWNLOADING,
        },
      ],
      isBulkDownloadComplete: false,
    } as Partial<TCombinedStore>);

    requestQuit();

    expectQuitOverlay();
  });

  it("quits when the bulk run has finished and nothing else is pending", () => {
    useBoundStore.setState({
      handleExit: () => {
        exits += 1;
      },
      bulkDownloadQueue: [
        {
          md5: "0a000000000000000000000000000000",
          filename: "",
          total: 0,
          progress: 0,
          status: DownloadStatus.DOWNLOADED,
        },
      ],
      isBulkDownloadComplete: true,
    } as Partial<TCombinedStore>);

    requestQuit();

    expectExit();
  });
});

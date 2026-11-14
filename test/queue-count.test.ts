import { describe, expect, it } from "bun:test";
import { DownloadStatus } from "../src/download-statuses";
import type { Entry } from "../src/api/models/entry";
import type { IDownloadProgress } from "../src/tui/store/download-queue";
import { unfinishedQueueCount } from "../src/tui/layouts/browse/queue-count";

const entryWithMD5 = (md5: string, id: string): Entry => ({
  id,
  authors: "A. Author",
  title: "A Title",
  publisher: "Publisher",
  year: "2019",
  pages: "388",
  language: "English",
  size: "14 MB",
  extension: "pdf",
  mirror: `https://mirror-a.example/ads.php?md5=${md5}`,
});

const adapter = {
  getEntryMD5: (entry: Entry): string | undefined => {
    const match = entry.mirror.match(/md5=([0-9a-f]+)/);
    return match?.[1];
  },
};

const directProgress = (status: DownloadStatus): IDownloadProgress => ({
  filename: "file.pdf",
  total: 100,
  progress: 0,
  status,
});

const bulkItem = (md5: string, status: DownloadStatus) => ({
  md5,
  filename: "file.pdf",
  total: 100,
  progress: 0,
  status,
});

const context = (overrides: {
  bulkDownloadSelectedEntries?: Record<string, Entry>;
  bulkDownloadQueue?: ReturnType<typeof bulkItem>[];
  downloadProgressMap?: Record<string, IDownloadProgress>;
  mirrorAdapter?: typeof adapter | undefined;
}) => ({
  bulkDownloadSelectedEntries: {} as Record<string, Entry>,
  bulkDownloadQueue: [] as ReturnType<typeof bulkItem>[],
  downloadProgressMap: {} as Record<string, IDownloadProgress>,
  mirrorAdapter: adapter as typeof adapter | undefined,
  ...overrides,
});

describe("unfinishedQueueCount", () => {
  it("is 0 with nothing selected and no downloads", () => {
    expect(unfinishedQueueCount(context({}))).toBe(0);
  });

  it("counts every bulk selection before a run starts", () => {
    const selected = {
      h1: entryWithMD5("a1", "e1"),
      h2: entryWithMD5("a2", "e2"),
      h3: entryWithMD5("a3", "e3"),
    };
    expect(unfinishedQueueCount(context({ bulkDownloadSelectedEntries: selected }))).toBe(3);
  });

  it("drops selections whose bulk run outcome is DOWNLOADED", () => {
    const selected = {
      h1: entryWithMD5("a1", "e1"),
      h2: entryWithMD5("a2", "e2"),
    };
    const count = unfinishedQueueCount(context({
      bulkDownloadSelectedEntries: selected,
      bulkDownloadQueue: [bulkItem("a1", DownloadStatus.DOWNLOADED)],
    }));

    expect(count).toBe(1);
  });

  it("drops selections whose bulk run outcome is FAILED the moment it fails", () => {
    const selected = {
      h1: entryWithMD5("a1", "e1"),
      h2: entryWithMD5("a2", "e2"),
    };
    const count = unfinishedQueueCount(context({
      bulkDownloadSelectedEntries: selected,
      bulkDownloadQueue: [bulkItem("a1", DownloadStatus.FAILED)],
    }));

    expect(count).toBe(1);
  });

  it("keeps counting selections whose bulk run outcome is not terminal", () => {
    const selected = { h1: entryWithMD5("a1", "e1") };
    const count = unfinishedQueueCount(context({
      bulkDownloadSelectedEntries: selected,
      bulkDownloadQueue: [bulkItem("a1", DownloadStatus.DOWNLOADING)],
    }));

    expect(count).toBe(1);
  });

  it("counts direct downloads that are neither DOWNLOADED nor FAILED", () => {
    const count = unfinishedQueueCount(context({
      downloadProgressMap: {
        e1: directProgress(DownloadStatus.IN_QUEUE),
        e2: directProgress(DownloadStatus.DOWNLOADING),
        e3: directProgress(DownloadStatus.CONNECTING_TO_LIBGEN),
        e4: directProgress(DownloadStatus.WAITING_FOR_LIBGEN),
        e5: directProgress(DownloadStatus.PROCESSING),
        e6: directProgress(DownloadStatus.FETCHING_MD5),
      },
    }));

    expect(count).toBe(6);
  });

  it("excludes terminal direct downloads", () => {
    const count = unfinishedQueueCount(context({
      downloadProgressMap: {
        e1: directProgress(DownloadStatus.DOWNLOADED),
        e2: directProgress(DownloadStatus.FAILED),
      },
    }));

    expect(count).toBe(0);
  });

  it("sums the bulk and direct terms independently", () => {
    const count = unfinishedQueueCount(context({
      bulkDownloadSelectedEntries: { h1: entryWithMD5("a1", "e1") },
      downloadProgressMap: { e1: directProgress(DownloadStatus.DOWNLOADING) },
    }));

    expect(count).toBe(2);
  });

  it("counts selections it cannot join to an outcome when no adapter is set", () => {
    const count = unfinishedQueueCount(context({
      bulkDownloadSelectedEntries: { h1: entryWithMD5("a1", "e1") },
      bulkDownloadQueue: [bulkItem("a1", DownloadStatus.DOWNLOADED)],
      mirrorAdapter: undefined,
    }));

    expect(count).toBe(1);
  });
});

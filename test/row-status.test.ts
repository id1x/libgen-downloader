import { describe, expect, it } from "bun:test";
import { DownloadStatus } from "../src/download-statuses";
import type { Entry } from "../src/api/models/entry";
import type { IDownloadProgress } from "../src/tui/store/download-queue";
import type { IBulkDownloadQueueItem } from "../src/tui/store/bulk-download-queue";
import {
  downloadPercent,
  rowStatus,
} from "../src/tui/layouts/browse/row-status";

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

const mirrorAdapter = {
  getEntryMD5: (candidate: Entry): string | undefined => {
    const match = candidate.mirror.match(/md5=([0-9a-f]+)/);
    return match?.[1];
  },
};

const progress = (status: DownloadStatus, progressBytes = 0): IDownloadProgress => ({
  filename: "file.pdf",
  total: 100,
  progress: progressBytes,
  status,
});

const bulkItem = (status: DownloadStatus, md5 = "9f3c2a7eb41d00000000000000000000") => ({
  md5,
  filename: "file.pdf",
  total: 100,
  progress: 0,
  status,
});

const context = (overrides: {
  downloadProgressMap?: Record<string, IDownloadProgress>;
  bulkSelected?: boolean;
  bulkQueue?: IBulkDownloadQueueItem[];
  mirrorAdapter?: typeof mirrorAdapter | undefined;
}) => ({
  downloadProgressMap: {} as Record<string, IDownloadProgress>,
  bulkSelected: false,
  bulkQueue: [] as IBulkDownloadQueueItem[],
  mirrorAdapter: mirrorAdapter as typeof mirrorAdapter | undefined,
  ...overrides,
});

describe("rowStatus", () => {
  it("labels a direct DOWNLOADING row with its integer percent in cyan", () => {
    const status = rowStatus(entry, context({
      downloadProgressMap: { [entry.id]: progress(DownloadStatus.DOWNLOADING, 42) },
    }));

    expect(status).toEqual({ symbol: "42%", color: "cyan", kind: "progress" });
  });

  it("labels CONNECTING_TO_LIBGEN with the spinner symbol in cyan", () => {
    const status = rowStatus(entry, context({
      downloadProgressMap: { [entry.id]: progress(DownloadStatus.CONNECTING_TO_LIBGEN) },
    }));

    expect(status).toEqual({ symbol: "⠋", color: "cyan", kind: "spinner" });
  });

  it("labels PROCESSING with the spinner symbol in cyan", () => {
    const status = rowStatus(entry, context({
      downloadProgressMap: { [entry.id]: progress(DownloadStatus.PROCESSING) },
    }));

    expect(status).toEqual({ symbol: "⠋", color: "cyan", kind: "spinner" });
  });

  it("labels FETCHING_MD5 with the spinner symbol in cyan", () => {
    const status = rowStatus(entry, context({
      downloadProgressMap: { [entry.id]: progress(DownloadStatus.FETCHING_MD5) },
    }));

    expect(status).toEqual({ symbol: "⠋", color: "cyan", kind: "spinner" });
  });

  it("labels WAITING_FOR_LIBGEN with an ellipsis in magenta", () => {
    const status = rowStatus(entry, context({
      downloadProgressMap: { [entry.id]: progress(DownloadStatus.WAITING_FOR_LIBGEN) },
    }));

    expect(status).toEqual({ symbol: "…", color: "magenta", kind: "waiting" });
  });

  it("labels IN_QUEUE with ⋯ dimmed", () => {
    const status = rowStatus(entry, context({
      downloadProgressMap: { [entry.id]: progress(DownloadStatus.IN_QUEUE) },
    }));

    expect(status).toEqual({ symbol: "⋯", color: "gray", kind: "queued" });
  });

  it("labels FAILED with ✗ in red", () => {
    const status = rowStatus(entry, context({
      downloadProgressMap: { [entry.id]: progress(DownloadStatus.FAILED) },
    }));

    expect(status).toEqual({ symbol: "✗", color: "red", kind: "failed" });
  });

  it("labels DOWNLOADED with ✓ in green", () => {
    const status = rowStatus(entry, context({
      downloadProgressMap: { [entry.id]: progress(DownloadStatus.DOWNLOADED, 100) },
    }));

    expect(status).toEqual({ symbol: "✓", color: "green", kind: "done" });
  });

  it("labels a bulk-selected entry with ● in yellow", () => {
    const status = rowStatus(entry, context({ bulkSelected: true }));

    expect(status).toEqual({ symbol: "●", color: "yellow", kind: "bulk" });
  });

  it("labels an entry with no status as blank", () => {
    const status = rowStatus(entry, context({}));

    expect(status).toEqual({ symbol: "", color: undefined, kind: "none" });
  });

  it("lets the download win when an entry is bulk-selected and downloading", () => {
    const status = rowStatus(entry, context({
      downloadProgressMap: { [entry.id]: progress(DownloadStatus.DOWNLOADING, 42) },
      bulkSelected: true,
    }));

    expect(status.kind).toBe("progress");
    expect(status.symbol).toBe("42%");
    expect(status.color).toBe("cyan");
  });

  it("keeps the priority order for the other direct statuses over bulk selection", () => {
    const statuses = [
      DownloadStatus.CONNECTING_TO_LIBGEN,
      DownloadStatus.WAITING_FOR_LIBGEN,
      DownloadStatus.IN_QUEUE,
      DownloadStatus.FAILED,
      DownloadStatus.DOWNLOADED,
    ];
    for (const downloadStatus of statuses) {
      const status = rowStatus(entry, context({
        downloadProgressMap: { [entry.id]: progress(downloadStatus) },
        bulkSelected: true,
      }));

      expect(status.kind).not.toBe("bulk");
    }
  });

  it("shows ✓ for a bulk-selected entry whose bulk run downloaded it", () => {
    const status = rowStatus(entry, context({
      bulkSelected: true,
      bulkQueue: [bulkItem(DownloadStatus.DOWNLOADED)],
    }));

    expect(status).toEqual({ symbol: "✓", color: "green", kind: "done" });
  });

  it("keeps ● for a bulk-selected entry whose bulk run failed it (it stays selected)", () => {
    const status = rowStatus(entry, context({
      bulkSelected: true,
      bulkQueue: [bulkItem(DownloadStatus.FAILED)],
    }));

    expect(status).toEqual({ symbol: "●", color: "yellow", kind: "bulk" });
  });

  it("keeps ● while the bulk run has not settled the entry", () => {
    const status = rowStatus(entry, context({
      bulkSelected: true,
      bulkQueue: [bulkItem(DownloadStatus.IN_QUEUE)],
    }));

    expect(status).toEqual({ symbol: "●", color: "yellow", kind: "bulk" });
  });

  it("ignores bulk queue outcomes for other MD5s", () => {
    const status = rowStatus(entry, context({
      bulkSelected: true,
      bulkQueue: [bulkItem(DownloadStatus.DOWNLOADED, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")],
    }));

    expect(status).toEqual({ symbol: "●", color: "yellow", kind: "bulk" });
  });

  it("treats a selection without an adapter as plain bulk membership", () => {
    const status = rowStatus(entry, context({
      bulkSelected: true,
      mirrorAdapter: undefined,
    }));

    expect(status).toEqual({ symbol: "●", color: "yellow", kind: "bulk" });
  });
});

describe("downloadPercent", () => {
  it("rounds the ratio into an integer percent like the old toFixed display", () => {
    expect(downloadPercent(42, 100)).toBe(42);
    expect(downloadPercent(4.2 * 1024 * 1024, 10 * 1024 * 1024)).toBe(42);
  });

  it("clamps to 0..100 and survives missing values", () => {
    expect(downloadPercent(0, 100)).toBe(0);
    expect(downloadPercent(undefined, 100)).toBe(0);
    expect(downloadPercent(50, 0)).toBe(0);
    expect(downloadPercent(150, 100)).toBe(100);
  });
});

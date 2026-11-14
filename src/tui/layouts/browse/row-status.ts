import { DownloadStatus } from "../../../download-statuses";
import type { Entry } from "../../../api/models/entry";
import type { IDownloadProgress } from "../../store/download-queue";
import type { IBulkDownloadQueueItem } from "../../store/bulk-download-queue";
import { BULK_SELECTED_SYMBOL, STATUS_SYMBOLS } from "./status-symbol";

// Statuses that are actively working but have no byte progress yet (spec §3
// row table, "spinner" row).
const SPINNER_STATUSES = new Set<DownloadStatus>([
  DownloadStatus.CONNECTING_TO_LIBGEN,
  DownloadStatus.PROCESSING,
  DownloadStatus.FETCHING_MD5,
]);

export type RowStatusKind =
  | "progress"
  | "spinner"
  | "waiting"
  | "queued"
  | "failed"
  | "done"
  | "bulk"
  | "none";

export interface RowStatus {
  symbol: string;
  // Ink colour name; undefined for the blank status.
  color: string | undefined;
  kind: RowStatusKind;
}

// Structural slice of the mirror adapter the status logic needs; the real
// Adapter satisfies this.
export interface RowStatusMirrorAdapter {
  getEntryMD5(entry: Entry): string | undefined;
}

export interface RowStatusContext {
  downloadProgressMap: Record<string, IDownloadProgress>;
  bulkSelected: boolean;
  bulkQueue: IBulkDownloadQueueItem[];
  mirrorAdapter: RowStatusMirrorAdapter | undefined;
}

// Integer percent for the `NN%` label, rounded like the old
// DownloadStatusAndProgress `toFixed(2)` display and clamped to 0..100
// (spec §3).
export const downloadPercent = (progress: number | undefined, total: number): number => {
  if (!total || !progress) {
    return 0;
  }
  const percent = Math.round((progress / total) * 100);
  if (percent < 0) {
    return 0;
  }
  if (percent > 100) {
    return 100;
  }
  return percent;
};

const blankStatus = (): RowStatus => {
  return { symbol: "", color: undefined, kind: "none" };
};

// The fixed glyphs come from the shared status map (spec §3's table);
// DOWNLOADING is the one status a row renders differently — the live percent
// — so it only borrows the map's colour.
const doneStatus = (): RowStatus => {
  return { ...STATUS_SYMBOLS[DownloadStatus.DOWNLOADED], kind: "done" };
};

// Row status label per spec §3's table, highest priority first: direct
// download statuses beat bulk selection, so "bulk-selected and downloading"
// shows the download. A bulk-selected entry whose bulk run already downloaded
// it shows ✓ (the outcome join by MD5); a failed bulk item stays ● because it
// remains selected for retry (spec §8.3).
export const rowStatus = (entry: Entry, context: RowStatusContext): RowStatus => {
  const progress = context.downloadProgressMap[entry.id];

  if (progress) {
    if (progress.status === DownloadStatus.DOWNLOADING) {
      const percent = downloadPercent(progress.progress, progress.total);
      return {
        symbol: `${percent}%`,
        color: STATUS_SYMBOLS[DownloadStatus.DOWNLOADING].color,
        kind: "progress",
      };
    }
    if (SPINNER_STATUSES.has(progress.status)) {
      return { ...STATUS_SYMBOLS[progress.status], kind: "spinner" };
    }
    if (progress.status === DownloadStatus.WAITING_FOR_LIBGEN) {
      return { ...STATUS_SYMBOLS[progress.status], kind: "waiting" };
    }
    if (progress.status === DownloadStatus.IN_QUEUE) {
      return { ...STATUS_SYMBOLS[progress.status], kind: "queued" };
    }
    if (progress.status === DownloadStatus.FAILED) {
      return { ...STATUS_SYMBOLS[progress.status], kind: "failed" };
    }
    if (progress.status === DownloadStatus.DOWNLOADED) {
      return doneStatus();
    }
  }

  if (context.bulkSelected) {
    const md5 = context.mirrorAdapter?.getEntryMD5(entry);
    const outcome = context.bulkQueue.find((item) => item.md5 === md5);
    if (outcome && outcome.status === DownloadStatus.DOWNLOADED) {
      return doneStatus();
    }
    return { ...BULK_SELECTED_SYMBOL, kind: "bulk" };
  }

  return blankStatus();
};

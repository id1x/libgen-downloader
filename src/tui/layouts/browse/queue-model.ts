import type { Entry } from "../../../api/models/entry";
import { DownloadStatus } from "../../../download-statuses";
import type { IDownloadProgress } from "../../store/download-queue";
import type { IBulkDownloadQueueItem } from "../../store/bulk-download-queue";
import { downloadPercent, type RowStatusMirrorAdapter } from "./row-status";
import { STATUS_SYMBOLS } from "./status-symbol";

// One rendered line of the Queue panel (spec §3's queue sections). Bars and
// failure reasons are separate lines attached to the item above them.
export type QueueLine =
  | {
      kind: "section";
      title: string;
      // `done of total done · N failed`; absent before a run starts.
      summary: { done: number; total: number; failed: number } | undefined;
    }
  | { kind: "bar"; ratio: number; percent: number }
  | { kind: "item"; symbol: string; color: string | undefined; title: string; size: string }
  | { kind: "reason"; text: string }
  | { kind: "saved"; path: string }
  | { kind: "list-file"; name: string }
  | { kind: "blank" };

// A scroll unit: an item row with its attached bar/reason lines, or a fixed
// line (section header, blank, saved-to). Groups render all-or-nothing so a
// scrolling window never separates an item from its bar or reason.
export interface QueueGroup {
  lines: QueueLine[];
  // Actionable-row index this group belongs to; -1 for fixed groups.
  anchor: number;
}

// What x/d/space act on for one actionable row (spec §4, queue mode).
export interface QueueActionRow {
  type: "bulk" | "direct";
  md5?: string;
  entryId?: string;
  // The entry the row maps to, when it maps to a result.
  entry: Entry | undefined;
  // Whether the entry is currently in the bulk selection (drives `x`).
  selected: boolean;
}

export interface QueueModel {
  groups: QueueGroup[];
  actions: QueueActionRow[];
}

export interface QueueModelContext {
  entries: Entry[];
  mirrorAdapter: RowStatusMirrorAdapter | undefined;
  bulkDownloadSelectedEntries: Record<string, Entry>;
  bulkDownloadQueue: IBulkDownloadQueueItem[];
  bulkFailureReasons: Record<string, string>;
  downloadProgressMap: Record<string, IDownloadProgress>;
  // `process.cwd()` at render time; a parameter keeps the model pure.
  downloadDirectory: string;
  createdMD5ListFileName: string;
  createdFailedMD5ListFileName: string;
}

// An item row, with the downloading bar attached when the item is
// DOWNLOADING and has a byte total (spec §3: "The downloading row is
// followed by its own bar"). The symbol and colour come from the shared
// status map — the Queue panel shows "the same symbols" as the row status
// table, keyed on the item's own status.
export const itemLines = (
  status: DownloadStatus,
  title: string,
  size: string,
  progress: number | undefined,
  total: number
): QueueLine[] => {
  const lines: QueueLine[] = [
    {
      kind: "item",
      symbol: STATUS_SYMBOLS[status].symbol,
      color: STATUS_SYMBOLS[status].color,
      title,
      size,
    },
  ];
  if (status === DownloadStatus.DOWNLOADING && total > 0) {
    lines.push({
      kind: "bar",
      ratio: (progress || 0) / total,
      percent: downloadPercent(progress, total),
    });
  }
  return lines;
};

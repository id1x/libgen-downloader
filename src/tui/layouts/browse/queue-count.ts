import { DownloadStatus } from "../../../download-statuses";
import type { Entry } from "../../../api/models/entry";
import type { IDownloadProgress } from "../../store/download-queue";
import type { IBulkDownloadQueueItem } from "../../store/bulk-download-queue";
import type { RowStatusMirrorAdapter } from "./row-status";

export interface UnfinishedQueueContext {
  bulkDownloadSelectedEntries: Record<string, Entry>;
  bulkDownloadQueue: IBulkDownloadQueueItem[];
  downloadProgressMap: Record<string, IDownloadProgress>;
  mirrorAdapter: RowStatusMirrorAdapter | undefined;
}

// The side-panel border's `Queue N` (spec §3, resolved by issue #5): the
// unfinished-item count, computed from the store, never from rendered rows.
//
// Bulk term — selected bulk entries whose MD5 has no terminal run outcome
// (`DOWNLOADED` or `FAILED`) recorded in `bulkDownloadQueue`; an outcome join
// by MD5, so a selection stops counting the moment its outcome lands, done or
// failed, regardless of settle timing.
//
// Direct term — `downloadProgressMap` records whose status is neither
// `DOWNLOADED` nor `FAILED`. The two terms sum independently: an item both
// bulk-selected and direct-downloading counts twice (accepted, rare).
export const unfinishedQueueCount = (context: UnfinishedQueueContext): number => {
  const outcomeByMD5 = new Map<string, DownloadStatus>();
  for (const item of context.bulkDownloadQueue) {
    outcomeByMD5.set(item.md5, item.status);
  }

  let count = 0;

  for (const entry of Object.values(context.bulkDownloadSelectedEntries)) {
    const md5 = context.mirrorAdapter?.getEntryMD5(entry);
    let outcome: DownloadStatus | undefined;
    if (md5) {
      outcome = outcomeByMD5.get(md5);
    }
    if (outcome !== DownloadStatus.DOWNLOADED && outcome !== DownloadStatus.FAILED) {
      count += 1;
    }
  }

  for (const progress of Object.values(context.downloadProgressMap)) {
    if (progress.status !== DownloadStatus.DOWNLOADED && progress.status !== DownloadStatus.FAILED) {
      count += 1;
    }
  }

  return count;
};

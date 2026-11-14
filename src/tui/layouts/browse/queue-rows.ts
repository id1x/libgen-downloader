import objectHash from "object-hash";
import { Label } from "../../../labels";
import { DownloadStatus } from "../../../download-statuses";
import type { Entry } from "../../../api/models/entry";
import type { IDownloadProgress } from "../../store/download-queue";
import type { IBulkDownloadQueueItem } from "../../store/bulk-download-queue";
import { isCompleted, isFailed } from "../../store/utils/bulk-queue";
import { downloadPercent, SPINNER_SYMBOL, type RowStatusMirrorAdapter } from "./row-status";

// --- data model -------------------------------------------------------------

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

// Status symbol for a queue row (spec §3: "the same symbols" as the row
// status table, keyed on the queue item's own status).
export const queueItemStatus = (
  status: DownloadStatus
): { symbol: string; color: string | undefined } => {
  switch (status) {
    case DownloadStatus.DOWNLOADING: {
      return { symbol: "↓", color: "cyan" };
    }
    case DownloadStatus.DOWNLOADED: {
      return { symbol: "✓", color: "green" };
    }
    case DownloadStatus.FAILED: {
      return { symbol: "✗", color: "red" };
    }
    case DownloadStatus.WAITING_FOR_LIBGEN: {
      return { symbol: "…", color: "magenta" };
    }
    case DownloadStatus.IN_QUEUE: {
      return { symbol: "⋯", color: "gray" };
    }
    default: {
      // CONNECTING/PROCESSING/FETCHING (and IDLE) work without a byte count.
      return { symbol: SPINNER_SYMBOL, color: "cyan" };
    }
  }
};

const itemBarLine = (progress: number | undefined, total: number): QueueLine | undefined => {
  if (!total || total <= 0) {
    return undefined;
  }
  return {
    kind: "bar",
    ratio: (progress || 0) / total,
    percent: downloadPercent(progress, total),
  };
};

// The Queue panel's content (spec §3 + §5.3): sections in order — Bulk
// download (summary, overall bar, per-item rows from bulkDownloadQueue, or
// the selected entries with ● before a run starts), Direct downloads (every
// downloadProgressMap record, newest first), then Saved to + the MD5 list
// file names once written. `actions` indexes the actionable rows in the same
// order the groups carry them (anchor).
export const buildQueueModel = (context: QueueModelContext): QueueModel => {
  const groups: QueueGroup[] = [];
  const actions: QueueActionRow[] = [];

  const pushFixed = (lines: QueueLine[]) => {
    groups.push({ lines, anchor: -1 });
  };

  const pushAction = (lines: QueueLine[], action: QueueActionRow) => {
    groups.push({ lines, anchor: actions.length });
    actions.push(action);
  };

  const emitSection = (title: string, summary?: { done: number; total: number; failed: number }) => {
    // A blank line separates sections (spec §5.3 mock); never leading.
    if (groups.length > 0 && groups.at(-1)?.lines[0]?.kind !== "blank") {
      pushFixed([{ kind: "blank" }]);
    }
    pushFixed([{ kind: "section", title, summary }]);
  };

  const selectedByMD5 = new Map<string, Entry>();
  for (const entry of Object.values(context.bulkDownloadSelectedEntries)) {
    const md5 = context.mirrorAdapter?.getEntryMD5(entry);
    if (md5) {
      selectedByMD5.set(md5, entry);
    }
  }

  // Section 1 — Bulk download.
  const queue = context.bulkDownloadQueue;
  if (queue.length > 0) {
    const done = queue.filter((item) => isCompleted(item)).length;
    const failed = queue.filter((item) => isFailed(item)).length;
    emitSection(
      Label.QUEUE_SECTION_BULK,
      { done, total: queue.length, failed }
    );
    pushFixed([
      { kind: "bar", ratio: done / queue.length, percent: downloadPercent(done, queue.length) },
    ]);

    for (const item of queue) {
      const { symbol, color } = queueItemStatus(item.status);
      const entry = selectedByMD5.get(item.md5);
      const lines: QueueLine[] = [
        {
          kind: "item",
          symbol,
          color,
          title: entry?.title ?? item.md5,
          size: entry?.size ?? "",
        },
      ];
      if (item.status === DownloadStatus.DOWNLOADING) {
        const bar = itemBarLine(item.progress, item.total);
        if (bar) {
          lines.push(bar);
        }
      }
      if (item.status === DownloadStatus.FAILED && context.bulkFailureReasons[item.md5]) {
        lines.push({ kind: "reason", text: context.bulkFailureReasons[item.md5] });
      }
      pushAction(lines, {
        type: "bulk",
        md5: item.md5,
        entryId: entry?.id,
        entry,
        selected: Boolean(entry),
      });
    }
  } else if (Object.keys(context.bulkDownloadSelectedEntries).length > 0) {
    // Before a run starts, the selected entries are listed with ● (spec §3).
    emitSection(Label.QUEUE_SECTION_BULK);
    for (const entry of Object.values(context.bulkDownloadSelectedEntries)) {
      pushAction(
        [{ kind: "item", symbol: "●", color: "yellow", title: entry.title, size: entry.size }],
        {
          type: "bulk",
          md5: context.mirrorAdapter?.getEntryMD5(entry),
          entryId: entry.id,
          entry,
          selected: true,
        }
      );
    }
  }

  // Section 2 — Direct downloads, newest first (insertion order of the
  // progress map reversed: keys enter when a download is queued).
  const progressRecords = Object.entries(context.downloadProgressMap);
  if (progressRecords.length > 0) {
    emitSection(Label.QUEUE_SECTION_DIRECT);
    const entryById = new Map(context.entries.map((entry) => [entry.id, entry]));
    for (const [entryId, progress] of progressRecords.toReversed()) {
      const { symbol, color } = queueItemStatus(progress.status);
      const entry = entryById.get(entryId);
      const lines: QueueLine[] = [
        {
          kind: "item",
          symbol,
          color,
          title: entry?.title ?? entryId,
          size: entry?.size ?? "",
        },
      ];
      if (progress.status === DownloadStatus.DOWNLOADING) {
        const bar = itemBarLine(progress.progress, progress.total);
        if (bar) {
          lines.push(bar);
        }
      }
      const action: QueueActionRow = {
        type: "direct",
        entryId,
        entry,
        selected: false,
      };
      if (entry) {
        action.md5 = context.mirrorAdapter?.getEntryMD5(entry);
        action.selected = Boolean(context.bulkDownloadSelectedEntries[objectHash(entry)]);
      }
      pushAction(lines, action);
    }
  }

  // Section 3 — Saved to + the MD5 list file names once written (spec §3).
  if (groups.length > 0 && groups.at(-1)?.lines[0]?.kind !== "blank") {
    pushFixed([{ kind: "blank" }]);
  }
  pushFixed([{ kind: "saved", path: context.downloadDirectory }]);
  if (context.createdMD5ListFileName) {
    pushFixed([{ kind: "list-file", name: context.createdMD5ListFileName }]);
  }
  if (context.createdFailedMD5ListFileName) {
    pushFixed([{ kind: "list-file", name: context.createdFailedMD5ListFileName }]);
  }

  return { groups, actions };
};

// Scroll window over the groups for a cursor over the actionable rows (spec
// §5.3: "the Queue panel scrolls with queueCursor"). Keeps the cursor's group
// visible, fills forward first, then back so the window stays full.
export const visibleQueueGroups = (
  groups: QueueGroup[],
  queueCursor: number,
  viewport: number
): QueueGroup[] => {
  if (groups.length === 0 || viewport < 1) {
    return [];
  }

  const actionableCount = groups.filter((group) => group.anchor >= 0).length;
  const cursor = Math.min(Math.max(queueCursor, 0), Math.max(actionableCount - 1, 0));
  let index = groups.findIndex((group) => group.anchor === cursor);
  if (index < 0) {
    index = 0;
  }

  let start = index;
  let end = index;
  let used = groups[index].lines.length;
  while (end + 1 < groups.length && used + groups[end + 1].lines.length <= viewport) {
    end += 1;
    used += groups[end].lines.length;
  }
  while (start - 1 >= 0 && used + groups[start - 1].lines.length <= viewport) {
    start -= 1;
    used += groups[start].lines.length;
  }

  return groups.slice(start, end + 1);
};

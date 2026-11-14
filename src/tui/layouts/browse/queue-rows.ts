import objectHash from "object-hash";
import { Label } from "../../../labels";
import { DownloadStatus } from "../../../download-statuses";
import type { Entry } from "../../../api/models/entry";
import { isCompleted, isFailed } from "../../store/utils/bulk-queue";
import { downloadPercent } from "./row-status";
import { BULK_SELECTED_SYMBOL } from "./status-symbol";
import { itemLines } from "./queue-model";
import type {
  QueueActionRow,
  QueueGroup,
  QueueLine,
  QueueModel,
  QueueModelContext,
} from "./queue-model";

// The sections' building blocks moved with their types (queue-model.ts) and
// the scroll window with its own concern (queue-scroll.ts); the names stay
// importable from here so the panel and the key router keep one import path.
export { visibleQueueGroups } from "./queue-scroll";
export type { QueueLine, QueueModel } from "./queue-model";

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
    emitSection(Label.QUEUE_SECTION_BULK, { done, total: queue.length, failed });
    pushFixed([
      { kind: "bar", ratio: done / queue.length, percent: downloadPercent(done, queue.length) },
    ]);

    for (const item of queue) {
      const entry = selectedByMD5.get(item.md5);
      const lines = itemLines(
        item.status,
        entry?.title ?? item.md5,
        entry?.size ?? "",
        item.progress,
        item.total
      );
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
        [
          {
            kind: "item",
            symbol: BULK_SELECTED_SYMBOL.symbol,
            color: BULK_SELECTED_SYMBOL.color,
            title: entry.title,
            size: entry.size,
          },
        ],
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
      const entry = entryById.get(entryId);
      const lines = itemLines(
        progress.status,
        entry?.title ?? entryId,
        entry?.size ?? "",
        progress.progress,
        progress.total
      );
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

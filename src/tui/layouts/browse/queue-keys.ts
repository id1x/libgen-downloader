import type { Key } from "ink";
import type { Entry } from "../../../api/models/entry";
import { useBoundStore } from "../../store";
import { buildQueueModel, type QueueModel } from "./queue-rows";
import type { KeyActions } from "./key-actions";

// Keys in `queue` mode (spec §4): the cursor moves over the panel's
// actionable rows, `x` removes the cursor item from the bulk selection before
// a run starts, `r` retries a finished run's failures, `d`/`space` act on the
// cursor entry when it maps to a result, and esc/v return to list mode with
// the Detail panel. The active availability banner owns esc (NOTES.md M3).
export const handleQueueKeys = (
  input: string,
  key: Key,
  actions: KeyActions,
  bannerActive: boolean
): void => {
  if (key.upArrow || input === "k") {
    actions.moveQueueCursor(-1);
    return;
  }

  if (key.downArrow || input === "j") {
    actions.moveQueueCursor(1);
    return;
  }

  if (input === "x") {
    actions.removeBulkUnderCursor();
    return;
  }

  if (input === "r") {
    actions.retryFailedBulk();
    return;
  }

  if (input === " ") {
    actions.actOnCursorEntry("toggle");
    return;
  }

  if (input === "d") {
    actions.actOnCursorEntry("download");
    return;
  }

  if (key.escape && !bannerActive) {
    actions.leaveQueue();
    return;
  }

  if (input === "v") {
    actions.leaveQueue();
    return;
  }

  if (input === "/") {
    actions.enterSearch();
    return;
  }

  if (input === "?") {
    actions.openHelp();
    return;
  }

  if (input === "q") {
    actions.requestQuit();
  }
};

// The queue panel's actionable rows, rebuilt from the freshest store state
// per keypress (download ticks mutate it between renders).
const queueModel = (): QueueModel => {
  const store = useBoundStore.getState();
  return buildQueueModel({
    entries: store.entries,
    mirrorAdapter: store.mirrorAdapter,
    bulkDownloadSelectedEntries: store.bulkDownloadSelectedEntries,
    bulkDownloadQueue: store.bulkDownloadQueue,
    bulkFailureReasons: store.bulkFailureReasons,
    downloadProgressMap: store.downloadProgressMap,
    downloadDirectory: process.cwd(),
    createdMD5ListFileName: store.createdMD5ListFileName,
    createdFailedMD5ListFileName: store.createdFailedMD5ListFileName,
  });
};

const queueRowAtCursor = (model: QueueModel) => {
  const store = useBoundStore.getState();
  const maxRow = Math.max(model.actions.length - 1, 0);
  return model.actions[Math.min(Math.max(store.queueCursor, 0), maxRow)];
};

// `v` from list mode (spec §4): toggle the side panel to Queue and move the
// focus with it; the check reads the pre-toggle snapshot.
export const enterQueue = (): void => {
  const store = useBoundStore.getState();
  store.toggleSidePanel();
  if (store.sidePanel === "detail") {
    store.setQueueCursor(0);
    store.setBrowseFocus("queue");
    return;
  }
  store.setBrowseFocus("list");
};

// esc or `v` from queue mode: back to list mode with the Detail panel.
export const leaveQueue = (): void => {
  const store = useBoundStore.getState();
  store.toggleSidePanel();
  store.setBrowseFocus("list");
};

// ↑↓ in queue mode: clamp the cursor to the actionable rows.
export const moveQueueCursorBy = (delta: number): void => {
  const model = queueModel();
  const maxRow = Math.max(model.actions.length - 1, 0);
  const store = useBoundStore.getState();
  store.setQueueCursor(Math.min(Math.max(store.queueCursor + delta, 0), maxRow));
};

// `x` — only before a run starts (spec §4): the hint renders dim during a
// run and the key is ignored there.
export const removeBulkUnderCursor = (): void => {
  const store = useBoundStore.getState();
  if (store.bulkDownloadQueue.length > 0 && !store.isBulkDownloadComplete) {
    return;
  }
  const row = queueRowAtCursor(queueModel());
  if (row?.type === "bulk" && row.selected && row.entry) {
    store.removeFromBulkDownloadQueue(row.entry);
  }
};

// `r` — only for a finished run that has failures (spec §4); otherwise a
// no-op. List mode's `r` shares this guard.
export const retryFailedBulk = (): void => {
  const store = useBoundStore.getState();
  if (store.isBulkDownloadComplete && store.failedBulkDownloadItemCount > 0) {
    store.retryFailedBulkDownloads();
  }
};

// `space`/`d` act on the cursor entry when it maps to a result (spec §4).
export const actOnCursorRow = (
  action: "toggle" | "download",
  toggleBulkSelection: (entry: Entry) => void
): void => {
  const row = queueRowAtCursor(queueModel());
  if (!row?.entry) {
    return;
  }
  if (action === "download") {
    useBoundStore.getState().pushDownloadQueue(row.entry);
    return;
  }
  toggleBulkSelection(row.entry);
};

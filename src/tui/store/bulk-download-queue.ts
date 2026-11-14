import { TCombinedStore } from "./index";
import { Entry } from "../../api/models/entry";
import { DownloadStatus } from "../../download-statuses";
import { Label } from "../../labels";
import { LAYOUT_KEY } from "../layouts/keys";
import { IDownloadProgress } from "./download-queue";
import { createFailedMD5ListFile, createMD5ListFile } from "../../api/data/file";
import { BULK_RETRY_PASSES } from "../../settings";
import { BulkDownloadFlow } from "./flows/bulk-download-flow";
import { indexesWhere, isCompleted, isFailed, isPending, patchQueueItem } from "./utils/bulk-queue";
import objectHash from "object-hash";

export interface IBulkDownloadQueueItem extends IDownloadProgress {
  md5: string;
}

export interface IBulkDownloadQueueState {
  isBulkDownloadComplete: boolean;

  completedBulkDownloadItemCount: number;
  failedBulkDownloadItemCount: number;

  createdMD5ListFileName: string;
  createdFailedMD5ListFileName: string;

  bulkDownloadSelectedEntries: Record<string, Entry>;
  bulkDownloadQueue: IBulkDownloadQueueItem[];
  // Last failure text per MD5, filled where BulkDownloadFlow builds the
  // failure warning (spec §5.3); the Queue panel's red reason row reads it.
  bulkFailureReasons: Record<string, string>;

  addToBulkDownloadQueue: (entry: Entry) => void;
  removeFromBulkDownloadQueue: (entry: Entry) => void;
  onBulkQueueItemProcessing: (index: number) => void;
  onBulkQueueItemWaiting: (index: number) => void;
  onBulkQueueItemStart: (index: number, filename: string, total: number) => void;
  onBulkQueueItemData: (index: number, filename: string, chunk: Buffer, total: number) => void;
  onBulkQueueItemComplete: (index: number) => void;
  onBulkQueueItemFail: (index: number, reason?: string) => void;
  operateBulkDownloadQueue: () => Promise<void>;
  retryFailedBulkDownloads: () => Promise<void>;
  resetBulkQueueItems: (indexes: number[]) => void;
  writeBulkDownloadReports: () => Promise<void>;
  settleBulkRun: () => void;
  returnToListKeepingFailedSelected: () => void;
  startBulkDownload: () => Promise<void>;
  startBulkDownloadInCLI: (md5List: string[]) => Promise<void>;
  resetBulkDownloadQueue: () => void;
}

export const initialBulkDownloadQueueState = {
  isBulkDownloadComplete: false,

  completedBulkDownloadItemCount: 0,
  failedBulkDownloadItemCount: 0,

  createdMD5ListFileName: "",
  createdFailedMD5ListFileName: "",

  bulkDownloadSelectedEntries: {},
  bulkDownloadQueue: [],
  bulkFailureReasons: {},
};

export const createBulkDownloadQueueStateSlice = (
  set: (
    partial: Partial<TCombinedStore> | ((state: TCombinedStore) => Partial<TCombinedStore>)
  ) => void,
  get: () => TCombinedStore
) => {
  return {
    ...initialBulkDownloadQueueState,

    addToBulkDownloadQueue: (entry: Entry) => {
      const store = get();

      const entryHash = objectHash(entry);
      if (store.bulkDownloadSelectedEntries[entryHash]) {
        store.setWarningMessage(`Entry with ID ${entry.id} is already in the bulk download queue`);
        return;
      }

      const newEntryMap = { ...store.bulkDownloadSelectedEntries, [entryHash]: entry };

      set({
        bulkDownloadSelectedEntries: newEntryMap,
      });
    },

    removeFromBulkDownloadQueue: (entry: Entry) => {
      const store = get();

      const entryHash = objectHash(entry);

      if (!store.bulkDownloadSelectedEntries[entryHash]) {
        store.setWarningMessage(`Entry with ID ${entry.id} is not in the bulk download queue`);
        return;
      }

      const newEntryMap: Record<string, Entry> = {};
      for (const [hash, item] of Object.entries(store.bulkDownloadSelectedEntries)) {
        if (hash !== entryHash) {
          newEntryMap[hash] = item;
        }
      }

      set({
        bulkDownloadSelectedEntries: newEntryMap,
      });
    },

    onBulkQueueItemProcessing: (index: number) => {
      set((previous) => ({
        bulkDownloadQueue: patchQueueItem(previous.bulkDownloadQueue, index, () => ({
          status: DownloadStatus.PROCESSING,
        })),
      }));
    },

    onBulkQueueItemWaiting: (index: number) => {
      set((previous) => ({
        bulkDownloadQueue: patchQueueItem(previous.bulkDownloadQueue, index, () => ({
          status: DownloadStatus.WAITING_FOR_LIBGEN,
        })),
      }));
    },

    onBulkQueueItemStart: (index: number, filename: string, total: number) => {
      set((previous) => ({
        bulkDownloadQueue: patchQueueItem(previous.bulkDownloadQueue, index, () => ({
          filename,
          total,
          status: DownloadStatus.DOWNLOADING,
        })),
      }));
    },

    onBulkQueueItemData: (index: number, filename: string, chunk: Buffer, total: number) => {
      set((previous) => ({
        bulkDownloadQueue: patchQueueItem(previous.bulkDownloadQueue, index, (item) => ({
          filename,
          total,
          progress: (item.progress || 0) + chunk.length,
        })),
      }));
    },

    onBulkQueueItemComplete: (index: number) => {
      set((previous) => ({
        bulkDownloadQueue: patchQueueItem(previous.bulkDownloadQueue, index, () => ({
          status: DownloadStatus.DOWNLOADED,
        })),
        completedBulkDownloadItemCount: previous.completedBulkDownloadItemCount + 1,
      }));
    },

    onBulkQueueItemFail: (index: number, reason?: string) => {
      set((previous) => {
        const patch: Partial<TCombinedStore> = {
          bulkDownloadQueue: patchQueueItem(previous.bulkDownloadQueue, index, () => ({
            status: DownloadStatus.FAILED,
          })),
          failedBulkDownloadItemCount: previous.failedBulkDownloadItemCount + 1,
        };
        const item = previous.bulkDownloadQueue[index];
        if (item && reason) {
          patch.bulkFailureReasons = { ...previous.bulkFailureReasons, [item.md5]: reason };
        }
        return patch;
      });
    },

    operateBulkDownloadQueue: async () => {
      set({ isBulkDownloadComplete: false });
      await new BulkDownloadFlow(get).download(indexesWhere(get().bulkDownloadQueue, isPending));

      for (let pass = 0; pass < BULK_RETRY_PASSES; pass++) {
        const failedIndexes = indexesWhere(get().bulkDownloadQueue, isFailed);
        if (failedIndexes.length === 0) {
          break;
        }
        get().resetBulkQueueItems(failedIndexes);
        await new BulkDownloadFlow(get).download(failedIndexes);
      }

      set({ isBulkDownloadComplete: true });
      await get().writeBulkDownloadReports();

      // Spec §6.1: in interactive mode the run settles in place — completed
      // entries leave the selection, failed ones stay selected for `r`, and
      // the queue stays for display until the next `b` replaces it. CLI mode
      // has no selection to settle.
      if (!get().CLIMode) {
        get().settleBulkRun();
      }
    },

    retryFailedBulkDownloads: async () => {
      const failedIndexes = indexesWhere(get().bulkDownloadQueue, isFailed);
      if (failedIndexes.length === 0) {
        return;
      }
      get().resetBulkQueueItems(failedIndexes);
      get().allowWaitingForLibgen();
      await get().operateBulkDownloadQueue();
    },

    resetBulkQueueItems: (indexes: number[]) => {
      set((previous) => ({
        bulkDownloadQueue: previous.bulkDownloadQueue.map((item, index) => {
          if (!indexes.includes(index)) {
            return item;
          }
          return { ...item, status: DownloadStatus.IN_QUEUE, filename: "", progress: 0, total: 0 };
        }),
        failedBulkDownloadItemCount: Math.max(
          0,
          previous.failedBulkDownloadItemCount -
            indexes.filter((index) => isFailed(previous.bulkDownloadQueue[index])).length
        ),
        // Retried items lose their stored reason; a fresh failure writes a
        // fresh one, so no stale red row lingers under a retrying item.
        bulkFailureReasons: Object.fromEntries(
          Object.entries(previous.bulkFailureReasons).filter(([md5]) => {
            return !indexes.some((index) => previous.bulkDownloadQueue[index]?.md5 === md5);
          })
        ),
      }));
    },

    // Spec §6.1: remove completed entries from the selection, keep failed
    // ones selected, and keep the queue for display until the next `b`.
    settleBulkRun: () => {
      const store = get();
      const completedMD5s = new Set(
        store.bulkDownloadQueue.filter((item) => isCompleted(item)).map((item) => item.md5)
      );
      const remainingSelections: Record<string, Entry> = {};
      for (const [hash, entry] of Object.entries(store.bulkDownloadSelectedEntries)) {
        const md5 = store.mirrorAdapter?.getEntryMD5(entry) ?? "";
        if (!completedMD5s.has(md5)) {
          remainingSelections[hash] = entry;
        }
      }
      set({ bulkDownloadSelectedEntries: remainingSelections });
    },

    writeBulkDownloadReports: async () => {
      const queue = get().bulkDownloadQueue;
      const completedMD5List = queue.filter((item) => isCompleted(item)).map((item) => item.md5);
      const failedMD5List = queue.filter((item) => isFailed(item)).map((item) => item.md5);

      try {
        const filename = await createMD5ListFile(
          completedMD5List,
          get().createdMD5ListFileName || undefined
        );
        set({ createdMD5ListFileName: filename });
      } catch {
        get().setWarningMessage("Couldn't create the MD5 list file");
      }

      const previousFailedListFileName = get().createdFailedMD5ListFileName;
      if (failedMD5List.length === 0 && !previousFailedListFileName) {
        return;
      }
      try {
        const filename = await createFailedMD5ListFile(
          failedMD5List,
          previousFailedListFileName || undefined
        );
        set({ createdFailedMD5ListFileName: filename });
      } catch {
        get().setWarningMessage("Couldn't create the failed MD5 list file");
      }
    },

    returnToListKeepingFailedSelected: () => {
      const failedMD5s = new Set(
        get()
          .bulkDownloadQueue.filter((item) => isFailed(item))
          .map((item) => item.md5)
      );
      const adapter = get().mirrorAdapter;
      const failedSelections = Object.fromEntries(
        Object.entries(get().bulkDownloadSelectedEntries).filter(([, entry]) =>
          failedMD5s.has(adapter?.getEntryMD5(entry) ?? "")
        )
      );
      set({
        ...initialBulkDownloadQueueState,
        bulkDownloadSelectedEntries: failedSelections,
      });
      get().setActiveLayout(LAYOUT_KEY.RESULT_LIST_LAYOUT);
    },

    startBulkDownload: async () => {
      const store = get();

      // Spec §4: a run already active warns instead of starting again. (The
      // same condition the quit prompt uses for its bulk-run line.)
      if (store.bulkDownloadQueue.length > 0 && !store.isBulkDownloadComplete) {
        store.setWarningMessage(Label.BULK_ALREADY_RUNNING);
        return;
      }

      const entries = Object.values(store.bulkDownloadSelectedEntries);
      if (entries.length === 0) {
        store.setWarningMessage("Bulk download queue is empty");
        return;
      }

      set({
        completedBulkDownloadItemCount: 0,
        failedBulkDownloadItemCount: 0,
        createdMD5ListFileName: "",
        createdFailedMD5ListFileName: "",
        isBulkDownloadComplete: false,
        bulkFailureReasons: {},
      });

      // Spec §6.1: interactive bulk stays on the browse screen — the Queue
      // panel opens in place (side panel + focus move to queue, M3's
      // recorded deferral); CLI mode keeps the old bulk screen.
      if (store.CLIMode) {
        get().setActiveLayout(LAYOUT_KEY.BULK_DOWNLOAD_LAYOUT);
      } else {
        set({ sidePanel: "queue", browseFocus: "queue", queueCursor: 0 });
      }
      get().allowWaitingForLibgen();

      // initialize bulk queue
      const bulkDownloadQueue: IBulkDownloadQueueItem[] = [];
      for (const entry of entries) {
        const md5 = get().mirrorAdapter?.getEntryMD5(entry);
        if (!md5) {
          get().setWarningMessage(`Couldn't find MD5 for entry ${entry.id}`);
          continue;
        }

        bulkDownloadQueue.push({
          md5,
          status: DownloadStatus.IN_QUEUE,
          filename: "",
          progress: 0,
          total: 0,
        });
      }

      set({
        bulkDownloadQueue,
      });

      get().operateBulkDownloadQueue();
    },

    startBulkDownloadInCLI: async (md5List: string[]) => {
      get().allowWaitingForLibgen();
      set({
        bulkDownloadQueue: md5List.map((md5) => ({
          md5,
          status: DownloadStatus.IN_QUEUE,
          filename: "",
          progress: 0,
          total: 0,
        })),
      });

      await get().operateBulkDownloadQueue();

      // process exit successfully
      get().handleExit();
    },

    resetBulkDownloadQueue: () => {
      set({
        ...initialBulkDownloadQueueState,
      });
    },
  };
};

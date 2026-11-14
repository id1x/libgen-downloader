import { summarizeFailures } from "../../../api/download/utils/failure-text";
import type { TCombinedStore } from "../index";

export class BulkDownloadFlow {
  constructor(private readonly get: () => TCombinedStore) {}

  async download(indexes: number[]): Promise<void> {
    for (const index of indexes) {
      await this.downloadItem(index);
    }
  }

  private async downloadItem(index: number): Promise<void> {
    const item = this.get().bulkDownloadQueue[index];
    this.get().onBulkQueueItemProcessing(index);
    try {
      const outcome = await this.get()
        .getRecoveringDownloadService()
        .download(
          item.md5,
          {
            onStart: (filename, total) => {
              this.get().onBulkQueueItemStart(index, filename, total);
            },
            onData: (filename, chunk, total) => {
              this.get().onBulkQueueItemData(index, filename, chunk, total);
            },
          },
          {
            shouldWait: () => {
              return !this.get().libgenWaitDeclined;
            },
            onWaiting: () => {
              this.get().onBulkQueueItemWaiting(index);
            },
            onResumed: () => {
              this.get().onBulkQueueItemProcessing(index);
            },
          }
        );
      if (!outcome.downloaded) {
        // The Queue panel's red reason row reads this summary from
        // bulkFailureReasons (spec §5.3).
        const reason = summarizeFailures(outcome.failures);
        this.get().setWarningMessage(`Couldn't download ${item.md5}: ${reason}`);
        this.get().onBulkQueueItemFail(index, reason);
        return;
      }
      this.get().onBulkQueueItemComplete(index);
    } catch {
      this.get().onBulkQueueItemFail(index);
    }
  }
}

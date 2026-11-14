import { Text } from "ink";
import { APP_VERSION } from "../../../version";
import { DownloadStatus } from "../../../download-statuses";
import { Label } from "../../../labels";
import { useBoundStore } from "../../store";
import { useStdoutDimensions } from "../../hooks/use-stdout-dimensions";
import { WIDE_MIN_COLUMNS } from "./layout-metrics";
import { ProgressBar } from "../../components/progress-bar";
import { isCompleted, isFailed } from "../../store/utils/bulk-queue";
import { BULK_SELECTED_SYMBOL, STATUS_SYMBOLS } from "./status-symbol";
import type { StatusSymbol } from "./status-symbol";

interface SummarySegment extends StatusSymbol {
  count: number;
  word: string;
}

// Bulk-run header variant (spec §3): `bulk <bar 16> done/total · ✗ N failed`.
const BULK_BAR_WIDTH = 16;
const BULK_BAR_RESERVE = 1; // space between the bar and done/total

// Everything between queued and running reads as "queued" in the summary.
const QUEUED_STATUSES = new Set<DownloadStatus>([
  DownloadStatus.IN_QUEUE,
  DownloadStatus.CONNECTING_TO_LIBGEN,
  DownloadStatus.PROCESSING,
  DownloadStatus.FETCHING_MD5,
  DownloadStatus.WAITING_FOR_LIBGEN,
]);

const mirrorHost = (baseURL: string | undefined): string => {
  if (!baseURL) {
    return "";
  }
  try {
    return new URL(baseURL).host;
  } catch {
    return baseURL;
  }
};

// Header row of the browse screen (spec §3): version and mirror on the left,
// a live summary that omits zero counts on the right. The compact summary
// form is used below 100 columns. While a bulk run is active the summary is
// replaced by the bulk-run variant (the speed term is dropped: nothing tracks
// download speed, and the spec says not to add tracking just for this).
export function StatusHeader() {
  const [terminalColumns] = useStdoutDimensions();
  const mirrorAdapter = useBoundStore((state) => state.mirrorAdapter);
  const downloadProgressMap = useBoundStore((state) => state.downloadProgressMap);
  const bulkDownloadSelectedEntries = useBoundStore((state) => state.bulkDownloadSelectedEntries);
  const bulkDownloadQueue = useBoundStore((state) => state.bulkDownloadQueue);
  const isBulkDownloadComplete = useBoundStore((state) => state.isBulkDownloadComplete);

  const bulkRunActive = bulkDownloadQueue.length > 0 && !isBulkDownloadComplete;

  // Live summary counts (spec §3). Everything between queued and running
  // reads as "queued"; the settled outcomes count on their own.
  const statuses = Object.values(downloadProgressMap).map((progress) => progress.status);
  const downloading = statuses.filter((status) => status === DownloadStatus.DOWNLOADING).length;
  const queued = statuses.filter((status) => QUEUED_STATUSES.has(status)).length;
  const done = statuses.filter((status) => status === DownloadStatus.DOWNLOADED).length;
  const failed = statuses.filter((status) => status === DownloadStatus.FAILED).length;

  // The bulk segment carries the selection glyph (not a DownloadStatus).
  const summarySegment = (status: DownloadStatus, count: number, word: string): SummarySegment => {
    return { ...STATUS_SYMBOLS[status], count, word };
  };
  const segments: SummarySegment[] = [
    summarySegment(DownloadStatus.DOWNLOADING, downloading, Label.STATUS_SUMMARY_DOWNLOADING),
    summarySegment(DownloadStatus.IN_QUEUE, queued, Label.STATUS_SUMMARY_QUEUED),
    {
      ...BULK_SELECTED_SYMBOL,
      count: Object.keys(bulkDownloadSelectedEntries).length,
      word: Label.STATUS_SUMMARY_IN_BULK,
    },
    summarySegment(DownloadStatus.DOWNLOADED, done, Label.STATUS_SUMMARY_DONE),
    summarySegment(DownloadStatus.FAILED, failed, Label.STATUS_SUMMARY_FAILED),
  ];
  const activeSegments = segments.filter((segment) => segment.count > 0);
  const isWide = terminalColumns >= WIDE_MIN_COLUMNS;

  // Left part per §3's format string: `libgen-downloader <version>  │  ●
  // <mirror host>` (two spaces around the separator).
  const host = mirrorHost(mirrorAdapter?.baseURL);
  const LEFT_PREFIX = "libgen-downloader ";
  const LEFT_SEPARATOR = "  │  ";
  const leftLength =
    LEFT_PREFIX.length + APP_VERSION.length + LEFT_SEPARATOR.length + 2 + host.length;

  const segmentWidth = (segment: SummarySegment): number => {
    const countWidth = String(segment.count).length;
    if (!isWide) {
      return segment.symbol.length + countWidth;
    }
    return segment.symbol.length + 1 + countWidth + 1 + segment.word.length;
  };

  // Right-part length per variant: the normal live summary, or the bulk-run
  // summary `bulk <bar 16> done/total` plus ` · ✗ N failed` when items failed.
  const failedSymbol = STATUS_SYMBOLS[DownloadStatus.FAILED];
  const bulkDone = bulkDownloadQueue.filter((item) => isCompleted(item)).length;
  const bulkFailed = bulkDownloadQueue.filter((item) => isFailed(item)).length;
  const bulkRatioWidth =
    String(bulkDone).length + 1 + String(bulkDownloadQueue.length).length;
  const bulkFailedWidth =
    Label.STATUS_SUMMARY_SEPARATOR.length +
    1 +
    1 +
    String(bulkFailed).length +
    1 +
    Label.STATUS_SUMMARY_FAILED.length; // " · ✗ N failed"
  let bulkSummaryLength =
    Label.STATUS_BULK_RUN_PREFIX.length + BULK_BAR_WIDTH + BULK_BAR_RESERVE + bulkRatioWidth;
  if (bulkFailed > 0) {
    bulkSummaryLength += bulkFailedWidth;
  }

  let summaryLength = 0;
  if (bulkRunActive) {
    summaryLength = bulkSummaryLength;
  } else {
    for (const [index, segment] of activeSegments.entries()) {
      if (index > 0) {
        summaryLength += Label.STATUS_SUMMARY_SEPARATOR.length;
      }
      summaryLength += segmentWidth(segment);
    }
  }

  // The summary is right-aligned (spec §3, "Right: a live summary"); one
  // space is kept between the parts when they collide, and truncate-end
  // handles the overflow.
  const contentWidth = terminalColumns - 1; // AppHeader's paddingLeft
  let pad = contentWidth - leftLength - summaryLength;
  if (pad < 1) {
    pad = 1;
  }

  return (
    <Text wrap="truncate-end">
      <Text color="white">{LEFT_PREFIX}</Text>
      <Text color="green">{APP_VERSION}</Text>
      <Text color="gray">{LEFT_SEPARATOR}</Text>
      <Text color="green">● </Text>
      <Text color="gray">{host}</Text>
      <Text>{" ".repeat(pad)}</Text>
      {bulkRunActive && (
        <>
          <Text color="gray">{Label.STATUS_BULK_RUN_PREFIX}</Text>
          <ProgressBar ratio={bulkDone / bulkDownloadQueue.length} width={BULK_BAR_WIDTH} />
          <Text> {bulkDone}/{bulkDownloadQueue.length}</Text>
          {bulkFailed > 0 && (
            <>
              <Text color="gray">{Label.STATUS_SUMMARY_SEPARATOR}</Text>
              <Text color={failedSymbol.color}>
                {failedSymbol.symbol} {bulkFailed} {Label.STATUS_SUMMARY_FAILED}
              </Text>
            </>
          )}
        </>
      )}
      {!bulkRunActive &&
        activeSegments.map((segment, index) => (
          <Text key={segment.symbol}>
            {index > 0 && <Text color="gray">{Label.STATUS_SUMMARY_SEPARATOR}</Text>}
            <Text color={segment.color}>
              {segment.symbol}
              {isWide && " "}
              {segment.count}
            </Text>
            {isWide && <Text color="gray"> {segment.word}</Text>}
          </Text>
        ))}
    </Text>
  );
}

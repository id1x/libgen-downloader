import { Text } from "ink";
import { APP_VERSION } from "../../../version";
import { DownloadStatus } from "../../../download-statuses";
import { useBoundStore } from "../../store";
import { useStdoutDimensions } from "../../hooks/use-stdout-dimensions";
import { WIDE_MIN_COLUMNS } from "./layout-metrics";

interface SummarySegment {
  symbol: string;
  count: number;
  word: string;
  color: string;
}

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
// form is used below 100 columns. The bulk-run variant arrives in M4.
export function StatusHeader() {
  const [terminalColumns] = useStdoutDimensions();
  const mirrorAdapter = useBoundStore((state) => state.mirrorAdapter);
  const downloadProgressMap = useBoundStore((state) => state.downloadProgressMap);
  const bulkDownloadSelectedEntries = useBoundStore((state) => state.bulkDownloadSelectedEntries);

  let downloading = 0;
  let queued = 0;
  let done = 0;
  let failed = 0;
  for (const progress of Object.values(downloadProgressMap)) {
    switch (progress.status) {
      case DownloadStatus.DOWNLOADING: {
        downloading += 1;
        break;
      }
      case DownloadStatus.DOWNLOADED: {
        done += 1;
        break;
      }
      case DownloadStatus.FAILED: {
        failed += 1;
        break;
      }
      // Everything between queued and running reads as "queued".
      case DownloadStatus.IN_QUEUE:
      case DownloadStatus.CONNECTING_TO_LIBGEN:
      case DownloadStatus.PROCESSING:
      case DownloadStatus.FETCHING_MD5:
      case DownloadStatus.WAITING_FOR_LIBGEN: {
        queued += 1;
        break;
      }
    }
  }

  const segments: SummarySegment[] = [
    { symbol: "↓", count: downloading, word: "downloading", color: "cyan" },
    { symbol: "⋯", count: queued, word: "queued", color: "gray" },
    {
      symbol: "●",
      count: Object.keys(bulkDownloadSelectedEntries).length,
      word: "in bulk",
      color: "yellow",
    },
    { symbol: "✓", count: done, word: "done", color: "green" },
    { symbol: "✗", count: failed, word: "failed", color: "red" },
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

  let summaryLength = 0;
  for (const [index, segment] of activeSegments.entries()) {
    if (index > 0) {
      summaryLength += 3; // " · "
    }
    summaryLength += segmentWidth(segment);
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
      {activeSegments.map((segment, index) => (
        <Text key={segment.symbol}>
          {index > 0 && <Text color="gray"> · </Text>}
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

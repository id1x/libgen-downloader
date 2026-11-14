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

// Header row of the browse screen (spec §3), normal variant: version and
// mirror on the left, a live summary that omits zero counts on the right.
// The compact summary form is used below 100 columns. The bulk-run variant
// arrives in M4.
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

  return (
    <Text wrap="truncate-end">
      <Text color="white">libgen-downloader </Text>
      <Text color="green">{APP_VERSION}</Text>
      <Text color="gray"> │ </Text>
      <Text color="green">● </Text>
      <Text color="gray">{mirrorHost(mirrorAdapter?.baseURL)}</Text>
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

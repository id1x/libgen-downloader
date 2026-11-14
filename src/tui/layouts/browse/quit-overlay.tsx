import { Box, Text } from "ink";
import { Label } from "../../../labels";
import { useBoundStore } from "../../store";

// One content space; OverlayBox's paddingX adds the second column the §5.6
// mockup shows after the border.
const INDENT = " ";

type QuitLine =
  | { kind: "blank" }
  | { kind: "text"; text: string }
  | { kind: "actions" };

// The quit prompt (spec §5.6), shown by `q` when work is pending. Only the
// lines that apply render, with correct singular and plural forms:
// - direct downloads while `inDownloadQueueEntryIds` is non-empty;
// - the bulk selection while it is non-empty and the bulk run has not
//   finished;
// - a running bulk run, as `Bulk download is N/M done`.
const quitLines = (
  inDownloadQueueEntryIds: string[],
  bulkDownloadSelectedEntries: Record<string, unknown>,
  bulkDownloadQueue: { status: string }[],
  isBulkDownloadComplete: boolean,
  completedBulkDownloadItemCount: number
): QuitLine[] => {
  const downloadCount = inDownloadQueueEntryIds.length;
  const bulkCount = Object.keys(bulkDownloadSelectedEntries).length;
  const bulkRunRunning = bulkDownloadQueue.length > 0 && !isBulkDownloadComplete;

  const countLines: string[] = [];
  if (downloadCount > 0) {
    let downloads = Label.QUIT_DOWNLOADS_ONE;
    if (downloadCount > 1) {
      downloads = `${downloadCount} ${Label.QUIT_DOWNLOADS_MANY}`;
    }
    countLines.push(downloads);
  }
  if (bulkCount > 0 && !isBulkDownloadComplete) {
    let items = Label.QUIT_BULK_ITEMS_ONE;
    if (bulkCount > 1) {
      items = `${bulkCount} ${Label.QUIT_BULK_ITEMS_MANY}`;
    }
    countLines.push(items);
  }
  if (bulkRunRunning) {
    countLines.push(
      `${Label.QUIT_BULK_RUN} ${completedBulkDownloadItemCount}/${bulkDownloadQueue.length} ${Label.QUIT_BULK_RUN_DONE}`
    );
  }

  const lines: QuitLine[] = [{ kind: "blank" }];
  for (const line of countLines) {
    lines.push({ kind: "text", text: line });
  }
  lines.push({ kind: "blank" });
  for (const line of Label.QUIT_EXPLANATION_LINES) {
    lines.push({ kind: "text", text: line });
  }
  lines.push({ kind: "blank" }, { kind: "actions" }, { kind: "blank" });
  return lines;
};

interface Properties {
  // Content rows available inside the box borders. When the terminal is too
  // short the cosmetic blank separators go first; if the content itself does
  // not fit, it truncates with `…`.
  maxRows: number;
}

export function QuitOverlay({ maxRows }: Properties) {
  const inDownloadQueueEntryIds = useBoundStore((state) => state.inDownloadQueueEntryIds);
  const bulkDownloadSelectedEntries = useBoundStore((state) => state.bulkDownloadSelectedEntries);
  const bulkDownloadQueue = useBoundStore((state) => state.bulkDownloadQueue);
  const isBulkDownloadComplete = useBoundStore((state) => state.isBulkDownloadComplete);
  const completedBulkDownloadItemCount = useBoundStore(
    (state) => state.completedBulkDownloadItemCount
  );

  let lines = quitLines(
    inDownloadQueueEntryIds,
    bulkDownloadSelectedEntries,
    bulkDownloadQueue,
    isBulkDownloadComplete,
    completedBulkDownloadItemCount
  );

  let truncated = false;
  if (lines.length > maxRows) {
    lines = lines.filter((line) => {
      return line.kind !== "blank";
    });
  }
  if (lines.length > maxRows) {
    truncated = true;
    lines = lines.slice(0, maxRows);
  }

  const renderLine = (line: QuitLine, index: number) => {
    const isEllipsis = truncated && index === lines.length - 1;
    if (isEllipsis) {
      return (
        <Text key={index} color="gray">
          {INDENT}…
        </Text>
      );
    }

    if (line.kind === "blank") {
      return <Text key={index}> </Text>;
    }
    if (line.kind === "text") {
      return (
        <Text key={index} wrap="truncate-end">
          {INDENT}
          {line.text}
        </Text>
      );
    }
    return (
      <Text key={index} wrap="truncate-end">
        {INDENT}
        <Text color="red" inverse={true}>
          {" "}
          y{" "}
        </Text>
        {" "}
        {Label.QUIT_ANYWAY}
        {"    "}
        <Text color="cyan" inverse={true}>
          {" "}
          n{" "}
        </Text>
        {" "}
        {Label.QUIT_STAY}
      </Text>
    );
  };

  return <Box flexDirection="column">{lines.map((line, index) => renderLine(line, index))}</Box>;
}

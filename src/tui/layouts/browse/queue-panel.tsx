import { Box, Text } from "ink";
import { Label } from "../../../labels";
import { useBoundStore } from "../../store";
import { KeyFooter } from "../../components/key-footer";
import { ProgressBar } from "../../components/progress-bar";
import { buildQueueModel, visibleQueueGroups, type QueueLine } from "./queue-rows";

interface Properties {
  // Content width in cells, inside the panel borders.
  width: number;
  // Content height in rows, inside the panel borders, including the pinned
  // hint row.
  height: number;
}

// Cursor-row background highlight, the same colour the results panel uses.
const CURSOR_BACKGROUND = "#1f3140";

// Reserve for an item row's `  <size>` tail and the symbol cell.
const ITEM_ROW_RESERVE = 4;
// Reserve for a bar row's ` NN%` suffix (speed is dropped: the store tracks
// none, and the spec says not to add tracking just for this, §3).
const BAR_RESERVE = 5;
const BAR_INDENT = 2;

const truncate = (text: string, width: number): string => {
  if (width < 1) {
    return "";
  }
  if (text.length > width) {
    return `${text.slice(0, width - 1)}…`;
  }
  return text;
};

// The side panel's Queue tab (spec §3 + §5.3). Content is the pure model of
// queue-rows.ts scrolled by queueCursor; the hint row is pinned to the bottom.
export function QueuePanel({ width, height }: Properties) {
  const entries = useBoundStore((state) => state.entries);
  const mirrorAdapter = useBoundStore((state) => state.mirrorAdapter);
  const bulkDownloadSelectedEntries = useBoundStore((state) => state.bulkDownloadSelectedEntries);
  const bulkDownloadQueue = useBoundStore((state) => state.bulkDownloadQueue);
  const bulkFailureReasons = useBoundStore((state) => state.bulkFailureReasons);
  const downloadProgressMap = useBoundStore((state) => state.downloadProgressMap);
  const createdMD5ListFileName = useBoundStore((state) => state.createdMD5ListFileName);
  const createdFailedMD5ListFileName = useBoundStore((state) => state.createdFailedMD5ListFileName);
  const queueCursor = useBoundStore((state) => state.queueCursor);
  const isBulkDownloadComplete = useBoundStore((state) => state.isBulkDownloadComplete);

  const model = buildQueueModel({
    entries,
    mirrorAdapter,
    bulkDownloadSelectedEntries,
    bulkDownloadQueue,
    bulkFailureReasons,
    downloadProgressMap,
    downloadDirectory: process.cwd(),
    createdMD5ListFileName,
    createdFailedMD5ListFileName,
  });

  const runActive = bulkDownloadQueue.length > 0 && !isBulkDownloadComplete;
  let dimmedHints: ReadonlyArray<string> | undefined;
  if (runActive) {
    dimmedHints = ["x"];
  }
  const actionableCount = model.actions.length;
  const cursor = Math.min(Math.max(queueCursor, 0), Math.max(actionableCount - 1, 0));

  const contentRows = Math.max(height - 1, 0); // the pinned hint row
  const groups = visibleQueueGroups(model.groups, queueCursor, contentRows);

  const itemTitleWidth = (size: string): number => {
    return Math.max(width - ITEM_ROW_RESERVE - size.length, 1);
  };

  const renderLine = (line: QueueLine, key: number, isCursorRow: boolean) => {
    switch (line.kind) {
      case "section": {
        return (
          <Text key={key} wrap="truncate-end">
            {line.title}
            {line.summary && (
              <>
                <Text>  {line.summary.done} of {line.summary.total} </Text>
                <Text>{Label.QUEUE_SUMMARY_DONE_WORD}</Text>
              </>
            )}
            {line.summary && line.summary.failed > 0 && (
              <Text color="red">
                {" "}
                · {line.summary.failed} {Label.QUEUE_SUMMARY_FAILED_WORD}
              </Text>
            )}
          </Text>
        );
      }
      case "bar": {
        const barWidth = Math.max(width - BAR_INDENT - BAR_RESERVE, 4);
        return (
          <Text key={key} wrap="truncate-end">
            {" ".repeat(BAR_INDENT)}
            <ProgressBar ratio={line.ratio} width={barWidth} />
            <Text color="cyan"> {line.percent}%</Text>
          </Text>
        );
      }
      case "item": {
        const title = truncate(line.title, itemTitleWidth(line.size));
        let background: string | undefined;
        if (isCursorRow) {
          background = CURSOR_BACKGROUND;
        }
        return (
          <Text key={key} wrap="truncate-end" backgroundColor={background}>
            <Text color={line.color}>{line.symbol} </Text>
            <Text bold={isCursorRow}>{title}</Text>
            <Text color="gray">  {line.size}</Text>
          </Text>
        );
      }
      case "reason": {
        return (
          <Text key={key} color="red" wrap="truncate-end">
            {" ".repeat(BAR_INDENT)}
            {line.text}
          </Text>
        );
      }
      case "saved": {
        return (
          <Text key={key} wrap="truncate-end">
            {Label.QUEUE_SAVED_TO} <Text color="gray">{line.path}</Text>
          </Text>
        );
      }
      case "list-file": {
        return (
          <Text key={key} wrap="truncate-end">
            <Text color="gray">{Label.QUEUE_LISTS_PREFIX} </Text>
            {line.name}
          </Text>
        );
      }
      case "blank": {
        return <Text key={key}> </Text>;
      }
    }
  };

  return (
    <Box flexDirection="column" width={width}>
      {groups.map((group, groupIndex) => {
        return (
          <Box key={groupIndex} flexDirection="column">
            {group.lines.map((line, lineIndex) => renderLine(line, lineIndex, group.anchor === cursor))}
          </Box>
        );
      })}
      <Box flexGrow={1} />
      <KeyFooter hints={Label.QUEUE_PANEL_HINTS} width={width} dimKeys={dimmedHints} />
    </Box>
  );
}

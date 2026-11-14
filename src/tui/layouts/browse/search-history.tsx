import { Box, Text } from "ink";
import figures from "figures";
import { Label } from "../../../labels";
import { useBoundStore } from "../../store";

interface Properties {
  // Content width in cells, inside the panel borders.
  width: number;
  // Content height in rows, inside the panel borders.
  height: number;
}

type HistoryLine =
  | { kind: "header" }
  | { kind: "row"; query: string; index: number }
  | { kind: "blank" }
  | { kind: "hint" }
  | { kind: "note" }
  | { kind: "count" };

// The Search panel's content (spec §5.4): the session's recent searches with
// a cursor, the mode's hints and the note that bulk selections survive a new
// search. The cursor row is the history entry the draft currently shows; a
// draft that is not in the history (the live query, or something being typed)
// keeps the cursor on the first row.
//
// The content is fitted to the panel's height like the queue panel does:
// wide panels get the mock's full layout, short (stacked) panels drop the
// blank separators before anything is cut.
export function SearchHistory({ width, height }: Properties) {
  const searchHistory = useBoundStore((state) => state.searchHistory);
  const searchDraft = useBoundStore((state) => state.searchDraft);
  const bulkDownloadSelectedEntries = useBoundStore((state) => state.bulkDownloadSelectedEntries);

  const bulkCount = Object.keys(bulkDownloadSelectedEntries).length;
  const cursorIndex = Math.max(searchHistory.indexOf(searchDraft), 0);

  const full: HistoryLine[] = [
    { kind: "header" },
    { kind: "blank" },
    ...searchHistory.map((query, index) => ({ kind: "row" as const, query, index })),
    { kind: "blank" },
    { kind: "hint" },
    { kind: "blank" },
    { kind: "note" },
    { kind: "count" },
  ];

  const compact: HistoryLine[] = [
    { kind: "header" },
    ...searchHistory.map((query, index) => ({ kind: "row" as const, query, index })),
    { kind: "hint" },
    { kind: "note" },
    { kind: "count" },
  ];

  let lines = full;
  if (full.length > height) {
    lines = compact;
  }
  const visible = lines.slice(0, Math.max(height, 0));

  const renderLine = (line: HistoryLine, key: number) => {
    switch (line.kind) {
      case "header": {
        return <Text key={key} wrap="truncate-end">{Label.SEARCH_HISTORY_TITLE}</Text>;
      }
      case "row": {
        const isCursor = line.index === cursorIndex;
        let prefix = "  ";
        let rowColor: string | undefined = "gray";
        if (isCursor) {
          prefix = `${figures.pointer} `;
          rowColor = undefined;
        }
        return (
          <Text key={key} bold={isCursor} color={rowColor} wrap="truncate-end">
            {prefix}
            {line.query}
          </Text>
        );
      }
      case "blank": {
        return <Text key={key}> </Text>;
      }
      case "hint": {
        return (
          <Text key={key} color="gray" wrap="truncate-end">
            {Label.SEARCH_HISTORY_HINT}
          </Text>
        );
      }
      case "note": {
        return (
          <Text key={key} color="gray" wrap="truncate-end">
            {Label.SEARCH_HISTORY_KEPT_NOTE}
          </Text>
        );
      }
      case "count": {
        return (
          <Text key={key} color="yellow" wrap="truncate-end">
            {figures.bullet} {bulkCount} {Label.SEARCH_HISTORY_BULK_SUFFIX}
          </Text>
        );
      }
    }
  };

  return (
    <Box flexDirection="column" width={width}>
      {visible.map((line, index) => {
        return renderLine(line, index);
      })}
    </Box>
  );
}

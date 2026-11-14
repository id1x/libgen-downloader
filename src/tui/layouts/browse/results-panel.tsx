import { Box, Text } from "ink";
import InkSpinner from "ink-spinner";
import objectHash from "object-hash";
import { Label } from "../../../labels";
import { SEARCH_PAGE_SIZE } from "../../../settings";
import type { Entry } from "../../../api/models/entry";
import { useBoundStore } from "../../store";
import { MirrorFailover } from "../../components/mirror-failover";
import type { ResultColumns } from "./layout-metrics";
import { rowStatus } from "./row-status";
import {
  ResultRow,
  RESULT_CURSOR_WIDTH,
  RESULT_EXTENSION_WIDTH,
  RESULT_NUMBER_WIDTH,
  RESULT_SIZE_WIDTH,
  RESULT_STATUS_WIDTH,
  fitCell,
} from "./result-row";

interface Properties {
  width: number;
  // Total panel height including the border rows.
  height: number;
  columns: ResultColumns;
}

// The results panel draws its own top border line so the title and the
// position marker can sit inside it; the box below omits its top border.
const borderTopTail = (width: number, marker: string): string => {
  let tail = "─╮";
  if (marker.length > 0) {
    tail = ` ${marker} ─╮`;
  }
  const prefixLength = 3 + Label.RESULTS_PANEL_TITLE.length + 1; // "╭─ <title> "
  let dashes = width - prefixLength - tail.length;
  if (dashes < 1) {
    dashes = 1;
  }
  return `${"─".repeat(dashes)}${tail}`;
};

// Scroll window over the entries: keep the cursor at least 2 rows from the
// edges of the window when possible, clamped so the window always fills.
const visibleWindowStart = (cursor: number, count: number, viewport: number): number => {
  if (viewport < 1 || count <= viewport) {
    return 0;
  }

  const maxStart = count - viewport;
  let start = cursor - 2;
  const minStart = cursor - viewport + 3;
  if (start < minStart) {
    start = minStart;
  }
  if (start < 0) {
    start = 0;
  }
  if (start > maxStart) {
    start = maxStart;
  }
  return start;
};

const headerLine = (columns: ResultColumns): string => {
  let line =
    fitCell("", RESULT_CURSOR_WIDTH, "right") +
    " " +
    fitCell(Label.RESULT_COLUMN_NUMBER, RESULT_NUMBER_WIDTH, "right") +
    " " +
    fitCell(Label.RESULT_COLUMN_EXTENSION, RESULT_EXTENSION_WIDTH, "left") +
    " " +
    fitCell(Label.RESULT_COLUMN_TITLE, columns.title, "left");
  if (columns.showAuthor) {
    line += " " + fitCell(Label.RESULT_COLUMN_AUTHOR, columns.author, "left");
  }
  line +=
    " " +
    fitCell(Label.RESULT_COLUMN_SIZE, RESULT_SIZE_WIDTH, "right") +
    " " +
    fitCell(Label.RESULT_COLUMN_STATUS, RESULT_STATUS_WIDTH, "left");
  return line;
};

export function ResultsPanel({ width, height, columns }: Properties) {
  const entries = useBoundStore((state) => state.entries);
  const listItemsCursor = useBoundStore((state) => state.listItemsCursor);
  const currentPage = useBoundStore((state) => state.currentPage);
  const isLoading = useBoundStore((state) => state.isLoading);
  const searchValue = useBoundStore((state) => state.searchValue);
  const connectionError = useBoundStore((state) => state.connectionError);
  const mirrorAdapter = useBoundStore((state) => state.mirrorAdapter);
  const downloadProgressMap = useBoundStore((state) => state.downloadProgressMap);
  const bulkDownloadSelectedEntries = useBoundStore((state) => state.bulkDownloadSelectedEntries);
  const bulkDownloadQueue = useBoundStore((state) => state.bulkDownloadQueue);

  const count = entries.length;
  let cursor = listItemsCursor;
  const maxCursor = count - 1;
  if (cursor > maxCursor) {
    cursor = Math.max(maxCursor, 0);
  }

  let marker = "";
  if (!isLoading && count > 0) {
    marker = `${cursor + 1}/${count}`;
  }

  const contentRows = Math.max(height - 2, 0); // top border line + bottom border
  const viewport = Math.max(contentRows - 1, 0); // dim header row
  const start = visibleWindowStart(cursor, count, viewport);

  return (
    <Box flexDirection="column" width={width}>
      <Text wrap="truncate-end">
        <Text color="gray">╭─ </Text>
        <Text>{Label.RESULTS_PANEL_TITLE}</Text>
        <Text color="gray"> {borderTopTail(width, marker)}</Text>
      </Text>
      <Box
        borderStyle="round"
        borderTop={false}
        borderColor="gray"
        width={width}
        height={Math.max(height - 1, 2)}
        flexDirection="column"
        overflow="hidden"
      >
        {(() => {
          if (isLoading) {
            return (
              <Box flexGrow={1} flexDirection="column" alignItems="center" justifyContent="center">
                {connectionError && (
                  <>
                    <Text color="red">{Label.CONNECTION_ERROR}</Text>
                    <Text color="gray">{connectionError}</Text>
                    <MirrorFailover />
                  </>
                )}
                {!connectionError && (
                  <>
                    <Text color="white">
                      <InkSpinner type="simpleDotsScrolling" />
                    </Text>
                    <Text color="white">{Label.GETTING_RESULTS}</Text>
                  </>
                )}
              </Box>
            );
          }

          if (count === 0) {
            return (
              <Box flexGrow={1} flexDirection="column" alignItems="center" justifyContent="center">
                <Text>{`${Label.NO_RESULTS} "${searchValue}"`}</Text>
              </Box>
            );
          }

          return (
            <Box flexDirection="column">
              <Text color="gray">{headerLine(columns)}</Text>
              {entries.slice(start, start + viewport).map((entry: Entry, index: number) => {
                const entryIndex = start + index;
                // Bulk membership is keyed by objectHash(entry) in the store
                // (spec §8.4, same-book dedupe).
                const bulkSelected = Boolean(bulkDownloadSelectedEntries[objectHash(entry)]);
                const status = rowStatus(entry, {
                  downloadProgressMap,
                  bulkSelected,
                  bulkQueue: bulkDownloadQueue,
                  mirrorAdapter,
                });
                return (
                  <ResultRow
                    key={entry.id}
                    entry={entry}
                    number={entryIndex + 1 + (currentPage - 1) * SEARCH_PAGE_SIZE}
                    isCursor={entryIndex === cursor}
                    status={status}
                    widths={columns}
                  />
                );
              })}
            </Box>
          );
        })()}
      </Box>
    </Box>
  );
}

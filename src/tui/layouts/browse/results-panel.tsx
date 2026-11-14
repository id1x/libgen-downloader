import { Box, Text } from "ink";
import InkSpinner from "ink-spinner";
import objectHash from "object-hash";
import { Label } from "../../../labels";
import { SEARCH_PAGE_SIZE } from "../../../settings";
import type { Entry } from "../../../api/models/entry";
import { useBoundStore } from "../../store";
import { MirrorFailover } from "../../components/mirror-failover";
import type { ResultColumns } from "./layout-metrics";
import type { RowStatus } from "./row-status";
import { rowStatus } from "./row-status";
import { ResultRow, headerLine } from "./result-row";
import { borderTopTail } from "./panel-border";

interface Properties {
  width: number;
  // Total panel height including the border rows.
  height: number;
  columns: ResultColumns;
  // Search focus dims the panel (spec §5.4): all text gray, no status
  // labels, gray border.
  dimmed?: boolean;
}

// The results panel draws its own top border line so the title and the
// position marker can sit inside it; the box below omits its top border.
// The tail arithmetic is shared with the other panels (panel-border.ts).

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

export function ResultsPanel({ width, height, columns, dimmed }: Properties) {
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

  // Dimmed status column: no labels, blank cell (spec §5.4).
  const dimmedStatus: RowStatus = { symbol: "", color: "gray", kind: "none" };
  let titleColor: string | undefined;
  if (dimmed) {
    titleColor = "gray";
  }

  return (
    <Box flexDirection="column" width={width}>
      <Text wrap="truncate-end">
        <Text color="gray">╭─ </Text>
        <Text color={titleColor}>{Label.RESULTS_PANEL_TITLE}</Text>
        <Text color="gray"> {borderTopTail(width, Label.RESULTS_PANEL_TITLE, marker)}</Text>
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
                <Text color={titleColor}>{`${Label.NO_RESULTS} "${searchValue}"`}</Text>
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
                let status: RowStatus = dimmedStatus;
                if (!dimmed) {
                  status = rowStatus(entry, {
                    downloadProgressMap,
                    bulkSelected,
                    bulkQueue: bulkDownloadQueue,
                    mirrorAdapter,
                  });
                }
                return (
                  <ResultRow
                    key={entry.id}
                    entry={entry}
                    number={entryIndex + 1 + (currentPage - 1) * SEARCH_PAGE_SIZE}
                    isCursor={entryIndex === cursor}
                    status={status}
                    widths={columns}
                    dimmed={dimmed}
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

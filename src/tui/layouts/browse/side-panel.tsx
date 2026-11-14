import { Box, Text } from "ink";
import { Label } from "../../../labels";
import { useBoundStore } from "../../store";
import { unfinishedQueueCount } from "./queue-count";
import { EntryDetail } from "./entry-detail";
import type { DetailLayout } from "./entry-detail";
import { QueuePanel } from "./queue-panel";
import { SearchHistory } from "./search-history";
import { borderTopTail } from "./panel-border";

interface Properties {
  width: number;
  // Total panel height including the border rows.
  height: number;
  // Layout for the detail content: wide beside the list, stacked below it.
  detailLayout: DetailLayout;
}

// The right-hand side panel (spec §3): Detail tab in M2, Queue tab kept
// rendered for M4. The border title's N is the unfinished-item count computed
// from the store, never from rendered rows. While the search input has the
// focus the panel becomes the Search panel with the session's recent
// searches (spec §5.4); in stacked mode it replaces the Detail panel the
// same way.
export function SidePanel({ width, height, detailLayout }: Properties) {
  const sidePanel = useBoundStore((state) => state.sidePanel);
  const browseFocus = useBoundStore((state) => state.browseFocus);
  const entries = useBoundStore((state) => state.entries);
  const listItemsCursor = useBoundStore((state) => state.listItemsCursor);
  const mirrorAdapter = useBoundStore((state) => state.mirrorAdapter);
  const bulkDownloadSelectedEntries = useBoundStore((state) => state.bulkDownloadSelectedEntries);
  const bulkDownloadQueue = useBoundStore((state) => state.bulkDownloadQueue);
  const downloadProgressMap = useBoundStore((state) => state.downloadProgressMap);

  // The detail panel shows the entry under the cursor, clamped the same way
  // the results panel clamps it.
  const maxCursor = entries.length - 1;
  let cursor = listItemsCursor;
  if (cursor > maxCursor) {
    cursor = Math.max(maxCursor, 0);
  }
  const entry = entries[cursor];

  const queueCount = unfinishedQueueCount({
    bulkDownloadSelectedEntries,
    bulkDownloadQueue,
    downloadProgressMap,
    mirrorAdapter,
  });

  let queueLabel = Label.SIDE_PANEL_TAB_QUEUE;
  if (queueCount > 0) {
    queueLabel = `${Label.SIDE_PANEL_TAB_QUEUE} ${queueCount}`;
  }

  const searchActive = browseFocus === "search";
  const detailActive = sidePanel === "detail";

  // Top border with the `Detail │ Queue N` tabs (spec §3): the active tab
  // bold, the other dim, and a right-aligned dim `v` hint. The border tail
  // arithmetic is shared with the other panels (panel-border.ts); the tabs
  // string is the border line's "title".
  const tabs = `${Label.SIDE_PANEL_TAB_DETAIL} │ ${queueLabel}`;
  const tail = borderTopTail(width, tabs, Label.SIDE_PANEL_TOGGLE_HINT);

  let detailColor: string | undefined = "gray";
  let detailBold = false;
  if (detailActive) {
    detailColor = undefined;
    detailBold = true;
  }

  let queueColor: string | undefined = "gray";
  let queueBold = false;
  if (!detailActive) {
    queueColor = undefined;
    queueBold = true;
  }

  if (searchActive) {
    // The Search panel (spec §5.4): a plain `Search` title, no tabs and no
    // `v` hint — the history list takes the panel in every layout mode.
    const searchTail = borderTopTail(width, Label.SEARCH_PANEL_TITLE);

    return (
      <Box flexDirection="column" width={width}>
        <Text wrap="truncate-end">
          <Text color="gray">╭─ </Text>
          <Text>{Label.SEARCH_PANEL_TITLE}</Text>
          <Text color="gray"> {searchTail}</Text>
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
          <SearchHistory width={width - 2} height={Math.max(height - 2, 0)} />
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" width={width}>
      <Text wrap="truncate-end">
        <Text color="gray">╭─ </Text>
        <Text bold={detailBold} color={detailColor}>
          {Label.SIDE_PANEL_TAB_DETAIL}
        </Text>
        <Text color="gray"> │ </Text>
        <Text bold={queueBold} color={queueColor}>
          {queueLabel}
        </Text>
        <Text color="gray">
          {" "}
          {tail}
        </Text>
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
        {detailActive && <EntryDetail entry={entry} layout={detailLayout} width={width - 2} />}
        {!detailActive && <QueuePanel width={width - 2} height={height - 2} />}
      </Box>
    </Box>
  );
}

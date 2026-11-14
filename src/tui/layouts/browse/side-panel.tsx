import { Box, Text } from "ink";
import { Label } from "../../../labels";
import { useBoundStore } from "../../store";
import { unfinishedQueueCount } from "./queue-count";
import { EntryDetail } from "./entry-detail";
import type { DetailLayout } from "./entry-detail";
import { QueuePanel } from "./queue-panel";

interface Properties {
  width: number;
  // Total panel height including the border rows.
  height: number;
  // Layout for the detail content: wide beside the list, stacked below it.
  detailLayout: DetailLayout;
}

// The right-hand side panel (spec §3): Detail tab in M2, Queue tab kept
// rendered for M4. The border title's N is the unfinished-item count computed
// from the store, never from rendered rows.
export function SidePanel({ width, height, detailLayout }: Properties) {
  const sidePanel = useBoundStore((state) => state.sidePanel);
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

  const detailActive = sidePanel === "detail";

  // Top border with the `Detail │ Queue N` tabs (spec §3): the active tab
  // bold, the other dim, and a right-aligned dim `v` hint.
  const tabsWidth =
    Label.SIDE_PANEL_TAB_DETAIL.length + 3 + queueLabel.length; // "Detail" + " │ " + "Queue N"
  const tail = ` ${Label.SIDE_PANEL_TOGGLE_HINT} ─╮`;
  let dashes = width - (3 + tabsWidth + 1 + tail.length); // "╭─ ", tabs, " ", tail
  if (dashes < 1) {
    dashes = 1;
  }

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
          {"─".repeat(dashes)}
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

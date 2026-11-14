import { Box, Text } from "ink";
import { Label } from "../../../labels";
import { useBoundStore } from "../../store";
import { EntryDetail } from "./entry-detail";

interface Properties {
  width: number;
  // Total panel height including the border rows.
  height: number;
}

// The top border line is drawn by hand so the `Detail  N/count` title can sit
// inside it, the same way ResultsPanel draws its border.
const borderTopTail = (width: number, title: string): string => {
  const prefixLength = 3 + title.length + 1; // "╭─ <title> "
  let dashes = width - prefixLength - 2; // "─╮"
  if (dashes < 1) {
    dashes = 1;
  }
  return `${"─".repeat(dashes)}─╮`;
};

// Full-screen detail (spec §5.7): the wide Detail panel's content at full
// width as one bordered panel titled `Detail  N/25`. EntryDetail
// layout="full" wraps long values instead of truncating them.
export function FullDetailPanel({ width, height }: Properties) {
  const entries = useBoundStore((state) => state.entries);
  const listItemsCursor = useBoundStore((state) => state.listItemsCursor);

  // The panel shows the entry under the cursor, clamped the same way the
  // results panel clamps it; ↑↓ in fullDetail mode moves it (spec §4).
  const maxCursor = entries.length - 1;
  let cursor = listItemsCursor;
  if (cursor > maxCursor) {
    cursor = Math.max(maxCursor, 0);
  }
  const entry = entries[cursor];

  const title = `${Label.SIDE_PANEL_TAB_DETAIL}  ${cursor + 1}/${entries.length}`;

  return (
    <Box flexDirection="column" width={width}>
      <Text wrap="truncate-end">
        <Text color="gray">╭─ </Text>
        <Text>{title}</Text>
        <Text color="gray"> {borderTopTail(width, title)}</Text>
      </Text>
      <Box
        borderStyle="round"
        borderTop={false}
        width={width}
        height={Math.max(height - 1, 2)}
        flexDirection="column"
        overflow="hidden"
      >
        <EntryDetail entry={entry} layout="full" width={width - 2} />
      </Box>
    </Box>
  );
}

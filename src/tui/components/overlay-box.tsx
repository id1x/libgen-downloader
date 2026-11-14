import type { ReactNode } from "react";
import { Box, Text } from "ink";

interface Properties {
  title: string;
  // Outer width of the box including its border columns.
  width: number;
  children: ReactNode;
}

// The top border line is drawn by hand so the title can sit inside it, the
// same way ResultsPanel and SidePanel draw theirs; the rounded box below
// omits its top border.
const borderTopTail = (width: number, title: string): string => {
  const prefixLength = 3 + title.length + 1; // "╭─ <title> "
  let dashes = width - prefixLength - 2; // "─╮"
  if (dashes < 1) {
    dashes = 1;
  }
  return `${"─".repeat(dashes)}─╮`;
};

// Centred bordered box used by the help and quit overlays (spec §5.5). The
// parent centres it with justifyContent/alignItems over the dimmed browse
// screen; the box itself stays undimmed.
export function OverlayBox({ title, width, children }: Properties) {
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
        flexDirection="column"
        paddingX={1}
      >
        {children}
      </Box>
    </Box>
  );
}

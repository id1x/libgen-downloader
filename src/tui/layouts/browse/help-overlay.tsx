import { Text } from "ink";
import { Label } from "../../../labels";

// Key column width inside the help box (spec §5.5 mockup): the descriptions
// all start at the same column. Indents are content-relative; OverlayBox's
// paddingX adds the first column the mockup shows after the border.
const KEY_COLUMN_WIDTH = 12;
const ROW_INDENT = " ";
const HEADING_INDENT = "";

interface HelpSection {
  heading: string;
  rows: ReadonlyArray<readonly [string, string]>;
}

const sections = (): HelpSection[] => {
  return [
    { heading: Label.HELP_SECTION_NAVIGATE, rows: Label.HELP_NAVIGATE_ROWS },
    { heading: Label.HELP_SECTION_ACT_ON_ITEM, rows: Label.HELP_ACT_ON_ITEM_ROWS },
    { heading: Label.HELP_SECTION_GLOBAL, rows: Label.HELP_GLOBAL_ROWS },
  ];
};

type HelpLine =
  | { kind: "heading"; text: string }
  | { kind: "row"; keys: string; description: string }
  | { kind: "blank" }
  | { kind: "hint"; text: string };

// The §5.5 frame as a flat line list: sections separated by blank rows, the
// close hint last.
const helpLines = (): HelpLine[] => {
  const blocks = sections().map((section): HelpLine[] => [
    { kind: "heading", text: section.heading },
    ...section.rows.map((row): HelpLine => {
      return { kind: "row", keys: row[0], description: row[1] };
    }),
  ]);
  const lines = blocks.flatMap((block, index): HelpLine[] => {
    if (index === 0) {
      return block;
    }
    return [{ kind: "blank" }, ...block];
  });
  lines.push({ kind: "blank" }, { kind: "hint", text: Label.HELP_CLOSE_HINT });
  return lines;
};

interface Properties {
  // Content rows available inside the box borders; when the terminal is too
  // short the key list truncates and the last visible line becomes `…`
  // (spec §5.5).
  maxRows: number;
}

export function HelpOverlay({ maxRows }: Properties) {
  const lines = helpLines();
  let truncated = false;
  let visible = lines;
  if (lines.length > maxRows) {
    truncated = true;
    visible = lines.slice(0, maxRows);
  }

  const renderLine = (line: HelpLine, index: number) => {
    const isEllipsis = truncated && index === visible.length - 1;
    if (isEllipsis) {
      return (
        <Text key={index} color="gray">
          {ROW_INDENT}…
        </Text>
      );
    }

    switch (line.kind) {
      case "heading": {
        return (
          <Text key={index} wrap="truncate-end">
            {HEADING_INDENT}
            {line.text}
          </Text>
        );
      }
      case "row": {
        return (
          <Text key={index} wrap="truncate-end">
            {ROW_INDENT}
            <Text color="cyan" bold={true}>
              {line.keys.padEnd(KEY_COLUMN_WIDTH)}
            </Text>
            <Text color="gray">{line.description}</Text>
          </Text>
        );
      }
      case "hint": {
        return (
          <Text key={index} color="gray" wrap="truncate-end">
            {ROW_INDENT}
            {line.text}
          </Text>
        );
      }
      default: {
        return <Text key={index}> </Text>;
      }
    }
  };

  return <>{visible.map((line, index) => renderLine(line, index))}</>;
}

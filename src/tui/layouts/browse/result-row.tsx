import { memo } from "react";
import { Text } from "ink";
import figures from "figures";
import { Label } from "../../../labels";
import type { Entry } from "../../../api/models/entry";
import type { RowStatus } from "./row-status";

// Column widths from spec §3. The title column is flexible and comes from
// the layout metrics.
export const RESULT_CURSOR_WIDTH = 3;
export const RESULT_NUMBER_WIDTH = 3;
export const RESULT_EXTENSION_WIDTH = 5;
export const RESULT_SIZE_WIDTH = 6;
export const RESULT_STATUS_WIDTH = 4;

export interface RowWidths {
  title: number;
  author: number;
  showAuthor: boolean;
}

// Cursor row background highlight (spec §3).
const CURSOR_BACKGROUND = "#1f3140";

// Truncate to `width` cells with an ellipsis, then pad to exactly `width`.
export const fitCell = (text: string, width: number, alignment: "left" | "right"): string => {
  if (width < 1) {
    return "";
  }

  let fitted = text;
  if (fitted.length > width) {
    fitted = `${fitted.slice(0, width - 1)}…`;
  }
  if (fitted.length > width) {
    fitted = fitted.slice(0, width);
  }

  if (alignment === "right") {
    return fitted.padStart(width, " ");
  }
  return fitted.padEnd(width, " ");
};

// The dim column-header row above the entries (spec §3's column table); the
// same widths and fit rules the rows below it use.
export const headerLine = (columns: RowWidths): string => {
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

interface Properties {
  entry: Entry;
  // Global index: order within the page plus the rows of the pages before it.
  number: number;
  isCursor: boolean;
  // Status column content (spec §3's row status table), computed with
  // row-status.ts.
  status: RowStatus;
  widths: RowWidths;
  // Search focus dims the whole results panel (spec §5.4): every cell gray,
  // no status labels.
  dimmed?: boolean;
}

const ResultRowComponent = ({ entry, number, isCursor, status, widths, dimmed }: Properties) => {
  let background: string | undefined;
  if (isCursor) {
    background = CURSOR_BACKGROUND;
  }

  let cursorCell = " ";
  if (isCursor) {
    cursorCell = figures.pointer;
  }

  let titleColor: string | undefined;
  if (isCursor) {
    titleColor = "white";
  }

  let cursorColor = "cyan";
  let extensionColor = "green";
  if (dimmed) {
    cursorColor = "gray";
    extensionColor = "gray";
    titleColor = "gray";
  }

  return (
    <Text backgroundColor={background}>
      <Text backgroundColor={background} color={cursorColor} bold={!dimmed && isCursor}>
        {fitCell(cursorCell, RESULT_CURSOR_WIDTH, "right")}
      </Text>
      <Text backgroundColor={background}> </Text>
      <Text backgroundColor={background} color="gray">
        {fitCell(String(number), RESULT_NUMBER_WIDTH, "right")}
      </Text>
      <Text backgroundColor={background}> </Text>
      <Text backgroundColor={background} color={extensionColor} bold={!dimmed}>
        {fitCell(entry.extension, RESULT_EXTENSION_WIDTH, "left")}
      </Text>
      <Text backgroundColor={background}> </Text>
      <Text backgroundColor={background} color={titleColor} bold={!dimmed && isCursor}>
        {fitCell(entry.title, widths.title, "left")}
      </Text>
      {widths.showAuthor && (
        <>
          <Text backgroundColor={background}> </Text>
          <Text backgroundColor={background} color="gray">
            {fitCell(entry.authors, widths.author, "left")}
          </Text>
        </>
      )}
      <Text backgroundColor={background}> </Text>
      <Text backgroundColor={background} color="gray">
        {fitCell(entry.size, RESULT_SIZE_WIDTH, "right")}
      </Text>
      <Text backgroundColor={background}> </Text>
      <Text backgroundColor={background} color={status.color}>
        {fitCell(status.symbol, RESULT_STATUS_WIDTH, "left")}
      </Text>
    </Text>
  );
};

// Key-repeat performance (spec §8.4): a row only re-renders when the entry,
// its cursor state or its status changes. The status is compared field by
// field because rowStatus returns a fresh object per render. Widths are part
// of the check so resizes still re-lay out the rows.
export const ResultRow = memo(
  ResultRowComponent,
  (previous, next) =>
    previous.entry.id === next.entry.id &&
    previous.number === next.number &&
    previous.isCursor === next.isCursor &&
    previous.status.symbol === next.status.symbol &&
    previous.status.color === next.status.color &&
    previous.status.kind === next.status.kind &&
    previous.dimmed === next.dimmed &&
    previous.widths.title === next.widths.title &&
    previous.widths.author === next.widths.author &&
    previous.widths.showAuthor === next.widths.showAuthor
);

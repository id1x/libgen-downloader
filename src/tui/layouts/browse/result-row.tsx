import { memo } from "react";
import { Text } from "ink";
import figures from "figures";
import type { Entry } from "../../../api/models/entry";

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

interface Properties {
  entry: Entry;
  // Global index: order within the page plus the rows of the pages before it.
  number: number;
  isCursor: boolean;
  // Status column content (spec §3). M1 renders it blank; M2 wires
  // row-status.ts.
  status: string;
  widths: RowWidths;
}

const ResultRowComponent = ({ entry, number, isCursor, status, widths }: Properties) => {
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

  return (
    <Text backgroundColor={background}>
      <Text backgroundColor={background} color="cyan" bold={isCursor}>
        {fitCell(cursorCell, RESULT_CURSOR_WIDTH, "right")}
      </Text>
      <Text backgroundColor={background}> </Text>
      <Text backgroundColor={background} color="gray">
        {fitCell(String(number), RESULT_NUMBER_WIDTH, "right")}
      </Text>
      <Text backgroundColor={background}> </Text>
      <Text backgroundColor={background} color="green" bold={true}>
        {fitCell(entry.extension, RESULT_EXTENSION_WIDTH, "left")}
      </Text>
      <Text backgroundColor={background}> </Text>
      <Text backgroundColor={background} color={titleColor} bold={isCursor}>
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
      <Text backgroundColor={background} color="gray">
        {fitCell(status, RESULT_STATUS_WIDTH, "left")}
      </Text>
    </Text>
  );
};

// Key-repeat performance (spec §8.4): a row only re-renders when the entry,
// its cursor state or its status changes. Widths are part of the check so
// resizes still re-lay out the rows.
export const ResultRow = memo(
  ResultRowComponent,
  (previous, next) =>
    previous.entry.id === next.entry.id &&
    previous.number === next.number &&
    previous.isCursor === next.isCursor &&
    previous.status === next.status &&
    previous.widths.title === next.widths.title &&
    previous.widths.author === next.widths.author &&
    previous.widths.showAuthor === next.widths.showAuthor
);

import type { SidePanelMode } from "../../store/browse";

export type LayoutMode = "wide" | "stacked" | "compact";

export interface ResultColumns {
  title: number;
  author: number;
  showAuthor: boolean;
}

export interface LayoutMetrics {
  mode: LayoutMode;
  resultsWidth: number;
  sideWidth: number;
  listHeight: number;
  sideHeight: number;
  columns: ResultColumns;
}

export interface ComputeLayoutOptions {
  hasWarning: boolean;
  hasBanner: boolean;
  hasUpdateNotice: boolean;
  hasSidePanel: boolean;
  sidePanel: SidePanelMode;
}

// Breakpoints from spec §3 ("Responsive layout"): ≥ 100 wide side by side,
// 60–99 stacked, < 60 stacked with the author column hidden. The breakpoints
// test the terminal width; the 1-column padding the browse screen renders on
// the left comes out of the panel widths (§5.1: 1 + 66 + 53 = 120).
export const WIDE_MIN_COLUMNS = 100;
const COMPACT_MAX_COLUMNS = 59;

const PADDING_COLUMNS = 1;
const RESULTS_WIDTH_SHARE = 0.55;
const RESULTS_MIN_WIDTH = 56;

// Spec §3: the stacked side panel is a fixed 7-row box (5 content rows plus
// borders); Queue mode takes 12 rows.
const SIDE_PANEL_DETAIL_HEIGHT = 7;
const SIDE_PANEL_QUEUE_HEIGHT = 12;

const AUTHOR_COLUMN_WIDTH = 16;
const AUTHOR_COLUMN_NARROW_WIDTH = 14;
// Fixed result-row cells: cursor 3, # 3, ext 5, size 6, st 4 (spec §3).
const FIXED_RESULT_CELLS = 3 + 3 + 5 + 6 + 4;
const MIN_TITLE_COLUMN_WIDTH = 10;

// Vertical budget. The browse header, search line and footer take one row
// each; the availability banner is a bordered 3-line box (5 rows total).
// One spare row is kept back so the total output never exceeds rows - 1
// (spec §8.4, Ink output flicker).
const HEADER_ROWS = 1;
const SEARCH_LINE_ROWS = 1;
const FOOTER_ROWS = 1;
const BANNER_ROWS = 5;
const SPARE_ROWS = 1;
const MIN_LIST_HEIGHT = 3;

const rowContentWidth = (resultsWidth: number): number => {
  return resultsWidth - 2; // rounded border, left and right
};

// The title column is whatever is left of the row content after the fixed
// cells, the author column (when shown) and one separator space between
// adjacent cells (7 cells with the author, 6 without).
const titleColumnWidth = (
  resultsWidth: number,
  authorWidth: number,
  showAuthor: boolean
): number => {
  let reserved = FIXED_RESULT_CELLS;
  if (showAuthor) {
    reserved += authorWidth;
  }
  let separators = 5;
  if (showAuthor) {
    separators += 1;
  }
  let title = rowContentWidth(resultsWidth) - reserved - separators;
  if (title < 1) {
    title = 1;
  }
  return title;
};

export const computeLayout = (
  columns: number,
  rows: number,
  options: ComputeLayoutOptions
): LayoutMetrics => {
  let mode: LayoutMode = "wide";
  if (columns < WIDE_MIN_COLUMNS) {
    mode = "stacked";
  }
  if (columns <= COMPACT_MAX_COLUMNS) {
    mode = "compact";
  }

  // The panels share the usable width (terminal minus the left padding).
  const usableWidth = columns - PADDING_COLUMNS;

  let resultsWidth = usableWidth;
  if (mode === "wide") {
    // The results panel takes its share of the terminal width; the padding
    // column comes out of the side panel's share.
    resultsWidth = Math.max(Math.floor(columns * RESULTS_WIDTH_SHARE), RESULTS_MIN_WIDTH);
  }

  let sideWidth = usableWidth;
  if (mode === "wide") {
    sideWidth = usableWidth - resultsWidth;
  }

  let reservedRows = SPARE_ROWS + HEADER_ROWS + SEARCH_LINE_ROWS + FOOTER_ROWS;
  if (options.hasWarning) {
    reservedRows += 1;
  }
  if (options.hasBanner) {
    reservedRows += BANNER_ROWS;
  }
  if (options.hasUpdateNotice) {
    reservedRows += 1;
  }

  const mainAreaHeight = rows - reservedRows;

  let sideHeight = mainAreaHeight;
  if (mode !== "wide") {
    sideHeight = SIDE_PANEL_DETAIL_HEIGHT;
    if (options.sidePanel === "queue") {
      sideHeight = SIDE_PANEL_QUEUE_HEIGHT;
    }
  }

  let listHeight = mainAreaHeight;
  if (mode !== "wide" && options.hasSidePanel) {
    listHeight = mainAreaHeight - sideHeight;
  }
  if (listHeight < MIN_LIST_HEIGHT) {
    listHeight = MIN_LIST_HEIGHT;
  }

  const showAuthor = mode !== "compact";
  let authorWidth = AUTHOR_COLUMN_WIDTH;
  let titleWidth = titleColumnWidth(resultsWidth, authorWidth, showAuthor);
  // Spec §3: the author column drops to 14 when wide space is short. Treat
  // "short" as "the title column would fall under its minimum width".
  if (mode === "wide" && showAuthor && titleWidth < MIN_TITLE_COLUMN_WIDTH) {
    authorWidth = AUTHOR_COLUMN_NARROW_WIDTH;
    titleWidth = titleColumnWidth(resultsWidth, authorWidth, showAuthor);
  }

  return {
    mode,
    resultsWidth,
    sideWidth,
    listHeight,
    sideHeight,
    columns: {
      title: titleWidth,
      author: authorWidth,
      showAuthor,
    },
  };
};

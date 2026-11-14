import { DownloadStatus } from "../../../download-statuses";

// Static spinner frame. A live spinner would advance only when the row
// re-renders, and rows are memoised against the status (spec §8.4 key
// repeat), so the frame character is drawn directly.
export const SPINNER_SYMBOL = "⠋";

// One status glyph: the symbol and its Ink colour (spec §3: named colours,
// and every state also has a distinct symbol).
export interface StatusSymbol {
  symbol: string;
  color: string;
}

// The status glyphs shared by the result rows, the Queue panel rows and the
// status header (spec §3's row table; §5.3 reuses "the same symbols" in the
// Queue panel). DOWNLOADING's glyph is the `↓` the Queue panel and the
// header show — a result row replaces it with the live percent, so
// rowStatus only borrows the colour for that one status.
export const STATUS_SYMBOLS: Record<DownloadStatus, StatusSymbol> = {
  [DownloadStatus.IDLE]: { symbol: SPINNER_SYMBOL, color: "cyan" },
  [DownloadStatus.IN_QUEUE]: { symbol: "⋯", color: "gray" },
  [DownloadStatus.PROCESSING]: { symbol: SPINNER_SYMBOL, color: "cyan" },
  [DownloadStatus.DOWNLOADING]: { symbol: "↓", color: "cyan" },
  [DownloadStatus.DOWNLOADED]: { symbol: "✓", color: "green" },
  [DownloadStatus.FAILED]: { symbol: "✗", color: "red" },
  [DownloadStatus.CONNECTING_TO_LIBGEN]: { symbol: SPINNER_SYMBOL, color: "cyan" },
  [DownloadStatus.FETCHING_MD5]: { symbol: SPINNER_SYMBOL, color: "cyan" },
  [DownloadStatus.WAITING_FOR_LIBGEN]: { symbol: "…", color: "magenta" },
};

// Bulk-selection glyph (spec §3's row table, "In bulkDownloadSelectedEntries
// → ● yellow"). Not a DownloadStatus: it is membership in the bulk
// selection, not a run state, so it sits beside the map.
export const BULK_SELECTED_SYMBOL: StatusSymbol = { symbol: "●", color: "yellow" };

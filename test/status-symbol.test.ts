import { describe, expect, it } from "bun:test";
import { DownloadStatus } from "../src/download-statuses";
import {
  BULK_SELECTED_SYMBOL,
  SPINNER_SYMBOL,
  STATUS_SYMBOLS,
} from "../src/tui/layouts/browse/status-symbol";

// §3's status table is the authority for the shared glyph map; the result
// rows, the Queue panel rows and the status header all consume it.
describe("STATUS_SYMBOLS", () => {
  it("labels IN_QUEUE with ⋯ dimmed", () => {
    expect(STATUS_SYMBOLS[DownloadStatus.IN_QUEUE]).toEqual({ symbol: "⋯", color: "gray" });
  });

  it("labels FAILED with ✗ in red", () => {
    expect(STATUS_SYMBOLS[DownloadStatus.FAILED]).toEqual({ symbol: "✗", color: "red" });
  });

  it("labels DOWNLOADED with ✓ in green", () => {
    expect(STATUS_SYMBOLS[DownloadStatus.DOWNLOADED]).toEqual({ symbol: "✓", color: "green" });
  });

  it("labels WAITING_FOR_LIBGEN with an ellipsis in magenta", () => {
    expect(STATUS_SYMBOLS[DownloadStatus.WAITING_FOR_LIBGEN]).toEqual({
      symbol: "…",
      color: "magenta",
    });
  });

  it("labels DOWNLOADING with ↓ in cyan (the queue and header glyph)", () => {
    expect(STATUS_SYMBOLS[DownloadStatus.DOWNLOADING]).toEqual({ symbol: "↓", color: "cyan" });
  });

  it("labels the working statuses without byte progress with the spinner in cyan", () => {
    for (const status of [
      DownloadStatus.IDLE,
      DownloadStatus.CONNECTING_TO_LIBGEN,
      DownloadStatus.PROCESSING,
      DownloadStatus.FETCHING_MD5,
    ]) {
      expect(STATUS_SYMBOLS[status]).toEqual({ symbol: SPINNER_SYMBOL, color: "cyan" });
    }
  });

  it("covers every DownloadStatus", () => {
    for (const status of Object.values(DownloadStatus)) {
      expect(STATUS_SYMBOLS[status].symbol.length).toBeGreaterThan(0);
    }
  });
});

describe("BULK_SELECTED_SYMBOL", () => {
  it("is ● in yellow, membership rather than a run state", () => {
    expect(BULK_SELECTED_SYMBOL).toEqual({ symbol: "●", color: "yellow" });
  });
});

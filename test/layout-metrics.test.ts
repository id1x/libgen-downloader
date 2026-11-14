import { describe, expect, it } from "bun:test";
import { computeLayout } from "../src/tui/layouts/browse/layout-metrics";

const baseOptions = {
  hasWarning: false,
  hasBanner: false,
  hasUpdateNotice: false,
  hasSidePanel: false,
  sidePanel: "detail" as const,
};

describe("computeLayout", () => {
  it("lays out 120×36 as wide with a side panel of at least 40 columns", () => {
    const metrics = computeLayout(120, 36, baseOptions);

    expect(metrics.mode).toBe("wide");
    // §5.1: the panels share the usable width (1 padding column out of the
    // side panel's share): 1 + 66 + 53 = 120.
    expect(metrics.resultsWidth).toBe(66);
    expect(metrics.sideWidth).toBe(53);
    expect(metrics.columns.showAuthor).toBe(true);
    expect(metrics.columns.author).toBe(16);
    expect(metrics.listHeight).toBe(32);
    expect(metrics.sideHeight).toBe(32);
  });

  it("lays out 100×30 as wide", () => {
    const metrics = computeLayout(100, 30, baseOptions);

    expect(metrics.mode).toBe("wide");
    expect(metrics.resultsWidth).toBe(56);
    expect(metrics.sideWidth).toBe(43);
  });

  it("lays out 99×30 as stacked at full usable width", () => {
    const metrics = computeLayout(99, 30, baseOptions);

    expect(metrics.mode).toBe("stacked");
    expect(metrics.resultsWidth).toBe(98);
    expect(metrics.sideWidth).toBe(98);
    expect(metrics.columns.showAuthor).toBe(true);
  });

  it("reserves side panel rows in stacked mode when the side panel is present", () => {
    const metrics = computeLayout(99, 30, { ...baseOptions, hasSidePanel: true });

    expect(metrics.sideHeight).toBe(7);
    expect(metrics.listHeight).toBe(19);
  });

  it("gives the wide side panel the full main-area height at 120×36", () => {
    const metrics = computeLayout(120, 36, { ...baseOptions, hasSidePanel: true });

    expect(metrics.sideHeight).toBe(metrics.listHeight);
    expect(metrics.sideHeight).toBe(32);
    // The panels share the usable width; the padding column is outside them.
    expect(metrics.resultsWidth + metrics.sideWidth).toBe(119);
  });

  it("keeps the wide side panel height constant across side-panel modes", () => {
    const detail = computeLayout(120, 36, { ...baseOptions, hasSidePanel: true, sidePanel: "detail" });
    const queue = computeLayout(120, 36, { ...baseOptions, hasSidePanel: true, sidePanel: "queue" });

    expect(queue.sideHeight).toBe(detail.sideHeight);
    expect(queue.listHeight).toBe(detail.listHeight);
  });

  it("reserves 7 stacked side-panel rows in compact mode too", () => {
    const metrics = computeLayout(59, 24, { ...baseOptions, hasSidePanel: true });

    expect(metrics.mode).toBe("compact");
    expect(metrics.sideHeight).toBe(7);
    expect(metrics.listHeight).toBe(13);
  });

  it("gives the queue panel 12 stacked rows", () => {
    const metrics = computeLayout(80, 30, {
      ...baseOptions,
      hasSidePanel: true,
      sidePanel: "queue",
    });

    expect(metrics.sideHeight).toBe(12);
    expect(metrics.listHeight).toBe(14);
  });

  it("hides the author column in compact mode below 60 columns", () => {
    const metrics = computeLayout(59, 24, baseOptions);

    expect(metrics.mode).toBe("compact");
    expect(metrics.columns.showAuthor).toBe(false);
    expect(metrics.resultsWidth).toBe(58);
  });

  it("never lets the list height drop below 3 rows", () => {
    const metrics = computeLayout(40, 6, {
      ...baseOptions,
      hasWarning: true,
      hasBanner: true,
    });

    expect(metrics.listHeight).toBe(3);
  });

  it("shrinks the list by one row while a warning is shown", () => {
    const metrics = computeLayout(90, 30, { ...baseOptions, hasWarning: true });

    expect(metrics.listHeight).toBe(25);
  });

  it("does not throw on a 40×12 terminal", () => {
    let metrics: ReturnType<typeof computeLayout> | undefined;
    expect(() => {
      metrics = computeLayout(40, 12, baseOptions);
    }).not.toThrow();

    expect(metrics?.mode).toBe("compact");
    expect(metrics?.listHeight).toBeGreaterThan(0);
  });
});

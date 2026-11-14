import { afterEach, describe, expect, it } from "bun:test";
import { useBoundStore } from "../src/tui/store";
import type { Entry } from "../src/api/models/entry";

const originalStoreState = useBoundStore.getState();

const createEntry = (id: string): Entry => {
  return {
    id,
    authors: "",
    title: id,
    publisher: "",
    year: "",
    pages: "",
    language: "",
    size: "",
    extension: "",
    mirror: "",
  };
};

const entries3 = [createEntry("a"), createEntry("b"), createEntry("c")];

afterEach(() => {
  useBoundStore.setState(originalStoreState, true);
});

describe("moveCursor", () => {
  it("clamps at the last entry", () => {
    useBoundStore.setState({ entries: entries3, listItemsCursor: 0 });

    useBoundStore.getState().moveCursor(10);

    expect(useBoundStore.getState().listItemsCursor).toBe(2);
  });

  it("clamps at the first entry", () => {
    useBoundStore.setState({ entries: entries3, listItemsCursor: 1 });

    useBoundStore.getState().moveCursor(-5);

    expect(useBoundStore.getState().listItemsCursor).toBe(0);
  });

  it("moves within the list", () => {
    useBoundStore.setState({ entries: entries3, listItemsCursor: 0 });

    useBoundStore.getState().moveCursor(2);

    expect(useBoundStore.getState().listItemsCursor).toBe(2);
  });

  it("keeps the cursor at 0 for an empty list", () => {
    useBoundStore.setState({ entries: [], listItemsCursor: 0 });

    useBoundStore.getState().moveCursor(3);

    expect(useBoundStore.getState().listItemsCursor).toBe(0);
  });
});

describe("setCursorToEdge", () => {
  it("moves to the first entry", () => {
    useBoundStore.setState({ entries: entries3, listItemsCursor: 2 });

    useBoundStore.getState().setCursorToEdge("first");

    expect(useBoundStore.getState().listItemsCursor).toBe(0);
  });

  it("moves to the last entry", () => {
    useBoundStore.setState({ entries: entries3, listItemsCursor: 0 });

    useBoundStore.getState().setCursorToEdge("last");

    expect(useBoundStore.getState().listItemsCursor).toBe(2);
  });

  it("keeps the cursor at 0 for an empty list", () => {
    useBoundStore.setState({ entries: [], listItemsCursor: 0 });

    useBoundStore.getState().setCursorToEdge("last");

    expect(useBoundStore.getState().listItemsCursor).toBe(0);
  });
});

import { useInput } from "ink";
import type { Key } from "ink";
import { useBoundStore } from "../../store";

// Spec §4: PgUp/PgDn move the cursor 10 rows.
const PAGE_STEP = 10;

interface ListKeyHandlers {
  moveCursor: (delta: number) => void;
  setCursorToEdge: (edge: "first" | "last") => void;
  handleExit: () => void;
}

// Keys in `list` mode (spec §4). M1 wires only cursor movement and a plain
// quit; later milestones add cases per key, dispatching through the same
// handler.
const handleListKeys = (input: string, key: Key, handlers: ListKeyHandlers): void => {
  if (key.upArrow || input === "k") {
    handlers.moveCursor(-1);
    return;
  }

  if (key.downArrow || input === "j") {
    handlers.moveCursor(1);
    return;
  }

  if (key.pageUp) {
    handlers.moveCursor(-PAGE_STEP);
    return;
  }

  if (key.pageDown) {
    handlers.moveCursor(PAGE_STEP);
    return;
  }

  // Case-sensitive: `g` first row, `G` (shift+g) last row.
  if (input === "g") {
    handlers.setCursorToEdge("first");
    return;
  }

  if (input === "G") {
    handlers.setCursorToEdge("last");
    return;
  }

  if (input === "q") {
    handlers.handleExit();
  }
};

// The single `useInput` router of the browse screen (spec §4): every key
// dispatches on the current focus mode, and no component below the router
// registers its own `useInput` for these keys.
export function useBrowseKeys() {
  const browseFocus = useBoundStore((state) => state.browseFocus);
  const isLoading = useBoundStore((state) => state.isLoading);
  const moveCursor = useBoundStore((state) => state.moveCursor);
  const setCursorToEdge = useBoundStore((state) => state.setCursorToEdge);
  const handleExit = useBoundStore((state) => state.handleExit);

  useInput((input, key) => {
    switch (browseFocus) {
      case "list": {
        // While a search or page change is in flight only quit still works
        // (spec §4, priority rule 4).
        if (!isLoading || input === "q") {
          handleListKeys(input, key, { moveCursor, setCursorToEdge, handleExit });
        }
        break;
      }
    }
  });
}

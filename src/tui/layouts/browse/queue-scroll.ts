import type { QueueGroup } from "./queue-model";

// Scroll window over the groups for a cursor over the actionable rows (spec
// §5.3: "the Queue panel scrolls with queueCursor"). Keeps the cursor's group
// visible, fills forward first, then back so the window stays full.
export const visibleQueueGroups = (
  groups: QueueGroup[],
  queueCursor: number,
  viewport: number
): QueueGroup[] => {
  if (groups.length === 0 || viewport < 1) {
    return [];
  }

  const actionableCount = groups.filter((group) => group.anchor >= 0).length;
  const cursor = Math.min(Math.max(queueCursor, 0), Math.max(actionableCount - 1, 0));
  let index = groups.findIndex((group) => group.anchor === cursor);
  if (index < 0) {
    index = 0;
  }

  let start = index;
  let end = index;
  let used = groups[index].lines.length;
  while (end + 1 < groups.length && used + groups[end + 1].lines.length <= viewport) {
    end += 1;
    used += groups[end].lines.length;
  }
  while (start - 1 >= 0 && used + groups[start - 1].lines.length <= viewport) {
    start -= 1;
    used += groups[start].lines.length;
  }

  return groups.slice(start, end + 1);
};

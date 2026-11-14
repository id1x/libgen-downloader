import { Text } from "ink";

interface Properties {
  // 0..1; clamped.
  ratio: number;
  // Width of the bar in cells.
  width: number;
}

// Progress bar drawing `█` over `░` (spec §6.2); cyan for progress per the
// spec's colour rules. Used by the detail panel, the Queue panel and the
// header's bulk-run variant.
export function ProgressBar({ ratio, width }: Properties) {
  const clamped = Math.min(Math.max(ratio, 0), 1);
  const filled = Math.round(clamped * width);
  const empty = Math.max(width - filled, 0);

  if (width < 1) {
    return <Text />;
  }

  return (
    <Text>
      <Text color="cyan">{"█".repeat(filled)}</Text>
      <Text color="gray">{"░".repeat(empty)}</Text>
    </Text>
  );
}

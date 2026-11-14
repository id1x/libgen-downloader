import { Text } from "ink";

interface Properties {
  // [key, description] pairs (spec §4).
  hints: ReadonlyArray<readonly [string, string]>;
  width: number;
  // Keys rendered dim and non-bold (spec §4: the queue panel shows `x` dim
  // while a bulk run is active).
  dimKeys?: ReadonlyArray<string>;
}

const hintWidth = (hint: readonly [string, string]): number => {
  return hint[0].length + 1 + hint[1].length;
};

// Keys render bold cyan; dimmed keys (e.g. the queue panel's `x` during a
// run, spec §4) render plain gray.
const keyElement = (key: string, dimmed: boolean) => {
  if (dimmed) {
    return <Text color="gray">{key}</Text>;
  }
  return (
    <Text color="cyan" bold={true}>
      {key}
    </Text>
  );
};

// Footer hint row: keys in bold cyan, descriptions in gray, two spaces
// between pairs (the §4 footer format strings are two-spaced). Hints that no
// longer fit are dropped and marked with an ellipsis (spec §3, footer).
export function KeyFooter({ hints, width, dimKeys }: Properties) {
  const fitted: Array<readonly [string, string]> = [];
  let used = 0;
  let truncated = false;

  for (const hint of hints) {
    let required = hintWidth(hint);
    if (fitted.length > 0) {
      required += 2;
    }
    // Keep two columns in reserve for the ellipsis marker.
    if (used + required > width - 2) {
      truncated = true;
      break;
    }
    fitted.push(hint);
    used += required;
  }

  return (
    <Text wrap="truncate-end">
      {fitted.map(([key, description], index) => {
        const dimmed = dimKeys?.includes(key) ?? false;
        return (
          <Text key={key}>
            {index > 0 && <Text color="gray">  </Text>}
            {keyElement(key, dimmed)}
            <Text color="gray"> {description}</Text>
          </Text>
        );
      })}
      {truncated && <Text color="gray"> …</Text>}
    </Text>
  );
}

// The hand-drawn top border line the panels share (spec §3's Results and
// Detail panels, §5.7's full-screen detail): the title sits inside the line
// (`╭─ <title> `), so the bordered Box below omits its own top border. The
// dashes fill the remaining width, clamped to at least one. `marker` is an
// optional string that sits inside the line before the corner — the results
// panel's position marker, the side panel's `v` toggle hint — rendered as
// ` <marker> ─╮`; without it the line just ends in `─╮`.
export const borderTopTail = (width: number, title: string, marker = ""): string => {
  let tail = "─╮";
  if (marker.length > 0) {
    tail = ` ${marker} ─╮`;
  }
  const prefixLength = 3 + title.length + 1; // "╭─ <title> "
  let dashes = width - prefixLength - tail.length;
  if (dashes < 1) {
    dashes = 1;
  }
  return `${"─".repeat(dashes)}${tail}`;
};

import { Box, Text } from "ink";
import { Label } from "../../../labels";
import { APP_VERSION } from "../../../version";
import { useBoundStore } from "../../store";
import { AvailabilityBanner } from "../../components/availability-banner";
import { KeyFooter } from "../../components/key-footer";
import { useStdoutDimensions } from "../../hooks/use-stdout-dimensions";
import { computeLayout } from "./layout-metrics";
import { ResultsPanel } from "./results-panel";
import { SearchLine } from "./search-line";
import { SidePanel } from "./side-panel";
import { useBrowseKeys } from "./use-browse-keys";

// Spec §8.4: below this size the browse screen shows only a notice; q keeps
// working through the key router.
const MIN_TERMINAL_COLUMNS = 40;
const MIN_TERMINAL_ROWS = 12;

export function BrowseLayout() {
  const [terminalColumns, terminalRows] = useStdoutDimensions();
  const warningMessage = useBoundStore((state) => state.warningMessage);
  const availabilityStatus = useBoundStore((state) => state.availabilityStatus);
  const latestVersion = useBoundStore((state) => state.latestVersion);
  const sidePanel = useBoundStore((state) => state.sidePanel);

  useBrowseKeys();

  if (terminalColumns < MIN_TERMINAL_COLUMNS || terminalRows < MIN_TERMINAL_ROWS) {
    return (
      <Box paddingLeft={1}>
        <Text color="yellow">
          {Label.TERMINAL_TOO_SMALL} — current {terminalColumns}×{terminalRows}
        </Text>
      </Box>
    );
  }

  // computeLayout sizes against the terminal width (the §3 breakpoints and
  // §5.1's width shares are terminal-relative) and keeps the 1-column
  // padding out of the side panel's share; the root box renders that padding.
  const metrics = computeLayout(terminalColumns, terminalRows, {
    hasWarning: Boolean(warningMessage),
    hasBanner: availabilityStatus.state !== "available",
    hasUpdateNotice: Boolean(latestVersion && latestVersion !== APP_VERSION),
    // The side panel (Detail/Queue) exists from M2 on and is always rendered.
    hasSidePanel: true,
    sidePanel,
  });

  // One padding column so the header, body and footer line up one cell from
  // the terminal edge.
  const columns = terminalColumns - 1;

  let hints = Label.FOOTER_LIST_NARROW;
  if (metrics.mode === "wide") {
    hints = Label.FOOTER_LIST_WIDE;
  }

  let detailLayout: "wide" | "stacked" = "stacked";
  if (metrics.mode === "wide") {
    detailLayout = "wide";
  }

  const panels = (
    <>
      <ResultsPanel
        width={metrics.resultsWidth}
        height={metrics.listHeight}
        columns={metrics.columns}
      />
      <SidePanel
        width={metrics.sideWidth}
        height={metrics.sideHeight}
        detailLayout={detailLayout}
      />
    </>
  );

  return (
    <Box flexDirection="column" paddingLeft={1}>
      <SearchLine />
      {metrics.mode === "wide" && <Box flexDirection="row">{panels}</Box>}
      {metrics.mode !== "wide" && panels}
      {warningMessage && <Text color="yellow">[!] {warningMessage}</Text>}
      {availabilityStatus.state !== "available" && <AvailabilityBanner />}
      <KeyFooter hints={hints} width={columns} />
    </Box>
  );
}

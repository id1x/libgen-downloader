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

  // The root box keeps one padding column so the header, body and footer
  // line up one cell from the terminal edge.
  const columns = terminalColumns - 1;
  const metrics = computeLayout(columns, terminalRows, {
    hasWarning: Boolean(warningMessage),
    hasBanner: availabilityStatus.state !== "available",
    hasUpdateNotice: Boolean(latestVersion && latestVersion !== APP_VERSION),
    // The side panel (Detail/Queue) arrives in M2; until then the results
    // panel takes the whole main area.
    hasSidePanel: false,
    sidePanel: "detail",
  });

  let hints = Label.FOOTER_LIST_NARROW;
  if (metrics.mode === "wide") {
    hints = Label.FOOTER_LIST_WIDE;
  }

  return (
    <Box flexDirection="column" paddingLeft={1}>
      <SearchLine />
      <ResultsPanel
        width={metrics.resultsWidth}
        height={metrics.listHeight}
        columns={metrics.columns}
      />
      {warningMessage && <Text color="yellow">[!] {warningMessage}</Text>}
      {availabilityStatus.state !== "available" && <AvailabilityBanner />}
      <KeyFooter hints={hints} width={columns} />
    </Box>
  );
}

import { Box, Text } from "ink";
import { Label } from "../../../labels";
import { APP_VERSION } from "../../../version";
import { useBoundStore } from "../../store";
import { AvailabilityBanner } from "../../components/availability-banner";
import { KeyFooter } from "../../components/key-footer";
import { OverlayBox } from "../../components/overlay-box";
import { useStdoutDimensions } from "../../hooks/use-stdout-dimensions";
import { computeLayout } from "./layout-metrics";
import { FullDetailPanel } from "./full-detail-panel";
import { HelpOverlay } from "./help-overlay";
import { QuitOverlay } from "./quit-overlay";
import { ResultsPanel } from "./results-panel";
import { SearchLine } from "./search-line";
import { SidePanel } from "./side-panel";
import { useBrowseKeys } from "./use-browse-keys";

// Spec §8.4: below this size the browse screen shows only a notice; q keeps
// working through the key router.
const MIN_TERMINAL_COLUMNS = 40;
const MIN_TERMINAL_ROWS = 12;

// Overlay widths from the §5.5/§5.6 mockups: help is a 46-column box, quit
// renders at 50 columns at 80×30.
const HELP_OVERLAY_WIDTH = 46;
const QUIT_OVERLAY_WIDTH = 50;
// Border rows an overlay box adds around its content.
const OVERLAY_BORDER_ROWS = 2;

export function BrowseLayout() {
  const [terminalColumns, terminalRows] = useStdoutDimensions();
  const warningMessage = useBoundStore((state) => state.warningMessage);
  const availabilityStatus = useBoundStore((state) => state.availabilityStatus);
  const latestVersion = useBoundStore((state) => state.latestVersion);
  const sidePanel = useBoundStore((state) => state.sidePanel);
  const browseFocus = useBoundStore((state) => state.browseFocus);

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

  const layoutOptions = {
    hasWarning: Boolean(warningMessage),
    hasBanner: availabilityStatus.state !== "available",
    hasUpdateNotice: Boolean(latestVersion && latestVersion !== APP_VERSION),
    sidePanel,
  };

  // computeLayout sizes against the terminal width (the §3 breakpoints and
  // §5.1's width shares are terminal-relative) and keeps the 1-column
  // padding out of the side panel's share; the root box renders that padding.
  const metrics = computeLayout(terminalColumns, terminalRows, {
    ...layoutOptions,
    // The side panel (Detail/Queue) exists from M2 on and is always rendered.
    hasSidePanel: true,
  });

  // One padding column so the header, body and footer line up one cell from
  // the terminal edge.
  const columns = terminalColumns - 1;

  const overlayOpen = browseFocus === "help" || browseFocus === "quit";

  // Search focus dims the results panel (spec §5.4); the search line shows
  // the live input instead.
  const searchActive = browseFocus === "search";

  // Footer hints by focus mode (spec §4).
  let hints = Label.FOOTER_LIST_NARROW;
  if (metrics.mode === "wide") {
    hints = Label.FOOTER_LIST_WIDE;
  }
  if (browseFocus === "queue") {
    hints = Label.FOOTER_QUEUE;
  }
  if (browseFocus === "help") {
    hints = Label.FOOTER_HELP;
  }
  if (browseFocus === "quit") {
    hints = Label.FOOTER_QUIT;
  }
  if (browseFocus === "fullDetail") {
    hints = Label.FOOTER_FULL_DETAIL;
  }
  if (searchActive) {
    hints = Label.FOOTER_SEARCH;
  }

  let detailLayout: "wide" | "stacked" = "stacked";
  if (metrics.mode === "wide") {
    detailLayout = "wide";
  }

  let mainDirection: "row" | "column" = "column";
  if (metrics.mode === "wide") {
    mainDirection = "row";
  }

  // While an overlay is open the main area is the centred overlay box
  // (spec §5.5) and the surrounding browse chrome dims behind it. Ink 6 puts
  // dimColor on Text only, so the chrome pieces take a dimmed prop.
  const chromeDimmed = overlayOpen;

  // Overlays and the full-screen detail replace the whole main area, so
  // their height is the main area without the stacked side panel's share.
  const fullAreaHeight = computeLayout(terminalColumns, terminalRows, {
    ...layoutOptions,
    hasSidePanel: false,
  }).listHeight;

  const mainArea = (() => {
    if (overlayOpen) {
      return (
        <Box
          height={fullAreaHeight}
          alignItems="center"
          justifyContent="center"
          overflow="hidden"
        >
          {browseFocus === "help" && (
            <OverlayBox title={Label.HELP_TITLE} width={HELP_OVERLAY_WIDTH}>
              <HelpOverlay maxRows={fullAreaHeight - OVERLAY_BORDER_ROWS} />
            </OverlayBox>
          )}
          {browseFocus === "quit" && (
            <OverlayBox title={Label.QUIT_TITLE} width={QUIT_OVERLAY_WIDTH}>
              <QuitOverlay maxRows={fullAreaHeight - OVERLAY_BORDER_ROWS} />
            </OverlayBox>
          )}
        </Box>
      );
    }

    if (browseFocus === "fullDetail") {
      return <FullDetailPanel width={columns} height={fullAreaHeight} />;
    }

    return (
      <Box flexDirection={mainDirection}>
        <ResultsPanel
          width={metrics.resultsWidth}
          height={metrics.listHeight}
          columns={metrics.columns}
          dimmed={searchActive}
        />
        <SidePanel
          width={metrics.sideWidth}
          height={metrics.sideHeight}
          detailLayout={detailLayout}
        />
      </Box>
    );
  })();

  return (
    <Box flexDirection="column" paddingLeft={1}>
      <SearchLine dimmed={chromeDimmed} />
      {mainArea}
      {warningMessage && (
        <Text color="yellow" dimColor={chromeDimmed}>
          [!] {warningMessage}
        </Text>
      )}
      {availabilityStatus.state !== "available" && (
        <AvailabilityBanner dimmed={chromeDimmed} />
      )}
      <KeyFooter hints={hints} width={columns} />
    </Box>
  );
}

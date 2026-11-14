import { useEffect } from "react";
import { Box, Text, useStdin } from "ink";

import { Layouts } from "./layouts/index";
import { LAYOUT_KEY } from "./layouts/keys";
import { DownloadIndicator } from "./components/download-indicator";
import { ErrorMessage } from "./components/error-message";
import { useBoundStore } from "./store";
import { AppHeader } from "./components/app-header";
import { AppContainer } from "./components/app-container";
import { AvailabilityBanner } from "./components/availability-banner";

interface Properties {
  doNotFetchConfigInitially: boolean;
}

export function App({ doNotFetchConfigInitially }: Properties) {
  const { setRawMode } = useStdin();

  const errorMessage = useBoundStore((state) => state.errorMessage);
  const warningMessage = useBoundStore((state) => state.warningMessage);
  const activeLayout = useBoundStore((state) => state.activeLayout);
  const fetchConfig = useBoundStore((state) => state.fetchConfig);

  useEffect(() => {
    if (doNotFetchConfigInitially) {
      return;
    }

    fetchConfig();
  }, [doNotFetchConfigInitially, fetchConfig]);

  useEffect(() => {
    setRawMode(true);
    return () => {
      setRawMode(false);
    };
  }, [setRawMode]);

  if (errorMessage) {
    return <ErrorMessage />;
  }

  if (activeLayout === LAYOUT_KEY.BROWSE_LAYOUT) {
    // The browse screen renders its own status header, warning line,
    // availability banner and key footer, and the header summary replaces
    // the download counter (spec §3, §6.1). It is not width-capped by
    // AppContainer so the responsive layout can use the full terminal.
    return (
      <Box flexDirection="column">
        <AppHeader />
        <Layouts />
      </Box>
    );
  }

  return (
    <AppContainer>
      <AppHeader />
      <Layouts />
      <DownloadIndicator />
      <AvailabilityBanner />
      {warningMessage && <Text color="yellow">[!] {warningMessage}</Text>}
    </AppContainer>
  );
}

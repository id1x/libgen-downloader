import { Box, Text } from "ink";
import InkTextInput from "ink-text-input";
import { Label } from "../../../labels";
import { useBoundStore } from "../../store";

// The search line (spec §3, §6.2): `/ <query>` on the left and the page info
// on the right. While the search input has the focus (spec §5.4) the left
// side becomes an `ink-text-input` bound to `searchDraft` and the right side
// shows the mock's inline hints; the enter/esc/↑↓/ctrl+u keys themselves stay
// in the key router (spec §4), so the input only handles typing.
export function SearchLine({ dimmed = false }: { dimmed?: boolean }) {
  const browseFocus = useBoundStore((state) => state.browseFocus);
  const searchValue = useBoundStore((state) => state.searchValue);
  const searchDraft = useBoundStore((state) => state.searchDraft);
  const setSearchDraft = useBoundStore((state) => state.setSearchDraft);
  const currentPage = useBoundStore((state) => state.currentPage);

  const searching = browseFocus === "search";

  let queryPart = (
    <Text color="gray" dimColor={dimmed} wrap="truncate">
      {searchValue}
    </Text>
  );
  if (searching) {
    queryPart = (
      <Text wrap="truncate">
        <InkTextInput value={searchDraft} onChange={setSearchDraft} showCursor={true} />
      </Text>
    );
  }

  let lineInfo = `${Label.PAGE_INFO} ${currentPage}`;
  if (searching) {
    lineInfo = Label.SEARCH_LINE_HINTS;
  }

  return (
    <Box justifyContent="space-between">
      <Box flexShrink={1}>
        <Text color="gray" dimColor={dimmed} wrap="truncate">
          {Label.SEARCH_LINE_PROMPT}{" "}
        </Text>
        {queryPart}
      </Box>
      <Text color="gray" dimColor={dimmed} wrap="truncate-end">
        {lineInfo}
      </Text>
    </Box>
  );
}

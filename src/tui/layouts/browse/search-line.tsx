import { Box, Text } from "ink";
import { Label } from "../../../labels";
import { useBoundStore } from "../../store";

// Display-only search line (spec §3): `/ <query>` on the left, the page
// info on the right. The editable search input arrives in M5; until then
// the total result count is unknown, so only the page number is shown.
export function SearchLine({ dimmed = false }: { dimmed?: boolean }) {
  const searchValue = useBoundStore((state) => state.searchValue);
  const currentPage = useBoundStore((state) => state.currentPage);

  return (
    <Box justifyContent="space-between">
      <Text color="gray" dimColor={dimmed} wrap="truncate-end">
        {Label.SEARCH_LINE_PROMPT} {searchValue}
      </Text>
      <Text color="gray" dimColor={dimmed}>
        {Label.PAGE_INFO} {currentPage}
      </Text>
    </Box>
  );
}

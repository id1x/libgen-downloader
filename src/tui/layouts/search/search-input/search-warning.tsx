import type { FC } from "react";
import { Text } from "ink";

import { Label } from "../../../../labels";
import { useBoundStore } from "../../../store/index";

const SearchWarning: FC = () => {
  const showSearchMinCharWarning = useBoundStore((state) => state.showSearchMinCharWarning);

  if (!showSearchMinCharWarning) {
    return;
  }

  return (
    <Text color="yellow" wrap="truncate">
      {Label.SEARCH_MIN_CHAR_WARNING}
    </Text>
  );
};

export default SearchWarning;

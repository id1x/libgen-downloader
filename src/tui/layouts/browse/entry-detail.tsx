import { Box, Text } from "ink";
import objectHash from "object-hash";
import { Label } from "../../../labels";
import type { Entry } from "../../../api/models/entry";
import { useBoundStore } from "../../store";
import { getDownloadProgress } from "../../helpers/display";
import { KeyFooter } from "../../components/key-footer";
import { ProgressBar } from "../../components/progress-bar";
import { downloadPercent, rowStatus } from "./row-status";
import {
  DETAIL_FIELDS,
  FIELD_LABEL_WIDTH,
  STATUS_WORDS,
  entryFieldValue,
  shortMD5,
  stackedSummary,
} from "./detail-fields";

export type DetailLayout = "wide" | "stacked" | "full";

interface Properties {
  entry: Entry | undefined;
  layout: DetailLayout;
  // Content width in cells, inside the panel borders.
  width: number;
}

// The bar leaves room for its `↓ ` prefix and ` NN%` suffix.
const BAR_WIDTH_RESERVE = 8;

const blankRow = () => {
  return <Text> </Text>;
};

export function EntryDetail({ entry, layout, width }: Properties) {
  const mirrorAdapter = useBoundStore((state) => state.mirrorAdapter);
  const downloadProgressMap = useBoundStore((state) => state.downloadProgressMap);
  const bulkDownloadSelectedEntries = useBoundStore((state) => state.bulkDownloadSelectedEntries);
  const bulkDownloadQueue = useBoundStore((state) => state.bulkDownloadQueue);

  if (!entry) {
    return;
  }

  const downloadProgress = downloadProgressMap[entry.id];
  const bulkSelected = Boolean(bulkDownloadSelectedEntries[objectHash(entry)]);
  const status = rowStatus(entry, {
    downloadProgressMap,
    bulkSelected,
    bulkQueue: bulkDownloadQueue,
    mirrorAdapter,
  });

  const md5 = mirrorAdapter?.getEntryMD5(entry);

  let valueWrap: "wrap" | "truncate-end" = "truncate-end";
  if (layout === "full") {
    // Full-screen detail wraps long values instead of truncating (§5.7).
    valueWrap = "wrap";
  }

  const fieldRow = (label: string, value: string, index: number) => {
    return (
      <Text key={index} wrap={valueWrap}>
        <Text color="gray">{label.padEnd(FIELD_LABEL_WIDTH)}</Text>
        <Text> </Text>
        <Text>{value}</Text>
      </Text>
    );
  };

  const fieldRows = DETAIL_FIELDS.filter((field) => {
    return !mirrorAdapter || mirrorAdapter.isHiddenField(field.key);
  }).map((field, index) => {
    return fieldRow(field.label, entryFieldValue(entry, field.key, mirrorAdapter), index);
  });

  const md5Row = fieldRow(Label.DETAIL_FIELD_MD5, shortMD5(md5), DETAIL_FIELDS.length);

  // The download rows for a direct-download status: two rows while
  // downloading (`↓ <bar> NN%` and `<done> / <total>`), one status line for
  // every other direct status, nothing without a record.
  const renderDownloadRows = () => {
    if (!downloadProgress || status.kind === "bulk" || status.kind === "none") {
      return;
    }

    if (status.kind === "progress") {
      const percent = downloadPercent(downloadProgress.progress, downloadProgress.total);
      let ratio = 0;
      if (downloadProgress.total > 0) {
        ratio = (downloadProgress.progress || 0) / downloadProgress.total;
      }
      const sizes = getDownloadProgress(downloadProgress.progress || 0, downloadProgress.total);
      const barWidth = Math.max(width - BAR_WIDTH_RESERVE, 8);

      return (
        <>
          <Text wrap="truncate-end">
            <Text color="cyan">↓ </Text>
            <ProgressBar ratio={ratio} width={barWidth} />
            <Text> </Text>
            <Text color="cyan">{percent}%</Text>
          </Text>
          <Text color="gray" wrap="truncate-end">
            {"  "}
            {sizes.downloadedSize} / {sizes.totalSize}
          </Text>
        </>
      );
    }

    return (
      <Text color={status.color} wrap="truncate-end">
        {status.symbol} {STATUS_WORDS[downloadProgress.status]}
      </Text>
    );
  };

  // Stacked mode keeps lines 3–4 for the download block so the bulk line
  // stays on line 5 whatever the status is (spec §3).
  const renderStackedDownloadRows = () => {
    const rows = renderDownloadRows();
    if (!rows) {
      return (
        <>
          {blankRow()}
          {blankRow()}
        </>
      );
    }
    if (status.kind === "progress") {
      return rows;
    }
    return (
      <>
        {rows}
        {blankRow()}
      </>
    );
  };

  const renderBulkLine = () => {
    if (bulkSelected) {
      return (
        <Text color="yellow" wrap="truncate-end">
          ● {Label.DETAIL_BULK_MEMBER}  {Label.DETAIL_BULK_MEMBER_HINT}
        </Text>
      );
    }
    return (
      <Text color="gray" wrap="truncate-end">
        ○ {Label.DETAIL_BULK_NONMEMBER}  {Label.DETAIL_BULK_NONMEMBER_HINT}
      </Text>
    );
  };

  if (layout === "stacked") {
    // Stacked compression (spec §3): line 1 title + authors, line 2 the
    // one-line summary, lines 3–4 the download block, line 5 the bulk line.
    return (
      <Box flexDirection="column">
        <Text wrap="truncate-end">
          <Text bold={true}>{entry.title}</Text>
          <Text color="gray">  {entryFieldValue(entry, "authors", mirrorAdapter)}</Text>
        </Text>
        <Text color="gray" wrap="truncate-end">
          {stackedSummary(entry, mirrorAdapter)}
        </Text>
        {renderStackedDownloadRows()}
        {renderBulkLine()}
      </Box>
    );
  }

  // Wide fills the panel's height so the hint row pins to the bottom
  // (spec §3: "pinned to the bottom row"); full is content-sized (M3 decides
  // its frame).
  let rootGrow = 0;
  if (layout === "wide") {
    rootGrow = 1;
  }

  return (
    <Box flexDirection="column" flexGrow={rootGrow}>
      <Text bold={true} wrap="wrap">
        {entry.title}
      </Text>
      <Text color="gray" wrap={valueWrap}>
        {entryFieldValue(entry, "authors", mirrorAdapter)}
      </Text>
      {blankRow()}
      {fieldRows}
      {md5Row}
      {blankRow()}
      {renderDownloadRows()}
      {renderBulkLine()}
      {layout !== "full" && <Box flexGrow={1} />}
      {layout !== "full" && <KeyFooter hints={Label.DETAIL_PANEL_HINTS} width={width} />}
    </Box>
  );
}

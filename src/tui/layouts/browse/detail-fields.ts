import { Label } from "../../../labels";
import { DownloadStatus } from "../../../download-statuses";
import type { Entry } from "../../../api/models/entry";

// Structural slice of the mirror adapter the field rendering needs; the real
// Adapter satisfies this.
export interface DetailFieldsAdapter {
  isHiddenField(fieldName: string): boolean;
  getEntryMD5(entry: Entry): string | undefined;
  formatField(fieldName: string, value: string): string;
}

// Aligned key/value rows (spec §3): Publisher, Year, Pages, Language, Format,
// Size, MD5. The raw mirror URL is never shown; MD5 comes from the adapter.
export const DETAIL_FIELDS = [
  { key: "publisher", label: Label.DETAIL_FIELD_PUBLISHER },
  { key: "year", label: Label.DETAIL_FIELD_YEAR },
  { key: "pages", label: Label.DETAIL_FIELD_PAGES },
  { key: "language", label: Label.DETAIL_FIELD_LANGUAGE },
  { key: "extension", label: Label.DETAIL_FIELD_FORMAT },
  { key: "size", label: Label.DETAIL_FIELD_SIZE },
];

export const FIELD_LABEL_WIDTH = Math.max(
  ...DETAIL_FIELDS.map((field) => field.label.length),
  Label.DETAIL_FIELD_MD5.length
);

// Words for the one-line download status (spec §3: "For queued, failed or
// done items, show one status line instead"). DOWNLOADING renders as the bar
// block instead, so it has no word.
export const STATUS_WORDS: Record<DownloadStatus, string> = {
  [DownloadStatus.IDLE]: "",
  [DownloadStatus.IN_QUEUE]: Label.DETAIL_STATUS_QUEUED,
  [DownloadStatus.PROCESSING]: Label.DETAIL_STATUS_PROCESSING,
  [DownloadStatus.DOWNLOADING]: "",
  [DownloadStatus.DOWNLOADED]: Label.DETAIL_STATUS_DONE,
  [DownloadStatus.FAILED]: Label.DETAIL_STATUS_FAILED,
  [DownloadStatus.CONNECTING_TO_LIBGEN]: Label.DETAIL_STATUS_CONNECTING,
  [DownloadStatus.FETCHING_MD5]: Label.DETAIL_STATUS_FETCHING,
  [DownloadStatus.WAITING_FOR_LIBGEN]: Label.DETAIL_STATUS_WAITING,
};

// One field's display value: formatted through the adapter like today's
// layouts/detail does, `—` when missing (spec §8.4).
export const entryFieldValue = (
  entry: Entry,
  key: string,
  mirrorAdapter: DetailFieldsAdapter | undefined
): string => {
  const record = entry as unknown as Record<string, string>;
  const raw = record[key] ?? "";
  if (raw.trim().length === 0) {
    return Label.DETAIL_MISSING_VALUE;
  }
  const formatted = mirrorAdapter?.formatField(key, raw) || raw;
  if (formatted.trim().length === 0) {
    return Label.DETAIL_MISSING_VALUE;
  }
  return formatted;
};

// MD5 shortened to first 8 + `…` + last 4 (spec §3).
export const shortMD5 = (md5: string | undefined): string => {
  if (!md5) {
    return Label.DETAIL_MISSING_VALUE;
  }
  return `${md5.slice(0, 8)}…${md5.slice(-4)}`;
};

// Stacked line 2 (spec §3): `publisher · year · pages pp · language · ext ·
// size`.
export const stackedSummary = (
  entry: Entry,
  mirrorAdapter: DetailFieldsAdapter | undefined
): string => {
  const record = entry as unknown as Record<string, string>;
  let pagesPart = Label.DETAIL_MISSING_VALUE;
  if (record.pages && record.pages.trim().length > 0) {
    pagesPart = `${record.pages.trim()} ${Label.DETAIL_PAGES_SUFFIX}`;
  }
  const parts = [
    entryFieldValue(entry, "publisher", mirrorAdapter),
    entryFieldValue(entry, "year", mirrorAdapter),
    pagesPart,
    entryFieldValue(entry, "language", mirrorAdapter),
    entryFieldValue(entry, "extension", mirrorAdapter),
    entryFieldValue(entry, "size", mirrorAdapter),
  ];
  return parts.join(` ${Label.DETAIL_FIELD_SEPARATOR} `);
};

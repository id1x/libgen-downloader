// Mock harness (spec §8.1): renders the real <App> with faked store actions,
// no network access. Run it from an empty directory so MD5 list files do not
// land in the repo:
//
//   cd "$(mktemp -d)"
//   bun --preload <repo>/dev/harness/preload.ts <repo>/dev/harness/run.tsx
//
// MODE env switches scenarios: normal, slow, nextfail, bulkfail, freeze,
// failover, outage, error.

import { render } from "ink";

import { App } from "../../src/tui/app";
import { useBoundStore } from "../../src/tui/store";
import type { TCombinedStore } from "../../src/tui/store";
import { getAdapter } from "../../src/api/adapters";
import type { Entry } from "../../src/api/models/entry";
import type { Mirror } from "../../src/api/data/types";
import type { SearchResult } from "../../src/api/search/types";
import type { RecoveringDownloadService } from "../../src/api/download/recovering-download-service";
import type { DownloadCallbacks, DownloadOutcome, SourceFailure } from "../../src/api/download/types";
import { SEARCH_PAGE_SIZE } from "../../src/settings";

type Mode =
  | "normal"
  | "slow"
  | "nextfail"
  | "bulkfail"
  | "freeze"
  | "failover"
  | "outage"
  | "error";

const MODE = (process.env.MODE ?? "normal") as Mode;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const never = () => new Promise<never>(() => {});

// --- fake data --------------------------------------------------------------

const fakeMD5 = (page: number, index: number): string => {
  const n = (page - 1) * SEARCH_PAGE_SIZE + index;
  // Every 7th entry (n = 1, 8, 15, ...) gets an MD5 starting with "11" so
  // MODE=bulkfail has deterministic failures among the first visible rows.
  const head = n % 7 === 1 ? "11" : n.toString(16).padStart(2, "0");
  return `${head}${n.toString(16).padStart(6, "0")}`.padEnd(32, "0").slice(0, 32);
};

const EXTENSIONS = ["pdf", "epub", "mobi", "djvu"];

const fakeEntry = (page: number, index: number): Entry => {
  const n = (page - 1) * SEARCH_PAGE_SIZE + index;
  return {
    id: `fake-entry-${n}`,
    authors: `Author ${index}, Second Author ${index}`,
    title: `Simulated Book Title ${n} for the Master Detail Harness`,
    publisher: `Publisher ${index}`,
    year: String(1990 + (n % 35)),
    pages: String(120 + n * 7),
    language: "English",
    size: `${1 + (n % 30)} MB`,
    extension: EXTENSIONS[n % EXTENSIONS.length],
    mirror: `https://mirror-a.example/ads.php?md5=${fakeMD5(page, index)}`,
  };
};

const fakePage = (page: number): Entry[] =>
  Array.from({ length: SEARCH_PAGE_SIZE }, (_, index) => fakeEntry(page, index));

// --- fake services ----------------------------------------------------------

const FAKE_SEARCH_DELAY_MS = 700;

const fakeSearch = async (_query: string, page: number): Promise<SearchResult> => {
  if (MODE === "slow" || MODE === "failover") {
    // failover hangs so the loading skeleton keeps showing the seeded
    // connectionError + mirrorCheckStates (showResults would clear them).
    await never();
  }

  await sleep(FAKE_SEARCH_DELAY_MS);

  if (MODE === "nextfail" && page > 1) {
    return { status: "error", message: `Simulated next-page failure (MODE=nextfail, page ${page})` };
  }

  if (page >= 1 && page <= 3) {
    return { status: "success", entries: fakePage(page) };
  }

  return { status: "success", entries: [] };
};

const DOWNLOAD_TOTAL = 10 * 1024 * 1024; // 10 MiB, delivered in 10 chunks
const DOWNLOAD_CHUNK_PAUSE_MS = 250;

const simulatedFailure = (md5: string): SourceFailure => ({
  sourceName: "mirror-a.example",
  kind: "unreachable",
  reason: `simulated failure for ${md5.slice(0, 8)} (MODE=bulkfail)`,
});

// Returns a stand-in for RecoveringDownloadService; only `download` is real
// enough for the store flows (iterateQueue + BulkDownloadFlow).
const fakeRecoveringDownloadService = (): RecoveringDownloadService => {
  const download = async (md5: string, callbacks: DownloadCallbacks): Promise<DownloadOutcome> => {
    const filename = `${md5.slice(0, 8)}.pdf`;
    const chunk = Buffer.alloc(DOWNLOAD_TOTAL / 10);

    if (MODE === "bulkfail" && md5.startsWith("11")) {
      await sleep(DOWNLOAD_CHUNK_PAUSE_MS);
      return {
        downloaded: false,
        failures: [simulatedFailure(md5)],
        waitable: false,
      };
    }

    callbacks.onStart(filename, DOWNLOAD_TOTAL);

    // freeze stalls at 40% (4 of 10 chunks) and never resolves, so the
    // download stays DOWNLOADING for quit-prompt captures.
    const chunks = MODE === "freeze" ? 4 : 10;
    for (let index = 0; index < chunks; index++) {
      await sleep(DOWNLOAD_CHUNK_PAUSE_MS);
      callbacks.onData(filename, chunk, DOWNLOAD_TOTAL);
    }

    if (MODE === "freeze") {
      await never();
    }

    return {
      downloaded: true,
      result: { path: filename, filename, total: DOWNLOAD_TOTAL },
      sourceName: "mirror-a.example",
    };
  };

  return { download } as unknown as RecoveringDownloadService;
};

// --- store seeding ----------------------------------------------------------

const fakeMirrors: Mirror[] = [1, 2, 3].map((n) => ({
  src: `https://mirror-${String.fromCharCode(96 + n)}.example`,
  type: "libgen-plus",
}));

const seedStore = () => {
  const patch: Partial<TCombinedStore> = {
    latestVersion: "",
    mirrors: fakeMirrors,
    downloadMirrors: fakeMirrors,
    mirror: fakeMirrors[0],
    mirrorAdapter: getAdapter(fakeMirrors[0].src, fakeMirrors[0].type),
    search: fakeSearch,
    getRecoveringDownloadService: fakeRecoveringDownloadService,
  };

  if (MODE === "failover") {
    patch.connectionError = "Simulated connection error (MODE=failover)";
    patch.mirrorCheckStates = [
      { src: fakeMirrors[1].src, status: "checking" },
      { src: fakeMirrors[2].src, status: "pending" },
    ];
  }

  if (MODE === "outage") {
    const since = Date.now();
    patch.availabilityStatus = {
      state: "waiting",
      outage: { kind: "unreachable", reason: "simulated outage (MODE=outage)" },
      since,
      checks: 2,
      nextCheckAt: since + 45_000,
    };
  }

  if (MODE === "error") {
    patch.errorMessage = "Simulated fatal error (MODE=error)";
  }

  useBoundStore.setState(patch);
};

seedStore();
render(<App doNotFetchConfigInitially={true} />);

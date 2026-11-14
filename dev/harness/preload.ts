// Mock-harness preload (spec §8.1). Stubs `src/index.ts`, which runs
// `operate()` on import; nothing under src/ should import it since
// `src/version.ts` exists, so this is only a safety net.
import { plugin } from "bun";

plugin({
  name: "stub-entry",
  setup(b) {
    // Broadened from the spec's `/libgen-downloader\/src\/index\.ts$/` so the
    // stub also matches sandbox worktrees whose directory is not named
    // "libgen-downloader" (see NOTES.md).
    b.onLoad({ filter: /src\/index\.ts$/ }, () => ({
      contents: 'export const APP_VERSION = "3.4.0";',
      loader: "ts",
    }));
  },
});

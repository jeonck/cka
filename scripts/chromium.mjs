// Resolve a Chromium binary: an explicit override, then any browser Playwright
// already has on this machine, then Playwright's own default (which downloads
// on demand in CI). Keeps the PDF build working both in a sandbox with a
// preinstalled browser and on a clean GitHub Actions runner.
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

export function chromiumExecutable() {
  if (process.env.CHROME_PATH && existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;

  const root = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (root && existsSync(root)) {
    const candidates = readdirSync(root)
      .filter((d) => d.startsWith("chromium-"))
      .sort()
      .reverse()
      .map((d) => join(root, d, "chrome-linux", "chrome"));
    const found = candidates.find(existsSync);
    if (found) return found;
  }
  return undefined; // let Playwright pick its own
}

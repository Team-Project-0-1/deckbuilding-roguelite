import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

const serializeError = (error) =>
  error instanceof Error
    ? { name: error.name, message: error.message, stack: error.stack }
    : { message: String(error) };

const capture = async (label, work, results) => {
  try {
    await work();
    results[label] = "captured";
  } catch (error) {
    results[label] = `failed: ${serializeError(error).message}`;
  }
};

export const capturePlaytestDiagnostics = async ({
  browser,
  baseUrl,
  consoleErrors = [],
  failure,
  page,
  pageErrors = [],
  scriptName,
}) => {
  try {
    const artifactRoot = resolve(
      repositoryRoot,
      process.env.PLAYTEST_ARTIFACTS_DIR ?? "playtest-artifacts",
    );
    const artifactDir = resolve(
      artifactRoot,
      "browser-checks",
      scriptName,
    );
    await mkdir(artifactDir, { recursive: true });

    const results = {};
    let diagnosticContext;
    let diagnosticPage = page?.isClosed() ? undefined : page;

    if (!diagnosticPage && browser?.isConnected() && baseUrl) {
      await capture(
        "fallback-page",
        async () => {
          diagnosticContext = await browser.newContext({
            viewport: { width: 1280, height: 720 },
          });
          diagnosticPage = await diagnosticContext.newPage();
          await diagnosticPage.goto(baseUrl, {
            timeout: 5000,
            waitUntil: "domcontentloaded",
          });
        },
        results,
      );
    }

    if (diagnosticPage) {
      await capture(
        "screenshot",
        () =>
          diagnosticPage.screenshot({
            fullPage: true,
            path: resolve(artifactDir, "failure.png"),
            timeout: 5000,
          }),
        results,
      );
      await capture(
        "dom-snapshot",
        async () =>
          writeFile(resolve(artifactDir, "failure.html"), await diagnosticPage.content()),
        results,
      );
    } else {
      results.page = "unavailable";
    }

    await writeFile(
      resolve(artifactDir, "diagnostics.json"),
      `${JSON.stringify(
        {
          capturedAt: new Date().toISOString(),
          consoleErrors,
          failure: serializeError(failure),
          pageErrors,
          results,
        },
        null,
        2,
      )}\n`,
    );
    await diagnosticContext?.close();
  } catch (error) {
    console.error("playtest diagnostics capture failed", error);
  }
};

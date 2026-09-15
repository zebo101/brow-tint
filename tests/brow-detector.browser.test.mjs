// Run after `pnpm brow:assets`, with Playwright + its browsers installed.
// BROW_PLAYWRIGHT_MODULE can point to a shared Playwright installation.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { build } from 'esbuild';

const require = createRequire(import.meta.url);
const playwright = require(process.env.BROW_PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(import.meta.dirname, '..');
const iosChrome =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/133.0.6943.84 Mobile/15E148 Safari/604.1';
let server;
let origin;

before(async () => {
  const bundle = await build({
    entryPoints: [path.join(root, 'src/shared/lib/brow-mapping/detector.ts')],
    bundle: true,
    write: false,
    format: 'iife',
    globalName: 'BrowDetector',
    platform: 'browser',
  });
  server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/') {
        res.setHeader('Content-Type', 'text/html');
        res.end('<!doctype html><script src="/detector.js"></script>');
        return;
      }
      if (url.pathname === '/detector.js') {
        res.setHeader('Content-Type', 'application/javascript');
        res.end(bundle.outputFiles[0].contents);
        return;
      }
      const file = path.join(root, 'public', url.pathname);
      let bytes = await readFile(file);
      if (
        url.pathname === '/workers/brow-detector.js' &&
        url.searchParams.has('no-offscreen')
      )
        bytes = Buffer.concat([
          Buffer.from('self.OffscreenCanvas = undefined;\n'),
          bytes,
        ]);
      if (
        url.pathname === '/workers/brow-detector.js' &&
        url.searchParams.has('no-webgl')
      )
        bytes = Buffer.concat([
          Buffer.from('OffscreenCanvas.prototype.getContext = () => null;\n'),
          bytes,
        ]);
      res.setHeader(
        'Content-Type',
        file.endsWith('.js')
          ? 'application/javascript'
          : file.endsWith('.wasm')
            ? 'application/wasm'
            : 'application/octet-stream'
      );
      res.end(bytes);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
});

for (const scenario of [
  { name: 'Chromium worker', engine: 'chromium' },
  {
    name: 'iOS Chrome user agent with a capable worker',
    engine: 'chromium',
    userAgent: iosChrome,
  },
  {
    name: 'worker without OffscreenCanvas',
    engine: 'chromium',
    noOffscreen: true,
  },
  { name: 'worker without WebGL', engine: 'chromium', noWebgl: true },
  { name: 'WebKit canvas fallback', engine: 'webkit' },
]) {
  test(
    `real face model detects the public example: ${scenario.name}`,
    { timeout: 60000 },
    async () => {
      const browser = await playwright[scenario.engine].launch({
        headless: true,
      });
      try {
        const page = await browser.newPage({ userAgent: scenario.userAgent });
        if (scenario.noOffscreen || scenario.noWebgl) {
          await page.addInitScript(
            (flag) => {
              const NativeWorker = Worker;
              window.Worker = class extends NativeWorker {
                constructor(url, options) {
                  super(`${url}?${flag}`, options);
                }
              };
            },
            scenario.noOffscreen ? 'no-offscreen' : 'no-webgl'
          );
        }
        await page.goto(origin);
        const result = await page.evaluate(async () => {
          const blob = await (await fetch('/imgs/cases/1.jpg')).blob();
          const stages = [];
          try {
            const faces = await BrowDetector.detectPhoto(
              { blob },
              AbortSignal.timeout(45000),
              (stage) => stages.push(stage)
            );
            return { counts: faces.map((face) => face.length), stages };
          } catch (error) {
            return { error: error.message, stages };
          }
        });
        assert.equal(result.error, undefined, JSON.stringify(result));
        assert.deepEqual(result.counts, [478]);
        assert.ok(result.stages.includes('loading-model'));
        assert.ok(result.stages.includes('detecting'));
      } finally {
        await browser.close();
      }
    }
  );
}

test(
  'aborting fallback initialization discards its result and a fresh analysis succeeds',
  { timeout: 60000 },
  async () => {
    const browser = await playwright.webkit.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.addInitScript(() => {
        const NativeWorker = Worker;
        window.Worker = class extends NativeWorker {
          constructor(url, options) {
            super(`${url}?no-offscreen`, options);
          }
        };
      });
      let releaseModel;
      let modelRequested;
      const modelGate = new Promise((resolve) => {
        releaseModel = resolve;
      });
      const modelStarted = new Promise((resolve) => {
        modelRequested = resolve;
      });
      await page.route(
        '**/face_landmarker.task',
        async (route) => {
          modelRequested();
          await modelGate;
          await route.continue();
        },
        { times: 1 }
      );
      await page.goto(origin);
      await page.evaluate(async () => {
        const blob = await (await fetch('/imgs/cases/1.jpg')).blob();
        window.testPhoto = { blob };
        window.testController = new AbortController();
        window.testStages = [];
        window.testResult = BrowDetector.detectPhoto(
          testPhoto,
          testController.signal,
          (stage) => testStages.push(stage)
        ).then(
          () => ({ resolved: true }),
          (error) => ({ error: error.name })
        );
      });
      await modelStarted;
      await page.evaluate(() => testController.abort());
      assert.deepEqual(await page.evaluate(() => testResult), {
        error: 'AbortError',
      });
      releaseModel();
      const retry = await page.evaluate(async () => {
        const faces = await BrowDetector.detectPhoto(
          testPhoto,
          AbortSignal.timeout(45000),
          () => {}
        );
        return {
          counts: faces.map((face) => face.length),
          previousStages: testStages,
        };
      });
      assert.deepEqual(retry.counts, [478]);
      assert.ok(!retry.previousStages.includes('detecting'));
    } finally {
      await browser.close();
    }
  }
);

test(
  'a model asset failure stays a retryable model error',
  { timeout: 60000 },
  async () => {
    const browser = await playwright.chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.route('**/face_landmarker.task', (route) =>
        route.fulfill({ status: 503, body: 'Unavailable' })
      );
      await page.goto(origin);
      const message = await page.evaluate(async () => {
        const blob = await (await fetch('/imgs/cases/1.jpg')).blob();
        try {
          await BrowDetector.detectPhoto(
            { blob },
            AbortSignal.timeout(45000),
            () => {}
          );
          return 'unexpected success';
        } catch (error) {
          return error.message;
        }
      });
      assert.equal(message, 'model-error');
    } finally {
      await browser.close();
    }
  }
);

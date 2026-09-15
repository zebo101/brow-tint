// Isolated desktop browser check; no real Google account or public mobile UI.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { build } = require(process.env.ESBUILD_MODULE || 'esbuild');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = fileURLToPath(new URL('../', import.meta.url));
const bundle = await build({
  absWorkingDir: root,
  stdin: {
    contents: `import React from 'react';
      import {createRoot} from 'react-dom/client';
      import {Modal} from '@heroui/react/modal';
      import {AppContextProvider,useAppContext} from '@/shared/contexts/app';
      function App(){
        const {showOneTap}=useAppContext();
        return <Modal.Backdrop isOpen isDismissable={false}>
          <Modal.Container><Modal.Dialog aria-label="Editor">
            <button onClick={()=>void showOneTap({google_client_id:'test-client',google_one_tap_enabled:'true'}).then(()=>{window.oneTapSettled=true})}>Late One Tap</button>
          </Modal.Dialog></Modal.Container>
        </Modal.Backdrop>;
      }
      createRoot(document.getElementById('root')).render(<AppContextProvider><App/></AppContextProvider>);`,
    resolveDir: root,
    loader: 'tsx',
  },
  bundle: true,
  write: false,
  format: 'iife',
  jsx: 'automatic',
  define: {
    'process.env.NODE_ENV': '"production"',
    'process.env.NEXT_PUBLIC_AUTH_GET_SESSION_MIN_INTERVAL_MS': '"2000"',
  },
  plugins: [
    {
      name: 'test-boundaries',
      setup(build) {
        build.onResolve({ filter: /^@\/config$/ }, () => ({
          path: 'config',
          namespace: 'test',
        }));
        build.onResolve({ filter: /^\.\/brow-purchase$/ }, () => ({
          path: 'purchase',
          namespace: 'test',
        }));
        build.onLoad({ filter: /.*/, namespace: 'test' }, (args) => ({
          contents:
            args.path === 'config'
              ? 'export const envConfigs={auth_url:window.location.origin};'
              : 'export const BrowPurchaseProvider=({children})=>children;',
          loader: 'js',
          resolveDir: root,
        }));
      },
    },
  ],
  logLevel: 'silent',
});
const server = createServer((req, res) => {
  res.setHeader(
    'Content-Type',
    req.url === '/app.js' ? 'text/javascript' : 'text/html'
  );
  res.end(
    req.url === '/app.js'
      ? bundle.outputFiles[0].contents
      : `<!doctype html><style>
    [data-slot=modal-backdrop]{position:fixed;inset:0;z-index:50;background:#ddd}
    button{padding:20px}iframe{position:fixed;bottom:0;left:0;width:400px;height:100px;z-index:1000;background:white}
    </style><div id="root"></div><script src="/app.js"></script>`
  );
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  page.setDefaultTimeout(5000);
  page.on('pageerror', (error) => console.error(error.message));
  await page.addInitScript(() => {
    // The host can itself have a touch screen; make this desktop case explicit.
    Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 0 });
    window.googleScriptInitialized = true;
    window.google = {
      accounts: {
        id: {
          initialize(options) {
            window.oneTapOptions = options;
          },
          prompt() {
            // Google may finish loading after the user has opened the editor.
            setTimeout(() => {
              const iframe = document.createElement('iframe');
              iframe.id = 'fake-google';
              iframe.title = 'Google One Tap';
              iframe.srcdoc =
                "<button onclick=\"parent.postMessage('one-tap-continue','*')\">Continue</button>";
              const parent =
                document.getElementById(
                  window.oneTapOptions.prompt_parent_id
                ) || document.body;
              parent.append(iframe);
            }, 20);
          },
        },
      },
    };
    window.addEventListener('message', (event) => {
      if (event.data === 'one-tap-continue') window.oneTapClicked = true;
    });
  });
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.getByRole('button', { name: 'Late One Tap' }).click();
  await page.locator('#fake-google').waitFor();
  await page
    .frameLocator('#fake-google')
    .getByRole('button', { name: 'Continue' })
    .click();
  assert.equal(
    await page.evaluate(() => window.oneTapClicked),
    true,
    'Delayed Google iframe remains clickable over the editor'
  );
  assert.equal(
    await page.locator('#fake-google').evaluate((n) => !!n.closest('[inert]')),
    false
  );
  assert.equal(
    await page.evaluate(() => window.oneTapOptions.cancel_on_tap_outside),
    true
  );
  console.log('PASS: late Google One Tap receives clicks over an open editor');
  for (const capability of ['touch', 'coarse']) {
    const touchPage = await browser.newPage();
    touchPage.setDefaultTimeout(5000);
    await touchPage.addInitScript((capability) => {
      Object.defineProperty(navigator, 'maxTouchPoints', {
        get: () => (capability === 'touch' ? 1 : 0),
      });
      const originalMatchMedia = window.matchMedia.bind(window);
      window.matchMedia = (query) => {
        const result = originalMatchMedia(query);
        if (query === '(any-pointer: coarse)') {
          Object.defineProperty(result, 'matches', {
            value: capability === 'coarse',
          });
        }
        return result;
      };
      window.googleScriptInitialized = true;
      window.google = {
        accounts: {
          id: {
            initialize() {
              window.unexpectedOneTap = true;
            },
            prompt() {
              window.unexpectedOneTap = true;
            },
          },
        },
      };
    }, capability);
    await touchPage.goto(`http://127.0.0.1:${server.address().port}`);
    await touchPage.getByRole('button', { name: 'Late One Tap' }).click();
    await touchPage.waitForFunction(() => window.oneTapSettled);
    assert.equal(
      await touchPage.evaluate(() => !!window.unexpectedOneTap),
      false
    );
    assert.equal(
      await touchPage.locator('script[src*="accounts.google.com"]').count(),
      0
    );
    console.log(
      `PASS: ${capability} capability suppresses automatic One Tap before SDK load`
    );
    await touchPage.close();
  }
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

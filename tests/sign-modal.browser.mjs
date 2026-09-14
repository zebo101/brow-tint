// node tests/sign-modal.browser.mjs
// Optional PLAYWRIGHT_MODULE / ESBUILD_MODULE for shared runtime installations.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { build } = require(process.env.ESBUILD_MODULE || 'esbuild');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = fileURLToPath(new URL('../', import.meta.url));
const messages = JSON.parse(
  await readFile(
    new URL('../src/config/locale/messages/zh/common.json', import.meta.url)
  )
);
// Keep the real SignModal, SignInForm, SocialProviders, auth client and overlay
// libraries. Only replace app configuration/navigation and the photo workspace
// contents: the regression is at the boundary between the two modal stacks.
const virtual = {
  '@/shared/contexts/app': `import {createContext,useContext,useState} from 'react';
    const Context=createContext(null);
    export const useAppContext=()=>useContext(Context);
    export function Provider({children}) {
      const [isShowSignModal,setIsShowSignModal]=useState(false);
      return <Context.Provider value={{isShowSignModal,setIsShowSignModal,
        configs:{google_auth_enabled:'true',email_auth_enabled:'true'}}}>{children}</Context.Provider>;
    }`,
  '@/config': `export const envConfigs={auth_url:window.location.origin};`,
  '@/core/i18n/navigation': `import {createElement} from 'react';
    export const useRouter=()=>({push(){},replace(){},refresh(){}});
    export const Link=({href,children,...props})=>createElement('a',{href,...props},children);`,
};
const bundle = await build({
  absWorkingDir: root,
  stdin: {
    contents: `import React,{useState} from 'react';
      import {createRoot} from 'react-dom/client';
      import {NextIntlClientProvider} from 'next-intl';
      import {Modal} from '@heroui/react/modal';
      import {Toaster} from 'sonner';
      import {Provider,useAppContext} from '@/shared/contexts/app';
      import {SignModal} from '@/shared/blocks/sign/sign-modal';
      function App(){
        const {setIsShowSignModal}=useAppContext();
        const [editor,setEditor]=useState(false);
        return <><button onClick={()=>setIsShowSignModal(true)}>Header sign in</button>
          <button onClick={()=>setEditor(true)}>Open editor</button>
          {editor && <Modal.Backdrop isOpen isDismissable={false} onOpenChange={setEditor}>
            <Modal.Container size="full"><Modal.Dialog aria-label="Brow editing canvas">
              <input aria-label="Brow adjustment" defaultValue="112"/>
              <button onClick={()=>setIsShowSignModal(true)}>登录并生成</button>
              <button onClick={()=>setEditor(false)}>Close editor</button>
            </Modal.Dialog></Modal.Container>
          </Modal.Backdrop>}
          <SignModal callbackUrl="/"/><Toaster/></>;
      }
      createRoot(document.getElementById('root')).render(
        <NextIntlClientProvider locale="zh" messages={{common:${JSON.stringify(messages)}}}>
          <Provider><App/></Provider></NextIntlClientProvider>);`,
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
        build.onResolve({ filter: /^@\// }, (args) =>
          virtual[args.path]
            ? { path: args.path, namespace: 'test' }
            : undefined
        );
        build.onLoad({ filter: /.*/, namespace: 'test' }, (args) => ({
          contents: virtual[args.path],
          loader: 'tsx',
          resolveDir: root,
        }));
        if (process.env.SIGN_MODAL_SOURCE)
          build.onLoad({ filter: /sign-modal\.tsx$/ }, async () => ({
            contents: await readFile(process.env.SIGN_MODAL_SOURCE, 'utf8'),
            loader: 'tsx',
            resolveDir: root + 'src/shared/blocks/sign',
          }));
      },
    },
  ],
  logLevel: 'silent',
});
const server = createServer((request, response) => {
  response.setHeader(
    'Content-Type',
    request.url === '/app.js' ? 'text/javascript' : 'text/html'
  );
  response.end(
    request.url === '/app.js'
      ? bundle.outputFiles[0].contents
      : `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>
    body{margin:0;font:16px sans-serif}button,input{padding:12px;margin:6px}
    [data-slot=modal-backdrop],[data-slot=drawer-overlay],[data-slot=dialog-overlay]{position:fixed;inset:0;z-index:50;background:#0006}
    [data-slot=modal-container]{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none}
    [data-slot=modal-container][data-placement=bottom]{align-items:flex-end}
    [data-slot=modal-dialog]{background:white;padding:16px;pointer-events:auto;max-width:425px;max-height:80vh;overflow:auto}
    [data-slot=drawer-content]{position:fixed;bottom:0;left:0;right:0;z-index:50;background:white}
    [data-slot=dialog-content]{position:fixed;top:20%;left:20%;z-index:50;background:white}
    [data-slot=modal-body]{display:block} [data-slot=modal-close-trigger]{float:right}
    </style><div id="root"></div><script src="/app.js"></script>`
  );
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
try {
  for (const width of [390, 1280]) {
    const page = await browser.newPage({
      viewport: { width, height: 844 },
      hasTouch: true,
      isMobile: width < 768,
    });
    page.on('pageerror', (error) => console.error(error.message));
    page.setDefaultTimeout(4000);
    let requests = 0;
    await page.route('**/api/auth/sign-in/social', (route) => {
      requests++;
      const body = route.request().postDataJSON();
      assert.equal(body.provider, 'google');
      assert.equal(body.callbackURL, '/zh/');
      return route.fulfill({
        status: 400,
        json: { message: 'OAuth intercepted by regression test' },
      });
    });
    await page.goto(origin);
    await page.getByRole('button', { name: 'Open editor', exact: true }).tap();
    await page.getByRole('textbox', { name: 'Brow adjustment' }).fill('119');
    const open = () =>
      page.getByRole('button', { name: '登录并生成', exact: true }).tap();
    const google = page.getByRole('button', {
      name: '使用 Google 登录',
      exact: true,
      includeHidden: true,
    });
    const close = () =>
      page
        .getByRole('button', {
          name: width < 768 ? '取消' : '关闭',
          exact: true,
          includeHidden: true,
        })
        .and(page.locator('[data-slot]'))
        .tap();
    await open();
    await google.waitFor();
    assert.equal(
      await google.evaluate((n) => !!n.closest('[inert]')),
      false,
      'Login must not be made inert by the editor'
    );
    // Focus must reach the top dialog and remain there when tabbing.
    await page
      .getByRole('textbox', { name: '邮箱', exact: true })
      .fill('test@example.com');
    await page.keyboard.press('Tab');
    assert.equal(
      await page
        .locator('#password')
        .evaluate((n) => n === document.activeElement),
      true
    );
    await google.tap();
    await page
      .getByText('OAuth intercepted by regression test', { exact: true })
      .waitFor();
    assert.equal(requests, 1, 'Google tap sends one OAuth request');
    await close();
    await google.waitFor({ state: 'hidden' });
    assert.equal(
      await page.getByRole('textbox', { name: 'Brow adjustment' }).inputValue(),
      '119'
    );
    await open();
    await close();
    await open();
    await page.keyboard.press('Escape');
    await google.waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: 'Close editor', exact: true }).tap();
    await page
      .getByRole('button', { name: 'Header sign in', exact: true })
      .tap();
    await google.tap();
    assert.equal(requests, 2, 'Header login still works without an editor');
    await close();
    console.log(
      `PASS ${width}px: OAuth, email focus, cancel, retained edits, reopen, Escape, header login`
    );
    await page.close();
  }
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

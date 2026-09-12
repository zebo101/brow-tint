import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

test('preview and comparison text render identically without system fonts', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'brow-fonts-'));
  try {
    mkdirSync(path.join(directory, 'empty'));
    const config = path.join(directory, 'fonts.conf');
    const xmlPath = directory.replaceAll('\\', '/').replaceAll('&', '&amp;');
    writeFileSync(
      config,
      `<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig><dir>${xmlPath}/empty</dir><cachedir>${xmlPath}/cache</cachedir></fontconfig>`
    );
    const render = (env: NodeJS.ProcessEnv) =>
      execFileSync(
        process.execPath,
        ['--import', 'tsx', 'tests/fixtures/brow-export-render.ts'],
        { env, encoding: 'utf8' }
      );
    const normal = render(process.env);
    const withoutFonts = render({
      ...process.env,
      FONTCONFIG_FILE: config,
      FONTCONFIG_PATH: directory,
    });
    assert.deepEqual(
      JSON.parse(withoutFonts),
      JSON.parse(normal),
      'Missing container fonts must not turn preview or comparison labels into tofu'
    );
  } finally {
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(tmpdir()));
    assert.ok(path.basename(directory).startsWith('brow-fonts-'));
    rmSync(directory, { recursive: true, force: true });
  }
});

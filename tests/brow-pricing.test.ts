import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const expected = [
  ['free-monthly', 0, 4, 'month', 0],
  ['basic-monthly', 1290, 100, 'month', 30],
  ['premium-monthly', 2490, 300, 'month', 30],
  ['basic-yearly', 15900, 2400, 'year', 365],
  ['premium-yearly', 23900, 3600, 'year', 365],
  ['topup-24', 599, 24, 'one-time', 0],
  ['topup-60', 1199, 60, 'one-time', 0],
  ['topup-120', 1999, 120, 'one-time', 0],
];

for (const locale of ['en', 'zh', 'ko', 'ja', 'de', 'es', 'it', 'pt']) {
  test(`${locale} pricing charges and credit grants match the approved offers`, () => {
    const copy = JSON.parse(
      readFileSync(
        `src/config/locale/messages/${locale}/pages/pricing.json`,
        'utf8'
      )
    );
    assert.deepEqual(
      copy.page.sections.pricing.items.map((item: any) => [
        item.product_id,
        item.amount,
        item.credits,
        item.interval,
        item.valid_days,
      ]),
      expected
    );
  });
}

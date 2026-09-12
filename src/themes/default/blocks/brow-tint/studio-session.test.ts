import assert from 'node:assert/strict';
import test from 'node:test';

import {
  emptyStudioSession,
  studioSessionReducer as reduce,
} from './studio-session';

const file = new File(['photo'], 'portrait.jpg', { type: 'image/jpeg' });
const normalized = {
  url: 'blob:normalized',
  blob: file,
  width: 706,
  height: 941,
};
const confirmed = { photo: normalized, guide: new Blob(['guide']) };
const preview = { photo: normalized, analysis: null, candidate: null };
const accepted = () =>
  reduce(emptyStudioSession, {
    type: 'accept-photo',
    file,
    rawUrl: 'blob:raw',
  });

test('preselection opens no editor; accepted photo keeps it and starts unconfirmed', () => {
  const preselected = reduce(emptyStudioSession, {
    type: 'select-style',
    id: 'chosen',
  });
  assert.equal(preselected.editorOpen, false);
  const uploaded = reduce(preselected, {
    type: 'accept-photo',
    file,
    rawUrl: 'blob:raw',
  });
  assert.equal(uploaded.editorOpen, true);
  assert.equal(uploaded.selectedStyleId, 'chosen');
  assert.equal(uploaded.confirmed, null);
  assert.equal(
    reduce(emptyStudioSession, { type: 'set-open', open: true }).editorOpen,
    false
  );
});

test('closing and reopening retain the same photo, preview and confirmed guide', () => {
  let state = reduce(accepted(), {
    type: 'preview',
    rawUrl: 'blob:raw',
    preview,
  });
  state = reduce(state, { type: 'confirm', value: confirmed });
  state = reduce(state, { type: 'select-style', id: 'chosen' });
  const closed = reduce(state, { type: 'set-open', open: false });
  const reopened = reduce(closed, { type: 'set-open', open: true });
  assert.deepEqual(reopened, state);
  assert.equal(closed.file, state.file);
  assert.equal(closed.preview, preview);
  assert.equal(closed.confirmed, confirmed);
});

test('a preview finishing while closed is kept; stale replaced-photo previews are ignored', () => {
  const closed = reduce(accepted(), { type: 'set-open', open: false });
  const completed = reduce(closed, {
    type: 'preview',
    rawUrl: 'blob:raw',
    preview,
  });
  assert.equal(completed.editorOpen, false);
  assert.equal(completed.preview, preview);
  const replaced = reduce(completed, {
    type: 'accept-photo',
    file,
    rawUrl: 'blob:new',
  });
  assert.equal(
    reduce(replaced, { type: 'preview', rawUrl: 'blob:raw', preview }),
    replaced
  );
});

test('replace preserves style but clears confirmation; remove clears all editing state', () => {
  let state = reduce(accepted(), { type: 'confirm', value: confirmed });
  state = reduce(state, { type: 'select-style', id: 'chosen' });
  const replaced = reduce(state, {
    type: 'accept-photo',
    file,
    rawUrl: 'blob:next',
  });
  assert.equal(replaced.selectedStyleId, 'chosen');
  assert.equal(replaced.confirmed, null);
  assert.equal(replaced.preview, null);
  assert.equal(replaced.editorOpen, true);
  assert.deepEqual(reduce(replaced, { type: 'remove' }), emptyStudioSession);
});

test('adjustments invalidate confirmation without discarding the selected catalog style', () => {
  let state = reduce(accepted(), { type: 'confirm', value: confirmed });
  state = reduce(state, { type: 'select-style', id: 'chosen' });
  const adjusted = reduce(state, { type: 'invalidate' });
  assert.equal(adjusted.confirmed, null);
  assert.equal(adjusted.selectedStyleId, 'chosen');
});

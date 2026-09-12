import type { ConfirmedBrowAnalysis } from '@/shared/blocks/brow/analysis-panel';
import type { BrowPreviewState } from '@/shared/blocks/brow/portrait-preview';

export type StudioSession = {
  file: File | null;
  rawUrl: string | null;
  preview: BrowPreviewState | null;
  confirmed: ConfirmedBrowAnalysis | null;
  selectedStyleId: string | null;
  editorOpen: boolean;
};

export const emptyStudioSession: StudioSession = {
  file: null,
  rawUrl: null,
  preview: null,
  confirmed: null,
  selectedStyleId: null,
  editorOpen: false,
};

export type StudioSessionAction =
  | { type: 'accept-photo'; file: File; rawUrl: string }
  | { type: 'set-open'; open: boolean }
  | { type: 'select-style'; id: string }
  | { type: 'preview'; rawUrl: string; preview: BrowPreviewState }
  | { type: 'confirm'; value: ConfirmedBrowAnalysis }
  | { type: 'invalidate' }
  | { type: 'remove' };

// Visibility never owns the photo or confirmation. Closing an editor must not
// restart detection, discard adjustments, or affect an in-flight generation.
export function studioSessionReducer(
  state: StudioSession,
  action: StudioSessionAction
): StudioSession {
  switch (action.type) {
    case 'accept-photo':
      return {
        ...emptyStudioSession,
        file: action.file,
        rawUrl: action.rawUrl,
        selectedStyleId: state.selectedStyleId,
        editorOpen: true,
      };
    case 'set-open':
      return { ...state, editorOpen: !!state.file && action.open };
    case 'select-style':
      return { ...state, selectedStyleId: action.id };
    case 'preview':
      return action.rawUrl === state.rawUrl
        ? { ...state, preview: action.preview }
        : state;
    case 'confirm':
      return state.file ? { ...state, confirmed: action.value } : state;
    case 'invalidate':
      return state.confirmed ? { ...state, confirmed: null } : state;
    case 'remove':
      return emptyStudioSession;
  }
}

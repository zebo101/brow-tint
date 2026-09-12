'use client';

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';

import {
  buildBrowMappingPayload,
  classifyGenerateResponse,
  generationReducer,
  initialGenerationState,
  isDesignLocked,
  type GenerationAction,
} from './generation-lifecycle';

const POLL_INTERVAL_MS = 5000;
const GENERATION_TIMEOUT_MS = 180_000;
const MAX_QUERY_ERRORS = 3;

class KnownSubmitError extends Error {}

function extractResultUrls(raw: string | null | undefined): string[] {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    let resultJson = parsed?.data?.resultJson ?? parsed?.resultJson;
    if (typeof resultJson === 'string') {
      try {
        resultJson = JSON.parse(resultJson);
      } catch {
        resultJson = null;
      }
    }
    if (Array.isArray(resultJson?.resultUrls)) {
      const urls = resultJson.resultUrls.filter(
        (url: unknown): url is string =>
          typeof url === 'string' && url.length > 0
      );
      if (urls.length > 0) return urls;
    }

    const output =
      parsed?.output ?? parsed?.images ?? parsed?.data ?? parsed?.image;
    if (typeof output === 'string') return [output];
    if (Array.isArray(output)) {
      return output
        .map((item: unknown) => {
          if (typeof item === 'string') return item;
          if (!item || typeof item !== 'object') return null;
          const value = item as Record<string, unknown>;
          return (
            value.url ??
            value.uri ??
            value.src ??
            value.image ??
            value.imageUrl ??
            null
          );
        })
        .filter((url): url is string => typeof url === 'string');
    }
    if (output && typeof output === 'object') {
      const value = output as Record<string, unknown>;
      const url =
        value.url ?? value.uri ?? value.src ?? value.image ?? value.imageUrl;
      if (typeof url === 'string') return [url];
    }
  } catch {
    return [];
  }
  return [];
}

async function uploadImage(blob: Blob, filename: string): Promise<string> {
  const formData = new FormData();
  formData.append('files', blob, filename);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90_000);
  try {
    const response = await fetch('/api/storage/upload-image', {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(
        `Upload failed (HTTP ${response.status})${detail ? `: ${detail}` : ''}`
      );
    }
    const payload = await response.json();
    const url =
      payload?.data?.urls?.[0] ?? payload?.data?.url ?? payload?.data?.src;
    if (typeof url !== 'string' || !url) {
      throw new Error('Upload returned no image URL.');
    }
    return url;
  } finally {
    clearTimeout(timeout);
  }
}

interface StartGenerationInput {
  styleId: string;
  styleSlug: string;
  photo: Blob;
  guide: Blob;
  preserveBrowShape: boolean;
}

interface UseBrowGenerationOptions {
  onCreditsChanged: () => void;
  translateServerError: (code: string) => string;
}

export function useBrowGeneration({
  onCreditsChanged,
  translateServerError,
}: UseBrowGenerationOptions) {
  const [state, reactDispatch] = useReducer(
    generationReducer,
    initialGenerationState
  );
  const [resultStyleSlug, setResultStyleSlug] = useState<string | null>(null);
  const stateRef = useRef(state);
  const runRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queryErrorsRef = useRef(0);
  const mountedRef = useRef(true);
  const inFlightRef = useRef(false);
  // Keep the same source URL across styles so the server can verify one-photo comparisons.
  const uploadedPhotos = useRef(new WeakMap<Blob, Promise<string>>());

  const send = useCallback((action: GenerationAction) => {
    stateRef.current = generationReducer(stateRef.current, action);
    reactDispatch(action);
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const pauseQuery = useCallback(
    (message: string) => {
      clearTimer();
      send({ type: 'query-interrupted', message });
      onCreditsChanged();
    },
    [clearTimer, onCreditsChanged, send]
  );

  const beginQuery = useCallback(
    (taskId: string) => {
      clearTimer();
      const run = ++runRef.current;
      const deadline = Date.now() + GENERATION_TIMEOUT_MS;
      queryErrorsRef.current = 0;

      const query = async () => {
        if (!mountedRef.current || runRef.current !== run) return;
        if (Date.now() >= deadline) {
          pauseQuery('Generation is still pending. Check this task again.');
          return;
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20_000);
        try {
          const response = await fetch('/api/ai/query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ taskId }),
            signal: controller.signal,
          });
          if (!response.ok) {
            throw new Error(`Query failed with status ${response.status}`);
          }
          const { code, message, data: task } = await response.json();
          if (code !== 0 || !task) {
            throw new Error(message || 'Query task failed');
          }
          if (!mountedRef.current || runRef.current !== run) return;

          queryErrorsRef.current = 0;
          if (task.status === 'success') {
            const urls = [
              ...extractResultUrls(task.taskInfo),
              ...extractResultUrls(task.taskResult),
            ];
            clearTimer();
            inFlightRef.current = false;
            if (urls[0]) {
              send({ type: 'task-succeeded', resultUrl: urls[0] });
            } else {
              send({
                type: 'task-failed',
                message: 'The provider returned no result image.',
              });
            }
            onCreditsChanged();
            return;
          }
          if (task.status === 'failed') {
            clearTimer();
            inFlightRef.current = false;
            send({
              type: 'task-failed',
              message: task.errorMessage || 'Generation failed.',
            });
            onCreditsChanged();
            return;
          }
        } catch (error) {
          if (!mountedRef.current || runRef.current !== run) return;
          queryErrorsRef.current += 1;
          if (queryErrorsRef.current >= MAX_QUERY_ERRORS) {
            pauseQuery(
              error instanceof Error
                ? error.message
                : 'Generation status could not be checked.'
            );
            return;
          }
        } finally {
          clearTimeout(timeout);
        }

        timerRef.current = setTimeout(query, POLL_INTERVAL_MS);
      };

      void query();
    },
    [clearTimer, onCreditsChanged, pauseQuery, send]
  );

  const start = useCallback(
    async ({
      styleId,
      styleSlug,
      photo,
      guide,
      preserveBrowShape,
    }: StartGenerationInput) => {
      if (inFlightRef.current || isDesignLocked(stateRef.current)) return;
      inFlightRef.current = true;
      setResultStyleSlug(null);
      send({ type: 'upload-started' });

      let originalUrl: string;
      let guideUrl: string;
      try {
        let uploadedPhoto = uploadedPhotos.current.get(photo);
        if (!uploadedPhoto) {
          uploadedPhoto = uploadImage(photo, 'brow-photo.png');
          uploadedPhotos.current.set(photo, uploadedPhoto);
          void uploadedPhoto.catch(() => uploadedPhotos.current.delete(photo));
        }
        [originalUrl, guideUrl] = await Promise.all([
          uploadedPhoto,
          uploadImage(guide, 'brow-guide.png'),
        ]);
      } catch (error) {
        inFlightRef.current = false;
        if (!mountedRef.current) return;
        send({
          type: 'upload-failed',
          message:
            error instanceof Error ? error.message : 'Image upload failed.',
        });
        return;
      }
      if (!mountedRef.current) {
        inFlightRef.current = false;
        return;
      }

      let requestBody: ReturnType<typeof buildBrowMappingPayload>;
      try {
        requestBody = buildBrowMappingPayload({
          styleId,
          originalUrl,
          guideUrl,
          preserveBrowShape,
        });
      } catch (error) {
        inFlightRef.current = false;
        send({
          type: 'upload-failed',
          message:
            error instanceof Error
              ? error.message
              : 'Generation input is incomplete.',
        });
        return;
      }
      send({ type: 'submit-started' });
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 90_000);
      try {
        const response = await fetch('/api/ai/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => null);
        const outcome = classifyGenerateResponse(response.status, payload);
        if (outcome.kind === 'rejected') {
          throw new KnownSubmitError(translateServerError(outcome.message));
        }
        if (outcome.kind === 'ambiguous') {
          throw new Error(outcome.message);
        }
        if (!mountedRef.current) return;
        setResultStyleSlug(styleSlug);
        send({ type: 'task-accepted', taskId: outcome.taskId });
        beginQuery(outcome.taskId);
      } catch (error) {
        if (!mountedRef.current) return;
        const message =
          error instanceof Error ? error.message : 'Generation request failed.';
        if (error instanceof KnownSubmitError) {
          inFlightRef.current = false;
          send({ type: 'submit-failed', message });
        } else {
          send({ type: 'submit-ambiguous', message });
        }
      } finally {
        clearTimeout(timeout);
      }
    },
    [beginQuery, send, translateServerError]
  );

  const retryQuery = useCallback(() => {
    const taskId = stateRef.current.taskId;
    if (stateRef.current.phase !== 'query-paused' || !taskId) return;
    send({ type: 'query-retried' });
    beginQuery(taskId);
  }, [beginQuery, send]);

  const reset = useCallback(() => {
    if (isDesignLocked(stateRef.current)) return;
    runRef.current += 1;
    clearTimer();
    inFlightRef.current = false;
    setResultStyleSlug(null);
    send({ type: 'reset' });
  }, [clearTimer, send]);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      runRef.current += 1;
      clearTimer();
    };
  }, [clearTimer]);

  return {
    state,
    resultStyleSlug,
    isLocked: isDesignLocked(state),
    start,
    retryQuery,
    reset,
  };
}

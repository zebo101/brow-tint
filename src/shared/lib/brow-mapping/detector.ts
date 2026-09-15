import type { BrowAnalysis, BrowCandidate, Landmark } from './types';

export type BrowPhoto = {
  blob: Blob;
  url: string;
  width: number;
  height: number;
};
export type DetectionStage = 'loading-model' | 'detecting';

export async function normalizePhoto(file: File): Promise<BrowPhoto> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    throw new Error('file-type');
  if (file.size > 15 * 1024 * 1024) throw new Error('file-size');
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('decode');
  }
  try {
    if (bitmap.width < 256 || bitmap.height < 256)
      throw new Error('small-image');
    const ratio = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * ratio);
    canvas.height = Math.round(bitmap.height * ratio);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('browser');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await canvasBlob(canvas);
    return {
      blob,
      url: URL.createObjectURL(blob),
      width: canvas.width,
      height: canvas.height,
    };
  } finally {
    bitmap.close();
  }
}

export async function detectPhoto(
  photo: BrowPhoto,
  signal: AbortSignal,
  onStage: (stage: DetectionStage) => void
): Promise<Landmark[][]> {
  try {
    return await detectInWorker(photo, signal, onStage);
  } catch (error) {
    if (!(error instanceof Error) || error.message !== 'worker-unsupported')
      throw error;
    return detectOnPage(photo, signal, onStage);
  }
}

// Each worker analysis owns its WASM memory, released immediately on abort.
async function detectInWorker(
  photo: BrowPhoto,
  signal: AbortSignal,
  onStage: (stage: DetectionStage) => void
): Promise<Landmark[][]> {
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
  const bitmap = await createImageBitmap(photo.blob);
  if (signal.aborted) {
    bitmap.close();
    throw new DOMException('Aborted', 'AbortError');
  }
  return new Promise((resolve, reject) => {
    let worker: Worker;
    try {
      // The CDN caches this public script for hours. Use a new URL for this
      // compatibility fix so returning visitors do not reuse the broken worker.
      worker = new Worker('/workers/brow-detector.js?v=20260915-canvas');
    } catch {
      bitmap.close();
      reject(new Error('browser'));
      return;
    }
    const finish = (error?: Error, faces?: Landmark[][]) => {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      worker.terminate();
      if (error) reject(error);
      else resolve(faces ?? []);
    };
    const abort = () => finish(new DOMException('Aborted', 'AbortError'));
    const timer = setTimeout(() => finish(new Error('model-timeout')), 90000);
    signal.addEventListener('abort', abort, { once: true });
    worker.onerror = () => finish(new Error('model-error'));
    worker.onmessage = (
      event: MessageEvent<{
        stage?: DetectionStage;
        faces?: Landmark[][];
        error?: string;
      }>
    ) => {
      if (event.data.stage) onStage(event.data.stage);
      else if (event.data.error) finish(new Error(event.data.error));
      else if (event.data.faces) finish(undefined, event.data.faces);
    };
    worker.postMessage({ id: 1, bitmap }, [bitmap]);
  });
}

// Some WebKit versions cannot render WebGL in a worker. Keep processing local
// and use an explicit DOM canvas, rather than the SDK's user-agent heuristic.
function detectOnPage(
  photo: BrowPhoto,
  signal: AbortSignal,
  onStage: (stage: DetectionStage) => void
): Promise<Landmark[][]> {
  if (signal.aborted)
    return Promise.reject(new DOMException('Aborted', 'AbortError'));
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error?: Error, faces?: Landmark[][]) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      if (error) reject(error);
      else resolve(faces ?? []);
    };
    const abort = () => finish(new DOMException('Aborted', 'AbortError'));
    const timer = setTimeout(() => finish(new Error('model-timeout')), 90000);
    signal.addEventListener('abort', abort, { once: true });
    void (async () => {
      let detector:
        | import('@mediapipe/tasks-vision').FaceLandmarker
        | undefined;
      let bitmap: ImageBitmap | undefined;
      try {
        onStage('loading-model');
        const { FaceLandmarker, FilesetResolver } = await import(
          '@mediapipe/tasks-vision'
        );
        if (settled) return;
        const base = '/models/brow/1.0.1';
        const files = await FilesetResolver.forVisionTasks(`${base}/wasm`);
        if (settled) return;
        detector = await FaceLandmarker.createFromOptions(files, {
          canvas: document.createElement('canvas'),
          baseOptions: {
            modelAssetPath: `${base}/face_landmarker.task`,
            delegate: 'CPU',
          },
          runningMode: 'IMAGE',
          numFaces: 2,
          minFaceDetectionConfidence: 0.6,
          minFacePresenceConfidence: 0.6,
          outputFaceBlendshapes: false,
          outputFacialTransformationMatrixes: false,
        });
        if (settled) return;
        bitmap = await createImageBitmap(photo.blob);
        if (settled) return;
        onStage('detecting');
        finish(undefined, detector.detect(bitmap).faceLandmarks);
      } catch {
        finish(new Error('model-error'));
      } finally {
        bitmap?.close();
        detector?.close();
      }
    })();
  });
}

function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('export'))),
      'image/png'
    )
  );
}

export async function exportBrowPhoto(
  photo: BrowPhoto,
  analysis: BrowAnalysis,
  candidate: BrowCandidate,
  includeGuides: boolean
): Promise<Blob> {
  const bitmap = await createImageBitmap(photo.blob);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = photo.width;
    canvas.height = photo.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('browser');
    ctx.drawImage(bitmap, 0, 0);
    ctx.strokeStyle = 'rgba(255,255,255,0.86)';
    ctx.lineWidth = Math.max(1, photo.width / 650);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = 'rgba(0,0,0,.25)';
    ctx.shadowBlur = 2;
    if (includeGuides)
      for (const guide of analysis.guides) {
        ctx.beginPath();
        ctx.moveTo(guide.from.x, guide.from.y);
        ctx.lineTo(guide.to.x, guide.to.y);
        ctx.stroke();
      }
    ctx.strokeStyle = 'white';
    ctx.lineWidth = Math.max(2, photo.width / 420);
    for (const brow of candidate.brows) ctx.stroke(new Path2D(brow.path));
    return canvasBlob(canvas);
  } finally {
    bitmap.close();
  }
}

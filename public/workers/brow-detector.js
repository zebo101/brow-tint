/* MediaPipe runs in a classic worker so its WASM loader can use importScripts. */
let detectorPromise;
const base = '/models/brow/1.0.1';
self.onmessage = async (event) => {
  const { id, bitmap } = event.data;
  try {
    if (!detectorPromise) {
      self.postMessage({ id, stage: 'loading-model' });
      detectorPromise = (async () => {
        // The SDK's UA heuristic rejects iOS Chrome even when its worker can
        // render. Supply the canvas explicitly, after checking the capability.
        let canvas;
        try {
          canvas = new OffscreenCanvas(1, 1);
          if (!canvas.getContext('webgl2') && !canvas.getContext('webgl'))
            throw new Error('No worker WebGL');
        } catch {
          throw new Error('worker-unsupported');
        }
        importScripts(`${base}/vision_bundle.js`);
        const files = await Vision.FilesetResolver.forVisionTasks(`${base}/wasm`);
        return Vision.FaceLandmarker.createFromOptions(files, {
          canvas,
          baseOptions: { modelAssetPath: `${base}/face_landmarker.task`, delegate: 'CPU' },
          runningMode: 'IMAGE', numFaces: 2,
          minFaceDetectionConfidence: 0.6, minFacePresenceConfidence: 0.6,
          outputFaceBlendshapes: false, outputFacialTransformationMatrixes: false,
        });
      })();
    }
    const detector = await detectorPromise;
    self.postMessage({ id, stage: 'detecting' });
    const result = detector.detect(bitmap);
    self.postMessage({ id, faces: result.faceLandmarks });
  } catch (error) {
    detectorPromise = undefined;
    self.postMessage({
      id,
      error: error.message === 'worker-unsupported' ? 'worker-unsupported' : 'model-error',
    });
  } finally {
    bitmap.close();
  }
};

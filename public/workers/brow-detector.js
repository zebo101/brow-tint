/* MediaPipe runs in a classic worker so its WASM loader can use importScripts. */
let detectorPromise;
const base = '/models/brow/1.0.1';
self.onmessage = async (event) => {
  const { id, bitmap } = event.data;
  try {
    if (!detectorPromise) {
      self.postMessage({ id, stage: 'loading-model' });
      detectorPromise = (async () => {
        importScripts(`${base}/vision_bundle.js`);
        const files = await Vision.FilesetResolver.forVisionTasks(`${base}/wasm`);
        return Vision.FaceLandmarker.createFromOptions(files, {
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
  } catch {
    detectorPromise = undefined;
    self.postMessage({ id, error: 'model-error' });
  } finally {
    bitmap.close();
  }
};

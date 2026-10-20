self.exports = {};
importScripts('./vendor/vision_bundle.worker.js');
const { FaceDetector, FilesetResolver } = self.exports;

let detector;
self.onmessage = async ({data}) => {
  try {
    if (data.type === 'init') {
      const vision = await FilesetResolver.forVisionTasks(new URL('./vendor/wasm', self.location.href).href);
      detector = await FaceDetector.createFromOptions(vision, {
        baseOptions: { modelAssetPath: new URL('./models/blaze_face_short_range.tflite', self.location.href).href, delegate: 'CPU' },
        runningMode: 'VIDEO', minDetectionConfidence: 0.5, minSuppressionThreshold: 0.3,
      });
      self.postMessage({type:'ready'});
    } else if (data.type === 'frame' && detector) {
      try {
        const result = detector.detectForVideo(data.bitmap, data.timestamp);
        self.postMessage({type:'result', faces: result.detections.map(d => ({
          x:d.boundingBox.originX, y:d.boundingBox.originY, w:d.boundingBox.width, h:d.boundingBox.height,
          score:d.categories[0].score,
        })), width:data.bitmap.width, height:data.bitmap.height});
      } finally { data.bitmap.close(); }
    }
  } catch (error) {
    self.postMessage({type:'error', message:error.message || 'Face detector could not start.'});
  }
};

/* eslint-disable */
// OpenCV inpainting worker
// Loads OpenCV from same-origin static asset to avoid bundling into Worker.

let cvReady = null;

function getCv() {
  if (cvReady) return cvReady;
  cvReady = new Promise((resolve, reject) => {
    try {
      importScripts('/vendor/opencv.js');
      const cv = self.cv;
      if (!cv) {
        reject(new Error('cv not found after importScripts'));
        return;
      }
      if (cv.inpaint) {
        resolve(cv);
        return;
      }
      cv.onRuntimeInitialized = () => resolve(cv);
    } catch (e) {
      reject(e);
    }
  });
  return cvReady;
}

self.onmessage = async (evt) => {
  const msg = evt.data || {};
  const { id, width, height, srcBuffer, maskBuffer, radius = 3 } = msg;

  try {
    const cv = await getCv();

    const src = new Uint8ClampedArray(srcBuffer);
    const maskGray = new Uint8ClampedArray(maskBuffer);

    // src: RGBA ImageData
    const srcImage = new ImageData(src, width, height);
    const srcMat4 = cv.matFromImageData(srcImage); // CV_8UC4

    const srcMat3 = new cv.Mat();
    cv.cvtColor(srcMat4, srcMat3, cv.COLOR_RGBA2RGB, 0);

    // mask: CV_8UC1
    const maskMat = cv.matFromArray(height, width, cv.CV_8UC1, maskGray);

    // dilate mask a bit to reduce edge artifacts
    const kernel = cv.Mat.ones(5, 5, cv.CV_8U);
    cv.dilate(maskMat, maskMat, kernel, new cv.Point(-1, -1), 1);

    const dstMat3 = new cv.Mat();
    cv.inpaint(srcMat3, maskMat, dstMat3, radius, cv.INPAINT_TELEA);

    const dstMat4 = new cv.Mat();
    cv.cvtColor(dstMat3, dstMat4, cv.COLOR_RGB2RGBA, 0);

    // Copy result out
    const out = new Uint8ClampedArray(dstMat4.data);
    const outBuf = out.buffer.slice(0);

    // cleanup
    srcMat4.delete();
    srcMat3.delete();
    maskMat.delete();
    kernel.delete();
    dstMat3.delete();
    dstMat4.delete();

    self.postMessage({ id, ok: true, outBuffer: outBuf }, [outBuf]);
  } catch (e) {
    self.postMessage({ id, ok: false, error: (e && e.message) ? e.message : String(e) });
  }
};

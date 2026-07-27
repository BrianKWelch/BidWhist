export interface OrientationDebug {
  method: string;
  beforeDims?: string;
  afterDims?: string;
  blobSize?: number;
  error?: string;
}

function loadImageElement(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve(img);
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('image failed to load'));
    };
    img.src = url;
  });
}

/**
 * Camera photos often carry an EXIF orientation flag. Decoding through an
 * <img> element (the same path used to render the on-screen preview, which
 * has always displayed upright) and redrawing it onto a canvas bakes the
 * correct orientation into the pixels and strips the EXIF tag -- so
 * whatever reads the resulting blob next (like Tesseract, which reads raw
 * pixel data and does not apply EXIF orientation itself) sees an already
 * upright image.
 */
export async function normalizeImageOrientation(file: File | Blob): Promise<{ blob: Blob; debug: OrientationDebug }> {
  const debug: OrientationDebug = { method: 'img-element-canvas' };
  try {
    const img = await loadImageElement(file);
    debug.beforeDims = `${img.naturalWidth}x${img.naturalHeight}`;

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      debug.error = 'no 2d context';
      return { blob: file, debug };
    }
    ctx.drawImage(img, 0, 0);
    debug.afterDims = `${canvas.width}x${canvas.height}`;

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
    if (!blob || blob.size === 0) {
      debug.error = `toBlob produced ${blob ? 'an empty blob' : 'null'}`;
      return { blob: file, debug };
    }
    debug.blobSize = blob.size;
    return { blob, debug };
  } catch (err) {
    debug.error = err instanceof Error ? err.message : String(err);
    return { blob: file, debug };
  }
}

/**
 * Camera photos often carry an EXIF orientation flag. <img> tags apply it
 * automatically when rendering, but Tesseract.js reads the raw pixel data
 * and ignores it -- so a photo that displays upright can still get OCR'd
 * sideways. Re-rendering through createImageBitmap (which honors EXIF
 * orientation) and a canvas produces pixels that match what's on screen.
 */
export async function normalizeImageOrientation(file: File | Blob): Promise<Blob> {
  if (typeof createImageBitmap !== 'function') return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
    return blob || file;
  } catch {
    return file;
  }
}

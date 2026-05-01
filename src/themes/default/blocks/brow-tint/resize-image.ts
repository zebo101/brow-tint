'use client';

interface ResizeOpts {
  maxEdge?: number;   // longest side after resize, default 1600
  quality?: number;   // jpeg quality 0..1, default 0.85
  maxBytes?: number;  // skip resize if file is already smaller, default 1_500_000
}

/**
 * Resize a user-picked image to a max longest-edge before upload, re-encoding
 * as JPEG. Returns the original `file` unchanged if the browser lacks
 * OffscreenCanvas / createImageBitmap (Safari iOS ≤16), if the file is already
 * small enough, if it's a GIF (animation would be lost), or if anything throws
 * during decode/encode. Never rejects — always returns a usable File.
 */
export async function resizeImageForUpload(
  file: File,
  opts: ResizeOpts = {}
): Promise<File> {
  const maxEdge = opts.maxEdge ?? 1600;
  const quality = opts.quality ?? 0.85;
  const maxBytes = opts.maxBytes ?? 1_500_000;

  // Skip animations — re-encoding would lose frames.
  if (file.type === 'image/gif') return file;
  // Already small — no point spending CPU on it.
  if (file.size <= maxBytes) return file;
  // Feature-detect — Safari iOS ≤16 doesn't ship OffscreenCanvas.
  if (
    typeof OffscreenCanvas === 'undefined' ||
    typeof createImageBitmap === 'undefined'
  ) {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const longest = Math.max(bitmap.width, bitmap.height);
    const scale = longest > maxEdge ? maxEdge / longest : 1;
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const blob = await canvas.convertToBlob({
      type: 'image/jpeg',
      quality,
    });
    const stem = file.name.replace(/\.[^.]+$/, '') || 'photo';
    return new File([blob], `${stem}.jpg`, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });
  } catch (err) {
    // Decode/encode failure (rare HEIC variants, oversized images, etc.) —
    // fall back to the original so the upload still works.
    console.warn('[upload] resize failed, sending original', err);
    return file;
  }
}

/**
 * Shrinks a photo in the browser before it's uploaded, so the shop stays fast:
 * at most 1200 px on the longest side and, where possible, under ~300 KB.
 */
const MAX_SIDE = 1200;
const TARGET_BYTES = 300 * 1024;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('unreadable')); };
    img.src = url;
  });
}

function encode(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

export async function preparePhoto(file: File): Promise<{ blob: Blob; ext: 'webp' | 'jpg' }> {
  const img = await loadImage(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext('2d')!;
  // Transparent PNGs get the shop's ivory background instead of black.
  ctx.fillStyle = '#fffaf1';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  // Older Safari can't make WebP and quietly returns a PNG instead: use JPEG there.
  const probe = await encode(canvas, 'image/webp', 0.85);
  const type = probe?.type === 'image/webp' ? 'image/webp' : 'image/jpeg';
  let blob = type === 'image/webp' ? probe : await encode(canvas, type, 0.85);
  for (const quality of [0.75, 0.65, 0.55]) {
    if (!blob || blob.size <= TARGET_BYTES) break;
    blob = (await encode(canvas, type, quality)) ?? blob;
  }
  if (!blob) throw new Error('unreadable');
  return { blob, ext: type === 'image/webp' ? 'webp' : 'jpg' };
}

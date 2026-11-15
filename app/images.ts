export const MAX_EMBEDDED_IMAGE_LENGTH = 400_000;
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

export function safeImageSource(value: string | null): string | null {
  const source = value?.trim();
  if (!source) return null;
  if (/^data:/i.test(source)) {
    return source.length <= MAX_EMBEDDED_IMAGE_LENGTH && /^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/]+={0,2}$/i.test(source) ? source : null;
  }
  try {
    const url = new URL(source);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}

const escapeAttribute = (value: string) => value.replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));

export function imageMarkup(source: string, description = ''): string {
  const safeSource = safeImageSource(source);
  if (!safeSource) throw new Error('Use an http/https image URL or upload a PNG, JPG or WebP image.');
  const caption = escapeAttribute(description.trim().slice(0, 500));
  return `<figure><img src="${escapeAttribute(safeSource)}" alt="${caption}" loading="lazy" decoding="async">${caption ? `<figcaption>${caption}</figcaption>` : ''}</figure><p><br></p>`;
}

// Embedded uploads travel with the article when exporting or importing JSON.
export async function prepareArticleImage(file: File): Promise<string> {
  if (!IMAGE_TYPES.has(file.type)) throw new Error('Choose a PNG, JPG or WebP image.');
  if (file.size > 10_000_000) throw new Error('Choose an image smaller than 10 MB.');
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = objectUrl;
    await image.decode();
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context || !image.naturalWidth || !image.naturalHeight) throw new Error('This image could not be read.');
    let scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
    for (let attempt = 0; attempt < 3; attempt++, scale *= 0.75) {
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.85, 0.7, 0.55]) {
        const data = canvas.toDataURL('image/webp', quality);
        if (data.length <= MAX_EMBEDDED_IMAGE_LENGTH) return data;
      }
    }
    throw new Error('This image is too large after compression. Try cropping it first.');
  } catch (error) {
    if (error instanceof Error && error.name !== 'EncodingError') throw error;
    throw new Error('This image could not be read. Choose another PNG, JPG or WebP file.');
  } finally { URL.revokeObjectURL(objectUrl); }
}

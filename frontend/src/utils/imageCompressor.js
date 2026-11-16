/**
 * Resizes and compresses an image file in the browser before upload.
 * Reduces raw 8-15MB mobile photos to ~300-600KB without losing OCR legibility,
 * keeping the payload well under Vercel's 4.5MB function payload limit.
 *
 * @param {File} file - The original image file
 * @param {number} maxDimension - Max width or height in pixels (default: 1800)
 * @param {number} quality - JPEG compression quality 0.0 to 1.0 (default: 0.85)
 * @returns {Promise<File>} - Compressed JPEG File object
 */
export async function compressImageForUpload(file, maxDimension = 1800, quality = 0.85) {
  if (!file || !file.type.startsWith('image/')) {
    return file;
  }

  // If already under 1MB and is standard format, no need to re-encode
  if (file.size <= 1024 * 1024 && (file.type === 'image/jpeg' || file.type === 'image/webp')) {
    return file;
  }

  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      const img = new Image();

      img.onload = () => {
        let { width, height } = img;

        // Scale down proportionally if larger than maxDimension
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }

        // Fill white background in case of transparent PNGs
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file);
              return;
            }

            // Create compressed file keeping base name with .jpg
            const baseName = file.name.replace(/\.[^.]+$/, '');
            const compressedFile = new File([blob], `${baseName}_compressed.jpg`, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });

            resolve(compressedFile);
          },
          'image/jpeg',
          quality
        );
      };

      img.onerror = () => resolve(file);
      img.src = event.target.result;
    };

    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

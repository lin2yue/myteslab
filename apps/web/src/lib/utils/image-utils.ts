/**
 * Image manipulation utilities for wrap generation (Client-side only)
 */

/**
 * Flip an image 180 degrees (upside-down)
 * @param imageDataUrl Base64 data URL of the image
 * @returns Promise<string> Flipped image as base64 data URL
 */
export async function flipImage180(imageDataUrl: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';

        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Failed to get canvas context'));
                return;
            }

            // Flip 180 degrees: translate to center, rotate, translate back
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.rotate(Math.PI); // 180 degrees
            ctx.drawImage(img, -img.width / 2, -img.height / 2);

            resolve(canvas.toDataURL('image/png'));
        };

        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = imageDataUrl;
    });
}

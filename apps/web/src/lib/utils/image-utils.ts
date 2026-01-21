/**
 * Image manipulation utilities for wrap generation (Client-side only)
 */

/**
 * Rotate an image by specified degrees
 * @param imageDataUrl Base64 data URL of the image
 * @param degrees Degrees to rotate (CW)
 * @returns Promise<string> Rotated image as base64 data URL
 */
export async function rotateImage(imageDataUrl: string, degrees: number): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';

        img.onload = () => {
            const canvas = document.createElement('canvas');
            const radian = (degrees * Math.PI) / 180;

            // Calculate new dimensions after rotation
            const is90 = Math.abs(degrees % 180) === 90;
            canvas.width = is90 ? img.height : img.width;
            canvas.height = is90 ? img.width : img.height;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Failed to get canvas context'));
                return;
            }

            // Move to center, rotate, then draw back
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.rotate(radian);
            ctx.drawImage(img, -img.width / 2, -img.height / 2);

            resolve(canvas.toDataURL('image/png'));
        };

        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = imageDataUrl;
    });
}

/**
 * Flip an image 180 degrees (upside-down)
 * Kept for backward compatibility
 */
export async function flipImage180(imageDataUrl: string): Promise<string> {
    return rotateImage(imageDataUrl, 180);
}

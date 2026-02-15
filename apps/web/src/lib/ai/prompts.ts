// Centralized prompts for AI wrap generation
// Reverted to user-verified "Labubu" production prompt structure

const PRIMARY_ELEMENT_PLACEMENT = 'Do not leave rear panels blank. Rear graphics must be reversed (upside-down on the UV map). If using a primary element, place it on side doors/hood and keep the rear license plate area low-detail.';

export function buildWrapPrompt(params: {
  userPrompt: string;
  modelName: string; // Kept for interface compatibility, but not used in this specific prompt format
  outputSize?: { width: number; height: number };
  hasReferences?: boolean;
}): string {
  const { userPrompt, hasReferences = false } = params;
  const cleanPrompt = userPrompt.trim() || 'Create a print-ready automotive wrap texture.';

  const lines = [
    'Draw the pattern on the car 3D model UV map, painting ONLY on the white regions. Do NOT change the white region boundaries.',
  ];

  lines.push(`User prompt: ${cleanPrompt}`);

  if (hasReferences) {
    lines.push('Use the style, theme, and elements from the reference image, but do NOT alter the original region constraints.');
  }

  lines.push('Orientation: Front is at the bottom, Rear is at the top.');
  lines.push('Do not leave rear panels blank. Rear graphics MUST be reversed (upside-down on the UV map). If using a primary element, place it on the side doors or hood, and keep the rear license plate area low-detail.');

  return lines.join('\n');
}


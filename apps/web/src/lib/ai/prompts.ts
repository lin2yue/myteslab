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
    'Create artwork on the car 3D model UV map, painting only the white regions.',
  ];

  lines.push(`User prompt: ${cleanPrompt}`);

  if (hasReferences) {
    lines.push('Use attached reference images for style guidance only; do not transfer composition or subject placement.');
  }

  lines.push('Orientation: front at the bottom, rear at the top.');
  lines.push(PRIMARY_ELEMENT_PLACEMENT);

  return lines.join('\n');
}


// Centralized, versioned prompts for AI wrap generation

export type PromptVersion = 'v1' | 'v2';

const DEFAULT_PROMPT_VERSION: PromptVersion = 'v2';

function normalizeVersion(input?: string): PromptVersion {
  const v = (input || '').trim().toLowerCase();
  if (v === 'v1' || v === 'v2') return v;
  return DEFAULT_PROMPT_VERSION;
}

function isPatternPrompt(userPrompt: string): boolean {
  return /pattern|texture|camo|camouflage|carbon|geometric|stripe|gradient|wave|abstract|seamless|repeat/i.test(userPrompt);
}

const BASE_SYSTEM_PROMPT = `
You are a professional automotive wrap designer.
Create finished wrap artwork for a real vehicle using the provided UV mask.

────────────────────────────────
ABSOLUTE MASK RULES (NON-NEGOTIABLE)
────────────────────────────────
WHITE = paintable surface, BLACK = void.
Only draw inside WHITE. Keep BLACK pure #000000.
No bleed, no shape changes, crisp edges aligned to the mask.
Any content outside WHITE = failure.
`.trim();

const DESIGN_MODE_PROMPT = (isPattern: boolean) => `
────────────────────────────────
DESIGN MODE
────────────────────────────────
${isPattern
    ? `PATTERN: consistent scale, aligned across panels, avoid micro-detail.`
    : `THEMED: include 1 clear hero element on large side panels; add secondary flow elements.`}
`.trim();

const AUTO_WRAP_GUIDELINES = `
────────────────────────────────
WRAP GUIDELINES
────────────────────────────────
Design for 3D vehicle surfaces.
Maintain continuity across adjacent UV islands.
Favor horizontal flow from front to rear.
`.trim();

const STYLE_QUALITY = `
────────────────────────────────
STYLE & QUALITY
────────────────────────────────
Bold, high-contrast, print-ready. Large readable shapes. Sharp edges, no blur.
`.trim();

const REFERENCES = `
────────────────────────────────
REFERENCES
────────────────────────────────
If reference images are provided, use them for style, color palette, mood, or thematic inspiration.
`.trim();

const OUTPUT_REQUIREMENTS = `
────────────────────────────────
OUTPUT
────────────────────────────────
Single image at requested resolution. Background outside mask = #000000.
Orientation: FRONT faces BOTTOM, REAR faces TOP.
`.trim();

const REAR_COVERAGE_V2 = `
────────────────────────────────
REAR COVERAGE & LICENSE PLATE SAFE AREA (IMPORTANT)
────────────────────────────────
- ALL white UV islands must be fully covered; avoid large empty/blank areas.
- Pay special attention to REAR sections (trunk, rear bumper, rear quarter panels).
  Do NOT leave the rear areas plain or unfilled; extend patterns/graphics to the tail.
- The rear LICENSE PLATE recess area must NOT contain faces, eyes, or large focal graphics.
  Keep that area with simple background, texture, or small non-critical pattern elements.
  If using a hero element, keep it on side doors/hood; the rear plate area should stay low-detail.
`.trim();

export function buildWrapPrompt(params: {
  userPrompt: string;
  modelName: string;
  version?: string;
}): string {
  const { userPrompt, modelName, version } = params;
  const promptVersion = normalizeVersion(version);
  const isPattern = isPatternPrompt(userPrompt);

  const sections = [
    BASE_SYSTEM_PROMPT,
    DESIGN_MODE_PROMPT(isPattern),
    AUTO_WRAP_GUIDELINES,
    promptVersion === 'v2' ? REAR_COVERAGE_V2 : '',
    STYLE_QUALITY,
    REFERENCES,
    OUTPUT_REQUIREMENTS,
    `Model: ${modelName}`,
    `User Request: "${userPrompt}"`,
    `Output exactly 1024x768 pixels and respect the UV mask boundaries.`
  ].filter(Boolean);

  return sections.join('\n\n').trim();
}

export function getPromptVersionFromEnv(): PromptVersion {
  return normalizeVersion(process.env.GEMINI_PROMPT_VERSION);
}

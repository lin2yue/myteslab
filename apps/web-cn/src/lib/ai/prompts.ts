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
ABSOLUTE MASK RULES (PIXEL-PERFECT ADHERENCE REQUIRED)
────────────────────────────────
1. The WHITE/LIGHT GRAY areas in the mask are the ONLY paintable surfaces.
2. The BLACK areas are voids and MUST remain pure #000000.
3. Your design MUST be constrained within the WHITE islands. DO NOT ignore the mask.
4. If you place any color, pattern, or logo outside the white areas, the design will fail.
5. Align your artwork exactly to the mask edges. Any offset or "bleed" is a defect.
6. The WHITE islands represent the car's body panels. Fill them completely with your design.
7. Any white space left inside a white island will be interpreted as "unpainted/blank".
────────────────────────────────
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

const OUTPUT_REQUIREMENTS = (width: number, height: number) => `
────────────────────────────────
OUTPUT
────────────────────────────────
Single image at requested resolution. Background outside mask = #000000.
Orientation: FRONT faces BOTTOM, REAR faces TOP.
Output exactly ${width}x${height} pixels and respect the UV mask boundaries.
No white canvas background. Anything outside the mask must be solid black.
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
  outputSize?: { width: number; height: number };
}): string {
  const { userPrompt, modelName, version, outputSize } = params;
  const promptVersion = normalizeVersion(version);
  const isPattern = isPatternPrompt(userPrompt);
  const width = outputSize?.width ?? 1024;
  const height = outputSize?.height ?? 1024;

  const sections = [
    BASE_SYSTEM_PROMPT,
    DESIGN_MODE_PROMPT(isPattern),
    AUTO_WRAP_GUIDELINES,
    promptVersion === 'v2' ? REAR_COVERAGE_V2 : '',
    STYLE_QUALITY,
    REFERENCES,
    OUTPUT_REQUIREMENTS(width, height),
    `Model: ${modelName}`,
    `User Request: "${userPrompt}"`,
  ].filter(Boolean);

  return sections.join('\n\n').trim();
}

export function getPromptVersionFromEnv(): PromptVersion {
  return normalizeVersion(process.env.GEMINI_PROMPT_VERSION);
}

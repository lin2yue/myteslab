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
You are a professional automotive WRAP GRAPHIC designer specializing in Tesla vehicle wraps.
You create finished wrap artwork designed specifically for real vehicles using a UV mask.

The wrap design may be:
- A THEMED graphic wrap with recognizable imagery, OR
- A PATTERNED / TEXTURE-BASED wrap intended as an all-over design

You must decide the appropriate design approach based on the user's request.

────────────────────────────────
ABSOLUTE MASK RULES (NON-NEGOTIABLE)
────────────────────────────────
The input image contains a UV MASK:
- WHITE areas = car body paintable surface
- BLACK areas = void / background

You MUST follow these rules strictly:
- Draw ONLY inside the WHITE areas.
- ALL BLACK areas must remain pure black (#000000).
- Do NOT add gradients, noise, shadows, or artifacts to black areas.
- Do NOT change the shape, position, scale, or orientation of the UV islands.
- Do NOT bleed, spill, or overlap outside the white mask boundaries.
- Edges must be clean, crisp, and perfectly aligned to the mask.

If any content appears outside the white mask, it is considered a FAILURE.
`.trim();

const DESIGN_MODE_PROMPT = (isPattern: boolean) => `
────────────────────────────────
DESIGN MODE SELECTION (IMPORTANT)
────────────────────────────────
${isPattern
    ? `PATTERN MODE:
- Use consistent scale across all UV islands.
- Patterns must align logically across adjacent parts.
- Avoid excessive micro-detail that breaks when wrapped.
- The pattern should feel intentional and vehicle-ready.`
    : `THEMED MODE:
- Include at least ONE large, clearly recognizable HERO element.
- Place hero elements on large UV islands (doors, side panels).
- Use secondary elements to create flow across UV parts.
- Keep the composition readable at full car scale.`}
`.trim();

const AUTO_WRAP_GUIDELINES = `
────────────────────────────────
AUTOMOTIVE WRAP GUIDELINES (APPLY TO BOTH MODES)
────────────────────────────────
- Design for a real 3D vehicle, not a flat poster.
- Favor horizontal flow from front to rear.
- Keep critical details away from sharp edges and panel seams.
- Use safe margins near UV boundaries.
- Ensure continuity across adjacent UV islands (doors, fenders, rear quarters should connect logically).
`.trim();

const STYLE_QUALITY = `
────────────────────────────────
STYLE & QUALITY
────────────────────────────────
- Bold, high-contrast colors suitable for vehicle wraps.
- Clean, professional, print-ready look.
- Large readable shapes preferred over excessive fine noise.
- Sharp edges, no blur, no muddy gradients.
`.trim();

const REFERENCES = `
────────────────────────────────
REFERENCES & INSPIRATION
────────────────────────────────
- If reference images are provided, use them ONLY for style, color palette, mood, or thematic inspiration.
- Do NOT copy exact layouts or copyrighted characters directly.
- Create an original interpretation appropriate for a vehicle wrap.
`.trim();

const OUTPUT_REQUIREMENTS = `
────────────────────────────────
OUTPUT REQUIREMENTS
────────────────────────────────
- Output a SINGLE image at the requested resolution.
- Background outside the mask must be pure black (#000000).
- The design must look correct when wrapped onto a 3D car model.
- ORIENTATION: The car's FRONT (Hood) MUST face the BOTTOM of the image. REAR faces TOP.
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

# 3D Model & Rendering Workflow Standards

> **Status:** Active / Source of Truth
> **Last Updated:** 2026-01-30

This document outlines the standard procedures for managing, optimizing, and rendering 3D car models in the Tesla Studio project. It specifically addresses shadow rendering, file compression, and wheel injection logic.

## 1. Model Preparation (Blender)

When adding or updating car body models (`body.glb`), follow these strict rules to ensure compatibility with the web viewer's shadow and wheel injection systems.

### A. Geometry & Hierachy
- **Remove Floor Planes:** Delete any "Floor", "Ground", "Shadow Plane", or huge environmental meshes in Blender. 
  - *Why?* These interfere with `<model-viewer>`'s built-in dynamic shadow generation, causing rectangular artifacts or "floating" shadows.
- **Keep Wheel Anchors (CRITICAL):** Do **NOT** delete the empty nodes (Empties) used for wheel positioning.
  - **Required Nodes:** `Wheel_LF_Spatial`, `Wheel_RF_Spatial`, `Wheel_LR_Spatial`, `Wheel_RR_Spatial`.
  - *Why?* `ModelViewer.tsx` looks for these exact names to inject the detailed wheel models. If missing, wheels will not load.

### B. Export Settings
- **Format:** glTF Binary (`.glb`)
- **Include:** Selected Objects (or standard scene export)
- **Mesh Data:** Apply modifiers if needed, but keep geometry clean.

## 2. Asset Compression Pipeline

Raw exports from Blender are often too large (5MB+). We use `gltf-pipeline` with specific flags to optimize them for the web (<1MB).

### Standard Compression Command
```bash
npx gltf-pipeline -i input.glb -o output.glb -d --keepUnusedElements
```

### Flags Explanation
- `-d` (Draco Compression): uses Draco geometry compression. Reduce file size by ~80-90%.
- **`--keepUnusedElements` (MANDATORY)**: Prevents the removal of node-only objects (like Wheel Anchors) that don't have mesh data.
  - *Analysis:* Without this flag, `gltf-pipeline` views the wheel spatial nodes as "junk data" and deletes them, causing wheels to disappear in the app.

## 3. Web Rendering Logic (`ModelViewer.tsx`)

### Shadow & Scene Cleaning
We have moved from "aggressive programmatic cleaning" to "safe cleaning" because the source models are now cleaner (Thanks to Step 1).

- **`cleanScene` Logic:**
  - **Safe Mode:** Only removes nodes explicitly named `FLOOR` or `GROUND`.
  - **No Size Heuristics:** We no longer try to guess if a mesh is a floor based on its size (e.g., >6m). This prevents accidental deletion of car parts (like the trunk or frunk).
  - **Shadows:** We rely 100% on `<model-viewer>`'s `shadow-intensity="1"` and `shadow-softness="1"` to generate shadows based on the car's actual geometry.

### Exposure & Environment
- **Consistent Lighting:** Exposure is **fixed** between Day and Night modes (usually `1.0` or `1.2` depending on model config).
- **Reason:** Reducing exposure in night mode caused the car to look muddy. The dark background provides enough contrast naturally.

## 4. Updates Checklist

When updating a model (e.g., `model3-2024-base`):
1. [Blender] Open source file.
2. [Blender] Delete any `Plane` / `Shadow` / `Floor` meshes.
3. [Blender] Verify `Wheel_XX_Spatial` nodes exist under ROOT.
4. [Terminal] Run `npx gltf-pipeline -i exported.glb -o final.glb -d --keepUnusedElements`
5. [Code] Place `final.glb` in `apps/web/public/models/<model-name>/body.glb`.
6. [Preview] Verify wheels appear and shadows are round/dynamic (not rectangular).

## 5. Repository Structure & Source of Truth

To avoid confusion with legacy files or database URLs, we strictly follow this centralized structure:

### A. Asset Locations (Web)
All 3D assets for the web application live in `apps/web/public/models/`.

```
apps/web/public/models/
├── cybertruck/
│   └── body.glb       <-- Compressed Base Model
├── model3-2024-base/
│   └── body.glb       <-- Compressed Base Model
├── ...
└── wheels/            <-- Shared Wheel Library
    ├── induction.glb
    ├── stiletto.glb
    └── ...
```

### B. Configuration Priority
The application determines which model to load based on the following hierarchy, handled in `apps/web/src/lib/api.ts`:

1.  **Primary (Local Config):** `apps/web/src/config/models.ts`
    *   This is the **Master Definition**. It maps slugs (e.g., `model-3-2024-plus`) to local file paths (e.g., `/models/model3-2024-base/body.glb`).
    *   **Action:** When adding a new model, ALWAYS update this file first.
2.  **Fallback (Database):** `Supabase -> wrap_models`
    *   Used for legacy compatibility or metadata (names, sorting).
    *   If `models.ts` has an entry for the slug, the file path there **OVERRULES** the database URL.

### C. Deprecated / Ignored Locations
- `apps/miniprogram/uploads/...`: Legacy storage for the WeChat Mini Program. Do NOT use for the Web App.
- `assets/models/...`: Old monorepo root folder. Deprecated.

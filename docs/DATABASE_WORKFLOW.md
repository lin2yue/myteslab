# Database Management & Environment Workflow

> **Status:** Active
> **Last Updated:** 2026-01-30

To prevent accidental modifications to the production database and ensure feature stability, we enforce a strict **Dual-Environment Strategy**.

## 1. Environment Separation

We maintain two distinct Supabase projects (or ensuring isolation via environment variables).

### A. Environments

| Environment | Purpose | Supabase Project | Config File |
| :--- | :--- | :--- | :--- |
| **Development** | New features, testing, destructive schema changes. | `myteslab-dev` (New) | `.env.development.local` |
| **Production** | Live user data. **Stable & Sacred.** | `myteslab-prod` (Current) | `.env.production.local` |

### B. Configuration (.env)

Next.js automatically loads environment variables based on `NODE_ENV` or specific files.

1.  **Create `.env.development.local`**:
    ```properties
    # Connects to the DEV Project
    NEXT_PUBLIC_SUPABASE_URL=https://<dev-project>.supabase.co
    NEXT_PUBLIC_SUPABASE_ANON_KEY=<dev-anon-key>
    SUPABASE_SERVICE_ROLE_KEY=<dev-service-key>
    ```

2.  **Keep `.env.local`** (or rename to `.env.production.local` for clarity when simulating prod):
    ```properties
    # Connects to the PROD Project
    NEXT_PUBLIC_SUPABASE_URL=https://<prod-project>.supabase.co
    NEXT_PUBLIC_SUPABASE_ANON_KEY=<prod-anon-key>
    ...
    ```

3.  **Running the App**:
    *   `npm run dev`: By default loads `.env.development.local` (if it exists) or falls back to `.env.local`.
    *   **Recommendation**: Explicitly use `.env.local` for your default "Dev" environment if you change the values there to the Dev project.

## 2. Schema Change Protocol (The "Migration" Flow)

Since we do not use Docker for local DB simulation, we followed a **"Code-First"** workflow.

### Step 1: Design in Code
All database changes must first be written/updated in the source of truth file:
`apps/web/database/schema.sql`

*   Do **NOT** just click buttons in the Supabase Dashboard Table Editor to add columns without recording it here.
*   If you modify the DB via Dashboard, **immediately** add the SQL equivalent to `schema.sql`.

### Step 2: Apply to Dev
1.  Connect to the **Development** project.
2.  Execute the changing SQL in the Supabase **SQL Editor**.
3.  Test the features in the local web app pointing to Dev.

### Step 3: Promote to Production
1.  Once the feature is tested and merged to `main` branch.
2.  Go to the **Production** Supabase Dashboard -> SQL Editor.
3.  Execute **ONLY** the new SQL statements (incremental update).
4.  *Advanced:* Use `supabase db diff` (requires CLI) to ensure no drift.

## 3. Data Safety Rules

1.  **Never delete columns** in Production without a maintenance window.
2.  **Backups**: Production database has Point-in-Time Recovery (PITR) enabled (if on Pro) or daily backups.
3.  **API Keys**: Never commit `.env` files to Git.

## 4. Implementation Plan (Immediate Action)

1.  Go to Supabase Dashboard.
2.  Create a new project `myteslab-dev` (Free Tier).
3.  In the Dashboard, go to **SQL Editor** -> **New Query**.
4.  Paste the **entire content** of `apps/web/database/schema.sql`.
5.  Run it. This creates a perfect clone of the schema.
6.  Get API Keys from `myteslab-dev` -> Settings -> API.
7.  Update your local `.env.local` to use these **Dev** keys.
8.  **Result**: Your `npm run dev` now hits the Test DB. You can break it safely.

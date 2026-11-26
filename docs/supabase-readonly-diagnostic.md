# Supabase read-only diagnostic

This workflow inspects PostgreSQL metadata for the Pilot Pro production project. It does not run migrations, write application rows, change RLS, or dump business data.

## One-time repository configuration

In GitHub, open **Settings → Secrets and variables → Actions** for this repository.

1. Add the repository variable `SUPABASE_PROJECT_REF` with the exact value `mgkeqwwzhcodntkakqaz`.
2. Add the repository secret `SUPABASE_DB_URL` containing the PostgreSQL connection URI for this exact Supabase project. Prefer the direct connection URI from the Supabase project's **Connect** dialog. Never put the URI in a file, issue, pull request, or chat.
3. Keep the secret restricted to this repository. Do not use a URL from another Supabase project.

The workflow verifies the configured project reference before connecting. It enforces PostgreSQL read-only mode at the session level and starts an explicit read-only transaction. The SQL contains metadata SELECTs only.

## Run

After this change is merged, open **Actions → Supabase read-only diagnostic → Run workflow** on `main`.

When it finishes, download the `supabase-sst-readonly-diagnostic` artifact and share that artifact through this conversation. It contains schema metadata, RLS policy definitions, triggers, and SST-related function definitions, but no application table rows.

If the connection URI uses a pooler whose username/host does not include the project reference, this initial safety check will stop before connecting. In that case, use the direct connection URI from the target project's Connect dialog rather than weakening the check.

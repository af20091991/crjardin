# Site web — Google APIs

## Required Supabase Edge Function secrets

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `SITE_WEB_GOOGLE_REDIRECT_URI`
- `SITE_WEB_APP_URL`

The redirect URI must point to the deployed `site-web-api` Edge Function callback:

`https://<supabase-project-ref>.supabase.co/functions/v1/site-web-api?action=callback&provider=google_search_console`

## OAuth scopes

Pilot Pro requests one shared Google OAuth consent for:

- Search Console: `webmasters.readonly`
- Analytics Data: `analytics.readonly`
- Business Profile: `business.manage`

No Google credentials are stored in Git. OAuth tokens are kept server-side through Supabase Vault.

## Known Google prerequisites

Search Console and Analytics access are granted by the Google account used for OAuth. Business Profile API access additionally requires the Google Cloud project to be approved for the Business Profile APIs and the relevant APIs enabled.

The application must be configured in Google Cloud with the exact redirect URI used by the Edge Function.

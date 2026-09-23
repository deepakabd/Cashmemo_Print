# Cloudflare R2 Sales Report storage

Sales Report transactions are compressed month-by-month and stored as private
R2 objects. Firestore keeps only the report manifest and summaries. The browser
never receives R2 credentials; all object access goes through the authenticated
`/api/sales-report` endpoint.

## Cloudflare setup

1. In Cloudflare Dashboard, open **R2 Object Storage** and create a private
   bucket named `cashmemo-sales-reports`.
2. Open **Manage R2 API Tokens** and create an account API token with
   **Object Read & Write** access limited to that bucket.
3. Add these server environment variables locally and in the deployment host:

```env
CLOUDFLARE_R2_ACCOUNT_ID=your_cloudflare_account_id
CLOUDFLARE_R2_ACCESS_KEY_ID=your_r2_access_key_id
CLOUDFLARE_R2_SECRET_ACCESS_KEY=your_r2_secret_access_key
CLOUDFLARE_R2_BUCKET=cashmemo-sales-reports
```

Do not prefix these names with `VITE_`; that would expose secrets to the browser.
Restart the development server after changing `.env`.

## Object layout

```text
sales-reports/{firestoreUserId}/{YYYY-MM}.lz-base64
```

Existing Firestore-based reports remain readable. If R2 is not configured, the
application retains IndexedDB data and attempts the legacy Firestore fallback.

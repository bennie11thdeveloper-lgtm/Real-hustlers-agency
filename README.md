# Real Hustlers

React/Vite frontend with Supabase Edge Functions for application intake, private UploadThing document storage, Flutterwave, PayPal, Pesapal, MTN MoMo, and Airtel Money payment processing, Africa's Talking SMS, and Resend email.

[Open the Real Hustlers account access and content editing guide](./docs/real-hustlers-account-and-content-guide.html).

## Local development

1. Create a Supabase project and copy its project URL (for example, `https://your-project.supabase.co`, without `/rest/v1`) and publishable/anon key.
2. Copy `.env.example` to `.env` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
3. Install dependencies and start Vite:

   ```sh
   npm install
   npm run dev
   ```

The public site builds without connected accounts, but submissions remain disabled until Supabase and the agency’s fee terms have been set up.
The applicant intake and payment-status functions are public endpoints for the public application form; the Supabase publishable key is public, and database access is separately denied by RLS. Add CAPTCHA/rate limiting before promoting the form widely.

Vercel deployments use `vercel.json` to route `/admin` to the Vite app entry point, so the content editor works when opened directly or from the public-site footer.

## Supabase setup

Apply all six migrations in order using the Supabase SQL Editor or Supabase CLI:

1. `supabase/migrations/20261013000000_create_applications_and_payments.sql`
2. `supabase/migrations/20261013010000_add_site_content_editor.sql`
3. `supabase/migrations/20261030000000_add_public_site_assets.sql`
4. `supabase/migrations/20261030010000_allow_editable_opportunity_roles.sql`
5. `supabase/migrations/20261030020000_enable_site_content_realtime.sql`
6. `supabase/migrations/20261030030000_add_payment_configuration.sql`

The first migration creates applicant, payment, and document records with private-by-default database permissions. The second seeds the website's editable copy and adds an authenticated, admin-only editing role. The third creates a public bucket for website images; only approved admins can upload to it. The fourth allows application records to store admin-managed opportunity titles. The fifth enables live delivery of published-content changes to visitors with the site already open. The sixth allows editable payment amounts and records provider/currency details; API credentials are stored separately as authenticated, server-only encrypted data. Applicant documents remain in separate private storage. Visitors can read published website copy; only approved admins can change it. Supabase Edge Functions use the server-side service-role key.

### One-time admin setup

Do this once during launch; after setup, routine copy updates happen at `https://YOUR_DOMAIN/admin`, not in the Supabase dashboard.

1. In Supabase **Authentication → Users**, invite your agency owner's email address. Finish the email invitation and set an account password.
2. In **Authentication → URL Configuration**, set the production Site URL to your website and allow `https://YOUR_DOMAIN/admin` as a redirect URL (also allow the exact development URL while testing). The password reset link uses this route.
3. In **SQL Editor**, grant admin editing rights to the invited account. Replace the email with the exact address used in the invitation:

   ```sql
   insert into public.site_admins (user_id)
   select id
   from auth.users
   where lower(email) = lower('owner@example.com')
   on conflict (user_id) do nothing;
   ```

4. Generate a random 32-byte key (for example, run `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"` on your computer) and set it as `PAYMENT_CREDENTIALS_ENCRYPTION_KEY` in Supabase **Edge Function Secrets**. Keep a secure backup of this key; changing or losing it makes already-saved payment credentials unreadable.
5. Sign in at `https://YOUR_DOMAIN/admin`, open **Payments & fees**, add the published HTTPS terms URL and fee/refund details, then save. Enter each payment provider's sandbox credentials in the secure credential forms and enable only the methods you have tested. Credentials are encrypted by an Edge Function and are never returned to the browser or exposed in public website content. Supabase redirects must include this site's `/admin` URL so password recovery works.
6. Do not give routine content editors Supabase dashboard access. Invite additional accounts only when needed and grant each authorized editor an explicit `site_admins` row. Remove access by deleting that row; deleting an auth account also cascades its admin role.

### Editing the public website (no backend/dashboard visits)

1. Open `https://YOUR_DOMAIN/admin`.
2. Sign in with the owner/editor email and password.
3. Choose a section to edit. In **Header**, upload the logo and add, remove, or update navigation link text and destinations. In **Opportunities**, add or delete cards, edit job titles and descriptions, and upload or change each card image. In **About us**, edit the agency copy and add team members with their names, positions, and portrait images.
4. In **Payments & fees**, edit the UGX fee, terms text and published HTTPS terms URL. Enter provider credentials, choose sandbox or live, then enable only configured methods. USD is calculated from the UGX fee using a live exchange-rate feed; direct MTN and Airtel Mobile Money accept UGX.
5. Select **Save changes**. Once the realtime migration is applied, open public pages receive the published changes automatically. Use **View public site** to preview them. Use **Forgot your password?** on the sign-in screen to recover your admin password by email.

The default fee is **UGX 150,000**, but an authorized admin can change it. Provider secrets are managed in encrypted server-side storage; the admin page never displays previously saved secret values. Settlement accounts and payout bank/mobile-money destinations are configured in each merchant's provider dashboard, not in public website content. Opportunity titles are checked against the currently published cards and stored with application records. Applicants must explicitly agree to the configured terms; never present the fee as a guarantee of a job or visa.

Set these Edge Function secrets in the Supabase project. Do not put provider secrets in `.env`, React code, or browser-visible `VITE_` variables:

| Secret | Purpose |
| --- | --- |
| `APP_ORIGIN` | Exact public frontend origin, with no trailing slash; use the origin the browser actually loads, e.g. `http://127.0.0.1:5173` locally |
| `APP_SITE_URL` | HTTPS frontend URL used for checkout return links |
| `FLW_SECRET_KEY` | Flutterwave server-side secret key |
| `FLW_WEBHOOK_SECRET_HASH` | Flutterwave webhook secret hash |
| `PAYMENT_CREDENTIALS_ENCRYPTION_KEY` | Base64-encoded random 32-byte AES-GCM key used to encrypt provider credentials saved in the admin editor |
| `UPLOADTHING_TOKEN` | UploadThing server token |
| `RESEND_API_KEY` | Resend API key |
| `RESEND_FROM_EMAIL` | Verified sender address, for example `Real Hustlers <applications@example.com>` |
| `AT_API_KEY` | Africa's Talking API key |
| `AT_USERNAME` | Africa's Talking account username (use `sandbox` only with sandbox credentials) |
| `AGENCY_NOTIFICATION_EMAIL` | Optional email address for new-application and payment notifications |

Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to deployed Edge Functions. Never expose or commit the service-role key.

Deploy the Edge Functions:

```sh
supabase functions deploy submit-application
supabase functions deploy payment-status
supabase functions deploy payment-credentials
supabase functions deploy pesapal-ipn
supabase functions deploy uploadthing
supabase functions deploy flutterwave-webhook
```

Redeploy `submit-application` after updating the site code so newly published opportunity titles are accepted in applications.

Configure Flutterwave to send `charge.completed` events to:

```text
https://YOUR_PROJECT.supabase.co/functions/v1/flutterwave-webhook
```

Set the same webhook secret hash in Supabase as in Flutterwave. Payment status is changed to paid only after the webhook signature and Flutterwave transaction status, reference, amount, and UGX currency are verified.

The admin payment editor also supports sandbox/live credentials for PayPal, Pesapal, MTN MoMo, and Airtel Money. Provider status is verified server-side against the saved payment record, amount, and currency. Pesapal notifications are reconciled by calling its transaction-status API; mobile-money results are checked against the provider APIs. Enter sandbox credentials first, perform successful, failed, and cancelled-payment checks, and only then switch to live. For USD checkouts, the backend fetches the latest UGX-per-USD rate for each new payment and records the rate and base UGX fee; if the rate service is unavailable, the USD checkout fails closed rather than using a stale estimate.

In the UploadThing dashboard, enable **Allow Overriding ACL** so the application document route can save files with the **private** ACL. Uploads are limited to five PDF/JPG/PNG documents, at 4 MB each. Their file keys are stored privately in Postgres; public access to applicant files is not enabled.

The checkout reads the currently published fee/refund URL, fee amount, and terms from the on-site editor. The applicant selects an enabled provider and currency; the backend records the exact charge before creating checkout. Merely submitting the application does not collect money.

## Provider account portals

Create/verify the company's accounts and complete provider business verification through each provider's official dashboard:

- Supabase: https://supabase.com/dashboard
- UploadThing: https://uploadthing.com/dashboard
- Flutterwave: https://app.flutterwave.com/
- PayPal developer dashboard: https://developer.paypal.com/dashboard/
- Pesapal developer portal: https://developer.pesapal.com/
- MTN MoMo developer portal: https://momodeveloper.mtn.com/
- Airtel Africa developer portal: https://developers.airtel.africa/
- Africa's Talking: https://account.africastalking.com/
- Resend: https://resend.com/

The Supabase service-role key and `PAYMENT_CREDENTIALS_ENCRYPTION_KEY` are infrastructure secrets; configure them only through Supabase Edge Function Secrets. Provider merchant credentials can then be entered in **Payments & fees**; they are encrypted at rest and never sent back to the browser. Never paste secrets into chat, public website content, or React/Vite environment variables.

## Before accepting real applications

- Replace the example frontend settings and deploy the functions with real provider credentials through Supabase's secret manager.
- Complete merchant onboarding and test each enabled provider in sandbox. Confirm PayPal can receive funds for the merchant's registered country and settlement account; confirm the Pesapal merchant profile supports the selected currencies; register MTN MoMo and Airtel Money collection products for Uganda.
- For direct MTN and Airtel collections, verify each merchant API account is linked to the intended settlement destination in the provider's dashboard. The website does not change the provider's payout bank or wallet account.
- Verify Africa's Talking Uganda SMS access and the Resend sender domain.
- Publish the agency's exact registration/paperwork service description, fee and refund terms, contact details, and privacy notice. Confirm candidate-fee and overseas-recruitment requirements with qualified local counsel and the relevant licensing authorities before enabling live candidate payments.
- Restrict access to applicant records and private documents to authorized agency staff. The `/admin` screen edits website content only; it is not an applicant-review or document-management dashboard.

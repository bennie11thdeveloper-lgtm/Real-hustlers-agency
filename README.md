# Real Hustlers

React/Vite frontend with Supabase Edge Functions for application intake, private UploadThing document storage, Flutterwave mobile-money checkout, Africa's Talking SMS, and Resend email.

[Download the Real Hustlers account access and content editing guide (PDF)](./docs/Real-Hustlers-Account-and-Content-Guide.pdf).

## Local development

1. Create a Supabase project and copy its project URL and publishable/anon key.
2. Copy `.env.example` to `.env` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
3. Install dependencies and start Vite:

   ```sh
   npm install
   npm run dev
   ```

The public site builds without connected accounts, but submissions remain disabled until Supabase and the agency’s fee terms have been set up.
The applicant intake and payment-status functions are public endpoints for the public application form; the Supabase publishable key is public, and database access is separately denied by RLS. Add CAPTCHA/rate limiting before promoting the form widely.

## Supabase setup

Apply **both** migrations in order using the Supabase SQL Editor or Supabase CLI:

1. `supabase/migrations/20261013000000_create_applications_and_payments.sql`
2. `supabase/migrations/20261013010000_add_site_content_editor.sql`

The first migration creates applicant, payment, and document records with private-by-default database permissions. The second seeds the website's editable copy and adds an authenticated, admin-only editing role. Visitors can read published website copy; only approved admins can change it. Supabase Edge Functions use the server-side service-role key.

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

4. Sign in at `https://YOUR_DOMAIN/admin`, add the published HTTPS fee/refund terms link in **Payment Terms Url**, and save. Publishing terms enables the candidate application and payment flow. Supabase redirects must include this site's `/admin` URL so password recovery works.
5. Do not give routine content editors Supabase dashboard access. Invite additional accounts only when needed and grant each authorized editor an explicit `site_admins` row. Remove access by deleting that row; deleting an auth account also cascades its admin role.

### Editing the public website (no backend/dashboard visits)

1. Open `https://YOUR_DOMAIN/admin`.
2. Sign in with the owner/editor email and password.
3. Edit the labeled fields. These include navigation, the homepage hero, job titles and summaries, agency story, application form wording, and buttons.
4. Update **Payment Terms Url** with the agency's real, published `https://` terms page. Review its fee, service description, refund terms, and applicant protections before publishing.
5. Select **Save changes**, then open or refresh the public site to review the live changes. Use **View public site** to preview it. Use **Forgot your password?** on the sign-in screen to recover your admin password by email.

The fixed **UGX 150,000** payment amount, provider credentials, payment rules, internal role identifiers, layout, and code are intentionally not editable here. Changing the charge requires an authorized developer to update the database constraint, backend checkout, reconciliation, and tests together. Applicants must explicitly agree to the configured terms; never present the fee as a guarantee of a job or visa.

Set these Edge Function secrets in the Supabase project. Do not put provider secrets in `.env`, React code, or browser-visible `VITE_` variables:

| Secret | Purpose |
| --- | --- |
| `APP_ORIGIN` | Exact public frontend origin, with no trailing slash; use the origin the browser actually loads, e.g. `http://127.0.0.1:5173` locally |
| `APP_SITE_URL` | Frontend URL used for the Flutterwave return link |
| `FLW_SECRET_KEY` | Flutterwave server-side secret key |
| `FLW_WEBHOOK_SECRET_HASH` | Flutterwave webhook secret hash |
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
supabase functions deploy uploadthing
supabase functions deploy flutterwave-webhook
```

Configure Flutterwave to send `charge.completed` events to:

```text
https://YOUR_PROJECT.supabase.co/functions/v1/flutterwave-webhook
```

Set the same webhook secret hash in Supabase as in Flutterwave. Payment status is changed to paid only after the webhook signature and Flutterwave transaction status, reference, amount, and UGX currency are verified.

In the UploadThing dashboard, enable **Allow Overriding ACL** so the application document route can save files with the **private** ACL. Uploads are limited to five PDF/JPG/PNG documents, at 4 MB each. Their file keys are stored privately in Postgres; public access to applicant files is not enabled.

The checkout reads the agency's currently published HTTPS fee/refund terms URL from the on-site editor and requests the approved **UGX 150,000** registration-and-paperwork fee. The applicant must complete/approve checkout with their mobile-money provider; merely submitting the application does not collect money.

## Provider account portals

Create/verify the company's accounts and complete provider business verification through each provider's official dashboard:

- Supabase: https://supabase.com/dashboard
- UploadThing: https://uploadthing.com/dashboard
- Flutterwave: https://app.flutterwave.com/
- Africa's Talking: https://account.africastalking.com/
- Resend: https://resend.com/

Provider API secrets and the database service-role key are infrastructure credentials, not website copy. Configure or rotate them through Supabase Edge Function secrets as described below; never paste credentials into the content editor or publish them in the React app.

## Before accepting real applications

- Replace the example frontend settings and deploy the functions with real provider credentials through Supabase's secret manager.
- Verify the Flutterwave account is enabled for Uganda UGX mobile-money checkout and test both MTN and Airtel Money using Flutterwave's test mode before switching to live credentials.
- Verify Africa's Talking Uganda SMS access and the Resend sender domain.
- Publish the agency's exact registration/paperwork service description, fee and refund terms, contact details, and privacy notice. Confirm candidate-fee and overseas-recruitment requirements with qualified local counsel and the relevant licensing authorities before enabling live candidate payments.
- Restrict access to applicant records and private documents to authorized agency staff. The `/admin` screen edits website content only; it is not an applicant-review or document-management dashboard.

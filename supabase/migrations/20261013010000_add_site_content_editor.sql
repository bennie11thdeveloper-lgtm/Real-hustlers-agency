create table public.site_content (
  id text primary key check (id = 'public'),
  content jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.site_content (id, content) values (
  'public',
  '{
    "navigation": {
      "opportunities": "Opportunities",
      "journey": "How it works",
      "about": "About us",
      "action": "Find your opportunity"
    },
    "hero": {
      "kicker": "UGANDA TO THE WORLD",
      "titleFirst": "Your next chapter",
      "titleSecond": "starts",
      "titleAccent": "here.",
      "description": "Big goals deserve a real plan. Explore work opportunities abroad and take your next step with Real Hustlers’ Agency.",
      "primaryAction": "Explore opportunities",
      "secondaryAction": "How it works",
      "reassurance": "Clear guidance. A real conversation. Your choice.",
      "artTop": "BUILT FOR WHAT’S NEXT",
      "artSticker": "MAKE IT HAPPEN",
      "artWorldFirst": "ONE WORLD.",
      "artWorldSecond": "MORE POSSIBILITIES.",
      "artCaptionFirst": "YOUR AMBITION",
      "artCaptionSecond": "HAS NO BORDERS."
    },
    "proof": {
      "items": [
        {"first": "Opportunities", "second": "beyond borders"},
        {"first": "Guidance at", "second": "every step"},
        {"first": "Work that fits", "second": "your ambition"}
      ],
      "tagline": "YOUR SKILLS CAN TAKE YOU PLACES"
    },
    "opportunities": {
      "eyebrow": "FIND YOUR FIT",
      "titleFirst": "Good work.",
      "titleSecond": "New horizons.",
      "introduction": "Your experience has value. Explore the kinds of roles we can help you learn more about, then start a conversation with our team.",
      "roles": [
        {"label": "Domestic workers", "detail": "Housekeeping · Caregiving · Home support"},
        {"label": "Drivers", "detail": "Personal · Commercial · Delivery"},
        {"label": "Security workers", "detail": "Security · Site support · Stewarding"},
        {"label": "Machine operators", "detail": "Equipment · Production · Skilled trades"}
      ],
      "roleAction": "Ask us about this",
      "fitNote": "Not sure where you fit yet? That’s okay.",
      "fitAction": "Let’s talk about it"
    },
    "journey": {
      "eyebrow": "NO GUESSWORK",
      "titleFirst": "A clear path",
      "titleSecond": "beats a leap",
      "titleAccent": "of faith.",
      "description": "Working abroad is a big decision. We help you understand the process, ask the right questions, and make informed choices at every step.",
      "action": "Start with a conversation",
      "steps": [
        {"title": "Tell us about you", "description": "Share your experience, the work you’re looking for, and where you’d like to go."},
        {"title": "Get to know the process", "description": "We’ll talk through possible roles, requirements, and what to expect at each stage."},
        {"title": "Prepare for your next step", "description": "If there’s a suitable opportunity, we’ll help you understand the next steps before you decide."}
      ],
      "reassurance": "Ask questions. Understand your options. Decide what feels right for you."
    },
    "about": {
      "tag": "ABOUT REAL HUSTLERS’ AGENCY",
      "titleFirst": "We believe a",
      "titleSecond": "better future is",
      "titleAccent": "within reach.",
      "firstParagraph": "Real Hustlers’ Agency connects Ugandans with the possibility of work abroad in roles where their drive and skills can open new doors.",
      "secondParagraph": "Our job is to help you explore your options with clarity. Your journey should begin with honest conversations and an understanding of the process—not unanswered questions.",
      "action": "Let’s talk about your goals",
      "footerLeft": "REAL PEOPLE. REAL AMBITION.",
      "footerRight": "KAMPALA, UGANDA"
    },
    "closing": {
      "eyebrow": "YOUR STORY, YOUR NEXT STEP",
      "titleFirst": "Ready to see",
      "titleSecond": "what’s possible?",
      "description": "Start with a conversation. Bring your questions, your experience, and your ambition.",
      "action": "Let’s get started"
    },
    "footer": {
      "description": "Made for the ones going places.",
      "backToTop": "BACK TO TOP",
      "copyright": "© 2026 REAL HUSTLERS’ AGENCY"
    },
    "applicationForm": {
      "eyebrow": "START A CONVERSATION",
      "title": "Let’s find your next step.",
      "introduction": "Tell us a little about yourself and the kind of work you’re interested in.",
      "nameLabel": "Your full name",
      "namePlaceholder": "e.g. Amina Namusoke",
      "phoneLabel": "Phone number",
      "phonePlaceholder": "+256 ...",
      "emailLabel": "Email",
      "emailHint": "Needed for your payment receipt",
      "emailPlaceholder": "you@example.com",
      "roleLabel": "Work you’re interested in",
      "rolePlaceholder": "Select a role",
      "otherRole": "Other / not sure yet",
      "experienceLabel": "A little about your experience",
      "optionalLabel": "Optional",
      "experiencePlaceholder": "What skills or experience would you like us to know about?",
      "acknowledgementBefore": "I have reviewed the",
      "termsLinkLabel": "fee and refund terms",
      "acknowledgementAfter": ", understand the registration and paperwork fee is UGX 150,000, and understand payment does not guarantee a job, visa, or employment.",
      "feeDisclosure": "Submitting creates your application and payment link. You will only be charged if you approve payment at Flutterwave. Payment does not guarantee job placement, a visa, or employment.",
      "termsPrompt": "Read the fee and refund terms.",
      "notConfigured": "Online applications are not configured yet. Please contact the agency.",
      "termsMissing": "The agency must publish and link its fee and refund terms before online applications can accept a payment.",
      "submitting": "Submitting…",
      "submitAction": "Submit application",
      "receivedEyebrow": "APPLICATION RECEIVED",
      "receivedTitle": "Your next step is ready.",
      "receivedIntroduction": "Your application is saved. Add any supporting documents now, or skip this step and continue to secure Flutterwave checkout.",
      "notificationWarning": "Keep this page open so you can continue to payment.",
      "documentsTitle": "Supporting documents",
      "documentsOptional": "Optional",
      "documentsDescription": "PDF, JPG, or PNG · up to 4 MB each · five files maximum. Documents are stored privately.",
      "documentsSuccessSingle": "document uploaded privately",
      "documentsSuccessMultiple": "documents uploaded privately",
      "documentsUploadAction": "Upload documents",
      "uploading": "Uploading…",
      "paymentAfterSubmission": "Payment is completed only when you approve it with your mobile money provider.",
      "continuePayment": "Continue to secure payment",
      "closedPageNote": "If you close this page before paying, use the payment link sent to your phone or email. Your application remains saved."
    },
    "paymentTermsUrl": ""
  }'::jsonb
);

create table public.site_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.site_content enable row level security;
alter table public.site_admins enable row level security;

create policy "Public can read published website content"
  on public.site_content for select
  to anon, authenticated
  using (id = 'public');

create function public.is_site_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.site_admins
    where user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_site_admin() from public, anon;
grant execute on function public.is_site_admin() to authenticated;

create policy "Admins can update website content"
  on public.site_content for update
  to authenticated
  using ((select public.is_site_admin()))
  with check (id = 'public' and (select public.is_site_admin()));

create policy "Admins can read their own website role"
  on public.site_admins for select
  to authenticated
  using (user_id = (select auth.uid()));

grant select on public.site_content to anon, authenticated;
grant update on public.site_content to authenticated;
grant select on public.site_admins to authenticated;
revoke insert, delete on public.site_content from anon, authenticated;
revoke insert, update, delete on public.site_admins from anon, authenticated;

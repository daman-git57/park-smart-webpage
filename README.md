# ParkSmart – Supabase-connected frontend

This version removes Firebase and connects the existing vanilla HTML/CSS/JavaScript frontend to Supabase.

## Included
- `js/supabase-config.js`: Supabase client + silent anonymous authentication.
- `supabase-setup.sql`: creates the `app_state` table and Row Level Security policies.
- `js/app.js`: loads/saves the app state to Supabase and keeps a local browser backup.
- No login page is shown.

## Configure Supabase

1. Create a project at https://supabase.com/ and wait for provisioning to finish.
2. In Supabase Dashboard, open **Project Settings → API** (or **Data API / API Keys**, depending on dashboard layout).
3. Copy the **Project URL** and the **anon/public key** (sometimes labelled `anon` or `publishable`).
4. Open `js/supabase-config.js`.
5. Replace `PASTE_YOUR_PROJECT_URL` and `PASTE_YOUR_ANON_PUBLIC_KEY` with those exact values.
6. In Supabase Dashboard, open **Authentication → Sign In / Providers** and enable **Anonymous Sign-Ins**.
7. Open **SQL Editor → New query**.
8. Paste all of `supabase-setup.sql` and click **Run**.
9. Open the project in VS Code and run `index.html` using Live Server.

## Verify
Open browser DevTools (F12) → Console. Expected messages:
- `Supabase connected. Anonymous session started.`
- `ParkSmart data loaded from Supabase.`

In Supabase Dashboard → Table Editor, you should see `app_state`. After first successful app load, it should contain a row with id `main`.

## Important security and architecture limitations
- The browser uses the Supabase anon/public key, which is intended for frontend use. Never use a `service_role` or secret key in browser code.
- Anonymous sign-in means any visitor can create an anonymous account. The included RLS policies allow any authenticated/anonymous visitor to read and modify the single demo state row. This is only for a controlled college demonstration with dummy data, not production.
- This starter integration stores the entire application state in one JSONB row (`app_state/main`) to connect the current frontend without rewriting every feature. It is suitable only for a single-admin prototype. It is not safe for simultaneous operators: concurrent saves can overwrite each other, and the row can grow. Before multi-user/production use, migrate to normalized tables (`parking_slots`, `vehicles`, `parking_tickets`, `payments`, etc.) and implement server-side/Postgres transactional allocation and role-based RLS.
- No physical sensors or real payment processing are connected.

## Troubleshooting
- `Supabase configuration is incomplete`: fill both values in `js/supabase-config.js`.
- `Invalid API key`: use the project's anon/public key, not a Firebase key or service-role key.
- `Anonymous sign-ins are disabled`: enable Anonymous Sign-Ins under Authentication providers.
- `relation public.app_state does not exist`: run `supabase-setup.sql`.
- `permission denied` / RLS error: verify the SQL ran successfully and the user is signed in anonymously.
- Keep an internet connection for Supabase and the Chart.js/QRCode.js/jsPDF CDN scripts.

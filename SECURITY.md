# CoachOS XC Security Model

## Current prototype

The current browser prototype stores coaching data in the device browser's local storage so the app can work offline. It does **not** store or manage account passwords.

Do not treat device-local storage as a production cloud account system. Browser data can be cleared, and local storage alone does not provide multi-device synchronization or authenticated access control.

## Production authentication plan

CoachOS XC should use a dedicated authentication provider for email/password accounts. The planned implementation uses Supabase Auth with email/password sign-in.

Passwords must never be stored in CoachOS application data, browser local storage, source code, GitHub, or the CoachOS database payload.

## Production data isolation

The repository includes `supabase/schema.sql`, which creates a per-user `coach_data` record and enables PostgreSQL Row Level Security (RLS).

The included policies restrict SELECT, INSERT, UPDATE, and DELETE operations to the authenticated user whose `auth.uid()` matches the row's `user_id`.

## Secrets

- Never commit Supabase service-role keys.
- Never expose privileged server credentials in browser JavaScript.
- Public/publishable client configuration should be separated from privileged secrets.
- Production deployments should use HTTPS.
- Staff/team sharing should use explicit membership records and RLS policies rather than shared passwords.

## Next security implementation steps

1. Create the production Supabase project.
2. Enable email/password authentication and configure email verification.
3. Apply `supabase/schema.sql`.
4. Add the Supabase browser client with only publishable client configuration.
5. Add sign-up, sign-in, sign-out, password-reset, and session handling.
6. Migrate local CoachOS data into the authenticated user's `coach_data` row after first login.
7. Replace local-only persistence with authenticated cloud synchronization plus an offline cache.
8. Add team membership roles for head coaches and assistant coaches with separate authorization policies.

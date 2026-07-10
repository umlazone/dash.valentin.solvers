-- Make signal deduplication usable by PostgREST ON CONFLICT.
-- PostgreSQL unique indexes already allow multiple NULL fingerprints.
drop index if exists public.mc_signals_fingerprint_uidx;
create unique index mc_signals_fingerprint_uidx
  on public.mc_signals(fingerprint);

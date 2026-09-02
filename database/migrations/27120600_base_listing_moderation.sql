-- Step 1/2: add enum value in its own transaction.
-- PostgreSQL requires new enum values to be committed before use (55P04).

alter type public.content_status add value if not exists 'approved';

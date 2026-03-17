-- CRITICAL PERFORMANCE FIX
-- get_my_org_id() and get_my_role() are used in RLS policies on resources, loans,
-- requests, and other tables. When marked VOLATILE (default), Postgres re-executes
-- them for every single row during a SELECT, causing N+1 queries to profiles.
-- Marking them STABLE tells Postgres the result won't change within one query
-- execution, so it evaluates them once and caches. This turns an O(n) scan into O(1).
ALTER FUNCTION public.get_my_org_id() STABLE;
ALTER FUNCTION public.get_my_role() STABLE;

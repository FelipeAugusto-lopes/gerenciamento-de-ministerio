ALTER TABLE public.members ADD COLUMN unavailable_dates DATE[] DEFAULT '{}';
GRANT SELECT, INSERT, UPDATE, DELETE ON public.members TO authenticated;
GRANT ALL ON public.members TO service_role;
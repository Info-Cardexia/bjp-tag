ALTER TABLE public.areas ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0;

WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY slug) AS rn FROM public.areas
)
UPDATE public.areas a SET display_order = o.rn FROM ordered o WHERE a.id = o.id;
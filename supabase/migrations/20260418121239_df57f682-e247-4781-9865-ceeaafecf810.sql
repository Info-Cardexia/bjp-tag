ALTER TABLE public.area_content
ADD COLUMN IF NOT EXISTS section_order jsonb NOT NULL DEFAULT '["image","video","buttons","socials"]'::jsonb;
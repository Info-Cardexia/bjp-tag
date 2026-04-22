
-- Create enum for roles
CREATE TYPE public.app_role AS ENUM ('super_admin', 'area_head');

-- Create enum for content modes
CREATE TYPE public.content_mode AS ENUM ('redirect', 'landing', 'video');

-- Create areas table
CREATE TABLE public.areas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_roles table (separate from profiles per security best practice)
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  area_id UUID REFERENCES public.areas(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Create area_content table
CREATE TABLE public.area_content (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  area_id UUID NOT NULL REFERENCES public.areas(id) ON DELETE CASCADE,
  content_mode content_mode NOT NULL DEFAULT 'landing',
  redirect_url TEXT,
  landing_title TEXT,
  landing_description TEXT,
  landing_image_url TEXT,
  landing_buttons JSONB DEFAULT '[]'::jsonb,
  landing_social_links JSONB DEFAULT '[]'::jsonb,
  video_url TEXT,
  video_type TEXT DEFAULT 'youtube',
  is_active BOOLEAN NOT NULL DEFAULT true,
  schedule_start TIME,
  schedule_end TIME,
  priority INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create area_visits table for analytics
CREATE TABLE public.area_visits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  area_id UUID NOT NULL REFERENCES public.areas(id) ON DELETE CASCADE,
  visited_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_agent TEXT,
  referrer TEXT
);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_areas_updated_at BEFORE UPDATE ON public.areas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_area_content_updated_at BEFORE UPDATE ON public.area_content FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Security definer functions to avoid RLS recursion
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_area_head(_user_id UUID, _area_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'area_head' AND area_id = _area_id
  )
$$;

-- Enable RLS
ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.area_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.area_visits ENABLE ROW LEVEL SECURITY;

-- AREAS policies
CREATE POLICY "Anyone can view active areas" ON public.areas FOR SELECT USING (is_active = true);
CREATE POLICY "Super admins can view all areas" ON public.areas FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins can insert areas" ON public.areas FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins can update areas" ON public.areas FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins can delete areas" ON public.areas FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

-- USER_ROLES policies
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Super admins can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins can manage roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins can update roles" ON public.user_roles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins can delete roles" ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

-- AREA_CONTENT policies
CREATE POLICY "Anyone can view active content" ON public.area_content FOR SELECT USING (is_active = true);
CREATE POLICY "Area heads can view their content" ON public.area_content FOR SELECT TO authenticated USING (public.is_area_head(auth.uid(), area_id));
CREATE POLICY "Super admins can view all content" ON public.area_content FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Area heads can insert content" ON public.area_content FOR INSERT TO authenticated WITH CHECK (public.is_area_head(auth.uid(), area_id));
CREATE POLICY "Area heads can update their content" ON public.area_content FOR UPDATE TO authenticated USING (public.is_area_head(auth.uid(), area_id));
CREATE POLICY "Area heads can delete their content" ON public.area_content FOR DELETE TO authenticated USING (public.is_area_head(auth.uid(), area_id));
CREATE POLICY "Super admins can insert content" ON public.area_content FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins can update content" ON public.area_content FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins can delete content" ON public.area_content FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

-- AREA_VISITS policies
CREATE POLICY "Anyone can insert visits" ON public.area_visits FOR INSERT WITH CHECK (true);
CREATE POLICY "Area heads can view their visits" ON public.area_visits FOR SELECT TO authenticated USING (public.is_area_head(auth.uid(), area_id));
CREATE POLICY "Super admins can view all visits" ON public.area_visits FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

-- Create storage bucket for campaign assets
INSERT INTO storage.buckets (id, name, public) VALUES ('campaign-assets', 'campaign-assets', true);

CREATE POLICY "Anyone can view campaign assets" ON storage.objects FOR SELECT USING (bucket_id = 'campaign-assets');
CREATE POLICY "Authenticated users can upload assets" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'campaign-assets');
CREATE POLICY "Authenticated users can update assets" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'campaign-assets');
CREATE POLICY "Authenticated users can delete assets" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'campaign-assets');

-- Insert default 5 areas
INSERT INTO public.areas (name, slug, description) VALUES
  ('Area 1', 'area1', 'Campaign Area 1'),
  ('Area 2', 'area2', 'Campaign Area 2'),
  ('Area 3', 'area3', 'Campaign Area 3'),
  ('Area 4', 'area4', 'Campaign Area 4'),
  ('Area 5', 'area5', 'Campaign Area 5');


DROP POLICY "Anyone can insert visits" ON public.area_visits;
CREATE POLICY "Anyone can insert visits for existing areas" ON public.area_visits 
  FOR INSERT 
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.areas WHERE id = area_id AND is_active = true)
  );

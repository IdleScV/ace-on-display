UPDATE public.course_holes ch
SET topdown_url = 'https://msjxchvagtylhfyhangb.supabase.co/storage/v1/object/public/hole-media/cypress-pines/topdown/hole-' || ch.hole_number || '.jpg?v=' || extract(epoch from now())::bigint
FROM public.courses c
WHERE c.id = ch.course_id
  AND c.slug = 'cypress-pines'
  AND ch.hole_number IN (2,4,7,9,12,14,16);

UPDATE public.courses SET data_version = data_version + 1, updated_at = now() WHERE slug = 'cypress-pines';
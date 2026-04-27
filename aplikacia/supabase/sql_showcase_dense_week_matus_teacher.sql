-- =============================================================================
-- Showcase — dense week (one Generate fills the grid) — Matúš Lupták teaches
--
-- Same idea as timetable "1. Weekly — Spread (main)" in
--   supabase/seed_showcase_timetables.sql
-- but this timetable lists ONLY Matúš Lupták (trainer) on the roster and sets
-- preferred_trainer_id to him on every target so Generate assigns his lessons.
--
-- Prereq: Dansovia club + users/couples/groups/rooms from
--   supabase/seed_showcase_timetables.sql (same UUIDs below). Run that seed first.
--
-- How to use:
--   1) Run this in the Supabase SQL Editor (or psql).
--   2) Club → Timetables → open "Showcase — dense week (Matúš teaches)".
--   3) Pick the current week Monday → Generate once → grid should fill heavily.
--
-- Re-run: deletes and recreates the same timetable id (idempotent).
-- =============================================================================

DO $$
DECLARE
  v_club_id uuid := '0afc9cb2-2e32-4327-8052-3b7787371acb';

  -- Students (solo targets)
  v_marek    uuid := '25b67f34-cbdd-40ea-ba8d-0181cdef7c6e';
  v_matus_s  uuid := '5bca37d2-356f-4902-acc8-b5b9854afc2e';
  v_papanica uuid := '9365b4b1-8132-436b-9725-cfb7f7ba5a49';
  v_bruno    uuid := 'a0ab19d2-7978-4ae0-b5be-90aba61fb29a';
  v_carol    uuid := 'af2c716a-a329-4e6e-8b0d-df80a3471129';
  v_lukas    uuid := 'e54cd6d9-494c-40ea-965c-3de284c8975a';

  -- Trainer: Matúš Lupták (club trainer profile — same id as seed_showcase)
  v_matus_t uuid := 'fc642e02-dc97-4c75-80b3-dedd79ce8360';

  -- Couples
  v_couple_ab uuid := '8a75e008-a2d7-4a44-81fd-33cca06a3ffa';
  v_couple_cd uuid := '416c3910-d94c-4a3b-9899-b7dd579c1d18';
  v_couple_pl uuid := '0132b728-18c9-4a3f-95e1-dcd6ffec593d';
  v_couple_mb uuid := '9956eab5-417b-4058-ba1e-2d16265f8378';

  -- Groups + lesson types (Dansovia showcase ids)
  v_g_lat  uuid := 'a490c7c1-50d0-4533-bc82-dc7755bf3601';
  v_g_beg  uuid := '2f124254-92e6-4bdf-a3ba-cd4d209a397c';
  v_g_comp uuid := '67b9909d-954b-41e6-b8e4-d555e4b4a952';
  v_gt_lat uuid := '1f6f199d-e558-46dc-a98e-f66698cfb37a';
  v_gt_std uuid := '593cea04-1c82-4d16-aecb-65d02245ce0e';
  v_gt_adv uuid := 'bfe78702-819d-4c67-bd6a-75040a9b36fe';

  v_monday date := (date_trunc('week', (current_date AT TIME ZONE 'UTC')::date))::date;
  v_tt     uuid := 'a0000ff2-0000-0000-0000-00000000ff03';
BEGIN
  DELETE FROM public.lessons                 WHERE timetable_id = v_tt;
  DELETE FROM public.timetable_group_targets WHERE timetable_id = v_tt;
  DELETE FROM public.timetable_targets       WHERE timetable_id = v_tt;
  DELETE FROM public.timetable_trainer_limits WHERE timetable_id = v_tt;
  DELETE FROM public.timetable_preferences   WHERE timetable_id = v_tt;
  DELETE FROM public.timetables              WHERE id = v_tt;

  INSERT INTO public.timetables (id, club_id, name, recurrence, valid_from, valid_until, is_active, day_start, day_end)
  VALUES (
    v_tt,
    v_club_id,
    'Showcase — dense week (Matúš teaches)',
    'weekly',
    v_monday,
    NULL,
    true,
    '09:00',
    '21:00'
  );

  -- Relaxed consecutive/buffer so the greedy solver can pack many slots in one week.
  INSERT INTO public.timetable_preferences (
    timetable_id,
    individual_lesson_duration_minutes,
    distribution,
    max_consecutive_minutes_per_trainer,
    min_break_minutes_after_consecutive,
    buffer_between_lessons_minutes
  )
  VALUES (v_tt, 45, 'same', 600, 0, 0);

  -- Only Matúš on this timetable; high daily cap so Generate is not capped early.
  INSERT INTO public.timetable_trainer_limits (timetable_id, user_id, max_lessons_per_day) VALUES
    (v_tt, v_matus_t, 24);

  -- All preferred_trainer_id = Matúš so every lesson is taught by him when the slot is valid.
  INSERT INTO public.timetable_targets (timetable_id, student_id, couple_id, desired_lessons_count, priority, preferred_trainer_id) VALUES
    (v_tt, NULL, v_couple_ab, 5, 'high',   v_matus_t),
    (v_tt, NULL, v_couple_cd, 5, 'high',   v_matus_t),
    (v_tt, NULL, v_couple_pl, 5, 'medium', v_matus_t),
    (v_tt, NULL, v_couple_mb, 4, 'medium', v_matus_t),
    (v_tt, v_matus_s, NULL, 4, 'medium', v_matus_t),
    (v_tt, v_marek,   NULL, 3, 'medium', v_matus_t),
    (v_tt, v_papanica, NULL, 3, 'low',    v_matus_t),
    (v_tt, v_bruno,   NULL, 3, 'low',    v_matus_t),
    (v_tt, v_lukas,   NULL, 3, 'low',    v_matus_t),
    (v_tt, v_carol,   NULL, 2, 'low',    v_matus_t);

  INSERT INTO public.timetable_group_targets (timetable_id, group_id, group_lesson_type_id, desired_lessons_count, priority, preferred_trainer_id) VALUES
    (v_tt, v_g_beg,  v_gt_std, 2, 'medium', v_matus_t),
    (v_tt, v_g_lat,  v_gt_lat, 2, 'high',   v_matus_t),
    (v_tt, v_g_comp, v_gt_adv, 2, 'high',   v_matus_t);

  RAISE NOTICE 'Timetable % created: Showcase — dense week (Matúš teaches). Open: /app/club/timetables/%', v_tt, v_tt;
END $$;

-- Create ministries table
CREATE TABLE public.ministries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  color_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create members table
CREATE TABLE public.members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Junction table for members <-> ministries
CREATE TABLE public.member_ministries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  UNIQUE (member_id, ministry_id)
);

-- Create schedules table
CREATE TABLE public.schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  shift TEXT NOT NULL CHECK (shift IN ('Manhã', 'Noite')),
  status TEXT NOT NULL DEFAULT 'Pendente' CHECK (status IN ('Pendente', 'Confirmado', 'Recusado', 'Concluído')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Junction table for schedules <-> members
CREATE TABLE public.schedule_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  schedule_id UUID NOT NULL REFERENCES public.schedules(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  UNIQUE (schedule_id, member_id)
);

-- Audit log table
CREATE TABLE public.audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  action TEXT NOT NULL,
  detail TEXT NOT NULL,
  username TEXT NOT NULL DEFAULT 'Usuário',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  schedule_id UUID NOT NULL REFERENCES public.schedules(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.ministries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_ministries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Allow all operations (no auth required - used by few leaders)
CREATE POLICY "Allow all on ministries" ON public.ministries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on members" ON public.members FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on member_ministries" ON public.member_ministries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on schedules" ON public.schedules FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on schedule_members" ON public.schedule_members FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on audit_log" ON public.audit_log FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on notifications" ON public.notifications FOR ALL USING (true) WITH CHECK (true);

-- Insert default ministries
INSERT INTO public.ministries (name, color_index) VALUES
  ('Voluntariado', 0),
  ('Louvor', 1),
  ('Áudio', 2),
  ('Mídia Story', 3),
  ('Mídia Fotos', 4),
  ('Projeção', 5),
  ('Transmissão', 6),
  ('Berçário', 7),
  ('INA Kids 3-6', 8),
  ('INA Kids 7-8', 9),
  ('INA Kids 9-12', 10);

-- Create indexes
CREATE INDEX idx_schedules_date ON public.schedules(date);
CREATE INDEX idx_schedules_ministry ON public.schedules(ministry_id);
CREATE INDEX idx_schedule_members_schedule ON public.schedule_members(schedule_id);
CREATE INDEX idx_schedule_members_member ON public.schedule_members(member_id);
CREATE INDEX idx_member_ministries_member ON public.member_ministries(member_id);
CREATE INDEX idx_member_ministries_ministry ON public.member_ministries(ministry_id);
CREATE INDEX idx_audit_log_created ON public.audit_log(created_at DESC);
CREATE INDEX idx_notifications_member ON public.notifications(member_id);
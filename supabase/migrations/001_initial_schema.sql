-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  phone TEXT,
  display_name TEXT,
  photo_url TEXT,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'unlimited')),
  drafts_used_this_month INTEGER NOT NULL DEFAULT 0,
  drafts_reset_date DATE NOT NULL DEFAULT CURRENT_DATE,
  subscription_id TEXT,
  subscription_status TEXT DEFAULT 'none',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Categories
CREATE TABLE IF NOT EXISTS public.categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  icon TEXT DEFAULT 'file',
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  template_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Templates with full-text search
CREATE TABLE IF NOT EXISTS public.templates (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL REFERENCES public.categories(id),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  keywords TEXT[] DEFAULT '{}',
  template_file_path TEXT NOT NULL,
  variables JSONB NOT NULL DEFAULT '[]',
  estimated_minutes INTEGER NOT NULL DEFAULT 5,
  is_active BOOLEAN NOT NULL DEFAULT true,
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Full-text search index
CREATE INDEX IF NOT EXISTS templates_search_idx ON public.templates
  USING GIN (to_tsvector('english', name || ' ' || COALESCE(description, '')));
CREATE INDEX IF NOT EXISTS templates_category_idx ON public.templates(category_id);

-- Drafts
CREATE TABLE IF NOT EXISTS public.drafts (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  template_id TEXT NOT NULL REFERENCES public.templates(id),
  template_name TEXT NOT NULL,
  category_name TEXT NOT NULL,
  generated_file_path TEXT NOT NULL,
  variables JSONB NOT NULL DEFAULT '{}',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS drafts_user_idx ON public.drafts(user_id);

-- Subscriptions
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'created',
  razorpay_subscription_id TEXT,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Webhook events
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  payload JSONB,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Public read categories" ON public.categories FOR SELECT USING (is_active = true);
CREATE POLICY "Public read templates" ON public.templates FOR SELECT USING (is_active = true);
CREATE POLICY "Users read own drafts" ON public.drafts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own drafts" ON public.drafts FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Service role bypass for API
CREATE POLICY "Service role full access profiles" ON public.profiles FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access categories" ON public.categories FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access templates" ON public.templates FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access drafts" ON public.drafts FOR ALL USING (auth.role() = 'service_role');

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, photo_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Helper functions
CREATE OR REPLACE FUNCTION increment_category_count(cat_id TEXT)
RETURNS VOID AS $$
  UPDATE public.categories SET template_count = template_count + 1 WHERE id = cat_id;
$$ LANGUAGE SQL;

CREATE OR REPLACE FUNCTION increment_template_usage(tpl_id TEXT)
RETURNS VOID AS $$
  UPDATE public.templates SET usage_count = usage_count + 1 WHERE id = tpl_id;
$$ LANGUAGE SQL;

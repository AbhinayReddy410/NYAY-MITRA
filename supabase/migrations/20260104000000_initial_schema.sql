-- NyayaMitra Initial Schema Migration for Supabase
-- This migration creates all tables, indexes, RLS policies, and helper functions

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- =================================================================
-- TABLES
-- =================================================================

-- Profiles table (extends Supabase auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  phone TEXT,
  display_name TEXT,
  photo_url TEXT,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'unlimited')),
  drafts_used_this_month INTEGER NOT NULL DEFAULT 0,
  drafts_reset_date DATE NOT NULL DEFAULT DATE_TRUNC('month', CURRENT_DATE),
  subscription_id TEXT,
  subscription_status TEXT DEFAULT 'none' CHECK (subscription_status IN ('active', 'cancelled', 'past_due', 'none')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Categories table
CREATE TABLE public.categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  icon TEXT DEFAULT 'file',
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  template_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Templates table with full-text search
CREATE TABLE public.templates (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  keywords TEXT[] DEFAULT '{}',
  template_file_path TEXT NOT NULL,
  variables JSONB NOT NULL DEFAULT '[]',
  estimated_minutes INTEGER NOT NULL DEFAULT 5,
  is_active BOOLEAN NOT NULL DEFAULT true,
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Full-text search column
  search_vector TSVECTOR GENERATED ALWAYS AS (
    setweight(to_tsvector('english', COALESCE(name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(description, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(keywords, ' '), '')), 'C')
  ) STORED
);

-- Drafts table
CREATE TABLE public.drafts (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  template_id TEXT NOT NULL REFERENCES public.templates(id) ON DELETE RESTRICT,
  template_name TEXT NOT NULL,
  category_name TEXT NOT NULL,
  generated_file_path TEXT NOT NULL,
  variables JSONB NOT NULL DEFAULT '{}',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Subscriptions table
CREATE TABLE public.subscriptions (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'active', 'paused', 'halted', 'cancelled', 'completed', 'expired')),
  razorpay_subscription_id TEXT UNIQUE,
  razorpay_plan_id TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  activated_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Webhook events (for idempotency)
CREATE TABLE public.webhook_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  payload JSONB,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =================================================================
-- INDEXES
-- =================================================================

-- Templates indexes
CREATE INDEX templates_search_idx ON public.templates USING GIN (search_vector);
CREATE INDEX templates_category_idx ON public.templates(category_id) WHERE is_active = true;
CREATE INDEX templates_active_idx ON public.templates(is_active) WHERE is_active = true;
CREATE INDEX templates_slug_idx ON public.templates(slug);

-- Drafts indexes
CREATE INDEX drafts_user_idx ON public.drafts(user_id);
CREATE INDEX drafts_created_idx ON public.drafts(created_at DESC);
CREATE INDEX drafts_expires_idx ON public.drafts(expires_at);

-- Subscriptions indexes
CREATE INDEX subscriptions_user_idx ON public.subscriptions(user_id);
CREATE INDEX subscriptions_razorpay_idx ON public.subscriptions(razorpay_subscription_id);
CREATE INDEX subscriptions_status_idx ON public.subscriptions(status);

-- Categories indexes
CREATE INDEX categories_active_idx ON public.categories(is_active) WHERE is_active = true;
CREATE INDEX categories_order_idx ON public.categories(sort_order);

-- =================================================================
-- ROW LEVEL SECURITY
-- =================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
  
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Categories policies (public read)
CREATE POLICY "Anyone can view active categories" ON public.categories
  FOR SELECT USING (is_active = true);

-- Templates policies (public read)
CREATE POLICY "Anyone can view active templates" ON public.templates
  FOR SELECT USING (is_active = true);

-- Drafts policies (user owns)
CREATE POLICY "Users can view own drafts" ON public.drafts
  FOR SELECT USING (auth.uid() = user_id);
  
CREATE POLICY "Users can insert own drafts" ON public.drafts
  FOR INSERT WITH CHECK (auth.uid() = user_id);
  
CREATE POLICY "Users can delete own drafts" ON public.drafts
  FOR DELETE USING (auth.uid() = user_id);

-- Subscriptions policies (user owns)
CREATE POLICY "Users can view own subscriptions" ON public.subscriptions
  FOR SELECT USING (auth.uid() = user_id);

-- =================================================================
-- FUNCTIONS
-- =================================================================

-- Function: Create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, phone, display_name, photo_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.phone,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: Auto-create profile
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function: Update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.templates
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Function: Increment category count
CREATE OR REPLACE FUNCTION public.increment_category_count(cat_id TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE public.categories 
  SET template_count = template_count + 1,
      updated_at = NOW()
  WHERE id = cat_id;
END;
$$ LANGUAGE plpgsql;

-- Function: Increment template usage
CREATE OR REPLACE FUNCTION public.increment_template_usage(template_id TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE public.templates 
  SET usage_count = usage_count + 1,
      updated_at = NOW()
  WHERE id = template_id;
END;
$$ LANGUAGE plpgsql;

-- Function: Search templates with full-text search
CREATE OR REPLACE FUNCTION public.search_templates(
  search_query TEXT DEFAULT NULL,
  category_filter TEXT DEFAULT NULL,
  page_num INTEGER DEFAULT 1,
  page_size INTEGER DEFAULT 20
)
RETURNS TABLE (
  id TEXT,
  category_id TEXT,
  name TEXT,
  slug TEXT,
  description TEXT,
  keywords TEXT[],
  estimated_minutes INTEGER,
  variables JSONB,
  template_file_path TEXT,
  usage_count INTEGER,
  rank REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.category_id,
    t.name,
    t.slug,
    t.description,
    t.keywords,
    t.estimated_minutes,
    t.variables,
    t.template_file_path,
    t.usage_count,
    CASE 
      WHEN search_query IS NOT NULL AND search_query != '' 
      THEN ts_rank(t.search_vector, websearch_to_tsquery('english', search_query))
      ELSE 1.0
    END AS rank
  FROM public.templates t
  WHERE t.is_active = true
    AND (category_filter IS NULL OR t.category_id = category_filter)
    AND (
      search_query IS NULL 
      OR search_query = '' 
      OR t.search_vector @@ websearch_to_tsquery('english', search_query)
      OR t.name ILIKE '%' || search_query || '%'
    )
  ORDER BY rank DESC, t.usage_count DESC, t.name ASC
  LIMIT page_size
  OFFSET (page_num - 1) * page_size;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function: Get template count for search
CREATE OR REPLACE FUNCTION public.count_search_templates(
  search_query TEXT DEFAULT NULL,
  category_filter TEXT DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  result INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER INTO result
  FROM public.templates t
  WHERE t.is_active = true
    AND (category_filter IS NULL OR t.category_id = category_filter)
    AND (
      search_query IS NULL 
      OR search_query = '' 
      OR t.search_vector @@ websearch_to_tsquery('english', search_query)
      OR t.name ILIKE '%' || search_query || '%'
    );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql STABLE;

-- =================================================================
-- STORAGE BUCKETS (Run these in Supabase Dashboard → Storage)
-- =================================================================

-- Buckets will be created manually or via API:
-- 1. templates (private)
-- 2. drafts (private, 24h expiry)

COMMENT ON TABLE public.profiles IS 'User profiles extending Supabase auth.users';
COMMENT ON TABLE public.categories IS 'Template categories for organizing legal documents';
COMMENT ON TABLE public.templates IS 'Legal document templates with variables and full-text search';
COMMENT ON TABLE public.drafts IS 'User-generated drafts with 24-hour expiry';
COMMENT ON TABLE public.subscriptions IS 'Razorpay subscription records';
COMMENT ON TABLE public.webhook_events IS 'Webhook event deduplication and audit log';

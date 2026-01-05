/**
 * Supabase Database Types
 * 
 * IMPORTANT: This file should be auto-generated from your Supabase schema.
 * 
 * To generate:
 * 1. Install Supabase CLI: npm install -g supabase
 * 2. Login: supabase login
 * 3. Get your project ref from Supabase Dashboard → Settings → General
 * 4. Run: npx supabase gen types typescript --project-id YOUR_PROJECT_REF > packages/shared/src/types/database.types.ts
 * 
 * For now, we're using manual types that match our schema.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string | null
          phone: string | null
          display_name: string | null
          photo_url: string | null
          plan: 'free' | 'pro' | 'unlimited'
          drafts_used_this_month: number
          drafts_reset_date: string
          subscription_id: string | null
          subscription_status: 'active' | 'cancelled' | 'past_due' | 'none'
          created_at: string
          last_login_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email?: string | null
          phone?: string | null
          display_name?: string | null
          photo_url?: string | null
          plan?: 'free' | 'pro' | 'unlimited'
          drafts_used_this_month?: number
          drafts_reset_date?: string
          subscription_id?: string | null
          subscription_status?: 'active' | 'cancelled' | 'past_due' | 'none'
          created_at?: string
          last_login_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string | null
          phone?: string | null
          display_name?: string | null
          photo_url?: string | null
          plan?: 'free' | 'pro' | 'unlimited'
          drafts_used_this_month?: number
          drafts_reset_date?: string
          subscription_id?: string | null
          subscription_status?: 'active' | 'cancelled' | 'past_due' | 'none'
          created_at?: string
          last_login_at?: string
          updated_at?: string
        }
      }
      categories: {
        Row: {
          id: string
          name: string
          slug: string
          icon: string
          description: string | null
          sort_order: number
          template_count: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          name: string
          slug: string
          icon?: string
          description?: string | null
          sort_order?: number
          template_count?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          icon?: string
          description?: string | null
          sort_order?: number
          template_count?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      templates: {
        Row: {
          id: string
          category_id: string
          name: string
          slug: string
          description: string | null
          keywords: string[]
          template_file_path: string
          variables: Json
          estimated_minutes: number
          is_active: boolean
          usage_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          category_id: string
          name: string
          slug: string
          description?: string | null
          keywords?: string[]
          template_file_path: string
          variables?: Json
          estimated_minutes?: number
          is_active?: boolean
          usage_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          category_id?: string
          name?: string
          slug?: string
          description?: string | null
          keywords?: string[]
          template_file_path?: string
          variables?: Json
          estimated_minutes?: number
          is_active?: boolean
          usage_count?: number
          created_at?: string
          updated_at?: string
        }
      }
      drafts: {
        Row: {
          id: string
          user_id: string
          template_id: string
          template_name: string
          category_name: string
          generated_file_path: string
          variables: Json
          expires_at: string
          created_at: string
        }
        Insert: {
          id: string
          user_id: string
          template_id: string
          template_name: string
          category_name: string
          generated_file_path: string
          variables?: Json
          expires_at: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          template_id?: string
          template_name?: string
          category_name?: string
          generated_file_path?: string
          variables?: Json
          expires_at?: string
          created_at?: string
        }
      }
      subscriptions: {
        Row: {
          id: string
          user_id: string
          plan_key: string
          status: string
          razorpay_subscription_id: string | null
          razorpay_plan_id: string | null
          current_period_start: string | null
          current_period_end: string | null
          created_at: string
          activated_at: string | null
          cancelled_at: string | null
          updated_at: string
        }
        Insert: {
          id: string
          user_id: string
          plan_key: string
          status?: string
          razorpay_subscription_id?: string | null
          razorpay_plan_id?: string | null
          current_period_start?: string | null
          current_period_end?: string | null
          created_at?: string
          activated_at?: string | null
          cancelled_at?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          plan_key?: string
          status?: string
          razorpay_subscription_id?: string | null
          razorpay_plan_id?: string | null
          current_period_start?: string | null
          current_period_end?: string | null
          created_at?: string
          activated_at?: string | null
          cancelled_at?: string | null
          updated_at?: string
        }
      }
      webhook_events: {
        Row: {
          id: string
          event_type: string
          payload: Json | null
          processed_at: string
        }
        Insert: {
          id: string
          event_type: string
          payload?: Json | null
          processed_at?: string
        }
        Update: {
          id?: string
          event_type?: string
          payload?: Json | null
          processed_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      search_templates: {
        Args: {
          search_query?: string
          category_filter?: string
          page_num?: number
          page_size?: number
        }
        Returns: Array<{
          id: string
          category_id: string
          name: string
          slug: string
          description: string | null
          keywords: string[]
          estimated_minutes: number
          variables: Json
          template_file_path: string
          usage_count: number
          rank: number
        }>
      }
      count_search_templates: {
        Args: {
          search_query?: string
          category_filter?: string
        }
        Returns: number
      }
      increment_category_count: {
        Args: {
          cat_id: string
        }
        Returns: void
      }
      increment_template_usage: {
        Args: {
          template_id: string
        }
        Returns: void
      }
    }
    Enums: {
      [_ in never]: never
    }
  }
}

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      api_tokens: {
        Row: {
          created_at: string
          id: string
          label: string
          last_used_at: string | null
          token_hash: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string
          last_used_at?: string | null
          token_hash: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          last_used_at?: string | null
          token_hash?: string
          user_id?: string
        }
        Relationships: []
      }
      client_errors: {
        Row: {
          created_at: string
          id: string
          message: string
          stack: string | null
          url: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          stack?: string | null
          url?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          stack?: string | null
          url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      climbing_attempts: {
        Row: {
          created_at: string
          grade: string
          id: string
          result: string
          session_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          grade: string
          id?: string
          result: string
          session_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          grade?: string
          id?: string
          result?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "climbing_attempts_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "climbing_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      climbing_sessions: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          session_date: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          session_date?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          session_date?: string
          user_id?: string
        }
        Relationships: []
      }
      event_friends: {
        Row: {
          created_at: string
          event_id: string
          friend_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          friend_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          friend_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_friends_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_friends_friend_id_fkey"
            columns: ["friend_id"]
            isOneToOne: false
            referencedRelation: "friends"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          event_date: string
          event_end_date: string | null
          event_end_time: string | null
          event_time: string | null
          google_account_id: string | null
          google_event_id: string | null
          html_link: string | null
          id: string
          location: string | null
          notes: string | null
          source: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_date: string
          event_end_date?: string | null
          event_end_time?: string | null
          event_time?: string | null
          google_account_id?: string | null
          google_event_id?: string | null
          html_link?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          source?: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_date?: string
          event_end_date?: string | null
          event_end_time?: string | null
          event_time?: string | null
          google_account_id?: string | null
          google_event_id?: string | null
          html_link?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          source?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_google_account_id_fkey"
            columns: ["google_account_id"]
            isOneToOne: false
            referencedRelation: "google_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      files: {
        Row: {
          created_at: string
          drive_file_id: string | null
          drive_modified_time: string | null
          folder: string
          id: string
          is_starred: boolean
          mime_type: string
          name: string
          notes: string | null
          relative_path: string
          root_folder_id: string | null
          size_bytes: number
          source: string
          storage_path: string
          user_id: string
        }
        Insert: {
          created_at?: string
          drive_file_id?: string | null
          drive_modified_time?: string | null
          folder: string
          id?: string
          is_starred?: boolean
          mime_type?: string
          name: string
          notes?: string | null
          relative_path?: string
          root_folder_id?: string | null
          size_bytes?: number
          source?: string
          storage_path: string
          user_id: string
        }
        Update: {
          created_at?: string
          drive_file_id?: string | null
          drive_modified_time?: string | null
          folder?: string
          id?: string
          is_starred?: boolean
          mime_type?: string
          name?: string
          notes?: string | null
          relative_path?: string
          root_folder_id?: string | null
          size_bytes?: number
          source?: string
          storage_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "files_root_folder_fkey"
            columns: ["user_id", "root_folder_id"]
            isOneToOne: false
            referencedRelation: "google_drive_folders"
            referencedColumns: ["user_id", "folder_id"]
          },
        ]
      }
      focus_summaries: {
        Row: {
          error: string | null
          generated_at: string | null
          id: string
          period: string
          status: string
          summary: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          error?: string | null
          generated_at?: string | null
          id?: string
          period: string
          status?: string
          summary?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          error?: string | null
          generated_at?: string | null
          id?: string
          period?: string
          status?: string
          summary?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      friend_interactions: {
        Row: {
          created_at: string
          friend_id: string
          id: string
          interaction_date: string
          note: string | null
          source_event_id: string | null
          source_todo_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          friend_id: string
          id?: string
          interaction_date: string
          note?: string | null
          source_event_id?: string | null
          source_todo_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          friend_id?: string
          id?: string
          interaction_date?: string
          note?: string | null
          source_event_id?: string | null
          source_todo_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "friend_interactions_friend_id_fkey"
            columns: ["friend_id"]
            isOneToOne: false
            referencedRelation: "friends"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friend_interactions_source_event_id_fkey"
            columns: ["source_event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friend_interactions_source_todo_id_fkey"
            columns: ["source_todo_id"]
            isOneToOne: false
            referencedRelation: "todos"
            referencedColumns: ["id"]
          },
        ]
      }
      friends: {
        Row: {
          avatar_url: string | null
          created_at: string
          details: string | null
          goal_count: number
          goal_mode: string
          goal_unit: string
          id: string
          last_notified_date: string | null
          name: string
          notes: string | null
          reminder_enabled: boolean
          reminder_notified_at: string | null
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          details?: string | null
          goal_count?: number
          goal_mode?: string
          goal_unit?: string
          id?: string
          last_notified_date?: string | null
          name: string
          notes?: string | null
          reminder_enabled?: boolean
          reminder_notified_at?: string | null
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          details?: string | null
          goal_count?: number
          goal_mode?: string
          goal_unit?: string
          id?: string
          last_notified_date?: string | null
          name?: string
          notes?: string | null
          reminder_enabled?: boolean
          reminder_notified_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      google_accounts: {
        Row: {
          access_token: string | null
          access_token_expires_at: string | null
          color: string
          created_at: string
          email: string
          id: string
          refresh_token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          access_token_expires_at?: string | null
          color?: string
          created_at?: string
          email: string
          id?: string
          refresh_token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          access_token_expires_at?: string | null
          color?: string
          created_at?: string
          email?: string
          id?: string
          refresh_token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      google_drive_folders: {
        Row: {
          created_at: string
          folder_id: string
          folder_name: string
          id: string
          last_synced_at: string | null
          sync_error: string | null
          sync_heartbeat_at: string | null
          sync_status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          folder_id: string
          folder_name: string
          id?: string
          last_synced_at?: string | null
          sync_error?: string | null
          sync_heartbeat_at?: string | null
          sync_status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          folder_id?: string
          folder_name?: string
          id?: string
          last_synced_at?: string | null
          sync_error?: string | null
          sync_heartbeat_at?: string | null
          sync_status?: string
          user_id?: string
        }
        Relationships: []
      }
      google_oauth_states: {
        Row: {
          created_at: string
          state: string
          user_id: string
        }
        Insert: {
          created_at?: string
          state?: string
          user_id: string
        }
        Update: {
          created_at?: string
          state?: string
          user_id?: string
        }
        Relationships: []
      }
      habit_logs: {
        Row: {
          created_at: string
          habit_id: string
          id: string
          logged_date: string
          paid_debt: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          habit_id: string
          id?: string
          logged_date: string
          paid_debt?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          habit_id?: string
          id?: string
          logged_date?: string
          paid_debt?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "habit_logs_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id"]
          },
        ]
      }
      habits: {
        Row: {
          color: string
          created_at: string
          debt: number
          debt_checked_date: string | null
          emoji: string
          frequency: string
          id: string
          last_notified_date: string | null
          name: string
          reminder_enabled: boolean
          reminder_time: string | null
          times_per_week: number | null
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          debt?: number
          debt_checked_date?: string | null
          emoji?: string
          frequency?: string
          id?: string
          last_notified_date?: string | null
          name: string
          reminder_enabled?: boolean
          reminder_time?: string | null
          times_per_week?: number | null
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          debt?: number
          debt_checked_date?: string | null
          emoji?: string
          frequency?: string
          id?: string
          last_notified_date?: string | null
          name?: string
          reminder_enabled?: boolean
          reminder_time?: string | null
          times_per_week?: number | null
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          read?: boolean
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      recipe_collection_items: {
        Row: {
          collection_id: string
          created_at: string
          id: string
          recipe_id: string
          user_id: string
        }
        Insert: {
          collection_id: string
          created_at?: string
          id?: string
          recipe_id: string
          user_id: string
        }
        Update: {
          collection_id?: string
          created_at?: string
          id?: string
          recipe_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_collection_items_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "recipe_collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_collection_items_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_collections: {
        Row: {
          created_at: string
          emoji: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      recipe_ingredients: {
        Row: {
          created_at: string
          id: string
          name: string
          note: string | null
          position: number
          quantity: number | null
          recipe_id: string
          unit: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          note?: string | null
          position?: number
          quantity?: number | null
          recipe_id: string
          unit?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          note?: string | null
          position?: number
          quantity?: number | null
          recipe_id?: string
          unit?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_ingredients_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_steps: {
        Row: {
          created_at: string
          id: string
          instruction: string
          position: number
          recipe_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          instruction: string
          position?: number
          recipe_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          instruction?: string
          position?: number
          recipe_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_steps_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          import_method: string
          last_viewed_at: string | null
          servings: number
          source_url: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          import_method?: string
          last_viewed_at?: string | null
          servings?: number
          source_url?: string | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          import_method?: string
          last_viewed_at?: string | null
          servings?: number
          source_url?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      shopping_items: {
        Row: {
          checked: boolean
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          checked?: boolean
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          checked?: boolean
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      stock_alerts: {
        Row: {
          created_at: string
          id: string
          symbol: string
          target_price: number
          triggered_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          symbol: string
          target_price?: number
          triggered_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          symbol?: string
          target_price?: number
          triggered_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      todo_friends: {
        Row: {
          created_at: string
          friend_id: string
          id: string
          todo_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          friend_id: string
          id?: string
          todo_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          friend_id?: string
          id?: string
          todo_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "todo_friends_friend_id_fkey"
            columns: ["friend_id"]
            isOneToOne: false
            referencedRelation: "friends"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "todo_friends_todo_id_fkey"
            columns: ["todo_id"]
            isOneToOne: false
            referencedRelation: "todos"
            referencedColumns: ["id"]
          },
        ]
      }
      todos: {
        Row: {
          completed: boolean
          completed_at: string | null
          created_at: string
          due_date: string | null
          due_time: string | null
          google_task_id: string | null
          id: string
          notes: string | null
          notified_at: string | null
          priority: string
          recurrence_interval: number | null
          recurrence_unit: string | null
          remind_at: string | null
          reminder_enabled: boolean
          source: string
          source_event_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          due_time?: string | null
          google_task_id?: string | null
          id?: string
          notes?: string | null
          notified_at?: string | null
          priority?: string
          recurrence_interval?: number | null
          recurrence_unit?: string | null
          remind_at?: string | null
          reminder_enabled?: boolean
          source?: string
          source_event_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          due_time?: string | null
          google_task_id?: string | null
          id?: string
          notes?: string | null
          notified_at?: string | null
          priority?: string
          recurrence_interval?: number | null
          recurrence_unit?: string | null
          remind_at?: string | null
          reminder_enabled?: boolean
          source?: string
          source_event_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          auto_generate_focus_summaries_daily_today: boolean
          auto_generate_focus_summaries_daily_week: boolean
          auto_generate_focus_summaries_on_change_today: boolean
          auto_generate_focus_summaries_on_change_week: boolean
          bottom_nav_items: Json
          default_focus_period: string
          show_focus_section: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_generate_focus_summaries_daily_today?: boolean
          auto_generate_focus_summaries_daily_week?: boolean
          auto_generate_focus_summaries_on_change_today?: boolean
          auto_generate_focus_summaries_on_change_week?: boolean
          bottom_nav_items?: Json
          default_focus_period?: string
          show_focus_section?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_generate_focus_summaries_daily_today?: boolean
          auto_generate_focus_summaries_daily_week?: boolean
          auto_generate_focus_summaries_on_change_today?: boolean
          auto_generate_focus_summaries_on_change_week?: boolean
          bottom_nav_items?: Json
          default_focus_period?: string
          show_focus_section?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      weather_cache: {
        Row: {
          condition: string | null
          error: string | null
          feels_like: number | null
          fetched_at: string | null
          humidity: number | null
          id: string
          is_day: boolean | null
          latitude: number
          longitude: number
          rain_notified_date: string | null
          status: string
          temperature: number | null
          updated_at: string
          user_id: string
          weather_code: number | null
          wind_speed: number | null
        }
        Insert: {
          condition?: string | null
          error?: string | null
          feels_like?: number | null
          fetched_at?: string | null
          humidity?: number | null
          id?: string
          is_day?: boolean | null
          latitude: number
          longitude: number
          rain_notified_date?: string | null
          status?: string
          temperature?: number | null
          updated_at?: string
          user_id: string
          weather_code?: number | null
          wind_speed?: number | null
        }
        Update: {
          condition?: string | null
          error?: string | null
          feels_like?: number | null
          fetched_at?: string | null
          humidity?: number | null
          id?: string
          is_day?: boolean | null
          latitude?: number
          longitude?: number
          rain_notified_date?: string | null
          status?: string
          temperature?: number | null
          updated_at?: string
          user_id?: string
          weather_code?: number | null
          wind_speed?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      notify_focus_refresh: {
        Args: { p_target_date: string; p_user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

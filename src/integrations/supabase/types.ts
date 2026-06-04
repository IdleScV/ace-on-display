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
      admin_chat_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          after: Json | null
          before: Json | null
          course_id: string | null
          created_at: string
          entity: string
          entity_id: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          after?: Json | null
          before?: Json | null
          course_id?: string | null
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          after?: Json | null
          before?: Json | null
          course_id?: string | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_holes: {
        Row: {
          course_id: string
          created_at: string
          hole_number: number
          id: string
          par: number
          topdown_url: string | null
          updated_at: string
          video_url: string | null
          yardage: number | null
        }
        Insert: {
          course_id: string
          created_at?: string
          hole_number: number
          id?: string
          par?: number
          topdown_url?: string | null
          updated_at?: string
          video_url?: string | null
          yardage?: number | null
        }
        Update: {
          course_id?: string
          created_at?: string
          hole_number?: number
          id?: string
          par?: number
          topdown_url?: string | null
          updated_at?: string
          video_url?: string | null
          yardage?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "course_holes_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_managers: {
        Row: {
          course_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_managers_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          created_at: string
          data_version: number
          display_sort: Database["public"]["Enums"]["display_sort"]
          has_touch: boolean
          id: string
          is_e2e: boolean
          is_multi_board: boolean
          logo_url: string | null
          name: string
          plan_label: string | null
          primary_color: string
          public_enabled: boolean
          secondary_color: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_version?: number
          display_sort?: Database["public"]["Enums"]["display_sort"]
          has_touch?: boolean
          id?: string
          is_e2e?: boolean
          is_multi_board?: boolean
          logo_url?: string | null
          name: string
          plan_label?: string | null
          primary_color?: string
          public_enabled?: boolean
          secondary_color?: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_version?: number
          display_sort?: Database["public"]["Enums"]["display_sort"]
          has_touch?: boolean
          id?: string
          is_e2e?: boolean
          is_multi_board?: boolean
          logo_url?: string | null
          name?: string
          plan_label?: string | null
          primary_color?: string
          public_enabled?: boolean
          secondary_color?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      display_alerts: {
        Row: {
          closed_at: string | null
          course_id: string
          id: string
          notified_at: string | null
          opened_at: string
        }
        Insert: {
          closed_at?: string | null
          course_id: string
          id?: string
          notified_at?: string | null
          opened_at?: string
        }
        Update: {
          closed_at?: string | null
          course_id?: string
          id?: string
          notified_at?: string | null
          opened_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "display_alerts_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      display_heartbeats: {
        Row: {
          client_info: Json | null
          course_id: string
          data_version: number | null
          id: number
          last_refresh_at: string | null
          ts: string
        }
        Insert: {
          client_info?: Json | null
          course_id: string
          data_version?: number | null
          id?: number
          last_refresh_at?: string | null
          ts?: string
        }
        Update: {
          client_info?: Json | null
          course_id?: string
          data_version?: number | null
          id?: number
          last_refresh_at?: string | null
          ts?: string
        }
        Relationships: [
          {
            foreignKeyName: "display_heartbeats_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      email_subscribers: {
        Row: {
          course_id: string
          created_at: string
          email: string
          entry_id: string | null
          golfer_name: string | null
          id: string
          source: string
          unsubscribe_token: string
          unsubscribed: boolean
        }
        Insert: {
          course_id: string
          created_at?: string
          email: string
          entry_id?: string | null
          golfer_name?: string | null
          id?: string
          source?: string
          unsubscribe_token?: string
          unsubscribed?: boolean
        }
        Update: {
          course_id?: string
          created_at?: string
          email?: string
          entry_id?: string | null
          golfer_name?: string | null
          id?: string
          source?: string
          unsubscribe_token?: string
          unsubscribed?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "email_subscribers_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_subscribers_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["id"]
          },
        ]
      }
      entries: {
        Row: {
          club: string | null
          course_id: string
          created_at: string
          created_by: string | null
          custom_plate: Json | null
          date_achieved: string
          favorite_hole: number | null
          golfer_email: string | null
          golfer_name: string
          handicap_at_time: number | null
          hole_number: number
          id: string
          is_e2e: boolean
          notes: string | null
          photo_url: string | null
          prior_holes_in_one: number | null
          status: Database["public"]["Enums"]["entry_status"]
          story: string | null
          submitted_via_intake: boolean
          updated_at: string
          updated_by: string | null
          video_url: string | null
          witness: string | null
          yardage: number | null
          years_playing: number | null
        }
        Insert: {
          club?: string | null
          course_id: string
          created_at?: string
          created_by?: string | null
          custom_plate?: Json | null
          date_achieved: string
          favorite_hole?: number | null
          golfer_email?: string | null
          golfer_name: string
          handicap_at_time?: number | null
          hole_number: number
          id?: string
          is_e2e?: boolean
          notes?: string | null
          photo_url?: string | null
          prior_holes_in_one?: number | null
          status?: Database["public"]["Enums"]["entry_status"]
          story?: string | null
          submitted_via_intake?: boolean
          updated_at?: string
          updated_by?: string | null
          video_url?: string | null
          witness?: string | null
          yardage?: number | null
          years_playing?: number | null
        }
        Update: {
          club?: string | null
          course_id?: string
          created_at?: string
          created_by?: string | null
          custom_plate?: Json | null
          date_achieved?: string
          favorite_hole?: number | null
          golfer_email?: string | null
          golfer_name?: string
          handicap_at_time?: number | null
          hole_number?: number
          id?: string
          is_e2e?: boolean
          notes?: string | null
          photo_url?: string | null
          prior_holes_in_one?: number | null
          status?: Database["public"]["Enums"]["entry_status"]
          story?: string | null
          submitted_via_intake?: boolean
          updated_at?: string
          updated_by?: string | null
          video_url?: string | null
          witness?: string | null
          yardage?: number | null
          years_playing?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "entries_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      entry_photos: {
        Row: {
          created_at: string
          entry_id: string
          id: string
          sort_order: number
          url: string
        }
        Insert: {
          created_at?: string
          entry_id: string
          id?: string
          sort_order?: number
          url: string
        }
        Update: {
          created_at?: string
          entry_id?: string
          id?: string
          sort_order?: number
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "entry_photos_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          is_e2e: boolean
          last_login_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          is_e2e?: boolean
          last_login_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_e2e?: boolean
          last_login_at?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_write_course_asset: {
        Args: { _path: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_course_manager: {
        Args: { _course_id: string; _user_id: string }
        Returns: boolean
      }
      is_superadmin: { Args: { _user_id: string }; Returns: boolean }
      resolve_course_id_from_slug: { Args: { _slug: string }; Returns: string }
      submit_public_entry: {
        Args: {
          _club?: string
          _date_achieved: string
          _favorite_hole?: number
          _golfer_email?: string
          _golfer_name: string
          _handicap_at_time?: number
          _hole_number: number
          _photo_urls?: string[]
          _prior_holes_in_one?: number
          _slug: string
          _story?: string
          _video_url?: string
          _witness: string
          _yardage?: number
          _years_playing?: number
        }
        Returns: string
      }
      unsubscribe_by_token: {
        Args: { _token: string }
        Returns: {
          already_unsubscribed: boolean
          course_name: string
        }[]
      }
    }
    Enums: {
      app_role: "superadmin" | "course_manager"
      display_sort: "newest" | "hole" | "year"
      entry_status: "draft" | "published" | "archived"
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
    Enums: {
      app_role: ["superadmin", "course_manager"],
      display_sort: ["newest", "hole", "year"],
      entry_status: ["draft", "published", "archived"],
    },
  },
} as const

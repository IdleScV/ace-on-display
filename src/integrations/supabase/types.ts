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
          updated_at: string
          yardage: number | null
        }
        Insert: {
          course_id: string
          created_at?: string
          hole_number: number
          id?: string
          par?: number
          updated_at?: string
          yardage?: number | null
        }
        Update: {
          course_id?: string
          created_at?: string
          hole_number?: number
          id?: string
          par?: number
          updated_at?: string
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
          id: string
          logo_url: string | null
          name: string
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
          id?: string
          logo_url?: string | null
          name: string
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
          id?: string
          logo_url?: string | null
          name?: string
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
      entries: {
        Row: {
          club: string | null
          course_id: string
          created_at: string
          created_by: string | null
          custom_plate: Json | null
          date_achieved: string
          golfer_name: string
          hole_number: number
          id: string
          notes: string | null
          photo_url: string | null
          status: Database["public"]["Enums"]["entry_status"]
          updated_at: string
          updated_by: string | null
          witness: string | null
          yardage: number | null
        }
        Insert: {
          club?: string | null
          course_id: string
          created_at?: string
          created_by?: string | null
          custom_plate?: Json | null
          date_achieved: string
          golfer_name: string
          hole_number: number
          id?: string
          notes?: string | null
          photo_url?: string | null
          status?: Database["public"]["Enums"]["entry_status"]
          updated_at?: string
          updated_by?: string | null
          witness?: string | null
          yardage?: number | null
        }
        Update: {
          club?: string | null
          course_id?: string
          created_at?: string
          created_by?: string | null
          custom_plate?: Json | null
          date_achieved?: string
          golfer_name?: string
          hole_number?: number
          id?: string
          notes?: string | null
          photo_url?: string | null
          status?: Database["public"]["Enums"]["entry_status"]
          updated_at?: string
          updated_by?: string | null
          witness?: string | null
          yardage?: number | null
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
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          last_login_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          last_login_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
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

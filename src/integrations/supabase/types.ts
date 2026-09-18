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
      equipment: {
        Row: {
          amortization_years: number | null
          category: string
          created_at: string
          custom_category: string | null
          equipment_type_id: string | null
          id: string
          name: string
          notes: string | null
          purchase_cost: number | null
          purchase_date: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amortization_years?: number | null
          category?: string
          created_at?: string
          custom_category?: string | null
          equipment_type_id?: string | null
          id?: string
          name: string
          notes?: string | null
          purchase_cost?: number | null
          purchase_date?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amortization_years?: number | null
          category?: string
          created_at?: string
          custom_category?: string | null
          equipment_type_id?: string | null
          id?: string
          name?: string
          notes?: string | null
          purchase_cost?: number | null
          purchase_date?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_equipment_type_id_fkey"
            columns: ["equipment_type_id"]
            isOneToOne: false
            referencedRelation: "equipment_types"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_maintenance: {
        Row: {
          cost: number | null
          created_at: string
          description: string
          equipment_id: string
          id: string
          maintenance_date: string
          maintenance_type_id: string | null
          next_due_date: string | null
          reminder_sent_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cost?: number | null
          created_at?: string
          description: string
          equipment_id: string
          id?: string
          maintenance_date?: string
          maintenance_type_id?: string | null
          next_due_date?: string | null
          reminder_sent_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cost?: number | null
          created_at?: string
          description?: string
          equipment_id?: string
          id?: string
          maintenance_date?: string
          maintenance_type_id?: string | null
          next_due_date?: string | null
          reminder_sent_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_maintenance_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_maintenance_maintenance_type_id_fkey"
            columns: ["maintenance_type_id"]
            isOneToOne: false
            referencedRelation: "maintenance_types"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_maintenance_schedules: {
        Row: {
          created_at: string
          equipment_id: string
          id: string
          last_completed_date: string | null
          last_maintenance_id: string | null
          maintenance_type_id: string
          next_due_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          equipment_id: string
          id?: string
          last_completed_date?: string | null
          last_maintenance_id?: string | null
          maintenance_type_id: string
          next_due_date: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          equipment_id?: string
          id?: string
          last_completed_date?: string | null
          last_maintenance_id?: string | null
          maintenance_type_id?: string
          next_due_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_maintenance_schedules_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_maintenance_schedules_last_maintenance_id_fkey"
            columns: ["last_maintenance_id"]
            isOneToOne: false
            referencedRelation: "equipment_maintenance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_maintenance_schedules_maintenance_type_id_fkey"
            columns: ["maintenance_type_id"]
            isOneToOne: false
            referencedRelation: "maintenance_types"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_type_maintenance_types: {
        Row: {
          created_at: string
          equipment_type_id: string
          maintenance_type_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          equipment_type_id: string
          maintenance_type_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          equipment_type_id?: string
          maintenance_type_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_type_maintenance_types_equipment_type_id_fkey"
            columns: ["equipment_type_id"]
            isOneToOne: false
            referencedRelation: "equipment_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_type_maintenance_types_maintenance_type_id_fkey"
            columns: ["maintenance_type_id"]
            isOneToOne: false
            referencedRelation: "maintenance_types"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_types: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      maintenance_types: {
        Row: {
          created_at: string
          id: string
          interval_months: number
          name: string
          reminder_days: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          interval_months: number
          name: string
          reminder_days?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          interval_months?: number
          name?: string
          reminder_days?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      site_web_connections: {
        Row: {
          access_token_secret_id: string | null
          created_at: string
          external_account_id: string | null
          external_account_name: string | null
          id: string
          last_error: string | null
          last_sync_at: string | null
          last_sync_status: string | null
          metadata: Json
          provider: string
          refresh_token_secret_id: string | null
          scopes: string[]
          status: string
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token_secret_id?: string | null
          created_at?: string
          external_account_id?: string | null
          external_account_name?: string | null
          id?: string
          last_error?: string | null
          last_sync_at?: string | null
          last_sync_status?: string | null
          metadata?: Json
          provider: string
          refresh_token_secret_id?: string | null
          scopes?: string[]
          status?: string
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token_secret_id?: string | null
          created_at?: string
          external_account_id?: string | null
          external_account_name?: string | null
          id?: string
          last_error?: string | null
          last_sync_at?: string | null
          last_sync_status?: string | null
          metadata?: Json
          provider?: string
          refresh_token_secret_id?: string | null
          scopes?: string[]
          status?: string
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      site_web_oauth_states: {
        Row: {
          created_at: string
          expires_at: string
          provider: string
          state_hash: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          provider: string
          state_hash: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          provider?: string
          state_hash?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      complete_equipment_maintenance: {
        Args: {
          p_cost?: number
          p_maintenance_date: string
          p_schedule_id: string
        }
        Returns: {
          cost: number | null
          created_at: string
          description: string
          equipment_id: string
          id: string
          maintenance_date: string
          maintenance_type_id: string | null
          next_due_date: string | null
          reminder_sent_at: string | null
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "equipment_maintenance"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      consume_site_web_oauth_state: {
        Args: { p_provider: string; p_state_hash: string; p_user_id: string }
        Returns: boolean
      }
      get_site_web_google_tokens: {
        Args: { p_provider: string; p_user_id: string }
        Returns: Json
      }
      store_site_web_google_tokens:
        | {
            Args: {
              p_access_token: string
              p_expires_at: string
              p_provider: string
              p_refresh_token: string
              p_user_id: string
            }
            Returns: string
          }
        | {
            Args: {
              p_access_token: string
              p_expires_at: string
              p_external_account_id?: string
              p_external_account_name?: string
              p_provider: string
              p_refresh_token: string
              p_scopes?: string[]
              p_user_id: string
            }
            Returns: string
          }
      sync_equipment_maintenance_schedules: {
        Args: { p_equipment_id: string }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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

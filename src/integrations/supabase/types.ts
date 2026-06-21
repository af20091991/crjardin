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
      client_messages: {
        Row: {
          author_name: string | null
          client_id: string
          content: string
          created_at: string
          id: string
          intervention_id: string | null
          kind: string
          resolved: boolean
          sender: string
        }
        Insert: {
          author_name?: string | null
          client_id: string
          content: string
          created_at?: string
          id?: string
          intervention_id?: string | null
          kind?: string
          resolved?: boolean
          sender?: string
        }
        Update: {
          author_name?: string | null
          client_id?: string
          content?: string
          created_at?: string
          id?: string
          intervention_id?: string | null
          kind?: string
          resolved?: boolean
          sender?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_messages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_messages_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: false
            referencedRelation: "interventions"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          civility: string | null
          contract_type: string | null
          created_at: string
          email: string | null
          frequency: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          share_token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          civility?: string | null
          contract_type?: string | null
          created_at?: string
          email?: string | null
          frequency?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          share_token?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          civility?: string | null
          contract_type?: string | null
          created_at?: string
          email?: string | null
          frequency?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          share_token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_settings: {
        Row: {
          body: string
          created_at: string
          key: string
          subject: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          key: string
          subject: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          key?: string
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      favorite_tasks: {
        Row: {
          created_at: string
          id: string
          label: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          user_id?: string
        }
        Relationships: []
      }
      garden_health: {
        Row: {
          assessed_on: string
          client_id: string
          created_at: string
          id: string
          intervention_id: string | null
          note: string | null
          rating: string
          user_id: string
          zone: string
        }
        Insert: {
          assessed_on?: string
          client_id: string
          created_at?: string
          id?: string
          intervention_id?: string | null
          note?: string | null
          rating: string
          user_id: string
          zone: string
        }
        Update: {
          assessed_on?: string
          client_id?: string
          created_at?: string
          id?: string
          intervention_id?: string | null
          note?: string | null
          rating?: string
          user_id?: string
          zone?: string
        }
        Relationships: [
          {
            foreignKeyName: "garden_health_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garden_health_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: false
            referencedRelation: "interventions"
            referencedColumns: ["id"]
          },
        ]
      }
      intervention_counters: {
        Row: {
          last_seq: number
          user_id: string
          year: number
        }
        Insert: {
          last_seq?: number
          user_id: string
          year: number
        }
        Update: {
          last_seq?: number
          user_id?: string
          year?: number
        }
        Relationships: []
      }
      intervention_photos: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          include_in_report: boolean
          intervention_id: string
          lat: number | null
          lng: number | null
          position: number
          storage_path: string
          user_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          include_in_report?: boolean
          intervention_id: string
          lat?: number | null
          lng?: number | null
          position?: number
          storage_path: string
          user_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          include_in_report?: boolean
          intervention_id?: string
          lat?: number | null
          lng?: number | null
          position?: number
          storage_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "intervention_photos_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: false
            referencedRelation: "interventions"
            referencedColumns: ["id"]
          },
        ]
      }
      intervention_tasks: {
        Row: {
          created_at: string
          id: string
          intervention_id: string
          label: string
          note: string | null
          position: number
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          intervention_id: string
          label: string
          note?: string | null
          position?: number
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          intervention_id?: string
          label?: string
          note?: string | null
          position?: number
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "intervention_tasks_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: false
            referencedRelation: "interventions"
            referencedColumns: ["id"]
          },
        ]
      }
      interventions: {
        Row: {
          client_id: string
          client_read_at: string | null
          client_read_count: number
          created_at: string
          garden_state: string | null
          id: string
          intervention_date: string
          intervention_type: string | null
          recommendations_text: string | null
          reference: string | null
          status: string
          summary: string | null
          title: string | null
          upcoming_works: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id: string
          client_read_at?: string | null
          client_read_count?: number
          created_at?: string
          garden_state?: string | null
          id?: string
          intervention_date?: string
          intervention_type?: string | null
          recommendations_text?: string | null
          reference?: string | null
          status?: string
          summary?: string | null
          title?: string | null
          upcoming_works?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string
          client_read_at?: string | null
          client_read_count?: number
          created_at?: string
          garden_state?: string | null
          id?: string
          intervention_date?: string
          intervention_type?: string | null
          recommendations_text?: string | null
          reference?: string | null
          status?: string
          summary?: string | null
          title?: string | null
          upcoming_works?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "interventions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      login_events: {
        Row: {
          created_at: string
          id: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          client_id: string | null
          created_at: string
          id: string
          intervention_id: string | null
          is_read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          client_id?: string | null
          created_at?: string
          id?: string
          intervention_id?: string | null
          is_read?: boolean
          title: string
          type?: string
          user_id: string
        }
        Update: {
          body?: string | null
          client_id?: string | null
          created_at?: string
          id?: string
          intervention_id?: string | null
          is_read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          company_name: string | null
          created_at: string
          display_name: string | null
          hourly_rate: number
          id: string
          signature_data: string | null
          stamp_data: string | null
          updated_at: string
        }
        Insert: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          company_name?: string | null
          created_at?: string
          display_name?: string | null
          hourly_rate?: number
          id: string
          signature_data?: string | null
          stamp_data?: string | null
          updated_at?: string
        }
        Update: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          company_name?: string | null
          created_at?: string
          display_name?: string | null
          hourly_rate?: number
          id?: string
          signature_data?: string | null
          stamp_data?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      recommendations: {
        Row: {
          category: string | null
          client_id: string
          client_interest: string | null
          client_interest_at: string | null
          created_at: string
          description: string | null
          estimated_hours: number | null
          id: string
          intervention_id: string | null
          source: string
          status: string
          title: string
          unit_price: number
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          client_id: string
          client_interest?: string | null
          client_interest_at?: string | null
          created_at?: string
          description?: string | null
          estimated_hours?: number | null
          id?: string
          intervention_id?: string | null
          source?: string
          status?: string
          title: string
          unit_price?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          client_id?: string
          client_interest?: string | null
          client_interest_at?: string | null
          created_at?: string
          description?: string | null
          estimated_hours?: number | null
          id?: string
          intervention_id?: string | null
          source?: string
          status?: string
          title?: string
          unit_price?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recommendations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendations_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: false
            referencedRelation: "interventions"
            referencedColumns: ["id"]
          },
        ]
      }
      reminders: {
        Row: {
          client_id: string | null
          created_at: string
          done: boolean
          due_date: string | null
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          done?: boolean
          due_date?: string | null
          id?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          done?: boolean
          due_date?: string | null
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      report_templates: {
        Row: {
          created_at: string
          id: string
          intervention_type: string | null
          name: string
          summary: string | null
          tasks: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          intervention_type?: string | null
          name: string
          summary?: string | null
          tasks?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          intervention_type?: string | null
          name?: string
          summary?: string | null
          tasks?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      share_access_log: {
        Row: {
          accessed_at: string
          client_id: string
          id: string
          ip_address: string | null
          user_agent: string | null
        }
        Insert: {
          accessed_at?: string
          client_id: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
        }
        Update: {
          accessed_at?: string
          client_id?: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "share_access_log_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
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
      add_client_message: {
        Args: {
          p_author_name?: string
          p_content: string
          p_intervention_id: string
          p_kind: string
          p_token: string
        }
        Returns: string
      }
      admin_delete_user: { Args: { p_user_id: string }; Returns: undefined }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_shared_client: { Args: { p_token: string }; Returns: Json }
      get_shared_messages: { Args: { p_token: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_approved: { Args: { _user_id: string }; Returns: boolean }
      mark_shared_read:
        | {
            Args: { p_token: string; p_user_agent?: string }
            Returns: undefined
          }
        | {
            Args: { p_ip?: string; p_token: string; p_user_agent?: string }
            Returns: undefined
          }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      next_intervention_reference: { Args: never; Returns: string }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      record_login: { Args: { p_user_agent?: string }; Returns: undefined }
      set_recommendation_interest: {
        Args: { p_interest: string; p_reco_id: string; p_token: string }
        Returns: undefined
      }
      set_user_approval: {
        Args: { p_status: string; p_user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "user" | "prestataire" | "observateur"
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
      app_role: ["admin", "user", "prestataire", "observateur"],
    },
  },
} as const

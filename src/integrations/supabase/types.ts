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
      admin_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string | null
          created_at: string
          details: Json | null
          id: string
          target_name: string | null
          target_user_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          target_name?: string | null
          target_user_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          target_name?: string | null
          target_user_id?: string | null
        }
        Relationships: []
      }
      charge_categories: {
        Row: {
          code: string
          created_at: string
          id: string
          kind: string
          label: string
          position: number
          updated_at: string
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          kind: string
          label: string
          position?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          kind?: string
          label?: string
          position?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      charges_one_off: {
        Row: {
          amortization_months: number | null
          amount_ht: number
          charge_category_id: string
          created_at: string
          id: string
          label: string
          note: string | null
          purchase_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amortization_months?: number | null
          amount_ht: number
          charge_category_id: string
          created_at?: string
          id?: string
          label: string
          note?: string | null
          purchase_date: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amortization_months?: number | null
          amount_ht?: number
          charge_category_id?: string
          created_at?: string
          id?: string
          label?: string
          note?: string | null
          purchase_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "charges_one_off_charge_category_id_fkey"
            columns: ["charge_category_id"]
            isOneToOne: false
            referencedRelation: "charge_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      charges_recurring: {
        Row: {
          amount_ht: number
          charge_category_id: string
          created_at: string
          id: string
          label: string
          note: string | null
          periodicity: string
          updated_at: string
          user_id: string
          valid_from: string
          valid_to: string | null
        }
        Insert: {
          amount_ht: number
          charge_category_id: string
          created_at?: string
          id?: string
          label: string
          note?: string | null
          periodicity: string
          updated_at?: string
          user_id: string
          valid_from: string
          valid_to?: string | null
        }
        Update: {
          amount_ht?: number
          charge_category_id?: string
          created_at?: string
          id?: string
          label?: string
          note?: string | null
          periodicity?: string
          updated_at?: string
          user_id?: string
          valid_from?: string
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "charges_recurring_charge_category_id_fkey"
            columns: ["charge_category_id"]
            isOneToOne: false
            referencedRelation: "charge_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      charges_variable_rates: {
        Row: {
          amount_per_unit: number
          charge_category_id: string
          created_at: string
          id: string
          label: string
          note: string | null
          unit: string
          user_id: string
          valid_from: string
          valid_to: string | null
        }
        Insert: {
          amount_per_unit: number
          charge_category_id: string
          created_at?: string
          id?: string
          label: string
          note?: string | null
          unit: string
          user_id: string
          valid_from: string
          valid_to?: string | null
        }
        Update: {
          amount_per_unit?: number
          charge_category_id?: string
          created_at?: string
          id?: string
          label?: string
          note?: string | null
          unit?: string
          user_id?: string
          valid_from?: string
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "charges_variable_rates_charge_category_id_fkey"
            columns: ["charge_category_id"]
            isOneToOne: false
            referencedRelation: "charge_categories"
            referencedColumns: ["id"]
          },
        ]
      }
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
          emails: string[]
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
          emails?: string[]
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
          emails?: string[]
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
      email_opens: {
        Row: {
          created_at: string
          message_id: string
          open_count: number
          opened_at: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          message_id: string
          open_count?: number
          opened_at?: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          message_id?: string
          open_count?: number
          opened_at?: string
          user_agent?: string | null
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
      pilot_ca_entries: {
        Row: {
          amount_ht: number
          category: string | null
          client_id: string | null
          created_at: string
          designation: string | null
          hours: number | null
          id: string
          is_fixed: boolean
          kind: string
          month: number
          note: string | null
          position: number
          updated_at: string
          user_id: string
          year: number
        }
        Insert: {
          amount_ht?: number
          category?: string | null
          client_id?: string | null
          created_at?: string
          designation?: string | null
          hours?: number | null
          id?: string
          is_fixed?: boolean
          kind: string
          month: number
          note?: string | null
          position?: number
          updated_at?: string
          user_id: string
          year: number
        }
        Update: {
          amount_ht?: number
          category?: string | null
          client_id?: string | null
          created_at?: string
          designation?: string | null
          hours?: number | null
          id?: string
          is_fixed?: boolean
          kind?: string
          month?: number
          note?: string | null
          position?: number
          updated_at?: string
          user_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "pilot_ca_entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      pilot_charges: {
        Row: {
          amount: number
          category: string | null
          charge_date: string | null
          created_at: string
          id: string
          kind: string
          label: string
          period: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          category?: string | null
          charge_date?: string | null
          created_at?: string
          id?: string
          kind?: string
          label: string
          period?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: string | null
          charge_date?: string | null
          created_at?: string
          id?: string
          kind?: string
          label?: string
          period?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pilot_client_notes: {
        Row: {
          client_key: string
          created_at: string
          id: string
          note: string
          updated_at: string
          user_id: string
        }
        Insert: {
          client_key: string
          created_at?: string
          id?: string
          note?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          client_key?: string
          created_at?: string
          id?: string
          note?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pilot_goals: {
        Row: {
          comment: string | null
          completed_date: string | null
          created_at: string
          deadline: string | null
          id: string
          position: number
          priority: string
          status: string
          theme: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          comment?: string | null
          completed_date?: string | null
          created_at?: string
          deadline?: string | null
          id?: string
          position?: number
          priority?: string
          status?: string
          theme: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          comment?: string | null
          completed_date?: string | null
          created_at?: string
          deadline?: string | null
          id?: string
          position?: number
          priority?: string
          status?: string
          theme?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pilot_hours: {
        Row: {
          created_at: string
          id: string
          jours_travailles: number | null
          month: number
          temps_terrain: number | null
          updated_at: string
          user_id: string
          year: number
        }
        Insert: {
          created_at?: string
          id?: string
          jours_travailles?: number | null
          month: number
          temps_terrain?: number | null
          updated_at?: string
          user_id: string
          year: number
        }
        Update: {
          created_at?: string
          id?: string
          jours_travailles?: number | null
          month?: number
          temps_terrain?: number | null
          updated_at?: string
          user_id?: string
          year?: number
        }
        Relationships: []
      }
      pilot_settings: {
        Row: {
          created_at: string
          monthly_fixed_charges: number
          monthly_salary: number
          target_hourly_rate: number
          target_tjm: number
          updated_at: string
          user_id: string
          weekly_hours: number
        }
        Insert: {
          created_at?: string
          monthly_fixed_charges?: number
          monthly_salary?: number
          target_hourly_rate?: number
          target_tjm?: number
          updated_at?: string
          user_id: string
          weekly_hours?: number
        }
        Update: {
          created_at?: string
          monthly_fixed_charges?: number
          monthly_salary?: number
          target_hourly_rate?: number
          target_tjm?: number
          updated_at?: string
          user_id?: string
          weekly_hours?: number
        }
        Relationships: []
      }
      pilot_tjm_settings: {
        Row: {
          bureau: number
          charges_fixes: number
          charges_variables: number
          conges: number
          created_at: string
          feries: number
          heures_gestion: number
          heures_jour: number
          id: string
          jours_off: number
          meteo: number
          objectif_remuneration: number
          revenus_bruts: number
          updated_at: string
          user_id: string
          weekend: number
        }
        Insert: {
          bureau?: number
          charges_fixes?: number
          charges_variables?: number
          conges?: number
          created_at?: string
          feries?: number
          heures_gestion?: number
          heures_jour?: number
          id?: string
          jours_off?: number
          meteo?: number
          objectif_remuneration?: number
          revenus_bruts?: number
          updated_at?: string
          user_id: string
          weekend?: number
        }
        Update: {
          bureau?: number
          charges_fixes?: number
          charges_variables?: number
          conges?: number
          created_at?: string
          feries?: number
          heures_gestion?: number
          heures_jour?: number
          id?: string
          jours_off?: number
          meteo?: number
          objectif_remuneration?: number
          revenus_bruts?: number
          updated_at?: string
          user_id?: string
          weekend?: number
        }
        Relationships: []
      }
      planning_notes: {
        Row: {
          client_id: string | null
          created_at: string
          created_by: string | null
          details: string | null
          id: string
          scheduled_date: string
          title: string
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          details?: string | null
          id?: string
          scheduled_date: string
          title: string
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          details?: string | null
          id?: string
          scheduled_date?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "planning_notes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
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
          client_viewed_at: string | null
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
          client_viewed_at?: string | null
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
          client_viewed_at?: string | null
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
      service_categories: {
        Row: {
          code: string
          color: string | null
          created_at: string
          id: string
          is_archived: boolean
          label: string
          position: number
          updated_at: string
          user_id: string
        }
        Insert: {
          code: string
          color?: string | null
          created_at?: string
          id?: string
          is_archived?: boolean
          label: string
          position?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          code?: string
          color?: string | null
          created_at?: string
          id?: string
          is_archived?: boolean
          label?: string
          position?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      service_prices: {
        Row: {
          created_at: string
          id: string
          material_cost: number
          note: string | null
          price_ht: number
          service_id: string
          tva_rate: number
          user_id: string
          valid_from: string
          valid_to: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          material_cost?: number
          note?: string | null
          price_ht: number
          service_id: string
          tva_rate?: number
          user_id: string
          valid_from: string
          valid_to?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          material_cost?: number
          note?: string | null
          price_ht?: number
          service_id?: string
          tva_rate?: number
          user_id?: string
          valid_from?: string
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_prices_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_prices_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "v_service_margin"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "service_prices_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "v_service_seasonality_resolved"
            referencedColumns: ["service_id"]
          },
        ]
      }
      service_seasonality: {
        Row: {
          category_id: string | null
          created_at: string
          id: string
          intensity: number
          month: number
          scope: string
          service_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          id?: string
          intensity?: number
          month: number
          scope: string
          service_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          id?: string
          intensity?: number
          month?: number
          scope?: string
          service_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_seasonality_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_seasonality_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_seasonality_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "v_service_margin"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "service_seasonality_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "v_service_seasonality_resolved"
            referencedColumns: ["service_id"]
          },
        ]
      }
      services: {
        Row: {
          category_id: string
          code: string
          created_at: string
          default_frequency: string | null
          description: string | null
          id: string
          is_archived: boolean
          is_recurring: boolean
          label: string
          standard_duration_hours: number | null
          tags: string[]
          unit: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category_id: string
          code: string
          created_at?: string
          default_frequency?: string | null
          description?: string | null
          id?: string
          is_archived?: boolean
          is_recurring?: boolean
          label: string
          standard_duration_hours?: number | null
          tags?: string[]
          unit: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category_id?: string
          code?: string
          created_at?: string
          default_frequency?: string | null
          description?: string | null
          id?: string
          is_archived?: boolean
          is_recurring?: boolean
          label?: string
          standard_duration_hours?: number | null
          tags?: string[]
          unit?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      share_access_log: {
        Row: {
          accessed_at: string
          client_id: string
          id: string
          ip_address: string | null
          section: string
          user_agent: string | null
        }
        Insert: {
          accessed_at?: string
          client_id: string
          id?: string
          ip_address?: string | null
          section?: string
          user_agent?: string | null
        }
        Update: {
          accessed_at?: string
          client_id?: string
          id?: string
          ip_address?: string | null
          section?: string
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
      time_categories: {
        Row: {
          code: string
          color: string | null
          created_at: string
          id: string
          is_billable: boolean
          label: string
          position: number
          updated_at: string
          user_id: string
        }
        Insert: {
          code: string
          color?: string | null
          created_at?: string
          id?: string
          is_billable?: boolean
          label: string
          position?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          code?: string
          color?: string | null
          created_at?: string
          id?: string
          is_billable?: boolean
          label?: string
          position?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      time_standards: {
        Row: {
          created_at: string
          hours_per_day: number
          id: string
          note: string | null
          target_ratio: number
          time_category_id: string
          user_id: string
          valid_from: string
          valid_to: string | null
          working_days_per_year: number
        }
        Insert: {
          created_at?: string
          hours_per_day?: number
          id?: string
          note?: string | null
          target_ratio: number
          time_category_id: string
          user_id: string
          valid_from: string
          valid_to?: string | null
          working_days_per_year?: number
        }
        Update: {
          created_at?: string
          hours_per_day?: number
          id?: string
          note?: string | null
          target_ratio?: number
          time_category_id?: string
          user_id?: string
          valid_from?: string
          valid_to?: string | null
          working_days_per_year?: number
        }
        Relationships: [
          {
            foreignKeyName: "time_standards_time_category_id_fkey"
            columns: ["time_category_id"]
            isOneToOne: false
            referencedRelation: "time_categories"
            referencedColumns: ["id"]
          },
        ]
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
      worksite_sheets: {
        Row: {
          access_complement: string | null
          address: string | null
          checklist: Json
          civility: string | null
          client_id: string | null
          client_name: string
          client_phone: string | null
          client_phone_backup: string | null
          client_present: boolean | null
          contact_person: string | null
          created_at: string
          epi: Json
          equipment: Json
          garden_markers: Json
          green_waste: boolean | null
          id: string
          intervenant: string | null
          intervention_date: string | null
          latitude: number | null
          longitude: number | null
          notes: string | null
          photos: Json
          recycling_center: Json | null
          tasks: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          access_complement?: string | null
          address?: string | null
          checklist?: Json
          civility?: string | null
          client_id?: string | null
          client_name?: string
          client_phone?: string | null
          client_phone_backup?: string | null
          client_present?: boolean | null
          contact_person?: string | null
          created_at?: string
          epi?: Json
          equipment?: Json
          garden_markers?: Json
          green_waste?: boolean | null
          id?: string
          intervenant?: string | null
          intervention_date?: string | null
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          photos?: Json
          recycling_center?: Json | null
          tasks?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          access_complement?: string | null
          address?: string | null
          checklist?: Json
          civility?: string | null
          client_id?: string | null
          client_name?: string
          client_phone?: string | null
          client_phone_backup?: string | null
          client_present?: boolean | null
          contact_person?: string | null
          created_at?: string
          epi?: Json
          equipment?: Json
          garden_markers?: Json
          green_waste?: boolean | null
          id?: string
          intervenant?: string | null
          intervention_date?: string | null
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          photos?: Json
          recycling_center?: Json | null
          tasks?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "worksite_sheets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_billable_hours_target: {
        Row: {
          billable_hours_year: number | null
          user_id: string | null
        }
        Relationships: []
      }
      v_charges_monthly: {
        Row: {
          monthly_recurring: number | null
          user_id: string | null
        }
        Relationships: []
      }
      v_real_hourly_cost: {
        Row: {
          real_hourly_cost: number | null
          user_id: string | null
        }
        Relationships: []
      }
      v_service_current_price: {
        Row: {
          material_cost: number | null
          price_ht: number | null
          service_id: string | null
          tva_rate: number | null
          user_id: string | null
          valid_from: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_prices_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_prices_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "v_service_margin"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "service_prices_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "v_service_seasonality_resolved"
            referencedColumns: ["service_id"]
          },
        ]
      }
      v_service_margin: {
        Row: {
          gross_margin: number | null
          label: string | null
          material_cost: number | null
          price_ht: number | null
          real_hourly_cost: number | null
          service_id: string | null
          standard_duration_hours: number | null
          unit: string | null
          user_id: string | null
        }
        Relationships: []
      }
      v_service_seasonality_resolved: {
        Row: {
          intensity: number | null
          month: number | null
          service_id: string | null
          user_id: string | null
        }
        Relationships: []
      }
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
      clear_share_access_log: { Args: never; Returns: undefined }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_or_create_unsubscribe_token: {
        Args: { p_email: string }
        Returns: string
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
      is_editor: { Args: { _user_id: string }; Returns: boolean }
      log_admin_action: {
        Args: { p_action: string; p_details?: Json; p_target_user_id: string }
        Returns: undefined
      }
      mark_recommendations_viewed: {
        Args: { p_ip?: string; p_token: string; p_user_agent?: string }
        Returns: undefined
      }
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
      set_user_role: {
        Args: {
          p_role: Database["public"]["Enums"]["app_role"]
          p_user_id: string
        }
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

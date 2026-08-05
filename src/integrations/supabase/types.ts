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
      ceev_contracts: {
        Row: {
          charges: number
          client_id: string | null
          created_at: string
          hours: number | null
          id: string
          import_source: string | null
          label: string
          margin_net: number
          match_method: string | null
          match_score: number | null
          match_status: string
          notes: string | null
          pv_ht: number
          raw_label: string
          status: string
          updated_at: string
          user_id: string
          validation_status: string
          year: number
        }
        Insert: {
          charges?: number
          client_id?: string | null
          created_at?: string
          hours?: number | null
          id?: string
          import_source?: string | null
          label: string
          margin_net?: number
          match_method?: string | null
          match_score?: number | null
          match_status?: string
          notes?: string | null
          pv_ht?: number
          raw_label: string
          status?: string
          updated_at?: string
          user_id: string
          validation_status?: string
          year: number
        }
        Update: {
          charges?: number
          client_id?: string | null
          created_at?: string
          hours?: number | null
          id?: string
          import_source?: string | null
          label?: string
          margin_net?: number
          match_method?: string | null
          match_score?: number | null
          match_status?: string
          notes?: string | null
          pv_ht?: number
          raw_label?: string
          status?: string
          updated_at?: string
          user_id?: string
          validation_status?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "ceev_contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ceev_contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_ca_orphans_report"
            referencedColumns: ["best_candidate_id"]
          },
          {
            foreignKeyName: "ceev_contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_service_gaps"
            referencedColumns: ["client_id"]
          },
        ]
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
      client_merge_log: {
        Row: {
          created_at: string
          id: string
          moved: Json
          reason: string | null
          reverted_at: string | null
          source_client_id: string
          source_client_name: string
          target_client_id: string
          target_client_name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          moved?: Json
          reason?: string | null
          reverted_at?: string | null
          source_client_id: string
          source_client_name: string
          target_client_id: string
          target_client_name: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          moved?: Json
          reason?: string | null
          reverted_at?: string | null
          source_client_id?: string
          source_client_name?: string
          target_client_id?: string
          target_client_name?: string
          user_id?: string
        }
        Relationships: []
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
            foreignKeyName: "client_messages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_ca_orphans_report"
            referencedColumns: ["best_candidate_id"]
          },
          {
            foreignKeyName: "client_messages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_service_gaps"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_messages_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: false
            referencedRelation: "interventions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_messages_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: false
            referencedRelation: "v_intervention_pnl"
            referencedColumns: ["intervention_id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          civility: string | null
          contract_type: string | null
          created_at: string
          default_contact_id: string | null
          email: string | null
          emails: string[]
          entity_certified_at: string | null
          entity_certified_by: string | null
          entity_confidence: number | null
          entity_notes: string | null
          entity_status: string
          entity_status_source: string
          frequency: string | null
          id: string
          lifecycle_status: string
          lost_at: string | null
          merged_at: string | null
          merged_into_client_id: string | null
          merged_reason: string | null
          name: string
          notes: string | null
          phone: string | null
          report_policy: string
          share_token: string
          source: string | null
          source_confidence: string | null
          suggested_entity_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          civility?: string | null
          contract_type?: string | null
          created_at?: string
          default_contact_id?: string | null
          email?: string | null
          emails?: string[]
          entity_certified_at?: string | null
          entity_certified_by?: string | null
          entity_confidence?: number | null
          entity_notes?: string | null
          entity_status?: string
          entity_status_source?: string
          frequency?: string | null
          id?: string
          lifecycle_status?: string
          lost_at?: string | null
          merged_at?: string | null
          merged_into_client_id?: string | null
          merged_reason?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          report_policy?: string
          share_token?: string
          source?: string | null
          source_confidence?: string | null
          suggested_entity_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          civility?: string | null
          contract_type?: string | null
          created_at?: string
          default_contact_id?: string | null
          email?: string | null
          emails?: string[]
          entity_certified_at?: string | null
          entity_certified_by?: string | null
          entity_confidence?: number | null
          entity_notes?: string | null
          entity_status?: string
          entity_status_source?: string
          frequency?: string | null
          id?: string
          lifecycle_status?: string
          lost_at?: string | null
          merged_at?: string | null
          merged_into_client_id?: string | null
          merged_reason?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          report_policy?: string
          share_token?: string
          source?: string | null
          source_confidence?: string | null
          suggested_entity_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_default_contact_id_fkey"
            columns: ["default_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_merged_into_client_id_fkey"
            columns: ["merged_into_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_merged_into_client_id_fkey"
            columns: ["merged_into_client_id"]
            isOneToOne: false
            referencedRelation: "v_ca_orphans_report"
            referencedColumns: ["best_candidate_id"]
          },
          {
            foreignKeyName: "clients_merged_into_client_id_fkey"
            columns: ["merged_into_client_id"]
            isOneToOne: false
            referencedRelation: "v_client_service_gaps"
            referencedColumns: ["client_id"]
          },
        ]
      }
      contact_sites: {
        Row: {
          contact_id: string
          created_at: string
          id: string
          is_report_recipient: boolean
          site_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          id?: string
          is_report_recipient?: boolean
          site_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          id?: string
          is_report_recipient?: boolean
          site_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_sites_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_sites_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          civility: string | null
          client_id: string
          created_at: string
          display_name: string
          emails: string[]
          first_name: string | null
          id: string
          is_report_recipient: boolean
          last_name: string | null
          needs_review: boolean
          phone: string | null
          review_reason: string | null
          role: string | null
          site_id: string | null
          source: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          civility?: string | null
          client_id: string
          created_at?: string
          display_name: string
          emails?: string[]
          first_name?: string | null
          id?: string
          is_report_recipient?: boolean
          last_name?: string | null
          needs_review?: boolean
          phone?: string | null
          review_reason?: string | null
          role?: string | null
          site_id?: string | null
          source?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          civility?: string | null
          client_id?: string
          created_at?: string
          display_name?: string
          emails?: string[]
          first_name?: string | null
          id?: string
          is_report_recipient?: boolean
          last_name?: string | null
          needs_review?: boolean
          phone?: string | null
          review_reason?: string | null
          role?: string | null
          site_id?: string | null
          source?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_ca_orphans_report"
            referencedColumns: ["best_candidate_id"]
          },
          {
            foreignKeyName: "contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_service_gaps"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "contacts_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
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
            foreignKeyName: "garden_health_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_ca_orphans_report"
            referencedColumns: ["best_candidate_id"]
          },
          {
            foreignKeyName: "garden_health_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_service_gaps"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "garden_health_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: false
            referencedRelation: "interventions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garden_health_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: false
            referencedRelation: "v_intervention_pnl"
            referencedColumns: ["intervention_id"]
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
          {
            foreignKeyName: "intervention_photos_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: false
            referencedRelation: "v_intervention_pnl"
            referencedColumns: ["intervention_id"]
          },
        ]
      }
      intervention_report_history: {
        Row: {
          created_at: string
          event_type: string
          id: string
          intervention_id: string
          metadata: Json | null
          pdf_storage_path: string | null
          recipient: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          intervention_id: string
          metadata?: Json | null
          pdf_storage_path?: string | null
          recipient?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          intervention_id?: string
          metadata?: Json | null
          pdf_storage_path?: string | null
          recipient?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "intervention_report_history_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: false
            referencedRelation: "interventions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intervention_report_history_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: false
            referencedRelation: "v_intervention_pnl"
            referencedColumns: ["intervention_id"]
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
          service_id: string | null
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
          service_id?: string | null
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
          service_id?: string | null
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
          {
            foreignKeyName: "intervention_tasks_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: false
            referencedRelation: "v_intervention_pnl"
            referencedColumns: ["intervention_id"]
          },
          {
            foreignKeyName: "intervention_tasks_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intervention_tasks_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "v_client_service_gaps"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "intervention_tasks_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "v_service_margin"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "intervention_tasks_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "v_service_seasonality_resolved"
            referencedColumns: ["service_id"]
          },
        ]
      }
      interventions: {
        Row: {
          ai_metadata: Json | null
          attention_points: string | null
          client_id: string
          client_read_at: string | null
          client_read_count: number
          contact_id: string | null
          created_at: string
          garden_evolution: string | null
          garden_state: string | null
          hours_spent: number | null
          id: string
          internal_hourly_rate: number | null
          intervention_date: string
          intervention_type: string | null
          pdf_storage_path: string | null
          positive_points: string | null
          recommendations_text: string | null
          reference: string | null
          report_generated_at: string | null
          report_sections: Json
          report_waived_at: string | null
          report_waived_reason: string | null
          sent_pdf_storage_path: string | null
          sent_to_client_at: string | null
          site_id: string | null
          status: string
          summary: string | null
          title: string | null
          upcoming_works: string | null
          updated_at: string
          user_id: string
          worksite_sheet_id: string | null
        }
        Insert: {
          ai_metadata?: Json | null
          attention_points?: string | null
          client_id: string
          client_read_at?: string | null
          client_read_count?: number
          contact_id?: string | null
          created_at?: string
          garden_evolution?: string | null
          garden_state?: string | null
          hours_spent?: number | null
          id?: string
          internal_hourly_rate?: number | null
          intervention_date?: string
          intervention_type?: string | null
          pdf_storage_path?: string | null
          positive_points?: string | null
          recommendations_text?: string | null
          reference?: string | null
          report_generated_at?: string | null
          report_sections?: Json
          report_waived_at?: string | null
          report_waived_reason?: string | null
          sent_pdf_storage_path?: string | null
          sent_to_client_at?: string | null
          site_id?: string | null
          status?: string
          summary?: string | null
          title?: string | null
          upcoming_works?: string | null
          updated_at?: string
          user_id: string
          worksite_sheet_id?: string | null
        }
        Update: {
          ai_metadata?: Json | null
          attention_points?: string | null
          client_id?: string
          client_read_at?: string | null
          client_read_count?: number
          contact_id?: string | null
          created_at?: string
          garden_evolution?: string | null
          garden_state?: string | null
          hours_spent?: number | null
          id?: string
          internal_hourly_rate?: number | null
          intervention_date?: string
          intervention_type?: string | null
          pdf_storage_path?: string | null
          positive_points?: string | null
          recommendations_text?: string | null
          reference?: string | null
          report_generated_at?: string | null
          report_sections?: Json
          report_waived_at?: string | null
          report_waived_reason?: string | null
          sent_pdf_storage_path?: string | null
          sent_to_client_at?: string | null
          site_id?: string | null
          status?: string
          summary?: string | null
          title?: string | null
          upcoming_works?: string | null
          updated_at?: string
          user_id?: string
          worksite_sheet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interventions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interventions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_ca_orphans_report"
            referencedColumns: ["best_candidate_id"]
          },
          {
            foreignKeyName: "interventions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_service_gaps"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "interventions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interventions_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interventions_worksite_sheet_id_fkey"
            columns: ["worksite_sheet_id"]
            isOneToOne: false
            referencedRelation: "worksite_sheets"
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
      pilot_alert_feedback: {
        Row: {
          alert_key: string
          created_at: string
          id: string
          rating: number | null
          seen_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          alert_key: string
          created_at?: string
          id?: string
          rating?: number | null
          seen_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          alert_key?: string
          created_at?: string
          id?: string
          rating?: number | null
          seen_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pilot_ca_entries: {
        Row: {
          amount_ht: number
          category: string | null
          charge_category: string | null
          charge_class: string | null
          client_id: string | null
          created_at: string
          designation: string | null
          fiscal_tag: string | null
          hours: number | null
          id: string
          intervention_id: string | null
          is_fixed: boolean
          is_investment: boolean
          kind: string
          match_method: string | null
          match_score: number | null
          match_status: string
          matched_at: string | null
          month: number
          note: string | null
          position: number
          raw_category: string | null
          raw_client_text: string | null
          raw_designation: string | null
          sale_status: string
          site_id: string | null
          source_file: string | null
          source_row: number | null
          source_sheet: string | null
          updated_at: string
          user_id: string
          validated_at: string | null
          validation_note: string | null
          validation_status: string
          year: number
        }
        Insert: {
          amount_ht?: number
          category?: string | null
          charge_category?: string | null
          charge_class?: string | null
          client_id?: string | null
          created_at?: string
          designation?: string | null
          fiscal_tag?: string | null
          hours?: number | null
          id?: string
          intervention_id?: string | null
          is_fixed?: boolean
          is_investment?: boolean
          kind: string
          match_method?: string | null
          match_score?: number | null
          match_status?: string
          matched_at?: string | null
          month: number
          note?: string | null
          position?: number
          raw_category?: string | null
          raw_client_text?: string | null
          raw_designation?: string | null
          sale_status?: string
          site_id?: string | null
          source_file?: string | null
          source_row?: number | null
          source_sheet?: string | null
          updated_at?: string
          user_id: string
          validated_at?: string | null
          validation_note?: string | null
          validation_status?: string
          year: number
        }
        Update: {
          amount_ht?: number
          category?: string | null
          charge_category?: string | null
          charge_class?: string | null
          client_id?: string | null
          created_at?: string
          designation?: string | null
          fiscal_tag?: string | null
          hours?: number | null
          id?: string
          intervention_id?: string | null
          is_fixed?: boolean
          is_investment?: boolean
          kind?: string
          match_method?: string | null
          match_score?: number | null
          match_status?: string
          matched_at?: string | null
          month?: number
          note?: string | null
          position?: number
          raw_category?: string | null
          raw_client_text?: string | null
          raw_designation?: string | null
          sale_status?: string
          site_id?: string | null
          source_file?: string | null
          source_row?: number | null
          source_sheet?: string | null
          updated_at?: string
          user_id?: string
          validated_at?: string | null
          validation_note?: string | null
          validation_status?: string
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
          {
            foreignKeyName: "pilot_ca_entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_ca_orphans_report"
            referencedColumns: ["best_candidate_id"]
          },
          {
            foreignKeyName: "pilot_ca_entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_service_gaps"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "pilot_ca_entries_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: false
            referencedRelation: "interventions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pilot_ca_entries_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: false
            referencedRelation: "v_intervention_pnl"
            referencedColumns: ["intervention_id"]
          },
          {
            foreignKeyName: "pilot_ca_entries_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      pilot_ca_match_log: {
        Row: {
          decided_at: string
          decided_by: string
          entry_id: string
          id: string
          method: string
          new_client_id: string | null
          note: string | null
          previous_client_id: string | null
          score: number | null
        }
        Insert: {
          decided_at?: string
          decided_by: string
          entry_id: string
          id?: string
          method: string
          new_client_id?: string | null
          note?: string | null
          previous_client_id?: string | null
          score?: number | null
        }
        Update: {
          decided_at?: string
          decided_by?: string
          entry_id?: string
          id?: string
          method?: string
          new_client_id?: string | null
          note?: string | null
          previous_client_id?: string | null
          score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pilot_ca_match_log_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "pilot_ca_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pilot_ca_match_log_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "v_ca_non_qualifie"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pilot_ca_match_log_new_client_id_fkey"
            columns: ["new_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pilot_ca_match_log_new_client_id_fkey"
            columns: ["new_client_id"]
            isOneToOne: false
            referencedRelation: "v_ca_orphans_report"
            referencedColumns: ["best_candidate_id"]
          },
          {
            foreignKeyName: "pilot_ca_match_log_new_client_id_fkey"
            columns: ["new_client_id"]
            isOneToOne: false
            referencedRelation: "v_client_service_gaps"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "pilot_ca_match_log_previous_client_id_fkey"
            columns: ["previous_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pilot_ca_match_log_previous_client_id_fkey"
            columns: ["previous_client_id"]
            isOneToOne: false
            referencedRelation: "v_ca_orphans_report"
            referencedColumns: ["best_candidate_id"]
          },
          {
            foreignKeyName: "pilot_ca_match_log_previous_client_id_fkey"
            columns: ["previous_client_id"]
            isOneToOne: false
            referencedRelation: "v_client_service_gaps"
            referencedColumns: ["client_id"]
          },
        ]
      }
      pilot_charge_categories: {
        Row: {
          charge_class: string
          created_at: string
          id: string
          is_active: boolean
          keywords: string[]
          label: string
          position: number
          updated_at: string
          user_id: string
        }
        Insert: {
          charge_class?: string
          created_at?: string
          id?: string
          is_active?: boolean
          keywords?: string[]
          label: string
          position?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          charge_class?: string
          created_at?: string
          id?: string
          is_active?: boolean
          keywords?: string[]
          label?: string
          position?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      pilot_edit_log: {
        Row: {
          after_value: Json | null
          before_value: Json | null
          created_at: string
          entity: string
          entity_id: string | null
          field: string
          id: string
          label: string | null
          reason: string | null
          undone_at: string | null
          user_id: string
        }
        Insert: {
          after_value?: Json | null
          before_value?: Json | null
          created_at?: string
          entity: string
          entity_id?: string | null
          field: string
          id?: string
          label?: string | null
          reason?: string | null
          undone_at?: string | null
          user_id?: string
        }
        Update: {
          after_value?: Json | null
          before_value?: Json | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          field?: string
          id?: string
          label?: string | null
          reason?: string | null
          undone_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      pilot_fixed_charges: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          label: string
          monthly_amount: number
          position: number
          updated_at: string
          user_id: string
          year: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          monthly_amount?: number
          position?: number
          updated_at?: string
          user_id: string
          year: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          monthly_amount?: number
          position?: number
          updated_at?: string
          user_id?: string
          year?: number
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
      pilot_historic_hours: {
        Row: {
          amount_ht: number | null
          client_id: string | null
          confidence: string
          created_at: string
          hours: number
          id: string
          margin_net: number | null
          note: string | null
          raw_client_text: string
          site_id: string | null
          source_file: string | null
          source_row: number | null
          source_sheet: string | null
          status: string
          updated_at: string
          user_id: string
          year: number
        }
        Insert: {
          amount_ht?: number | null
          client_id?: string | null
          confidence?: string
          created_at?: string
          hours: number
          id?: string
          margin_net?: number | null
          note?: string | null
          raw_client_text: string
          site_id?: string | null
          source_file?: string | null
          source_row?: number | null
          source_sheet?: string | null
          status?: string
          updated_at?: string
          user_id: string
          year: number
        }
        Update: {
          amount_ht?: number | null
          client_id?: string | null
          confidence?: string
          created_at?: string
          hours?: number
          id?: string
          margin_net?: number | null
          note?: string | null
          raw_client_text?: string
          site_id?: string | null
          source_file?: string | null
          source_row?: number | null
          source_sheet?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "pilot_historic_hours_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pilot_historic_hours_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_ca_orphans_report"
            referencedColumns: ["best_candidate_id"]
          },
          {
            foreignKeyName: "pilot_historic_hours_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_service_gaps"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "pilot_historic_hours_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      pilot_hours: {
        Row: {
          created_at: string
          id: string
          jours_travailles: number | null
          month: number
          temps_gestion: number | null
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
          temps_gestion?: number | null
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
          temps_gestion?: number | null
          temps_terrain?: number | null
          updated_at?: string
          user_id?: string
          year?: number
        }
        Relationships: []
      }
      pilot_hours_match_log: {
        Row: {
          decided_at: string
          hours_id: string
          id: string
          method: string
          new_client_id: string | null
          note: string | null
          previous_client_id: string | null
          user_id: string
        }
        Insert: {
          decided_at?: string
          hours_id: string
          id?: string
          method: string
          new_client_id?: string | null
          note?: string | null
          previous_client_id?: string | null
          user_id: string
        }
        Update: {
          decided_at?: string
          hours_id?: string
          id?: string
          method?: string
          new_client_id?: string | null
          note?: string | null
          previous_client_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pilot_hours_match_log_hours_id_fkey"
            columns: ["hours_id"]
            isOneToOne: false
            referencedRelation: "pilot_historic_hours"
            referencedColumns: ["id"]
          },
        ]
      }
      pilot_match_rules: {
        Row: {
          client_id: string
          created_at: string
          designation_key: string
          hits: number
          id: string
          origin: string
          sample_designation: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          designation_key: string
          hits?: number
          id?: string
          origin?: string
          sample_designation?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          designation_key?: string
          hits?: number
          id?: string
          origin?: string
          sample_designation?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pilot_match_rules_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pilot_match_rules_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_ca_orphans_report"
            referencedColumns: ["best_candidate_id"]
          },
          {
            foreignKeyName: "pilot_match_rules_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_service_gaps"
            referencedColumns: ["client_id"]
          },
        ]
      }
      pilot_metric_snapshots: {
        Row: {
          app_version: string | null
          created_at: string
          id: string
          metrics: Json
          note: string | null
          user_id: string
          year: number
        }
        Insert: {
          app_version?: string | null
          created_at?: string
          id?: string
          metrics?: Json
          note?: string | null
          user_id?: string
          year: number
        }
        Update: {
          app_version?: string | null
          created_at?: string
          id?: string
          metrics?: Json
          note?: string | null
          user_id?: string
          year?: number
        }
        Relationships: []
      }
      pilot_migration_log: {
        Row: {
          actor: string | null
          created_at: string
          details: Json
          finished_at: string | null
          id: string
          phase: string | null
          started_at: string | null
          status: string
          step: string
          summary: string | null
          updated_at: string
        }
        Insert: {
          actor?: string | null
          created_at?: string
          details?: Json
          finished_at?: string | null
          id?: string
          phase?: string | null
          started_at?: string | null
          status?: string
          step: string
          summary?: string | null
          updated_at?: string
        }
        Update: {
          actor?: string | null
          created_at?: string
          details?: Json
          finished_at?: string | null
          id?: string
          phase?: string | null
          started_at?: string | null
          status?: string
          step?: string
          summary?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      pilot_quality_checks: {
        Row: {
          check_type: string
          context: Json
          created_at: string
          detected_by: string | null
          id: string
          message: string | null
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          status: string
          target_id: string | null
          target_table: string
          updated_at: string
        }
        Insert: {
          check_type: string
          context?: Json
          created_at?: string
          detected_by?: string | null
          id?: string
          message?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          status?: string
          target_id?: string | null
          target_table: string
          updated_at?: string
        }
        Update: {
          check_type?: string
          context?: Json
          created_at?: string
          detected_by?: string | null
          id?: string
          message?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          status?: string
          target_id?: string | null
          target_table?: string
          updated_at?: string
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
      pilot_sst_label_map: {
        Row: {
          created_at: string
          id: string
          note: string | null
          provider_name: string | null
          raw_label: string
          subcontractor_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          provider_name?: string | null
          raw_label: string
          subcontractor_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          provider_name?: string | null
          raw_label?: string
          subcontractor_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pilot_sst_label_map_subcontractor_id_fkey"
            columns: ["subcontractor_id"]
            isOneToOne: false
            referencedRelation: "subcontractors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pilot_sst_label_map_subcontractor_id_fkey"
            columns: ["subcontractor_id"]
            isOneToOne: false
            referencedRelation: "v_sst_summary"
            referencedColumns: ["subcontractor_id"]
          },
        ]
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
          {
            foreignKeyName: "planning_notes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_ca_orphans_report"
            referencedColumns: ["best_candidate_id"]
          },
          {
            foreignKeyName: "planning_notes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_service_gaps"
            referencedColumns: ["client_id"]
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
          include_in_report: boolean
          intervention_id: string | null
          pilot_ca_entry_id: string | null
          planned_intervention_id: string | null
          priority: string | null
          recommended_season: string | null
          refusal_reason: string | null
          report_position: number | null
          responded_at: string | null
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
          include_in_report?: boolean
          intervention_id?: string | null
          pilot_ca_entry_id?: string | null
          planned_intervention_id?: string | null
          priority?: string | null
          recommended_season?: string | null
          refusal_reason?: string | null
          report_position?: number | null
          responded_at?: string | null
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
          include_in_report?: boolean
          intervention_id?: string | null
          pilot_ca_entry_id?: string | null
          planned_intervention_id?: string | null
          priority?: string | null
          recommended_season?: string | null
          refusal_reason?: string | null
          report_position?: number | null
          responded_at?: string | null
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
            foreignKeyName: "recommendations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_ca_orphans_report"
            referencedColumns: ["best_candidate_id"]
          },
          {
            foreignKeyName: "recommendations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_service_gaps"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "recommendations_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: false
            referencedRelation: "interventions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendations_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: false
            referencedRelation: "v_intervention_pnl"
            referencedColumns: ["intervention_id"]
          },
          {
            foreignKeyName: "recommendations_pilot_ca_entry_id_fkey"
            columns: ["pilot_ca_entry_id"]
            isOneToOne: false
            referencedRelation: "pilot_ca_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendations_pilot_ca_entry_id_fkey"
            columns: ["pilot_ca_entry_id"]
            isOneToOne: false
            referencedRelation: "v_ca_non_qualifie"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendations_planned_intervention_id_fkey"
            columns: ["planned_intervention_id"]
            isOneToOne: false
            referencedRelation: "interventions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendations_planned_intervention_id_fkey"
            columns: ["planned_intervention_id"]
            isOneToOne: false
            referencedRelation: "v_intervention_pnl"
            referencedColumns: ["intervention_id"]
          },
        ]
      }
      referential_audit_log: {
        Row: {
          action: string
          after_value: Json | null
          before_value: Json | null
          ca_impacted: number | null
          client_id: string | null
          client_name: string | null
          created_at: string
          hours_impacted: number | null
          id: string
          reason: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          after_value?: Json | null
          before_value?: Json | null
          ca_impacted?: number | null
          client_id?: string | null
          client_name?: string | null
          created_at?: string
          hours_impacted?: number | null
          id?: string
          reason?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          after_value?: Json | null
          before_value?: Json | null
          ca_impacted?: number | null
          client_id?: string | null
          client_name?: string | null
          created_at?: string
          hours_impacted?: number | null
          id?: string
          reason?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referential_audit_log_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referential_audit_log_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_ca_orphans_report"
            referencedColumns: ["best_candidate_id"]
          },
          {
            foreignKeyName: "referential_audit_log_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_service_gaps"
            referencedColumns: ["client_id"]
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
          {
            foreignKeyName: "reminders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_ca_orphans_report"
            referencedColumns: ["best_candidate_id"]
          },
          {
            foreignKeyName: "reminders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_service_gaps"
            referencedColumns: ["client_id"]
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
      service_contracts: {
        Row: {
          annual_value_ht: number | null
          client_id: string | null
          created_at: string
          end_date: string | null
          frequency: string | null
          frequency_details: Json
          id: string
          label: string | null
          next_due_date: string | null
          notes: string | null
          seasonality: Json
          service_id: string | null
          start_date: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          annual_value_ht?: number | null
          client_id?: string | null
          created_at?: string
          end_date?: string | null
          frequency?: string | null
          frequency_details?: Json
          id?: string
          label?: string | null
          next_due_date?: string | null
          notes?: string | null
          seasonality?: Json
          service_id?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          annual_value_ht?: number | null
          client_id?: string | null
          created_at?: string
          end_date?: string | null
          frequency?: string | null
          frequency_details?: Json
          id?: string
          label?: string | null
          next_due_date?: string | null
          notes?: string | null
          seasonality?: Json
          service_id?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_ca_orphans_report"
            referencedColumns: ["best_candidate_id"]
          },
          {
            foreignKeyName: "service_contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_service_gaps"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "service_contracts_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_contracts_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "v_client_service_gaps"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "service_contracts_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "v_service_margin"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "service_contracts_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "v_service_seasonality_resolved"
            referencedColumns: ["service_id"]
          },
        ]
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
            referencedRelation: "v_client_service_gaps"
            referencedColumns: ["service_id"]
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
            referencedRelation: "v_client_service_gaps"
            referencedColumns: ["service_id"]
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
          {
            foreignKeyName: "share_access_log_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_ca_orphans_report"
            referencedColumns: ["best_candidate_id"]
          },
          {
            foreignKeyName: "share_access_log_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_service_gaps"
            referencedColumns: ["client_id"]
          },
        ]
      }
      site_aliases: {
        Row: {
          alias: string
          alias_normalized: string
          created_at: string
          id: string
          legacy_client_id: string | null
          origin: string
          site_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          alias: string
          alias_normalized: string
          created_at?: string
          id?: string
          legacy_client_id?: string | null
          origin?: string
          site_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          alias?: string
          alias_normalized?: string
          created_at?: string
          id?: string
          legacy_client_id?: string | null
          origin?: string
          site_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_aliases_legacy_client_id_fkey"
            columns: ["legacy_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_aliases_legacy_client_id_fkey"
            columns: ["legacy_client_id"]
            isOneToOne: false
            referencedRelation: "v_ca_orphans_report"
            referencedColumns: ["best_candidate_id"]
          },
          {
            foreignKeyName: "site_aliases_legacy_client_id_fkey"
            columns: ["legacy_client_id"]
            isOneToOne: false
            referencedRelation: "v_client_service_gaps"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "site_aliases_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      site_merge_audit: {
        Row: {
          action: string
          after_state: Json
          alias_labels: string[]
          before_state: Json
          client_id: string | null
          created_at: string
          id: string
          note: string | null
          proposal_id: string | null
          reverted_at: string | null
          site_id: string | null
          site_name: string | null
          tagged_counts: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          action: string
          after_state?: Json
          alias_labels?: string[]
          before_state?: Json
          client_id?: string | null
          created_at?: string
          id?: string
          note?: string | null
          proposal_id?: string | null
          reverted_at?: string | null
          site_id?: string | null
          site_name?: string | null
          tagged_counts?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          action?: string
          after_state?: Json
          alias_labels?: string[]
          before_state?: Json
          client_id?: string | null
          created_at?: string
          id?: string
          note?: string | null
          proposal_id?: string | null
          reverted_at?: string | null
          site_id?: string | null
          site_name?: string | null
          tagged_counts?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_merge_audit_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "site_merge_proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      site_merge_proposals: {
        Row: {
          cluster_key: string
          confidence: number | null
          created_at: string
          decided_at: string | null
          decision_note: string | null
          id: string
          impact_ca_amount: number
          impact_ca_entries: number
          impact_hours: number
          impact_interventions: number
          impact_missions: number
          legacy_client_ids: string[]
          legacy_labels: string[]
          status: string
          suggested_client_name: string
          suggested_site_name: string
          target_client_id: string | null
          target_site_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cluster_key: string
          confidence?: number | null
          created_at?: string
          decided_at?: string | null
          decision_note?: string | null
          id?: string
          impact_ca_amount?: number
          impact_ca_entries?: number
          impact_hours?: number
          impact_interventions?: number
          impact_missions?: number
          legacy_client_ids?: string[]
          legacy_labels?: string[]
          status?: string
          suggested_client_name: string
          suggested_site_name: string
          target_client_id?: string | null
          target_site_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cluster_key?: string
          confidence?: number | null
          created_at?: string
          decided_at?: string | null
          decision_note?: string | null
          id?: string
          impact_ca_amount?: number
          impact_ca_entries?: number
          impact_hours?: number
          impact_interventions?: number
          impact_missions?: number
          legacy_client_ids?: string[]
          legacy_labels?: string[]
          status?: string
          suggested_client_name?: string
          suggested_site_name?: string
          target_client_id?: string | null
          target_site_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_merge_proposals_target_client_id_fkey"
            columns: ["target_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_merge_proposals_target_client_id_fkey"
            columns: ["target_client_id"]
            isOneToOne: false
            referencedRelation: "v_ca_orphans_report"
            referencedColumns: ["best_candidate_id"]
          },
          {
            foreignKeyName: "site_merge_proposals_target_client_id_fkey"
            columns: ["target_client_id"]
            isOneToOne: false
            referencedRelation: "v_client_service_gaps"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "site_merge_proposals_target_site_id_fkey"
            columns: ["target_site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      sites: {
        Row: {
          access_complement: string | null
          address: string | null
          client_id: string
          created_at: string
          id: string
          is_primary: boolean
          latitude: number | null
          longitude: number | null
          name: string
          notes: string | null
          source: string | null
          status: string
          updated_at: string
          user_id: string
          worksite_sheet_id: string | null
        }
        Insert: {
          access_complement?: string | null
          address?: string | null
          client_id: string
          created_at?: string
          id?: string
          is_primary?: boolean
          latitude?: number | null
          longitude?: number | null
          name: string
          notes?: string | null
          source?: string | null
          status?: string
          updated_at?: string
          user_id: string
          worksite_sheet_id?: string | null
        }
        Update: {
          access_complement?: string | null
          address?: string | null
          client_id?: string
          created_at?: string
          id?: string
          is_primary?: boolean
          latitude?: number | null
          longitude?: number | null
          name?: string
          notes?: string | null
          source?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          worksite_sheet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sites_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sites_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_ca_orphans_report"
            referencedColumns: ["best_candidate_id"]
          },
          {
            foreignKeyName: "sites_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_service_gaps"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "sites_worksite_sheet_id_fkey"
            columns: ["worksite_sheet_id"]
            isOneToOne: false
            referencedRelation: "worksite_sheets"
            referencedColumns: ["id"]
          },
        ]
      }
      sst_audit_log: {
        Row: {
          action: string
          after_data: Json | null
          before_data: Json | null
          created_at: string
          entity: string
          entity_id: string | null
          id: string
          label: string | null
          undone_at: string | null
          user_id: string
        }
        Insert: {
          action: string
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: string
          label?: string | null
          undone_at?: string | null
          user_id?: string
        }
        Update: {
          action?: string
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: string
          label?: string | null
          undone_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      sst_lists: {
        Row: {
          color: string | null
          created_at: string
          id: string
          is_active: boolean
          kind: string
          position: number
          updated_at: string
          user_id: string
          value: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          kind: string
          position?: number
          updated_at?: string
          user_id?: string
          value: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          kind?: string
          position?: number
          updated_at?: string
          user_id?: string
          value?: string
        }
        Relationships: []
      }
      subcontractor_mission_photos: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          kind: string
          mission_id: string
          position: number
          storage_path: string
          user_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          kind?: string
          mission_id: string
          position?: number
          storage_path: string
          user_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          kind?: string
          mission_id?: string
          position?: number
          storage_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subcontractor_mission_photos_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "subcontractor_missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subcontractor_mission_photos_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "v_sst_mission_pnl"
            referencedColumns: ["mission_id"]
          },
        ]
      }
      subcontractor_missions: {
        Row: {
          agreed_price: number | null
          anomalies: string | null
          archived_at: string | null
          autonomy: string | null
          category: string | null
          client_id: string | null
          client_price: number | null
          context_notes: string | null
          created_at: string
          hours_saved: number | null
          hours_spent: number | null
          id: string
          import_source: string | null
          instructions: string | null
          internal_rating: number | null
          intervention_id: string | null
          invoice_ref: string | null
          invoiced_amount: number | null
          mission_date: string
          objective: string | null
          parallel_worksite: string | null
          payment_method: string | null
          prestation: string | null
          recommendations: string | null
          report_notes: string | null
          service_id: string | null
          service_requested: string
          site_id: string | null
          status: string
          subcontractor_id: string
          updated_at: string
          user_id: string
          worksite_sheet_id: string | null
        }
        Insert: {
          agreed_price?: number | null
          anomalies?: string | null
          archived_at?: string | null
          autonomy?: string | null
          category?: string | null
          client_id?: string | null
          client_price?: number | null
          context_notes?: string | null
          created_at?: string
          hours_saved?: number | null
          hours_spent?: number | null
          id?: string
          import_source?: string | null
          instructions?: string | null
          internal_rating?: number | null
          intervention_id?: string | null
          invoice_ref?: string | null
          invoiced_amount?: number | null
          mission_date: string
          objective?: string | null
          parallel_worksite?: string | null
          payment_method?: string | null
          prestation?: string | null
          recommendations?: string | null
          report_notes?: string | null
          service_id?: string | null
          service_requested: string
          site_id?: string | null
          status?: string
          subcontractor_id: string
          updated_at?: string
          user_id: string
          worksite_sheet_id?: string | null
        }
        Update: {
          agreed_price?: number | null
          anomalies?: string | null
          archived_at?: string | null
          autonomy?: string | null
          category?: string | null
          client_id?: string | null
          client_price?: number | null
          context_notes?: string | null
          created_at?: string
          hours_saved?: number | null
          hours_spent?: number | null
          id?: string
          import_source?: string | null
          instructions?: string | null
          internal_rating?: number | null
          intervention_id?: string | null
          invoice_ref?: string | null
          invoiced_amount?: number | null
          mission_date?: string
          objective?: string | null
          parallel_worksite?: string | null
          payment_method?: string | null
          prestation?: string | null
          recommendations?: string | null
          report_notes?: string | null
          service_id?: string | null
          service_requested?: string
          site_id?: string | null
          status?: string
          subcontractor_id?: string
          updated_at?: string
          user_id?: string
          worksite_sheet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subcontractor_missions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subcontractor_missions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_ca_orphans_report"
            referencedColumns: ["best_candidate_id"]
          },
          {
            foreignKeyName: "subcontractor_missions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_service_gaps"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "subcontractor_missions_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: false
            referencedRelation: "interventions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subcontractor_missions_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: false
            referencedRelation: "v_intervention_pnl"
            referencedColumns: ["intervention_id"]
          },
          {
            foreignKeyName: "subcontractor_missions_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subcontractor_missions_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "v_client_service_gaps"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "subcontractor_missions_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "v_service_margin"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "subcontractor_missions_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "v_service_seasonality_resolved"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "subcontractor_missions_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subcontractor_missions_subcontractor_id_fkey"
            columns: ["subcontractor_id"]
            isOneToOne: false
            referencedRelation: "subcontractors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subcontractor_missions_subcontractor_id_fkey"
            columns: ["subcontractor_id"]
            isOneToOne: false
            referencedRelation: "v_sst_summary"
            referencedColumns: ["subcontractor_id"]
          },
          {
            foreignKeyName: "subcontractor_missions_worksite_sheet_id_fkey"
            columns: ["worksite_sheet_id"]
            isOneToOne: false
            referencedRelation: "worksite_sheets"
            referencedColumns: ["id"]
          },
        ]
      }
      subcontractors: {
        Row: {
          active: boolean
          address: string | null
          company: string | null
          created_at: string
          default_service_types: string[]
          email: string | null
          hourly_rate: number | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          specialties: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          address?: string | null
          company?: string | null
          created_at?: string
          default_service_types?: string[]
          email?: string | null
          hourly_rate?: number | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          specialties?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          address?: string | null
          company?: string | null
          created_at?: string
          default_service_types?: string[]
          email?: string | null
          hourly_rate?: number | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          specialties?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
          site_id: string | null
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
          site_id?: string | null
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
          site_id?: string | null
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
          {
            foreignKeyName: "worksite_sheets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_ca_orphans_report"
            referencedColumns: ["best_candidate_id"]
          },
          {
            foreignKeyName: "worksite_sheets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_service_gaps"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "worksite_sheets_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
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
      v_ca_match_rules: {
        Row: {
          client_id: string | null
          client_name: string | null
          confidence_pct: number | null
          last_seen: string | null
          normalized_designation: string | null
          sample_designation: string | null
          total_votes: number | null
          votes: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pilot_ca_match_log_new_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pilot_ca_match_log_new_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_ca_orphans_report"
            referencedColumns: ["best_candidate_id"]
          },
          {
            foreignKeyName: "pilot_ca_match_log_new_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_service_gaps"
            referencedColumns: ["client_id"]
          },
        ]
      }
      v_ca_non_qualifie: {
        Row: {
          amount_ht: number | null
          client_id: string | null
          designation: string | null
          fiscal_tag: string | null
          id: string | null
          month: number | null
          open_checks: Json | null
          qualification_state: string | null
          source_category: string | null
          user_id: string | null
          year: number | null
        }
        Insert: {
          amount_ht?: number | null
          client_id?: string | null
          designation?: string | null
          fiscal_tag?: string | null
          id?: string | null
          month?: number | null
          open_checks?: never
          qualification_state?: never
          source_category?: string | null
          user_id?: string | null
          year?: number | null
        }
        Update: {
          amount_ht?: number | null
          client_id?: string | null
          designation?: string | null
          fiscal_tag?: string | null
          id?: string | null
          month?: number | null
          open_checks?: never
          qualification_state?: never
          source_category?: string | null
          user_id?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pilot_ca_entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pilot_ca_entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_ca_orphans_report"
            referencedColumns: ["best_candidate_id"]
          },
          {
            foreignKeyName: "pilot_ca_entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_service_gaps"
            referencedColumns: ["client_id"]
          },
        ]
      }
      v_ca_orphans_report: {
        Row: {
          best_candidate_id: string | null
          best_candidate_name: string | null
          best_score: number | null
          ca_ht: number | null
          designation: string | null
          entry_ids: string[] | null
          learned_rule_client: string | null
          learned_rule_confidence: number | null
          occurrences: number | null
          raw_designation: string | null
          recommended_action: string | null
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
      v_client_next_best_offers: {
        Row: {
          category_name: string | null
          client_id: string | null
          days_since_last_performed: number | null
          default_frequency: string | null
          estimated_value: number | null
          last_performed_at: string | null
          reason: string | null
          recommended_season: number[] | null
          score_opportunity: number | null
          service_id: string | null
          service_name: string | null
          user_id: string | null
        }
        Relationships: []
      }
      v_client_service_gaps: {
        Row: {
          category_id: string | null
          client_id: string | null
          service_id: string | null
          service_label: string | null
          user_id: string | null
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
      v_client_service_profile: {
        Row: {
          category_id: string | null
          client_id: string | null
          first_date: string | null
          last_date: string | null
          last_intervention_id: string | null
          occurrences: number | null
          service_id: string | null
          service_label: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "intervention_tasks_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intervention_tasks_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "v_client_service_gaps"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "intervention_tasks_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "v_service_margin"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "intervention_tasks_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "v_service_seasonality_resolved"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "interventions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interventions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_ca_orphans_report"
            referencedColumns: ["best_candidate_id"]
          },
          {
            foreignKeyName: "interventions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_service_gaps"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "services_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      v_intervention_pnl: {
        Row: {
          ca_direct: number | null
          client_id: string | null
          client_revenue: number | null
          gross_margin: number | null
          internal_cost: number | null
          intervention_date: string | null
          intervention_id: string | null
          margin_pct: number | null
          sst_client_revenue: number | null
          sst_cost: number | null
          status: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interventions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interventions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_ca_orphans_report"
            referencedColumns: ["best_candidate_id"]
          },
          {
            foreignKeyName: "interventions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_service_gaps"
            referencedColumns: ["client_id"]
          },
        ]
      }
      v_real_hourly_cost: {
        Row: {
          real_hourly_cost: number | null
          user_id: string | null
        }
        Relationships: []
      }
      v_recommendations_funnel: {
        Row: {
          acceptees: number | null
          consultees: number | null
          expirees: number | null
          facturees: number | null
          planifiees: number | null
          proposees: number | null
          realisees: number | null
          refusees: number | null
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
            referencedRelation: "v_client_service_gaps"
            referencedColumns: ["service_id"]
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
      v_sst_mission_pnl: {
        Row: {
          agreed_price: number | null
          client_id: string | null
          client_price: number | null
          client_revenue: number | null
          gross_margin: number | null
          intervention_id: string | null
          invoiced_amount: number | null
          margin_pct: number | null
          mission_date: string | null
          mission_id: string | null
          sst_cost: number | null
          status: string | null
          subcontractor_id: string | null
          user_id: string | null
        }
        Insert: {
          agreed_price?: number | null
          client_id?: string | null
          client_price?: number | null
          client_revenue?: never
          gross_margin?: never
          intervention_id?: string | null
          invoiced_amount?: number | null
          margin_pct?: never
          mission_date?: string | null
          mission_id?: string | null
          sst_cost?: never
          status?: string | null
          subcontractor_id?: string | null
          user_id?: string | null
        }
        Update: {
          agreed_price?: number | null
          client_id?: string | null
          client_price?: number | null
          client_revenue?: never
          gross_margin?: never
          intervention_id?: string | null
          invoiced_amount?: number | null
          margin_pct?: never
          mission_date?: string | null
          mission_id?: string | null
          sst_cost?: never
          status?: string | null
          subcontractor_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subcontractor_missions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subcontractor_missions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_ca_orphans_report"
            referencedColumns: ["best_candidate_id"]
          },
          {
            foreignKeyName: "subcontractor_missions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_service_gaps"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "subcontractor_missions_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: false
            referencedRelation: "interventions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subcontractor_missions_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: false
            referencedRelation: "v_intervention_pnl"
            referencedColumns: ["intervention_id"]
          },
          {
            foreignKeyName: "subcontractor_missions_subcontractor_id_fkey"
            columns: ["subcontractor_id"]
            isOneToOne: false
            referencedRelation: "subcontractors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subcontractor_missions_subcontractor_id_fkey"
            columns: ["subcontractor_id"]
            isOneToOne: false
            referencedRelation: "v_sst_summary"
            referencedColumns: ["subcontractor_id"]
          },
        ]
      }
      v_sst_summary: {
        Row: {
          active: boolean | null
          avg_rating: number | null
          last_mission_date: string | null
          missions_count: number | null
          missions_done: number | null
          name: string | null
          subcontractor_id: string | null
          total_client_revenue: number | null
          total_gross_margin: number | null
          total_sst_cost: number | null
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
      link_ca_entry_to_client: {
        Args: {
          _client_id: string
          _entry_id: string
          _method: string
          _note?: string
          _score?: number
        }
        Returns: {
          amount_ht: number
          category: string | null
          charge_category: string | null
          charge_class: string | null
          client_id: string | null
          created_at: string
          designation: string | null
          fiscal_tag: string | null
          hours: number | null
          id: string
          intervention_id: string | null
          is_fixed: boolean
          is_investment: boolean
          kind: string
          match_method: string | null
          match_score: number | null
          match_status: string
          matched_at: string | null
          month: number
          note: string | null
          position: number
          raw_category: string | null
          raw_client_text: string | null
          raw_designation: string | null
          sale_status: string
          site_id: string | null
          source_file: string | null
          source_row: number | null
          source_sheet: string | null
          updated_at: string
          user_id: string
          validated_at: string | null
          validation_note: string | null
          validation_status: string
          year: number
        }
        SetofOptions: {
          from: "*"
          to: "pilot_ca_entries"
          isOneToOne: true
          isSetofReturn: false
        }
      }
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
      pilot_classify_charges: { Args: { _user_id?: string }; Returns: number }
      pilot_clean_designation: { Args: { p: string }; Returns: string }
      pilot_normalize_designation: { Args: { t: string }; Returns: string }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      record_login: { Args: { p_user_agent?: string }; Returns: undefined }
      record_shared_report_view: {
        Args: {
          p_intervention_id: string
          p_ip?: string
          p_token: string
          p_user_agent?: string
        }
        Returns: Json
      }
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
      unaccent_lite: { Args: { t: string }; Returns: string }
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

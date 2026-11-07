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
      access_requests: {
        Row: {
          admin_notes: string
          city: string
          created_at: string
          email: string
          full_name: string
          goal: string
          id: string
          invited_at: string | null
          phone: string
          profession: string
          requested_plan: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          weekly_volume: string
        }
        Insert: {
          admin_notes?: string
          city?: string
          created_at?: string
          email: string
          full_name: string
          goal?: string
          id?: string
          invited_at?: string | null
          phone?: string
          profession?: string
          requested_plan?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          weekly_volume?: string
        }
        Update: {
          admin_notes?: string
          city?: string
          created_at?: string
          email?: string
          full_name?: string
          goal?: string
          id?: string
          invited_at?: string | null
          phone?: string
          profession?: string
          requested_plan?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          weekly_volume?: string
        }
        Relationships: []
      }
      account_events: {
        Row: {
          actor_id: string | null
          created_at: string
          dedupe_key: string | null
          description: string
          event_type: string
          id: string
          meta: Json
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          dedupe_key?: string | null
          description?: string
          event_type: string
          id?: string
          meta?: Json
          user_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          dedupe_key?: string | null
          description?: string
          event_type?: string
          id?: string
          meta?: Json
          user_id?: string
        }
        Relationships: []
      }
      account_payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          paid_at: string
          period: string
          reference: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          paid_at: string
          period: string
          reference?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          paid_at?: string
          period?: string
          reference?: string
          user_id?: string
        }
        Relationships: []
      }
      account_plans: {
        Row: {
          created_at: string
          expires_at: string | null
          is_test: boolean
          last_payment_at: string | null
          notes: string | null
          payment_status: string
          plan: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          is_test?: boolean
          last_payment_at?: string | null
          notes?: string | null
          payment_status?: string
          plan?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          is_test?: boolean
          last_payment_at?: string | null
          notes?: string | null
          payment_status?: string
          plan?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      app_user_connection_slots: {
        Row: {
          connector_id: string
          slot: number
          updated_at: string
          user_id: string
        }
        Insert: {
          connector_id: string
          slot?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          connector_id?: string
          slot?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      app_user_connections: {
        Row: {
          connection_key_ciphertext: string
          connector_id: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          connection_key_ciphertext: string
          connector_id: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          connection_key_ciphertext?: string
          connector_id?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      appointment_types: {
        Row: {
          created_at: string
          duration_minutes: number
          id: string
          name: string
          owner_id: string
          price_ars: number | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          duration_minutes?: number
          id?: string
          name: string
          owner_id: string
          price_ars?: number | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          duration_minutes?: number
          id?: string
          name?: string
          owner_id?: string
          price_ars?: number | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      appointments: {
        Row: {
          appointment_type_id: string | null
          appointment_type_name: string
          attendance: Database["public"]["Enums"]["attendance_status"]
          attendance_marked_at: string | null
          calendar_event_id: string
          confirm_token: string | null
          confirm_token_expires_at: string | null
          confirmed_at: string | null
          created_at: string
          end_at: string
          id: string
          invoice_issued: boolean
          invoice_issued_at: string | null
          needs_invoice: boolean
          notes: string
          owner_id: string
          patient_id: string
          reminder_sent_at: string | null
          reschedule_count: number
          start_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          updated_at: string
        }
        Insert: {
          appointment_type_id?: string | null
          appointment_type_name?: string
          attendance?: Database["public"]["Enums"]["attendance_status"]
          attendance_marked_at?: string | null
          calendar_event_id?: string
          confirm_token?: string | null
          confirm_token_expires_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          end_at: string
          id?: string
          invoice_issued?: boolean
          invoice_issued_at?: string | null
          needs_invoice?: boolean
          notes?: string
          owner_id: string
          patient_id: string
          reminder_sent_at?: string | null
          reschedule_count?: number
          start_at: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Update: {
          appointment_type_id?: string | null
          appointment_type_name?: string
          attendance?: Database["public"]["Enums"]["attendance_status"]
          attendance_marked_at?: string | null
          calendar_event_id?: string
          confirm_token?: string | null
          confirm_token_expires_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          end_at?: string
          id?: string
          invoice_issued?: boolean
          invoice_issued_at?: string | null
          needs_invoice?: boolean
          notes?: string
          owner_id?: string
          patient_id?: string
          reminder_sent_at?: string | null
          reschedule_count?: number
          start_at?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_appointment_type_id_fkey"
            columns: ["appointment_type_id"]
            isOneToOne: false
            referencedRelation: "appointment_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_settings: {
        Row: {
          alias: string
          amount_basic: number
          amount_pro: number
          id: number
          receipt_phone: string
          updated_at: string
        }
        Insert: {
          alias?: string
          amount_basic?: number
          amount_pro?: number
          id?: number
          receipt_phone?: string
          updated_at?: string
        }
        Update: {
          alias?: string
          amount_basic?: number
          amount_pro?: number
          id?: number
          receipt_phone?: string
          updated_at?: string
        }
        Relationships: []
      }
      finance_audit: {
        Row: {
          action: string
          actor_id: string | null
          after: Json | null
          before: Json | null
          created_at: string
          entry_id: string
          id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entry_id: string
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entry_id?: string
          id?: string
        }
        Relationships: []
      }
      finance_categories: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      finance_entries: {
        Row: {
          amount: number
          amount_ars: number
          category: string
          concept: string
          created_at: string
          created_by: string | null
          currency: string
          deleted_at: string | null
          description: string
          end_date: string | null
          entry_date: string
          frequency: string
          fx_rate: number | null
          id: string
          kind: string
          provider: string
          updated_at: string
        }
        Insert: {
          amount: number
          amount_ars: number
          category: string
          concept: string
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          description?: string
          end_date?: string | null
          entry_date: string
          frequency?: string
          fx_rate?: number | null
          id?: string
          kind: string
          provider?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          amount_ars?: number
          category?: string
          concept?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          description?: string
          end_date?: string | null
          entry_date?: string
          frequency?: string
          fx_rate?: number | null
          id?: string
          kind?: string
          provider?: string
          updated_at?: string
        }
        Relationships: []
      }
      internal_settings: {
        Row: {
          created_at: string
          key: string
          value: string
        }
        Insert: {
          created_at?: string
          key: string
          value: string
        }
        Update: {
          created_at?: string
          key?: string
          value?: string
        }
        Relationships: []
      }
      locations: {
        Row: {
          address: string
          city: string
          created_at: string
          id: string
          maps_url: string
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          address?: string
          city?: string
          created_at?: string
          id?: string
          maps_url?: string
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          address?: string
          city?: string
          created_at?: string
          id?: string
          maps_url?: string
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      message_packs: {
        Row: {
          active: boolean
          created_at: string
          id: string
          price_ars: number
          quantity: number
          sort_order: number
          validity_days: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          price_ars: number
          quantity: number
          sort_order?: number
          validity_days?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          price_ars?: number
          quantity?: number
          sort_order?: number
          validity_days?: number
        }
        Relationships: []
      }
      patients: {
        Row: {
          absence_reset_at: string | null
          birth_date: string | null
          created_at: string
          dni: string
          email: string
          first_name: string
          history_summary: Json
          id: string
          is_allowed: boolean
          is_blocked: boolean
          last_name: string
          notes: string
          owner_id: string
          phone: string
          updated_at: string
        }
        Insert: {
          absence_reset_at?: string | null
          birth_date?: string | null
          created_at?: string
          dni: string
          email?: string
          first_name: string
          history_summary?: Json
          id?: string
          is_allowed?: boolean
          is_blocked?: boolean
          last_name: string
          notes?: string
          owner_id: string
          phone: string
          updated_at?: string
        }
        Update: {
          absence_reset_at?: string | null
          birth_date?: string | null
          created_at?: string
          dni?: string
          email?: string
          first_name?: string
          history_summary?: Json
          id?: string
          is_allowed?: boolean
          is_blocked?: boolean
          last_name?: string
          notes?: string
          owner_id?: string
          phone?: string
          updated_at?: string
        }
        Relationships: []
      }
      plan_feature_overrides: {
        Row: {
          created_at: string
          enabled: boolean
          feature: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          feature: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          feature?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      professional_config: {
        Row: {
          address: string
          appointment_duration_minutes: number
          booking_access_mode: string
          calendar_last_sync_at: string | null
          calendar_last_sync_summary: Json
          calendar_sync_interval_minutes: number
          calendar_sync_mode: string
          created_at: string
          display_name: string
          google_calendar_id: string
          google_calendar_name: string
          maps_url: string
          max_active_appointments_per_patient: number
          non_working_days: number[]
          owner_id: string
          phone: string
          purge_reminder_snoozed_until: string | null
          reminder_hour: number
          retention_years: number
          specialty: string
          timezone: string
          updated_at: string
        }
        Insert: {
          address?: string
          appointment_duration_minutes?: number
          booking_access_mode?: string
          calendar_last_sync_at?: string | null
          calendar_last_sync_summary?: Json
          calendar_sync_interval_minutes?: number
          calendar_sync_mode?: string
          created_at?: string
          display_name?: string
          google_calendar_id?: string
          google_calendar_name?: string
          maps_url?: string
          max_active_appointments_per_patient?: number
          non_working_days?: number[]
          owner_id: string
          phone?: string
          purge_reminder_snoozed_until?: string | null
          reminder_hour?: number
          retention_years?: number
          specialty?: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          address?: string
          appointment_duration_minutes?: number
          booking_access_mode?: string
          calendar_last_sync_at?: string | null
          calendar_last_sync_summary?: Json
          calendar_sync_interval_minutes?: number
          calendar_sync_mode?: string
          created_at?: string
          display_name?: string
          google_calendar_id?: string
          google_calendar_name?: string
          maps_url?: string
          max_active_appointments_per_patient?: number
          non_working_days?: number[]
          owner_id?: string
          phone?: string
          purge_reminder_snoozed_until?: string | null
          reminder_hour?: number
          retention_years?: number
          specialty?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      professional_message_packs: {
        Row: {
          cancelled_at: string | null
          created_at: string
          expires_at: string
          id: string
          owner_id: string
          pack_id: string | null
          paid_at: string | null
          payment_status: string
          price_ars: number
          purchased_at: string
          quantity: number
          remaining: number
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          owner_id: string
          pack_id?: string | null
          paid_at?: string | null
          payment_status?: string
          price_ars: number
          purchased_at?: string
          quantity: number
          remaining: number
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          owner_id?: string
          pack_id?: string | null
          paid_at?: string | null
          payment_status?: string
          price_ars?: number
          purchased_at?: string
          quantity?: number
          remaining?: number
        }
        Relationships: [
          {
            foreignKeyName: "professional_message_packs_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "message_packs"
            referencedColumns: ["id"]
          },
        ]
      }
      purge_log: {
        Row: {
          created_at: string
          deleted_count: number
          executed_at: string
          id: string
          owner_id: string
          range_from: string | null
          range_to: string | null
        }
        Insert: {
          created_at?: string
          deleted_count?: number
          executed_at?: string
          id?: string
          owner_id: string
          range_from?: string | null
          range_to?: string | null
        }
        Update: {
          created_at?: string
          deleted_count?: number
          executed_at?: string
          id?: string
          owner_id?: string
          range_from?: string | null
          range_to?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          last_body: string | null
          last_title: string | null
          last_url: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          last_body?: string | null
          last_title?: string | null
          last_url?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          last_body?: string | null
          last_title?: string | null
          last_url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      reminder_attempts: {
        Row: {
          appointment_id: string | null
          created_at: string
          error: string
          id: string
          owner_id: string
          status: string
          status_at: string | null
          trigger: string
          wa_message_id: string | null
        }
        Insert: {
          appointment_id?: string | null
          created_at?: string
          error?: string
          id?: string
          owner_id: string
          status: string
          status_at?: string | null
          trigger?: string
          wa_message_id?: string | null
        }
        Update: {
          appointment_id?: string | null
          created_at?: string
          error?: string
          id?: string
          owner_id?: string
          status?: string
          status_at?: string | null
          trigger?: string
          wa_message_id?: string | null
        }
        Relationships: []
      }
      schedule_date_blocks: {
        Row: {
          created_at: string
          day_of_week: number | null
          end_date: string
          end_time: string
          id: string
          location_id: string
          owner_id: string
          start_date: string
          start_time: string
        }
        Insert: {
          created_at?: string
          day_of_week?: number | null
          end_date: string
          end_time: string
          id?: string
          location_id: string
          owner_id: string
          start_date: string
          start_time: string
        }
        Update: {
          created_at?: string
          day_of_week?: number | null
          end_date?: string
          end_time?: string
          id?: string
          location_id?: string
          owner_id?: string
          start_date?: string
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_date_blocks_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      sim_messages: {
        Row: {
          body: string
          created_at: string
          direction: string
          id: string
          meta: Json
          owner_id: string
          phone: string
        }
        Insert: {
          body: string
          created_at?: string
          direction: string
          id?: string
          meta?: Json
          owner_id: string
          phone: string
        }
        Update: {
          body?: string
          created_at?: string
          direction?: string
          id?: string
          meta?: Json
          owner_id?: string
          phone?: string
        }
        Relationships: []
      }
      time_off: {
        Row: {
          calendar_event_id: string
          created_at: string
          end_date: string
          end_time: string | null
          id: string
          owner_id: string
          reason: string
          start_date: string
          start_time: string | null
        }
        Insert: {
          calendar_event_id?: string
          created_at?: string
          end_date: string
          end_time?: string | null
          id?: string
          owner_id: string
          reason?: string
          start_date: string
          start_time?: string | null
        }
        Update: {
          calendar_event_id?: string
          created_at?: string
          end_date?: string
          end_time?: string | null
          id?: string
          owner_id?: string
          reason?: string
          start_date?: string
          start_time?: string | null
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
      weekly_schedule: {
        Row: {
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          location_id: string | null
          owner_id: string
          start_time: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          location_id?: string | null
          owner_id: string
          start_time: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          location_id?: string | null
          owner_id?: string
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_schedule_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_accounts: {
        Row: {
          access_token_ciphertext: string
          app_secret_ciphertext: string
          created_at: string
          display_phone: string
          last_error: string
          owner_id: string
          phone_number_id: string
          reminder_template_lang: string
          reminder_template_name: string
          status: string
          updated_at: string
          verify_token: string
          waba_id: string
        }
        Insert: {
          access_token_ciphertext: string
          app_secret_ciphertext?: string
          created_at?: string
          display_phone?: string
          last_error?: string
          owner_id: string
          phone_number_id: string
          reminder_template_lang?: string
          reminder_template_name?: string
          status?: string
          updated_at?: string
          verify_token: string
          waba_id?: string
        }
        Update: {
          access_token_ciphertext?: string
          app_secret_ciphertext?: string
          created_at?: string
          display_phone?: string
          last_error?: string
          owner_id?: string
          phone_number_id?: string
          reminder_template_lang?: string
          reminder_template_name?: string
          status?: string
          updated_at?: string
          verify_token?: string
          waba_id?: string
        }
        Relationships: []
      }
      whatsapp_processed_messages: {
        Row: {
          created_at: string
          message_id: string
        }
        Insert: {
          created_at?: string
          message_id: string
        }
        Update: {
          created_at?: string
          message_id?: string
        }
        Relationships: []
      }
      whatsapp_sessions: {
        Row: {
          context: Json
          created_at: string
          expires_at: string
          history: Json
          id: string
          owner_id: string
          phone: string
          step: string
          updated_at: string
        }
        Insert: {
          context?: Json
          created_at?: string
          expires_at?: string
          history?: Json
          id?: string
          owner_id: string
          phone: string
          step?: string
          updated_at?: string
        }
        Update: {
          context?: Json
          created_at?: string
          expires_at?: string
          history?: Json
          id?: string
          owner_id?: string
          phone?: string
          step?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      consume_reminder_credit: {
        Args: { _monthly: number; _owner: string }
        Returns: string
      }
      refund_reminder_credit: { Args: { _pack: string }; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "user"
      appointment_status: "active" | "cancelled" | "completed"
      attendance_status:
        | "pending"
        | "attended"
        | "absent_notified"
        | "absent_no_notice"
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
    Enums: {
      app_role: ["admin", "user"],
      appointment_status: ["active", "cancelled", "completed"],
      attendance_status: [
        "pending",
        "attended",
        "absent_notified",
        "absent_no_notice",
      ],
    },
  },
} as const

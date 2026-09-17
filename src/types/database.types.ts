
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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      budgets: {
        Row: {
          amount: number
          category_id: number | null
          created_at: string | null
          id: number
          month: number
          user_id: string
          year: number
        }
        Insert: {
          amount: number
          category_id?: number | null
          created_at?: string | null
          id?: number
          month: number
          user_id: string
          year: number
        }
        Update: {
          amount?: number
          category_id?: number | null
          created_at?: string | null
          id?: number
          month?: number
          user_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "budgets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string | null
          id: number
          name: string
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          name: string
          type: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: number
          name?: string
          type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          action_href: string | null
          action_label: string | null
          created_at: string
          dedupe_key: string | null
          description: string
          dismissed_at: string | null
          friend_request_id: string | null
          id: string
          read_at: string | null
          secondary_action_href: string | null
          secondary_action_label: string | null
          split_expense_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          action_href?: string | null
          action_label?: string | null
          created_at?: string
          dedupe_key?: string | null
          description: string
          dismissed_at?: string | null
          friend_request_id?: string | null
          id?: string
          read_at?: string | null
          secondary_action_href?: string | null
          secondary_action_label?: string | null
          split_expense_id?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          action_href?: string | null
          action_label?: string | null
          created_at?: string
          dedupe_key?: string | null
          description?: string
          dismissed_at?: string | null
          friend_request_id?: string | null
          id?: string
          read_at?: string | null
          secondary_action_href?: string | null
          secondary_action_label?: string | null
          split_expense_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_friend_request_id_fkey"
            columns: ["friend_request_id"]
            isOneToOne: false
            referencedRelation: "friend_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_split_expense_id_fkey"
            columns: ["split_expense_id"]
            isOneToOne: false
            referencedRelation: "split_expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      friend_requests: {
        Row: {
          created_at: string
          id: string
          recipient_id: string
          responded_at: string | null
          sender_id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          recipient_id: string
          responded_at?: string | null
          sender_id: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          recipient_id?: string
          responded_at?: string | null
          sender_id?: string
          status?: string
        }
        Relationships: []
      }
      friendships: {
        Row: {
          created_at: string
          id: string
          user_one_id: string
          user_two_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_one_id: string
          user_two_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_one_id?: string
          user_two_id?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          account_security: boolean
          budget_approaching: boolean
          budget_exceeded: boolean
          created_at: string
          monthly_summary: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          account_security?: boolean
          budget_approaching?: boolean
          budget_exceeded?: boolean
          created_at?: string
          monthly_summary?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          account_security?: boolean
          budget_approaching?: boolean
          budget_exceeded?: boolean
          created_at?: string
          monthly_summary?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          budget_reset_cycle: string
          created_at: string | null
          currency: string
          date_format: string
          financial_bio: string | null
          full_name: string | null
          id: string
          location: string | null
          number_format: string
          phone: string | null
          reset_day: number
          timezone: string
        }
        Insert: {
          avatar_url?: string | null
          budget_reset_cycle?: string
          created_at?: string | null
          currency?: string
          date_format?: string
          financial_bio?: string | null
          full_name?: string | null
          id: string
          location?: string | null
          number_format?: string
          phone?: string | null
          reset_day?: number
          timezone?: string
        }
        Update: {
          avatar_url?: string | null
          budget_reset_cycle?: string
          created_at?: string | null
          currency?: string
          date_format?: string
          financial_bio?: string | null
          full_name?: string | null
          id?: string
          location?: string | null
          number_format?: string
          phone?: string | null
          reset_day?: number
          timezone?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          category_id: number | null
          created_at: string | null
          id: number
          merchant: string | null
          note: string | null
          occurred_at: string
          user_id: string
        }
        Insert: {
          amount: number
          category_id?: number | null
          created_at?: string | null
          id?: number
          merchant?: string | null
          note?: string | null
          occurred_at: string
          user_id: string
        }
        Update: {
          amount?: number
          category_id?: number | null
          created_at?: string | null
          id?: number
          merchant?: string | null
          note?: string | null
          occurred_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      split_expenses: {
        Row: {
          created_at: string
          created_by: string
          currency: string
          id: string
          idempotency_key: string
          status: string
          submitted_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          currency: string
          id?: string
          idempotency_key: string
          status?: string
          submitted_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          currency?: string
          id?: string
          idempotency_key?: string
          status?: string
          submitted_at?: string
        }
        Relationships: []
      }
      split_participants: {
        Row: {
          allocated_total_cents: number
          id: string
          paid_total_cents: number
          position: number
          responded_at: string | null
          response_status: string
          split_id: string
          user_id: string
        }
        Insert: {
          allocated_total_cents?: number
          id?: string
          paid_total_cents?: number
          position: number
          responded_at?: string | null
          response_status?: string
          split_id: string
          user_id: string
        }
        Update: {
          allocated_total_cents?: number
          id?: string
          paid_total_cents?: number
          position?: number
          responded_at?: string | null
          response_status?: string
          split_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "split_participants_split_id_fkey"
            columns: ["split_id"]
            isOneToOne: false
            referencedRelation: "split_expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      split_receipts: {
        Row: {
          category_id: number
          created_at: string
          id: string
          merchant: string | null
          payer_user_id: string
          position: number
          receipt_date: string
          receipt_total_cents: number
          split_id: string
        }
        Insert: {
          category_id: number
          created_at?: string
          id?: string
          merchant?: string | null
          payer_user_id: string
          position: number
          receipt_date: string
          receipt_total_cents: number
          split_id: string
        }
        Update: {
          category_id?: number
          created_at?: string
          id?: string
          merchant?: string | null
          payer_user_id?: string
          position?: number
          receipt_date?: string
          receipt_total_cents?: number
          split_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "split_receipts_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "split_receipts_split_id_fkey"
            columns: ["split_id"]
            isOneToOne: false
            referencedRelation: "split_expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      split_receipt_items: {
        Row: {
          assignment_type: string
          description: string
          id: string
          line_total_cents: number
          position: number
          quantity: number
          receipt_id: string
        }
        Insert: {
          assignment_type: string
          description: string
          id?: string
          line_total_cents: number
          position: number
          quantity?: number
          receipt_id: string
        }
        Update: {
          assignment_type?: string
          description?: string
          id?: string
          line_total_cents?: number
          position?: number
          quantity?: number
          receipt_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "split_receipt_items_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "split_receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      split_item_allocations: {
        Row: {
          id: string
          item_id: string
          share_cents: number
          user_id: string
        }
        Insert: {
          id?: string
          item_id: string
          share_cents: number
          user_id: string
        }
        Update: {
          id?: string
          item_id?: string
          share_cents?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "split_item_allocations_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "split_receipt_items"
            referencedColumns: ["id"]
          },
        ]
      }
      split_settlements: {
        Row: {
          amount_cents: number
          created_at: string
          from_user_id: string
          id: string
          settled_at: string | null
          split_id: string
          to_user_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          from_user_id: string
          id?: string
          settled_at?: string | null
          split_id: string
          to_user_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          from_user_id?: string
          id?: string
          settled_at?: string | null
          split_id?: string
          to_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "split_settlements_split_id_fkey"
            columns: ["split_id"]
            isOneToOne: false
            referencedRelation: "split_expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      split_generated_transactions: {
        Row: {
          created_at: string
          id: string
          receipt_id: string
          split_id: string
          transaction_id: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          receipt_id: string
          split_id: string
          transaction_id: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          receipt_id?: string
          split_id?: string
          transaction_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "split_generated_transactions_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "split_receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "split_generated_transactions_split_id_fkey"
            columns: ["split_id"]
            isOneToOne: false
            referencedRelation: "split_expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "split_generated_transactions_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_tx_search: {
        Row: {
          amount: number | null
          category_id: number | null
          category_name: string | null
          category_type: string | null
          created_at: string | null
          id: number | null
          merchant: string | null
          note: string | null
          occurred_at: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      delete_user_everything: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      is_valid_tz: {
        Args: { tz: string }
        Returns: boolean
      }
      dashboard_summary: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      reports_summary: {
        Args: { p_months_count: number; p_category_name?: string | null }
        Returns: Json
      }
      budgets_progress: {
        Args: { p_year: number; p_month: number }
        Returns: { category_id: number | null; spent: number }[]
      }
      transaction_category_counts: {
        Args: Record<PropertyKey, never>
        Returns: { category_name: string; count: number }[]
      }
      transactions_activity_summary: {
        Args: { p_from?: string | null; p_to?: string | null }
        Returns: Json
      }
      evaluate_budget_notifications: {
        Args: { p_user_id: string; p_category_id: number; p_year: number; p_month: number }
        Returns: undefined
      }
      update_user_settings: {
        Args: {
          p_timezone: string
          p_currency: string
          p_date_format: string
          p_number_format: string
          p_budget_approaching: boolean
          p_budget_exceeded: boolean
          p_monthly_summary: boolean
          p_account_security: boolean
        }
        Returns: undefined
      }
      search_nexali_users: {
        Args: { p_query: string }
        Returns: {
          user_id: string
          full_name: string | null
          avatar_url: string | null
          email: string | null
          relationship_status: string
        }[]
      }
      list_friends: {
        Args: Record<PropertyKey, never>
        Returns: {
          user_id: string
          full_name: string | null
          avatar_url: string | null
          email: string
          friendship_id: string
          friends_since: string
        }[]
      }
      list_incoming_friend_requests: {
        Args: Record<PropertyKey, never>
        Returns: {
          request_id: string
          sender_user_id: string
          sender_full_name: string | null
          sender_avatar_url: string | null
          created_at: string
        }[]
      }
      get_incoming_friend_request_count: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      send_friend_request: {
        Args: { p_recipient_id: string }
        Returns: string
      }
      accept_friend_request: {
        Args: { p_request_id: string }
        Returns: undefined
      }
      decline_friend_request: {
        Args: { p_request_id: string }
        Returns: undefined
      }
      remove_friend: {
        Args: { p_friend_user_id: string }
        Returns: undefined
      }
      submit_split_expense: {
        Args: { p_payload: Json }
        Returns: Json
      }
      accept_split_expense: {
        Args: { p_split_id: string }
        Returns: Json
      }
      decline_split_expense: {
        Args: { p_split_id: string }
        Returns: Json
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

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
      catalog_items: {
        Row: {
          created_at: string
          icon_key: string
          id: string
          name: string
          price: number
          unit: string
        }
        Insert: {
          created_at?: string
          icon_key?: string
          id: string
          name: string
          price?: number
          unit?: string
        }
        Update: {
          created_at?: string
          icon_key?: string
          id?: string
          name?: string
          price?: number
          unit?: string
        }
        Relationships: []
      }
      demand: {
        Row: {
          item_id: string | null
          key: string
          label: string
          last_at: string
          requests: number
          unfilled: number
        }
        Insert: {
          item_id?: string | null
          key: string
          label: string
          last_at?: string
          requests?: number
          unfilled?: number
        }
        Update: {
          item_id?: string | null
          key?: string
          label?: string
          last_at?: string
          requests?: number
          unfilled?: number
        }
        Relationships: []
      }
      orders: {
        Row: {
          buyer_id: string
          buyer_lat: number | null
          buyer_lng: number | null
          created_at: string
          id: string
          items: Json
          note: string
          paid_with: string | null
          status: string
          total: number
          trader_id: string | null
          updated_at: string
          wish: string
        }
        Insert: {
          buyer_id: string
          buyer_lat?: number | null
          buyer_lng?: number | null
          created_at?: string
          id?: string
          items?: Json
          note?: string
          paid_with?: string | null
          status?: string
          total?: number
          trader_id?: string | null
          updated_at?: string
          wish?: string
        }
        Update: {
          buyer_id?: string
          buyer_lat?: number | null
          buyer_lng?: number | null
          created_at?: string
          id?: string
          items?: Json
          note?: string
          paid_with?: string | null
          status?: string
          total?: number
          trader_id?: string | null
          updated_at?: string
          wish?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          buyer_id: string
          created_at: string
          currency: string
          external_id: string | null
          failure_reason: string | null
          id: string
          order_id: string
          payer_msisdn: string | null
          provider: string
          provider_status: string | null
          reference: string
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
          verified_at: string | null
        }
        Insert: {
          amount: number
          buyer_id: string
          created_at?: string
          currency?: string
          external_id?: string | null
          failure_reason?: string | null
          id?: string
          order_id: string
          payer_msisdn?: string | null
          provider?: string
          provider_status?: string | null
          reference: string
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
          verified_at?: string | null
        }
        Update: {
          amount?: number
          buyer_id?: string
          created_at?: string
          currency?: string
          external_id?: string | null
          failure_reason?: string | null
          id?: string
          order_id?: string
          payer_msisdn?: string | null
          provider?: string
          provider_status?: string | null
          reference?: string
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "wave_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar: string | null
          created_at: string
          id: string
          lat: number | null
          lng: number | null
          name: string
          online: boolean
          rating: number
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          avatar?: string | null
          created_at?: string
          id: string
          lat?: number | null
          lng?: number | null
          name?: string
          online?: boolean
          rating?: number
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          avatar?: string | null
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string
          online?: boolean
          rating?: number
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      settlements: {
        Row: {
          commission: number
          created_at: string
          gross: number
          id: string
          net: number
          order_id: string
          payment_id: string
          settled_at: string | null
          status: Database["public"]["Enums"]["settlement_status"]
          trader_id: string
          updated_at: string
        }
        Insert: {
          commission?: number
          created_at?: string
          gross: number
          id?: string
          net: number
          order_id: string
          payment_id: string
          settled_at?: string | null
          status?: Database["public"]["Enums"]["settlement_status"]
          trader_id: string
          updated_at?: string
        }
        Update: {
          commission?: number
          created_at?: string
          gross?: number
          id?: string
          net?: number
          order_id?: string
          payment_id?: string
          settled_at?: string | null
          status?: Database["public"]["Enums"]["settlement_status"]
          trader_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "settlements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "wave_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlements_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      stock: {
        Row: {
          available: boolean
          id: string
          item_id: string
          price: number
          quantity: number
          trader_id: string
          updated_at: string
        }
        Insert: {
          available?: boolean
          id?: string
          item_id: string
          price?: number
          quantity?: number
          trader_id: string
          updated_at?: string
        }
        Update: {
          available?: boolean
          id?: string
          item_id?: string
          price?: number
          quantity?: number
          trader_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      trader_earnings: {
        Row: {
          earnings: number
          updated_at: string
          user_id: string
        }
        Insert: {
          earnings?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          earnings?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          balance: number
          created_at: string
          pin_hash: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          pin_hash: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          pin_hash?: string
          user_id?: string
        }
        Relationships: []
      }
      wave_orders: {
        Row: {
          amount: number
          buyer_id: string
          completed_at: string | null
          created_at: string
          currency: string
          delivered_at: string | null
          id: string
          items: Json
          note: string
          rating: number | null
          rating_comment: string | null
          status: Database["public"]["Enums"]["order_status"]
          trader_id: string
          updated_at: string
          wave_id: string
        }
        Insert: {
          amount?: number
          buyer_id: string
          completed_at?: string | null
          created_at?: string
          currency?: string
          delivered_at?: string | null
          id?: string
          items?: Json
          note?: string
          rating?: number | null
          rating_comment?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          trader_id: string
          updated_at?: string
          wave_id: string
        }
        Update: {
          amount?: number
          buyer_id?: string
          completed_at?: string | null
          created_at?: string
          currency?: string
          delivered_at?: string | null
          id?: string
          items?: Json
          note?: string
          rating?: number | null
          rating_comment?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          trader_id?: string
          updated_at?: string
          wave_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wave_orders_wave_id_fkey"
            columns: ["wave_id"]
            isOneToOne: true
            referencedRelation: "waves"
            referencedColumns: ["id"]
          },
        ]
      }
      waves: {
        Row: {
          buyer_id: string
          created_at: string
          expires_at: string
          id: string
          items: Json
          lat: number | null
          lng: number | null
          note: string
          status: Database["public"]["Enums"]["wave_status"]
          trader_id: string | null
          updated_at: string
          wish: string
        }
        Insert: {
          buyer_id: string
          created_at?: string
          expires_at?: string
          id?: string
          items?: Json
          lat?: number | null
          lng?: number | null
          note?: string
          status?: Database["public"]["Enums"]["wave_status"]
          trader_id?: string | null
          updated_at?: string
          wish?: string
        }
        Update: {
          buyer_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          items?: Json
          lat?: number | null
          lng?: number | null
          note?: string
          status?: Database["public"]["Enums"]["wave_status"]
          trader_id?: string | null
          updated_at?: string
          wish?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_wave: {
        Args: { _trader: string; _wave_id: string }
        Returns: {
          amount: number
          buyer_id: string
          completed_at: string | null
          created_at: string
          currency: string
          delivered_at: string | null
          id: string
          items: Json
          note: string
          rating: number | null
          rating_comment: string | null
          status: Database["public"]["Enums"]["order_status"]
          trader_id: string
          updated_at: string
          wave_id: string
        }
        SetofOptions: {
          from: "*"
          to: "wave_orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      advance_order: {
        Args: {
          _actor: string
          _next: Database["public"]["Enums"]["order_status"]
          _order_id: string
        }
        Returns: {
          amount: number
          buyer_id: string
          completed_at: string | null
          created_at: string
          currency: string
          delivered_at: string | null
          id: string
          items: Json
          note: string
          rating: number | null
          rating_comment: string | null
          status: Database["public"]["Enums"]["order_status"]
          trader_id: string
          updated_at: string
          wave_id: string
        }
        SetofOptions: {
          from: "*"
          to: "wave_orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_wave: {
        Args: {
          _buyer: string
          _items: Json
          _lat: number
          _lng: number
          _note: string
          _wish: string
        }
        Returns: {
          buyer_id: string
          created_at: string
          expires_at: string
          id: string
          items: Json
          lat: number | null
          lng: number | null
          note: string
          status: Database["public"]["Enums"]["wave_status"]
          trader_id: string | null
          updated_at: string
          wish: string
        }
        SetofOptions: {
          from: "*"
          to: "waves"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      decline_wave: {
        Args: { _trader: string; _wave_id: string }
        Returns: undefined
      }
      expire_waves: { Args: never; Returns: number }
      finalize_payment: {
        Args: {
          _failure: string
          _provider_status: string
          _reference: string
          _status: Database["public"]["Enums"]["payment_status"]
        }
        Returns: {
          amount: number
          buyer_id: string
          created_at: string
          currency: string
          external_id: string | null
          failure_reason: string | null
          id: string
          order_id: string
          payer_msisdn: string | null
          provider: string
          provider_status: string | null
          reference: string
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
          verified_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "payments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      log_demand: {
        Args: { _item_id: string; _label: string; _stocked: boolean }
        Returns: undefined
      }
      mark_settled: {
        Args: { _settlement_id: string }
        Returns: {
          commission: number
          created_at: string
          gross: number
          id: string
          net: number
          order_id: string
          payment_id: string
          settled_at: string | null
          status: Database["public"]["Enums"]["settlement_status"]
          trader_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "settlements"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      pay_order: {
        Args: { _method: string; _order_id: string; _pin: string }
        Returns: string
      }
      price_basket: { Args: { _items: Json; _trader: string }; Returns: number }
      rate_order: {
        Args: {
          _buyer: string
          _comment: string
          _order_id: string
          _rating: number
        }
        Returns: undefined
      }
      start_payment: {
        Args: {
          _buyer: string
          _external_id: string
          _msisdn: string
          _order_id: string
          _reference: string
        }
        Returns: {
          amount: number
          buyer_id: string
          created_at: string
          currency: string
          external_id: string | null
          failure_reason: string | null
          id: string
          order_id: string
          payer_msisdn: string | null
          provider: string
          provider_status: string | null
          reference: string
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
          verified_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "payments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      app_role: "buyer" | "trader"
      order_status:
        | "created"
        | "accepted"
        | "preparing"
        | "ready"
        | "delivering"
        | "delivered"
        | "completed"
      payment_status: "pending" | "successful" | "failed"
      settlement_status: "pending" | "settled"
      wave_status: "created" | "accepted" | "declined" | "expired"
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
      app_role: ["buyer", "trader"],
      order_status: [
        "created",
        "accepted",
        "preparing",
        "ready",
        "delivering",
        "delivered",
        "completed",
      ],
      payment_status: ["pending", "successful", "failed"],
      settlement_status: ["pending", "settled"],
      wave_status: ["created", "accepted", "declined", "expired"],
    },
  },
} as const

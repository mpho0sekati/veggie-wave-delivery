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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      log_demand: {
        Args: { _item_id: string; _label: string; _stocked: boolean }
        Returns: undefined
      }
      pay_order: {
        Args: { _method: string; _order_id: string; _pin: string }
        Returns: string
      }
    }
    Enums: {
      app_role: "buyer" | "trader"
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
    },
  },
} as const

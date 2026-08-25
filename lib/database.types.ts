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
      delivery_locations: {
        Row: {
          address: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          notes: string | null
          position: number
        }
        Insert: {
          address: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          position?: number
        }
        Update: {
          address?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          position?: number
        }
        Relationships: []
      }
      payment_methods: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          label: string | null
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string | null
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      dishes: {
        Row: {
          description: string | null
          id: string
          menu_day_id: string
          name: string
          photo_url: string | null
          position: number
          price: number
          stock: number | null
        }
        Insert: {
          description?: string | null
          id?: string
          menu_day_id: string
          name: string
          photo_url?: string | null
          position?: number
          price?: number
          stock?: number | null
        }
        Update: {
          description?: string | null
          id?: string
          menu_day_id?: string
          name?: string
          photo_url?: string | null
          position?: number
          price?: number
          stock?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "dishes_menu_day_id_fkey"
            columns: ["menu_day_id"]
            isOneToOne: false
            referencedRelation: "menu_days"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_days: {
        Row: {
          day_date: string
          day_label: string
          id: string
          menu_id: string
          position: number
        }
        Insert: {
          day_date: string
          day_label: string
          id?: string
          menu_id: string
          position?: number
        }
        Update: {
          day_date?: string
          day_label?: string
          id?: string
          menu_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "menu_days_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "menus"
            referencedColumns: ["id"]
          },
        ]
      }
      menus: {
        Row: {
          created_at: string
          id: string
          is_published: boolean
          week_start_date: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_published?: boolean
          week_start_date: string
        }
        Update: {
          created_at?: string
          id?: string
          is_published?: boolean
          week_start_date?: string
        }
        Relationships: []
      }
      option_choices: {
        Row: {
          extra_cost: number
          id: string
          label: string
          option_group_id: string
          position: number
        }
        Insert: {
          extra_cost?: number
          id?: string
          label: string
          option_group_id: string
          position?: number
        }
        Update: {
          extra_cost?: number
          id?: string
          label?: string
          option_group_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "option_choices_option_group_id_fkey"
            columns: ["option_group_id"]
            isOneToOne: false
            referencedRelation: "option_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      option_groups: {
        Row: {
          dish_id: string
          id: string
          is_required: boolean
          label: string
          position: number
          type: string
        }
        Insert: {
          dish_id: string
          id?: string
          is_required?: boolean
          label: string
          position?: number
          type: string
        }
        Update: {
          dish_id?: string
          id?: string
          is_required?: boolean
          label?: string
          position?: number
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "option_groups_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "dishes"
            referencedColumns: ["id"]
          },
        ]
      }
      order_item_options: {
        Row: {
          chosen_option_label: string
          extra_cost: number
          id: string
          option_group_label: string
          order_item_id: string
        }
        Insert: {
          chosen_option_label: string
          extra_cost?: number
          id?: string
          option_group_label: string
          order_item_id: string
        }
        Update: {
          chosen_option_label?: string
          extra_cost?: number
          id?: string
          option_group_label?: string
          order_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_item_options_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          day_date: string
          day_label: string
          dish_id: string | null
          dish_name: string
          id: string
          order_id: string
          quantity: number
          unit_price: number
        }
        Insert: {
          day_date: string
          day_label: string
          dish_id?: string | null
          dish_name: string
          id?: string
          order_id: string
          quantity?: number
          unit_price: number
        }
        Update: {
          day_date?: string
          day_label?: string
          dish_id?: string | null
          dish_name?: string
          id?: string
          order_id?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "dishes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          customer_name: string
          customer_phone: string
          delivery_address: string | null
          delivery_type: string
          id: string
          menu_id: string | null
          notes: string | null
          payment_status: string
          total: number
          delivery_location_id: string | null
          delivery_location_name: string | null
          payment_error: string | null
          stripe_payment_intent_id: string | null
          payment_method_id: string | null
          payment_method_label: string | null
          transfer_proof_url: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          customer_name: string
          customer_phone: string
          delivery_address?: string | null
          delivery_type?: string
          id?: string
          menu_id?: string | null
          notes?: string | null
          payment_status?: string
          total?: number
          delivery_location_id?: string | null
          delivery_location_name?: string | null
          payment_error?: string | null
          stripe_payment_intent_id?: string | null
          payment_method_id?: string | null
          payment_method_label?: string | null
          transfer_proof_url?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          customer_name?: string
          customer_phone?: string
          delivery_address?: string | null
          delivery_type?: string
          id?: string
          menu_id?: string | null
          notes?: string | null
          payment_status?: string
          total?: number
          delivery_location_id?: string | null
          delivery_location_name?: string | null
          payment_error?: string | null
          stripe_payment_intent_id?: string | null
          payment_method_id?: string | null
          payment_method_label?: string | null
          transfer_proof_url?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "menus"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          delivery_location_id: string | null
          email: string | null
          stripe_customer_id: string | null
          full_name: string | null
          id: string
          phone: string | null
          role: string
        }
        Insert: {
          created_at?: string
          delivery_location_id?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          stripe_customer_id?: string | null
          phone?: string | null
          role?: string
        }
        Update: {
          created_at?: string
          delivery_location_id?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          role?: string
          stripe_customer_id?: string | null
        }
        Relationships: []
      }
      settings: {
        Row: {
          key: string
          value: string | null
        }
        Insert: {
          key: string
          value?: string | null
        }
        Update: {
          key?: string
          value?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      dish_availability: {
        Row: {
          dish_id: string
          menu_day_id: string
          stock: number | null
          reservado: number
          disponible: number | null
        }
        Relationships: [
          {
            foreignKeyName: "dishes_menu_day_id_fkey"
            columns: ["menu_day_id"]
            isOneToOne: false
            referencedRelation: "menu_days"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      crear_pedido: {
        Args: {
          p_menu_id: string
          p_customer_name: string
          p_customer_phone: string
          p_notes: string | null
          p_delivery_location_id: string | null
          p_delivery_location_name: string | null
          p_payment_method_id: string | null
          p_payment_method_label: string | null
          p_payment_status: string
          p_transfer_proof_url: string | null
          p_stripe_payment_intent_id: string | null
          p_total: number
          p_items: Json
        }
        Returns: string
      }
      verificar_stock: {
        Args: { dish_id: string; cantidad: number }
        Returns: undefined
      }
      estados_que_consumen_stock: {
        Args: Record<PropertyKey, never>
        Returns: string[]
      }
      clone_dish_into_day: {
        Args: { source_dish_id: string; target_menu_day_id: string }
        Returns: string
      }
      day_label_es: {
        Args: { fecha: string }
        Returns: string
      }
      duplicate_menu_week: {
        Args: {
          source_menu_id: string
          new_week_start: string
          include_saturday?: boolean
        }
        Returns: string
      }
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      set_default_payment_method: {
        Args: { method_id: string }
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

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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      community_food_approvals: {
        Row: {
          created_at: string
          food_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          food_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          food_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_food_approvals_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "community_foods"
            referencedColumns: ["id"]
          },
        ]
      }
      community_foods: {
        Row: {
          approval_count: number
          approved_at: string | null
          barcode: string | null
          brand: string | null
          created_at: string
          id: string
          image_path: string | null
          name: string
          nutrients: Json
          serving_size: number
          serving_unit: string
          status: Database["public"]["Enums"]["community_food_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          approval_count?: number
          approved_at?: string | null
          barcode?: string | null
          brand?: string | null
          created_at?: string
          id?: string
          image_path?: string | null
          name: string
          nutrients?: Json
          serving_size?: number
          serving_unit?: string
          status?: Database["public"]["Enums"]["community_food_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          approval_count?: number
          approved_at?: string | null
          barcode?: string | null
          brand?: string | null
          created_at?: string
          id?: string
          image_path?: string | null
          name?: string
          nutrients?: Json
          serving_size?: number
          serving_unit?: string
          status?: Database["public"]["Enums"]["community_food_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      feedback: {
        Row: {
          created_at: string
          id: string
          message: string
          reply_email: string | null
          screenshot_path: string | null
          type: Database["public"]["Enums"]["feedback_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          reply_email?: string | null
          screenshot_path?: string | null
          type?: Database["public"]["Enums"]["feedback_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          reply_email?: string | null
          screenshot_path?: string | null
          type?: Database["public"]["Enums"]["feedback_type"]
          user_id?: string
        }
        Relationships: []
      }
      premium_users: {
        Row: {
          id: string
          unlock_method: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          id?: string
          unlock_method?: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          id?: string
          unlock_method?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          count: number
          id: string
          key: string
          window_start: string
        }
        Insert: {
          count?: number
          id?: string
          key: string
          window_start?: string
        }
        Update: {
          count?: number
          id?: string
          key?: string
          window_start?: string
        }
        Relationships: []
      }
      theme_packs: {
        Row: {
          accent_hue: number
          accent_path: string | null
          background_path: string | null
          button_path: string | null
          card_path: string | null
          created_at: string
          description: string | null
          downloads: number
          id: string
          is_published: boolean
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          accent_hue?: number
          accent_path?: string | null
          background_path?: string | null
          button_path?: string | null
          card_path?: string | null
          created_at?: string
          description?: string | null
          downloads?: number
          id?: string
          is_published?: boolean
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          accent_hue?: number
          accent_path?: string | null
          background_path?: string | null
          button_path?: string | null
          card_path?: string | null
          created_at?: string
          description?: string | null
          downloads?: number
          id?: string
          is_published?: boolean
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      unlock_codes: {
        Row: {
          code: string
          created_at: string
          current_uses: number
          id: string
          is_active: boolean
          max_uses: number
        }
        Insert: {
          code: string
          created_at?: string
          current_uses?: number
          id?: string
          is_active?: boolean
          max_uses?: number
        }
        Update: {
          code?: string
          created_at?: string
          current_uses?: number
          id?: string
          is_active?: boolean
          max_uses?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_and_increment_rate_limit: {
        Args: {
          p_key: string
          p_max_requests: number
          p_window_seconds?: number
        }
        Returns: boolean
      }
      delete_own_account: { Args: never; Returns: undefined }
      is_premium: { Args: { p_user_id: string }; Returns: boolean }
      redeem_unlock_code: {
        Args: { p_code: string; p_user_id: string }
        Returns: Json
      }
    }
    Enums: {
      community_food_status: "pending" | "approved" | "rejected"
      feedback_type: "bug" | "feature" | "other"
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
      community_food_status: ["pending", "approved", "rejected"],
      feedback_type: ["bug", "feature", "other"],
    },
  },
} as const

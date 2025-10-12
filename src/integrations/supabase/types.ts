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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      altura_ref: {
        Row: {
          denominacao: string
          h_max_m: number | null
          h_min_m: number | null
          tipo: string
        }
        Insert: {
          denominacao: string
          h_max_m?: number | null
          h_min_m?: number | null
          tipo: string
        }
        Update: {
          denominacao?: string
          h_max_m?: number | null
          h_min_m?: number | null
          tipo?: string
        }
        Relationships: []
      }
      cnae_catalogo: {
        Row: {
          carga_incendio_mj_m2: number
          cnae: string
          descricao: string
          divisao: string
          grupo: string
          ocupacao_uso: string
        }
        Insert: {
          carga_incendio_mj_m2: number
          cnae: string
          descricao: string
          divisao: string
          grupo: string
          ocupacao_uso: string
        }
        Update: {
          carga_incendio_mj_m2?: number
          cnae?: string
          descricao?: string
          divisao?: string
          grupo?: string
          ocupacao_uso?: string
        }
        Relationships: []
      }
      empresa: {
        Row: {
          altura_denominacao: string | null
          altura_tipo: string | null
          area_m2: number
          bairro: string
          carga_incendio_mj_m2: number | null
          cep: string
          cidade: string
          cnae: string | null
          cnpj: string
          created_at: string | null
          descricao: string | null
          divisao: string | null
          email: string
          estado: string
          grau_risco: string | null
          grupo: string | null
          id: string
          nome_fantasia: string | null
          numero: string
          numero_ocupantes: number
          ocupacao_uso: string | null
          razao_social: string
          responsavel: string
          rua: string
          telefone: string
          updated_at: string | null
        }
        Insert: {
          altura_denominacao?: string | null
          altura_tipo?: string | null
          area_m2: number
          bairro: string
          carga_incendio_mj_m2?: number | null
          cep: string
          cidade: string
          cnae?: string | null
          cnpj: string
          created_at?: string | null
          descricao?: string | null
          divisao?: string | null
          email: string
          estado: string
          grau_risco?: string | null
          grupo?: string | null
          id?: string
          nome_fantasia?: string | null
          numero: string
          numero_ocupantes: number
          ocupacao_uso?: string | null
          razao_social: string
          responsavel: string
          rua: string
          telefone: string
          updated_at?: string | null
        }
        Update: {
          altura_denominacao?: string | null
          altura_tipo?: string | null
          area_m2?: number
          bairro?: string
          carga_incendio_mj_m2?: number | null
          cep?: string
          cidade?: string
          cnae?: string | null
          cnpj?: string
          created_at?: string | null
          descricao?: string | null
          divisao?: string | null
          email?: string
          estado?: string
          grau_risco?: string | null
          grupo?: string | null
          id?: string
          nome_fantasia?: string | null
          numero?: string
          numero_ocupantes?: number
          ocupacao_uso?: string | null
          razao_social?: string
          responsavel?: string
          rua?: string
          telefone?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "empresa_altura_tipo_fkey"
            columns: ["altura_tipo"]
            isOneToOne: false
            referencedRelation: "altura_ref"
            referencedColumns: ["tipo"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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

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
      checklist_itens: {
        Row: {
          created_at: string
          descricao: string
          id: string
          inspecao_id: string
          item_numero: string
          ordem: number
        }
        Insert: {
          created_at?: string
          descricao: string
          id?: string
          inspecao_id: string
          item_numero: string
          ordem: number
        }
        Update: {
          created_at?: string
          descricao?: string
          id?: string
          inspecao_id?: string
          item_numero?: string
          ordem?: number
        }
        Relationships: [
          {
            foreignKeyName: "checklist_itens_inspecao_id_fkey"
            columns: ["inspecao_id"]
            isOneToOne: false
            referencedRelation: "inspecoes"
            referencedColumns: ["id"]
          },
        ]
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
          altura_descricao: string | null
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
          altura_descricao?: string | null
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
          altura_descricao?: string | null
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
      empresa_checklist: {
        Row: {
          checklist_item_id: string
          created_at: string
          empresa_id: string
          id: string
          observacoes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          checklist_item_id: string
          created_at?: string
          empresa_id: string
          id?: string
          observacoes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          checklist_item_id?: string
          created_at?: string
          empresa_id?: string
          id?: string
          observacoes?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "empresa_checklist_checklist_item_id_fkey"
            columns: ["checklist_item_id"]
            isOneToOne: false
            referencedRelation: "checklist_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "empresa_checklist_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa"
            referencedColumns: ["id"]
          },
        ]
      }
      empresa_exigencias: {
        Row: {
          atende: boolean
          created_at: string
          empresa_id: string
          exigencia_id: string
          id: string
          observacoes: string | null
          updated_at: string
        }
        Insert: {
          atende?: boolean
          created_at?: string
          empresa_id: string
          exigencia_id: string
          id?: string
          observacoes?: string | null
          updated_at?: string
        }
        Update: {
          atende?: boolean
          created_at?: string
          empresa_id?: string
          exigencia_id?: string
          id?: string
          observacoes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "empresa_exigencias_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "empresa_exigencias_exigencia_id_fkey"
            columns: ["exigencia_id"]
            isOneToOne: false
            referencedRelation: "exigencias_seguranca"
            referencedColumns: ["id"]
          },
        ]
      }
      exigencias_criterios: {
        Row: {
          altura_max: number | null
          altura_min: number | null
          altura_tipo: string | null
          area_max: number | null
          area_min: number | null
          created_at: string
          divisao: string | null
          exigencia_id: string
          id: string
          observacao: string | null
        }
        Insert: {
          altura_max?: number | null
          altura_min?: number | null
          altura_tipo?: string | null
          area_max?: number | null
          area_min?: number | null
          created_at?: string
          divisao?: string | null
          exigencia_id: string
          id?: string
          observacao?: string | null
        }
        Update: {
          altura_max?: number | null
          altura_min?: number | null
          altura_tipo?: string | null
          area_max?: number | null
          area_min?: number | null
          created_at?: string
          divisao?: string | null
          exigencia_id?: string
          id?: string
          observacao?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exigencias_criterios_exigencia_id_fkey"
            columns: ["exigencia_id"]
            isOneToOne: false
            referencedRelation: "exigencias_seguranca"
            referencedColumns: ["id"]
          },
        ]
      }
      exigencias_seguranca: {
        Row: {
          categoria: string
          codigo: string
          created_at: string
          id: string
          nome: string
          ordem: number
          subcategoria: string | null
        }
        Insert: {
          categoria: string
          codigo: string
          created_at?: string
          id?: string
          nome: string
          ordem: number
          subcategoria?: string | null
        }
        Update: {
          categoria?: string
          codigo?: string
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
          subcategoria?: string | null
        }
        Relationships: []
      }
      inspecoes: {
        Row: {
          codigo: string
          created_at: string
          id: string
          nome: string
          ordem: number
          tipo: string
        }
        Insert: {
          codigo: string
          created_at?: string
          id?: string
          nome: string
          ordem: number
          tipo: string
        }
        Update: {
          codigo?: string
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
          tipo?: string
        }
        Relationships: []
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

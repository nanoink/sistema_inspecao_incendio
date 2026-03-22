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
      checklist_itens_modelo: {
        Row: {
          avaliavel: boolean
          complemento: string | null
          created_at: string
          descricao: string
          grupo_id: string
          id: string
          numero_original: string | null
          ordem: number
          tipo: string
        }
        Insert: {
          avaliavel?: boolean
          complemento?: string | null
          created_at?: string
          descricao: string
          grupo_id: string
          id?: string
          numero_original?: string | null
          ordem: number
          tipo?: string
        }
        Update: {
          avaliavel?: boolean
          complemento?: string | null
          created_at?: string
          descricao?: string
          grupo_id?: string
          id?: string
          numero_original?: string | null
          ordem?: number
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_itens_modelo_grupo_id_fkey"
            columns: ["grupo_id"]
            isOneToOne: false
            referencedRelation: "checklist_grupos"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_grupos: {
        Row: {
          created_at: string
          id: string
          modelo_id: string
          ordem: number
          tipo: string
          titulo: string
        }
        Insert: {
          created_at?: string
          id?: string
          modelo_id: string
          ordem: number
          tipo?: string
          titulo: string
        }
        Update: {
          created_at?: string
          id?: string
          modelo_id?: string
          ordem?: number
          tipo?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_grupos_modelo_id_fkey"
            columns: ["modelo_id"]
            isOneToOne: false
            referencedRelation: "checklist_modelos"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_modelos: {
        Row: {
          ativo: boolean
          codigo: string
          created_at: string
          id: string
          nome: string
          ordem: number
          tipo: string
          titulo: string
          total_grupos: number | null
        }
        Insert: {
          ativo?: boolean
          codigo: string
          created_at?: string
          id?: string
          nome: string
          ordem: number
          tipo?: string
          titulo: string
          total_grupos?: number | null
        }
        Update: {
          ativo?: boolean
          codigo?: string
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
          tipo?: string
          titulo?: string
          total_grupos?: number | null
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
          altura_descricao: string | null
          altura_tipo: string | null
          altura_real_m: number | null
          area_m2: number
          area_depositos_m2: number | null
          area_maior_pavimento_m2: number | null
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
          possui_atrio: boolean | null
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
          altura_real_m?: number | null
          area_m2: number
          area_depositos_m2?: number | null
          area_maior_pavimento_m2?: number | null
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
          possui_atrio?: boolean | null
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
          altura_real_m?: number | null
          area_m2?: number
          area_depositos_m2?: number | null
          area_maior_pavimento_m2?: number | null
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
          possui_atrio?: boolean | null
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
      empresa_extintores: {
        Row: {
          carga_nominal: string
          checklist_snapshot: Json
          created_at: string
          empresa_id: string
          id: string
          localizacao: string
          numero: string
          public_token: string
          qr_code_svg: string | null
          qr_code_url: string | null
          tipo: string
          updated_at: string
          vencimento_carga: string
          vencimento_teste_hidrostatico_ano: number
        }
        Insert: {
          carga_nominal: string
          checklist_snapshot?: Json
          created_at?: string
          empresa_id: string
          id?: string
          localizacao: string
          numero: string
          public_token?: string
          qr_code_svg?: string | null
          qr_code_url?: string | null
          tipo: string
          updated_at?: string
          vencimento_carga: string
          vencimento_teste_hidrostatico_ano: number
        }
        Update: {
          carga_nominal?: string
          checklist_snapshot?: Json
          created_at?: string
          empresa_id?: string
          id?: string
          localizacao?: string
          numero?: string
          public_token?: string
          qr_code_svg?: string | null
          qr_code_url?: string | null
          tipo?: string
          updated_at?: string
          vencimento_carga?: string
          vencimento_teste_hidrostatico_ano?: number
        }
        Relationships: [
          {
            foreignKeyName: "empresa_extintores_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa"
            referencedColumns: ["id"]
          },
        ]
      }
      empresa_hidrantes: {
        Row: {
          chave_mangueira: boolean
          checklist_snapshot: Json
          created_at: string
          empresa_id: string
          esguicho: boolean
          id: string
          localizacao: string
          mangueira1_tipo: string
          mangueira1_vencimento_teste_hidrostatico: string
          mangueira2_tipo: string | null
          mangueira2_vencimento_teste_hidrostatico: string | null
          numero: string
          public_token: string
          qr_code_svg: string | null
          qr_code_url: string | null
          status: string | null
          tipo_hidrante: string
          updated_at: string
        }
        Insert: {
          chave_mangueira?: boolean
          checklist_snapshot?: Json
          created_at?: string
          empresa_id: string
          esguicho?: boolean
          id?: string
          localizacao: string
          mangueira1_tipo: string
          mangueira1_vencimento_teste_hidrostatico: string
          mangueira2_tipo?: string | null
          mangueira2_vencimento_teste_hidrostatico?: string | null
          numero: string
          public_token?: string
          qr_code_svg?: string | null
          qr_code_url?: string | null
          status?: string | null
          tipo_hidrante: string
          updated_at?: string
        }
        Update: {
          chave_mangueira?: boolean
          checklist_snapshot?: Json
          created_at?: string
          empresa_id?: string
          esguicho?: boolean
          id?: string
          localizacao?: string
          mangueira1_tipo?: string
          mangueira1_vencimento_teste_hidrostatico?: string
          mangueira2_tipo?: string | null
          mangueira2_vencimento_teste_hidrostatico?: string | null
          numero?: string
          public_token?: string
          qr_code_svg?: string | null
          qr_code_url?: string | null
          status?: string | null
          tipo_hidrante?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "empresa_hidrantes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa"
            referencedColumns: ["id"]
          },
        ]
      }
      empresa_luminarias: {
        Row: {
          checklist_snapshot: Json
          created_at: string
          empresa_id: string
          id: string
          localizacao: string
          numero: string
          public_token: string
          qr_code_svg: string | null
          qr_code_url: string | null
          status: string
          tipo_luminaria: string
          updated_at: string
        }
        Insert: {
          checklist_snapshot?: Json
          created_at?: string
          empresa_id: string
          id?: string
          localizacao: string
          numero: string
          public_token?: string
          qr_code_svg?: string | null
          qr_code_url?: string | null
          status: string
          tipo_luminaria: string
          updated_at?: string
        }
        Update: {
          checklist_snapshot?: Json
          created_at?: string
          empresa_id?: string
          id?: string
          localizacao?: string
          numero?: string
          public_token?: string
          qr_code_svg?: string | null
          qr_code_url?: string | null
          status?: string
          tipo_luminaria?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "empresa_luminarias_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa"
            referencedColumns: ["id"]
          },
        ]
      }
      empresa_checklist_respostas: {
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
            foreignKeyName: "empresa_checklist_respostas_checklist_item_id_fkey"
            columns: ["checklist_item_id"]
            isOneToOne: false
            referencedRelation: "checklist_itens_modelo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "empresa_checklist_respostas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa"
            referencedColumns: ["id"]
          },
        ]
      }
      empresa_checklist_nao_conformidades: {
        Row: {
          checklist_item_id: string
          context_key: string
          created_at: string
          descricao: string
          empresa_id: string
          equipment_record_id: string | null
          equipment_type: string | null
          id: string
          imagem_data_url: string | null
          updated_at: string
        }
        Insert: {
          checklist_item_id: string
          context_key: string
          created_at?: string
          descricao?: string
          empresa_id: string
          equipment_record_id?: string | null
          equipment_type?: string | null
          id?: string
          imagem_data_url?: string | null
          updated_at?: string
        }
        Update: {
          checklist_item_id?: string
          context_key?: string
          created_at?: string
          descricao?: string
          empresa_id?: string
          equipment_record_id?: string | null
          equipment_type?: string | null
          id?: string
          imagem_data_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "empresa_checklist_nao_conformidades_checklist_item_id_fkey"
            columns: ["checklist_item_id"]
            isOneToOne: false
            referencedRelation: "checklist_itens_modelo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "empresa_checklist_nao_conformidades_empresa_id_fkey"
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
          criterio_cenario: string | null
          criterio_id: string | null
          criterio_status: string | null
          criterio_texto: string | null
          created_at: string
          empresa_id: string
          exigencia_id: string
          id: string
          observacoes: string | null
          updated_at: string
        }
        Insert: {
          atende?: boolean
          criterio_cenario?: string | null
          criterio_id?: string | null
          criterio_status?: string | null
          criterio_texto?: string | null
          created_at?: string
          empresa_id: string
          exigencia_id: string
          id?: string
          observacoes?: string | null
          updated_at?: string
        }
        Update: {
          atende?: boolean
          criterio_cenario?: string | null
          criterio_id?: string | null
          criterio_status?: string | null
          criterio_texto?: string | null
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
          {
            foreignKeyName: "empresa_exigencias_criterio_id_fkey"
            columns: ["criterio_id"]
            isOneToOne: false
            referencedRelation: "exigencias_criterios"
            referencedColumns: ["id"]
          },
        ]
      }
      empresa_relatorios: {
        Row: {
          checklist_snapshot: Json
          conclusao: string | null
          created_at: string
          dados_adicionais: Json
          data_emissao: string | null
          data_inspecao: string | null
          empresa_id: string
          escopo: string | null
          hora_fim: string | null
          hora_inicio: string | null
          id: string
          inspetor_cargo: string | null
          inspetor_nome: string | null
          numero_relatorio: string | null
          objetivo: string | null
          observacoes_gerais: string | null
          recomendacoes: string | null
          representante_cargo: string | null
          representante_nome: string | null
          status: string
          titulo: string
          updated_at: string
        }
        Insert: {
          checklist_snapshot?: Json
          conclusao?: string | null
          created_at?: string
          dados_adicionais?: Json
          data_emissao?: string | null
          data_inspecao?: string | null
          empresa_id: string
          escopo?: string | null
          hora_fim?: string | null
          hora_inicio?: string | null
          id?: string
          inspetor_cargo?: string | null
          inspetor_nome?: string | null
          numero_relatorio?: string | null
          objetivo?: string | null
          observacoes_gerais?: string | null
          recomendacoes?: string | null
          representante_cargo?: string | null
          representante_nome?: string | null
          status?: string
          titulo?: string
          updated_at?: string
        }
        Update: {
          checklist_snapshot?: Json
          conclusao?: string | null
          created_at?: string
          dados_adicionais?: Json
          data_emissao?: string | null
          data_inspecao?: string | null
          empresa_id?: string
          escopo?: string | null
          hora_fim?: string | null
          hora_inicio?: string | null
          id?: string
          inspetor_cargo?: string | null
          inspetor_nome?: string | null
          numero_relatorio?: string | null
          objetivo?: string | null
          observacoes_gerais?: string | null
          recomendacoes?: string | null
          representante_cargo?: string | null
          representante_nome?: string | null
          status?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "empresa_relatorios_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: true
            referencedRelation: "empresa"
            referencedColumns: ["id"]
          },
        ]
      }
      exigencias_criterios: {
        Row: {
          altura_denominacao: string | null
          altura_max: number | null
          altura_min: number | null
          altura_real_max: number | null
          altura_real_min: number | null
          altura_tipo: string | null
          area_max: number | null
          area_depositos_max: number | null
          area_depositos_min: number | null
          area_maior_pavimento_max: number | null
          area_maior_pavimento_min: number | null
          area_min: number | null
          cenario: string
          created_at: string
          descricao_edificacao: string | null
          divisao: string | null
          exigencia_id: string
          fonte_arquivo: string | null
          fonte_linha: number | null
          graus_risco: string[] | null
          id: string
          observacao: string | null
          ocupantes_max: number | null
          ocupantes_min: number | null
          requer_atrio: boolean | null
          status_aplicabilidade: string
          valor_raw: string
        }
        Insert: {
          altura_denominacao?: string | null
          altura_max?: number | null
          altura_min?: number | null
          altura_real_max?: number | null
          altura_real_min?: number | null
          altura_tipo?: string | null
          area_max?: number | null
          area_depositos_max?: number | null
          area_depositos_min?: number | null
          area_maior_pavimento_max?: number | null
          area_maior_pavimento_min?: number | null
          area_min?: number | null
          cenario?: string
          created_at?: string
          descricao_edificacao?: string | null
          divisao?: string | null
          exigencia_id: string
          fonte_arquivo?: string | null
          fonte_linha?: number | null
          graus_risco?: string[] | null
          id?: string
          observacao?: string | null
          ocupantes_max?: number | null
          ocupantes_min?: number | null
          requer_atrio?: boolean | null
          status_aplicabilidade?: string
          valor_raw?: string
        }
        Update: {
          altura_denominacao?: string | null
          altura_max?: number | null
          altura_min?: number | null
          altura_real_max?: number | null
          altura_real_min?: number | null
          altura_tipo?: string | null
          area_max?: number | null
          area_depositos_max?: number | null
          area_depositos_min?: number | null
          area_maior_pavimento_max?: number | null
          area_maior_pavimento_min?: number | null
          area_min?: number | null
          cenario?: string
          created_at?: string
          descricao_edificacao?: string | null
          divisao?: string | null
          exigencia_id?: string
          fonte_arquivo?: string | null
          fonte_linha?: number | null
          graus_risco?: string[] | null
          id?: string
          observacao?: string | null
          ocupantes_max?: number | null
          ocupantes_min?: number | null
          requer_atrio?: boolean | null
          status_aplicabilidade?: string
          valor_raw?: string
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
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          nome: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
          nome?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          nome?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_equipment_qr_non_conformities: {
        Args: { p_token: string }
        Returns: {
          checklist_item_id: string
          context_key: string
          created_at: string
          descricao: string
          empresa_id: string
          equipment_record_id: string | null
          equipment_type: string | null
          id: string
          imagem_data_url: string | null
          updated_at: string
        }[]
      }
      get_equipment_qr_page: {
        Args: { p_token: string }
        Returns: {
          checklist_snapshot: Json
          empresa_id: string
          empresa_razao_social: string
          equipment_data: Json
          equipment_id: string
          equipment_type: string
          localizacao: string
          numero: string
          qr_code_svg: string | null
          qr_code_url: string | null
          subtitulo: string
          titulo: string
        }[]
      }
      normalize_divisao_codigo: {
        Args: { p_value: string | null }
        Returns: string | null
      }
      save_equipment_qr_checklist: {
        Args: { p_checklist_snapshot: Json; p_token: string }
        Returns: {
          checklist_snapshot: Json
          empresa_id: string
          equipment_id: string
          equipment_type: string
        }[]
      }
      save_equipment_qr_non_conformity: {
        Args: {
          p_checklist_item_id: string
          p_descricao: string
          p_imagem_data_url?: string | null
          p_token: string
        }
        Returns: {
          checklist_item_id: string
          context_key: string
          created_at: string
          descricao: string
          empresa_id: string
          equipment_record_id: string | null
          equipment_type: string | null
          id: string
          imagem_data_url: string | null
          updated_at: string
        }[]
      }
      resolve_exigencias_empresa: {
        Args: {
          p_altura_real_m?: number | null
          p_altura_tipo: string | null
          p_area_m2: number | null
          p_area_depositos_m2?: number | null
          p_area_maior_pavimento_m2?: number | null
          p_divisao: string | null
          p_grau_risco?: string | null
          p_numero_ocupantes?: number | null
          p_possui_atrio?: boolean | null
        }
        Returns: {
          criterio_cenario: string
          criterio_id: string
          criterio_status: string
          criterio_texto: string | null
          exigencia_id: string
        }[]
      }
      sync_empresa_exigencias: {
        Args: { p_empresa_id: string }
        Returns: number
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

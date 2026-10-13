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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      ausencias: {
        Row: {
          colaborador_id: string
          created_at: string
          data_fim: string
          data_inicio: string
          id: string
          notas: string | null
          tipo: Database["public"]["Enums"]["tipo_ausencia"]
          updated_at: string
        }
        Insert: {
          colaborador_id: string
          created_at?: string
          data_fim: string
          data_inicio: string
          id?: string
          notas?: string | null
          tipo?: Database["public"]["Enums"]["tipo_ausencia"]
          updated_at?: string
        }
        Update: {
          colaborador_id?: string
          created_at?: string
          data_fim?: string
          data_inicio?: string
          id?: string
          notas?: string | null
          tipo?: Database["public"]["Enums"]["tipo_ausencia"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ausencias_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          ativo: boolean
          codigo_postal: string | null
          created_at: string
          email: string | null
          id: string
          localidade: string | null
          morada: string | null
          nif: string | null
          nome: string
          notas: string | null
          pessoa_contacto: string | null
          telefone: string | null
          telemovel: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          codigo_postal?: string | null
          created_at?: string
          email?: string | null
          id?: string
          localidade?: string | null
          morada?: string | null
          nif?: string | null
          nome: string
          notas?: string | null
          pessoa_contacto?: string | null
          telefone?: string | null
          telemovel?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          codigo_postal?: string | null
          created_at?: string
          email?: string | null
          id?: string
          localidade?: string | null
          morada?: string | null
          nif?: string | null
          nome?: string
          notas?: string | null
          pessoa_contacto?: string | null
          telefone?: string | null
          telemovel?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      colaboradores: {
        Row: {
          ativo: boolean
          created_at: string
          email: string | null
          equipa_id: string | null
          funcao: string | null
          id: string
          nome: string
          perfil: Database["public"]["Enums"]["perfil_utilizador"]
          telemovel: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          email?: string | null
          equipa_id?: string | null
          funcao?: string | null
          id?: string
          nome: string
          perfil?: Database["public"]["Enums"]["perfil_utilizador"]
          telemovel?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          email?: string | null
          equipa_id?: string | null
          funcao?: string | null
          id?: string
          nome?: string
          perfil?: Database["public"]["Enums"]["perfil_utilizador"]
          telemovel?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "colaboradores_equipa_id_fkey"
            columns: ["equipa_id"]
            isOneToOne: false
            referencedRelation: "equipas"
            referencedColumns: ["id"]
          },
        ]
      }
      colaboradores_custos: {
        Row: {
          colaborador_id: string
          created_at: string
          custo_hora: number
          updated_at: string
        }
        Insert: {
          colaborador_id: string
          created_at?: string
          custo_hora?: number
          updated_at?: string
        }
        Update: {
          colaborador_id?: string
          created_at?: string
          custo_hora?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "colaboradores_custos_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: true
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
        ]
      }
      equipas: {
        Row: {
          ativa: boolean
          chefe_id: string | null
          cor: string
          created_at: string
          id: string
          nome: string
          notas: string | null
          updated_at: string
        }
        Insert: {
          ativa?: boolean
          chefe_id?: string | null
          cor?: string
          created_at?: string
          id?: string
          nome: string
          notas?: string | null
          updated_at?: string
        }
        Update: {
          ativa?: boolean
          chefe_id?: string | null
          cor?: string
          created_at?: string
          id?: string
          nome?: string
          notas?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipas_chefe_id_fkey"
            columns: ["chefe_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
        ]
      }
      locais: {
        Row: {
          area_m2: number | null
          ativo: boolean
          cliente_id: string
          codigo_postal: string | null
          created_at: string
          id: string
          latitude: number | null
          localidade: string | null
          longitude: number | null
          morada: string
          nome: string
          notas: string | null
          updated_at: string
        }
        Insert: {
          area_m2?: number | null
          ativo?: boolean
          cliente_id: string
          codigo_postal?: string | null
          created_at?: string
          id?: string
          latitude?: number | null
          localidade?: string | null
          longitude?: number | null
          morada: string
          nome: string
          notas?: string | null
          updated_at?: string
        }
        Update: {
          area_m2?: number | null
          ativo?: boolean
          cliente_id?: string
          codigo_postal?: string | null
          created_at?: string
          id?: string
          latitude?: number | null
          localidade?: string | null
          longitude?: number | null
          morada?: string
          nome?: string
          notas?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "locais_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
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
      perfil_utilizador: "gerente" | "chefe_equipa" | "colaborador"
      tipo_ausencia: "ferias" | "doenca" | "formacao" | "falta" | "outro"
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
      perfil_utilizador: ["gerente", "chefe_equipa", "colaborador"],
      tipo_ausencia: ["ferias", "doenca", "formacao", "falta", "outro"],
    },
  },
} as const

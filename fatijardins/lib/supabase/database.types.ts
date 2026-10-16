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
      consumiveis: {
        Row: {
          ativo: boolean
          categoria: string | null
          created_at: string
          id: string
          nome: string
          notas: string | null
          stock_minimo: number
          unidade: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          categoria?: string | null
          created_at?: string
          id?: string
          nome: string
          notas?: string | null
          stock_minimo?: number
          unidade?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          categoria?: string | null
          created_at?: string
          id?: string
          nome?: string
          notas?: string | null
          stock_minimo?: number
          unidade?: string
          updated_at?: string
        }
        Relationships: []
      }
      consumiveis_precos: {
        Row: {
          consumivel_id: string
          created_at: string
          preco_unitario: number
          updated_at: string
        }
        Insert: {
          consumivel_id: string
          created_at?: string
          preco_unitario?: number
          updated_at?: string
        }
        Update: {
          consumivel_id?: string
          created_at?: string
          preco_unitario?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "consumiveis_precos_consumivel_id_fkey"
            columns: ["consumivel_id"]
            isOneToOne: true
            referencedRelation: "consumiveis"
            referencedColumns: ["id"]
          },
        ]
      }
      empresa: {
        Row: {
          codigo_postal: string | null
          condicoes_orcamento: string | null
          email: string | null
          iban: string | null
          id: boolean
          localidade: string | null
          morada: string | null
          nif: string | null
          nome: string
          telefone: string | null
          updated_at: string
          validade_orcamento_dias: number
          website: string | null
        }
        Insert: {
          codigo_postal?: string | null
          condicoes_orcamento?: string | null
          email?: string | null
          iban?: string | null
          id?: boolean
          localidade?: string | null
          morada?: string | null
          nif?: string | null
          nome?: string
          telefone?: string | null
          updated_at?: string
          validade_orcamento_dias?: number
          website?: string | null
        }
        Update: {
          codigo_postal?: string | null
          condicoes_orcamento?: string | null
          email?: string | null
          iban?: string | null
          id?: boolean
          localidade?: string | null
          morada?: string | null
          nif?: string | null
          nome?: string
          telefone?: string | null
          updated_at?: string
          validade_orcamento_dias?: number
          website?: string | null
        }
        Relationships: []
      }
      equipamentos: {
        Row: {
          colaborador_id: string | null
          created_at: string
          data_aquisicao: string | null
          equipa_id: string | null
          estado: Database["public"]["Enums"]["estado_equipamento"]
          id: string
          ipo_ate: string | null
          marca: string | null
          matricula: string | null
          modelo: string | null
          nome: string
          notas: string | null
          numero_serie: string | null
          proxima_revisao: string | null
          seguro_ate: string | null
          tipo: Database["public"]["Enums"]["tipo_equipamento"]
          updated_at: string
        }
        Insert: {
          colaborador_id?: string | null
          created_at?: string
          data_aquisicao?: string | null
          equipa_id?: string | null
          estado?: Database["public"]["Enums"]["estado_equipamento"]
          id?: string
          ipo_ate?: string | null
          marca?: string | null
          matricula?: string | null
          modelo?: string | null
          nome: string
          notas?: string | null
          numero_serie?: string | null
          proxima_revisao?: string | null
          seguro_ate?: string | null
          tipo?: Database["public"]["Enums"]["tipo_equipamento"]
          updated_at?: string
        }
        Update: {
          colaborador_id?: string | null
          created_at?: string
          data_aquisicao?: string | null
          equipa_id?: string | null
          estado?: Database["public"]["Enums"]["estado_equipamento"]
          id?: string
          ipo_ate?: string | null
          marca?: string | null
          matricula?: string | null
          modelo?: string | null
          nome?: string
          notas?: string | null
          numero_serie?: string | null
          proxima_revisao?: string | null
          seguro_ate?: string | null
          tipo?: Database["public"]["Enums"]["tipo_equipamento"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipamentos_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipamentos_equipa_id_fkey"
            columns: ["equipa_id"]
            isOneToOne: false
            referencedRelation: "equipas"
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
      fotos: {
        Row: {
          altura: number | null
          caminho: string
          colaborador_id: string | null
          created_at: string
          id: string
          largura: number | null
          legenda: string | null
          momento: Database["public"]["Enums"]["momento_foto"]
          tamanho_bytes: number | null
          trabalho_id: string | null
          visita_id: string | null
        }
        Insert: {
          altura?: number | null
          caminho: string
          colaborador_id?: string | null
          created_at?: string
          id?: string
          largura?: number | null
          legenda?: string | null
          momento?: Database["public"]["Enums"]["momento_foto"]
          tamanho_bytes?: number | null
          trabalho_id?: string | null
          visita_id?: string | null
        }
        Update: {
          altura?: number | null
          caminho?: string
          colaborador_id?: string | null
          created_at?: string
          id?: string
          largura?: number | null
          legenda?: string | null
          momento?: Database["public"]["Enums"]["momento_foto"]
          tamanho_bytes?: number | null
          trabalho_id?: string | null
          visita_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fotos_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fotos_trabalho_id_fkey"
            columns: ["trabalho_id"]
            isOneToOne: false
            referencedRelation: "trabalhos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fotos_visita_id_fkey"
            columns: ["visita_id"]
            isOneToOne: false
            referencedRelation: "visitas"
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
      manutencoes_equipamento: {
        Row: {
          colaborador_id: string | null
          contador: number | null
          created_at: string
          custo: number | null
          data: string
          descricao: string | null
          equipamento_id: string
          id: string
          tipo: Database["public"]["Enums"]["tipo_manutencao"]
          updated_at: string
        }
        Insert: {
          colaborador_id?: string | null
          contador?: number | null
          created_at?: string
          custo?: number | null
          data?: string
          descricao?: string | null
          equipamento_id: string
          id?: string
          tipo?: Database["public"]["Enums"]["tipo_manutencao"]
          updated_at?: string
        }
        Update: {
          colaborador_id?: string | null
          contador?: number | null
          created_at?: string
          custo?: number | null
          data?: string
          descricao?: string | null
          equipamento_id?: string
          id?: string
          tipo?: Database["public"]["Enums"]["tipo_manutencao"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "manutencoes_equipamento_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manutencoes_equipamento_equipamento_id_fkey"
            columns: ["equipamento_id"]
            isOneToOne: false
            referencedRelation: "equipamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      movimentos_stock: {
        Row: {
          colaborador_id: string | null
          consumivel_id: string
          created_at: string
          data: string
          id: string
          notas: string | null
          preco_unitario: number | null
          quantidade: number
          registo_material_id: string | null
          tipo: Database["public"]["Enums"]["tipo_movimento_stock"]
          trabalho_id: string | null
          updated_at: string
        }
        Insert: {
          colaborador_id?: string | null
          consumivel_id: string
          created_at?: string
          data?: string
          id?: string
          notas?: string | null
          preco_unitario?: number | null
          quantidade: number
          registo_material_id?: string | null
          tipo: Database["public"]["Enums"]["tipo_movimento_stock"]
          trabalho_id?: string | null
          updated_at?: string
        }
        Update: {
          colaborador_id?: string | null
          consumivel_id?: string
          created_at?: string
          data?: string
          id?: string
          notas?: string | null
          preco_unitario?: number | null
          quantidade?: number
          registo_material_id?: string | null
          tipo?: Database["public"]["Enums"]["tipo_movimento_stock"]
          trabalho_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "movimentos_stock_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentos_stock_consumivel_id_fkey"
            columns: ["consumivel_id"]
            isOneToOne: false
            referencedRelation: "consumiveis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentos_stock_registo_material_fkey"
            columns: ["registo_material_id"]
            isOneToOne: true
            referencedRelation: "registo_materiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentos_stock_trabalho_id_fkey"
            columns: ["trabalho_id"]
            isOneToOne: false
            referencedRelation: "trabalhos"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamento_linhas: {
        Row: {
          created_at: string
          descricao: string
          id: string
          orcamento_id: string
          ordem: number
          preco_unitario: number
          quantidade: number
          taxa_iva: number
          tipo: Database["public"]["Enums"]["tipo_linha_orcamento"]
          total: number | null
          unidade: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          descricao: string
          id?: string
          orcamento_id: string
          ordem?: number
          preco_unitario: number
          quantidade: number
          taxa_iva?: number
          tipo?: Database["public"]["Enums"]["tipo_linha_orcamento"]
          total?: never
          unidade?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          descricao?: string
          id?: string
          orcamento_id?: string
          ordem?: number
          preco_unitario?: number
          quantidade?: number
          taxa_iva?: number
          tipo?: Database["public"]["Enums"]["tipo_linha_orcamento"]
          total?: never
          unidade?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orcamento_linhas_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamentos: {
        Row: {
          ano: number
          cliente_id: string
          condicoes: string | null
          created_at: string
          criado_por: string | null
          data: string
          descricao: string | null
          enviado_em: string | null
          estado: Database["public"]["Enums"]["estado_orcamento"]
          id: string
          local_id: string
          notas_internas: string | null
          numero: number
          respondido_em: string | null
          subtotal: number
          titulo: string
          total: number
          total_iva: number
          trabalho_id: string | null
          updated_at: string
          validade: string
          visita_id: string | null
        }
        Insert: {
          ano: number
          cliente_id: string
          condicoes?: string | null
          created_at?: string
          criado_por?: string | null
          data?: string
          descricao?: string | null
          enviado_em?: string | null
          estado?: Database["public"]["Enums"]["estado_orcamento"]
          id?: string
          local_id: string
          notas_internas?: string | null
          numero: number
          respondido_em?: string | null
          subtotal?: number
          titulo: string
          total?: number
          total_iva?: number
          trabalho_id?: string | null
          updated_at?: string
          validade: string
          visita_id?: string | null
        }
        Update: {
          ano?: number
          cliente_id?: string
          condicoes?: string | null
          created_at?: string
          criado_por?: string | null
          data?: string
          descricao?: string | null
          enviado_em?: string | null
          estado?: Database["public"]["Enums"]["estado_orcamento"]
          id?: string
          local_id?: string
          notas_internas?: string | null
          numero?: number
          respondido_em?: string | null
          subtotal?: number
          titulo?: string
          total?: number
          total_iva?: number
          trabalho_id?: string | null
          updated_at?: string
          validade?: string
          visita_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orcamentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamentos_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamentos_local_id_fkey"
            columns: ["local_id"]
            isOneToOne: false
            referencedRelation: "locais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamentos_trabalho_id_fkey"
            columns: ["trabalho_id"]
            isOneToOne: true
            referencedRelation: "trabalhos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamentos_visita_id_fkey"
            columns: ["visita_id"]
            isOneToOne: false
            referencedRelation: "visitas"
            referencedColumns: ["id"]
          },
        ]
      }
      registo_materiais: {
        Row: {
          consumivel_id: string | null
          created_at: string
          descricao: string
          id: string
          quantidade: number
          registo_id: string
          unidade: string
          updated_at: string
        }
        Insert: {
          consumivel_id?: string | null
          created_at?: string
          descricao: string
          id?: string
          quantidade: number
          registo_id: string
          unidade?: string
          updated_at?: string
        }
        Update: {
          consumivel_id?: string | null
          created_at?: string
          descricao?: string
          id?: string
          quantidade?: number
          registo_id?: string
          unidade?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "registo_materiais_consumivel_id_fkey"
            columns: ["consumivel_id"]
            isOneToOne: false
            referencedRelation: "consumiveis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registo_materiais_registo_id_fkey"
            columns: ["registo_id"]
            isOneToOne: false
            referencedRelation: "registos_trabalho"
            referencedColumns: ["id"]
          },
        ]
      }
      registos_horas: {
        Row: {
          a_rever: boolean
          colaborador_id: string
          created_at: string
          entrada: string
          entrada_latitude: number | null
          entrada_longitude: number | null
          id: string
          notas: string | null
          origem: Database["public"]["Enums"]["origem_registo_horas"]
          saida: string | null
          saida_latitude: number | null
          saida_longitude: number | null
          trabalho_id: string | null
          updated_at: string
        }
        Insert: {
          a_rever?: boolean
          colaborador_id: string
          created_at?: string
          entrada: string
          entrada_latitude?: number | null
          entrada_longitude?: number | null
          id?: string
          notas?: string | null
          origem?: Database["public"]["Enums"]["origem_registo_horas"]
          saida?: string | null
          saida_latitude?: number | null
          saida_longitude?: number | null
          trabalho_id?: string | null
          updated_at?: string
        }
        Update: {
          a_rever?: boolean
          colaborador_id?: string
          created_at?: string
          entrada?: string
          entrada_latitude?: number | null
          entrada_longitude?: number | null
          id?: string
          notas?: string | null
          origem?: Database["public"]["Enums"]["origem_registo_horas"]
          saida?: string | null
          saida_latitude?: number | null
          saida_longitude?: number | null
          trabalho_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "registos_horas_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registos_horas_trabalho_id_fkey"
            columns: ["trabalho_id"]
            isOneToOne: false
            referencedRelation: "trabalhos"
            referencedColumns: ["id"]
          },
        ]
      }
      registos_trabalho: {
        Row: {
          assinado_em: string | null
          assinatura_caminho: string | null
          assinatura_nome: string | null
          colaborador_id: string | null
          created_at: string
          id: string
          notas: string | null
          tarefas_feitas: string | null
          trabalho_id: string
          updated_at: string
        }
        Insert: {
          assinado_em?: string | null
          assinatura_caminho?: string | null
          assinatura_nome?: string | null
          colaborador_id?: string | null
          created_at?: string
          id?: string
          notas?: string | null
          tarefas_feitas?: string | null
          trabalho_id: string
          updated_at?: string
        }
        Update: {
          assinado_em?: string | null
          assinatura_caminho?: string | null
          assinatura_nome?: string | null
          colaborador_id?: string | null
          created_at?: string
          id?: string
          notas?: string | null
          tarefas_feitas?: string | null
          trabalho_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "registos_trabalho_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registos_trabalho_trabalho_id_fkey"
            columns: ["trabalho_id"]
            isOneToOne: true
            referencedRelation: "trabalhos"
            referencedColumns: ["id"]
          },
        ]
      }
      trabalhos: {
        Row: {
          cliente_id: string
          created_at: string
          criado_por: string | null
          data: string
          descricao: string | null
          duracao_prevista_min: number | null
          equipa_id: string | null
          estado: Database["public"]["Enums"]["estado_trabalho"]
          hora_inicio: string | null
          id: string
          local_id: string
          orcamento_id: string | null
          ordem: number
          origem: Database["public"]["Enums"]["origem_trabalho"]
          serie_id: string | null
          tipo: Database["public"]["Enums"]["tipo_trabalho"]
          titulo: string
          updated_at: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          criado_por?: string | null
          data: string
          descricao?: string | null
          duracao_prevista_min?: number | null
          equipa_id?: string | null
          estado?: Database["public"]["Enums"]["estado_trabalho"]
          hora_inicio?: string | null
          id?: string
          local_id: string
          orcamento_id?: string | null
          ordem?: number
          origem?: Database["public"]["Enums"]["origem_trabalho"]
          serie_id?: string | null
          tipo?: Database["public"]["Enums"]["tipo_trabalho"]
          titulo: string
          updated_at?: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          criado_por?: string | null
          data?: string
          descricao?: string | null
          duracao_prevista_min?: number | null
          equipa_id?: string | null
          estado?: Database["public"]["Enums"]["estado_trabalho"]
          hora_inicio?: string | null
          id?: string
          local_id?: string
          orcamento_id?: string | null
          ordem?: number
          origem?: Database["public"]["Enums"]["origem_trabalho"]
          serie_id?: string | null
          tipo?: Database["public"]["Enums"]["tipo_trabalho"]
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trabalhos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trabalhos_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trabalhos_equipa_id_fkey"
            columns: ["equipa_id"]
            isOneToOne: false
            referencedRelation: "equipas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trabalhos_local_id_fkey"
            columns: ["local_id"]
            isOneToOne: false
            referencedRelation: "locais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trabalhos_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      visitas: {
        Row: {
          area_m2: number | null
          cliente_id: string
          created_at: string
          criado_por: string | null
          data: string
          hora: string | null
          id: string
          local_id: string
          medidas: string | null
          notas: string | null
          responsavel_id: string | null
          updated_at: string
        }
        Insert: {
          area_m2?: number | null
          cliente_id: string
          created_at?: string
          criado_por?: string | null
          data: string
          hora?: string | null
          id?: string
          local_id: string
          medidas?: string | null
          notas?: string | null
          responsavel_id?: string | null
          updated_at?: string
        }
        Update: {
          area_m2?: number | null
          cliente_id?: string
          created_at?: string
          criado_por?: string | null
          data?: string
          hora?: string | null
          id?: string
          local_id?: string
          medidas?: string | null
          notas?: string | null
          responsavel_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "visitas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitas_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitas_local_id_fkey"
            columns: ["local_id"]
            isOneToOne: false
            referencedRelation: "locais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitas_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      converter_orcamento: {
        Args: {
          p_data: string
          p_equipa_id?: string
          p_hora?: string
          p_orcamento_id: string
          p_ordem?: number
          p_tipo?: Database["public"]["Enums"]["tipo_trabalho"]
        }
        Returns: string
      }
      detalhes_trabalhos_das_horas: {
        Args: { p_fim: string; p_inicio: string }
        Returns: {
          cliente: string
          data: string
          local: string
          titulo: string
          trabalho_id: string
        }[]
      }
      picar_entrada: {
        Args: {
          p_latitude?: number
          p_longitude?: number
          p_trabalho_id?: string
        }
        Returns: {
          a_rever: boolean
          colaborador_id: string
          created_at: string
          entrada: string
          entrada_latitude: number | null
          entrada_longitude: number | null
          id: string
          notas: string | null
          origem: Database["public"]["Enums"]["origem_registo_horas"]
          saida: string | null
          saida_latitude: number | null
          saida_longitude: number | null
          trabalho_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "registos_horas"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      picar_saida: {
        Args: { p_latitude?: number; p_longitude?: number }
        Returns: {
          a_rever: boolean
          colaborador_id: string
          created_at: string
          entrada: string
          entrada_latitude: number | null
          entrada_longitude: number | null
          id: string
          notas: string | null
          origem: Database["public"]["Enums"]["origem_registo_horas"]
          saida: string | null
          saida_latitude: number | null
          saida_longitude: number | null
          trabalho_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "registos_horas"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      stock_consumiveis: {
        Args: Record<PropertyKey, never>
        Returns: {
          consumivel_id: string
          stock: number
        }[]
      }
    }
    Enums: {
      estado_equipamento:
        "operacional" | "avariado" | "em_reparacao" | "abatido"
      estado_orcamento: "rascunho" | "enviado" | "aceite" | "recusado"
      estado_trabalho: "agendado" | "em_curso" | "concluido" | "cancelado"
      momento_foto: "antes" | "depois" | "outra"
      origem_registo_horas: "picagem" | "manual"
      origem_trabalho: "avulso" | "contrato" | "orcamento"
      perfil_utilizador: "gerente" | "chefe_equipa" | "colaborador"
      tipo_ausencia: "ferias" | "doenca" | "formacao" | "falta" | "outro"
      tipo_equipamento: "viatura" | "maquina" | "ferramenta" | "outro"
      tipo_linha_orcamento:
        "mao_de_obra" | "material" | "equipamento" | "outros"
      tipo_manutencao: "revisao" | "reparacao" | "ipo" | "seguro" | "outra"
      tipo_movimento_stock: "entrada" | "saida" | "ajuste"
      tipo_trabalho: "manutencao" | "obra"
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
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
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
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
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
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
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
      estado_equipamento: [
        "operacional",
        "avariado",
        "em_reparacao",
        "abatido",
      ],
      estado_orcamento: ["rascunho", "enviado", "aceite", "recusado"],
      estado_trabalho: ["agendado", "em_curso", "concluido", "cancelado"],
      momento_foto: ["antes", "depois", "outra"],
      origem_registo_horas: ["picagem", "manual"],
      origem_trabalho: ["avulso", "contrato", "orcamento"],
      perfil_utilizador: ["gerente", "chefe_equipa", "colaborador"],
      tipo_ausencia: ["ferias", "doenca", "formacao", "falta", "outro"],
      tipo_equipamento: ["viatura", "maquina", "ferramenta", "outro"],
      tipo_linha_orcamento: [
        "mao_de_obra",
        "material",
        "equipamento",
        "outros",
      ],
      tipo_manutencao: ["revisao", "reparacao", "ipo", "seguro", "outra"],
      tipo_movimento_stock: ["entrada", "saida", "ajuste"],
      tipo_trabalho: ["manutencao", "obra"],
    },
  },
} as const

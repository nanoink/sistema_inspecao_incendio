# Backlog de implementacao: rastreabilidade por ciclo de relatorio

## Etapa 1: Fundacao do ciclo de relatorio
Status: concluida

- Criar uma entidade de ciclo de relatorio por empresa.
- Garantir somente um ciclo ativo por empresa.
- Vincular `empresa_checklist_execucoes` ao ciclo ativo.
- Ajustar `register_checklist_execution` para registrar por ciclo, sem quebrar o frontend atual.
- Ajustar `get_empresa_relatorio_assinaturas` para consolidar somente o ciclo ativo.
- Fazer backfill dos registros ja existentes para um ciclo ativo padrao.

## Etapa 2: QR Code transacional
Status: concluida

- Mover o registro de autoria do QR para dentro da RPC de salvamento do equipamento.
- Salvar snapshot do equipamento e execucao do checklist na mesma transacao.
- Corrigir a RPC `register_checklist_execution` para eliminar conflito ambiguo em `context_key`.

Observacao:
- Ainda falta incluir o `relatorio_ciclo_id` nas nao conformidades do QR; isso ficou como proximo desdobramento da etapa 3/4 porque nao bloqueia mais a autoria transacional do checklist.

## Etapa 3: Checklist principal sem sobrescrita global
Status: concluida

- Parar de usar `delete + insert` global nas respostas do checklist principal.
- Migrar para `upsert` por item e por ciclo de relatorio.
- Persistir autoria por item e por executor no mesmo fluxo.

Progresso atual:
- `empresa_checklist_respostas` passou a ser vinculada ao `relatorio_ciclo_id`.
- O save do checklist principal agora limpa apenas itens obsoletos do ciclo ativo e faz `upsert` por item.
- A sincronizacao do checklist principal com snapshots de equipamentos voltou para modo `preserve`, evitando sobrescrever respostas ja feitas no QR.

## Etapa 4: Consolidacao do relatorio
Status: concluida

- Separar autoria dos executores da assinatura do responsavel tecnico.
- Consolidar multiplos executores no relatorio tecnico e operacional.
- Remover bloqueios falsos de "sem autoria registrada".

Progresso atual:
- O relatorio passou a preferir o snapshot vivo do checklist do ciclo ativo, sem depender do snapshot persistido no `empresa_relatorios`.
- A autoria consolidada agora e reconstruida a partir das execucoes registradas e, como fallback, dos carimbos de auditoria dos itens do checklist principal e dos equipamentos.
- A finalizacao do relatorio tecnico revalida a rastreabilidade do ciclo ativo antes de bloquear a emissao, eliminando falsos negativos por estado antigo da tela.
- O `empresa_relatorios.dados_adicionais` passou a registrar `report_cycle_id` para preparar a amarracao historica da etapa 5.

## Etapa 5: Historico e emissao
Status: concluida

- Permitir fechar um ciclo e abrir um novo sem sobrescrever o anterior.
- Amarrar `empresa_relatorios` ao ciclo correto.
- Preparar emissao tecnica e operacional por ciclo.

Progresso atual:
- `empresa_relatorios` passou a ser vinculado obrigatoriamente a `relatorio_ciclo_id`.
- O salvamento do relatorio, da ART e do checklist principal agora grava no ciclo correto, com fallback apenas para ambientes legados sem a coluna.
- Foi criada a resolucao de ciclo editavel para impedir escrita acidental em ciclo ja finalizado.
- A acao de iniciar novo ciclo fecha o ciclo ativo, cria um novo ciclo e abre um novo `empresa_relatorios` sem sobrescrever o historico anterior.
- As RPCs de QR e de nao conformidades passaram a apontar para o ciclo editavel/ativo correto durante leitura e escrita.

## Etapa 6: Reparacao dos dados antigos
Status: pendente

- Reconciliar execucoes antigas usando `preenchido_por_*`, snapshots e registros existentes.
- Marcar somente casos realmente irrecuperaveis como sem autoria.

## Etapa 7: QA ponta a ponta
Status: pendente

- Testar fluxo executor QR -> gestor -> responsavel tecnico.
- Testar troca de usuario sem perda de contexto da empresa.
- Testar relatorio tecnico e operacional com multiplos executores.
- Testar abertura de novo ciclo sem apagar historico.

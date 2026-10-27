# Revisão de campanhas e persistência de anexos — 27/10/2026

## Diagnóstico confirmado em produção

A campanha com 2.412 destinatários tinha 824 resultados `sent`, 1.488 `failed`
e 100 `processing` antigos, em dois lotes de 50. Assim, 2.312/2.412, arredondado
para 96%, era o percentual **processado**, não de entrega.

Das falhas, 1.425 eram `SMTP senha ... 535`, 57 eram rejeições de destinatário
450, três eram 556, uma era 554 e duas eram timeout. Um teste posterior de TLS e
autenticação SMTP teve sucesso, sem enviar mensagens. Isso não confirma entrega
dos envios anteriores nem determina a razão interna das recusas da UOL.

Os logs da função confirmam dois encerramentos `WallClockTime` em
21/10/2026 às 01:12:30 e 03:37:30 UTC, correspondentes aos lotes antigos.
O cron continuava ativo; sem linhas `queued`, as chamadas seguintes não
processavam nada. Os resultados só eram gravados ao terminar o lote inteiro.

No relatório, `upsertCompanyReportForCycle` construía `{report_cycle_id}` mesmo
quando o chamador salvava apenas o checklist. O upsert substituía o JSON completo
`dados_adicionais`, removendo `report_attachments` e a referência da ART. A prévia
local podia continuar visível até a página ser remontada. A inspeção de metadados
do Storage confirmou objetos sem referência em relatórios. Nenhum objeto foi
apagado ou automaticamente revinculado nesta revisão: não há como distinguir
todos os uploads abandonados de documentos intencionalmente removidos, nem
recuperar os títulos originais apenas pelo nome armazenado.

## Correções

- Mesclar os dados adicionais já persistidos e aplicar somente o patch recebido.
- Comparar `updated_at` e repetir a leitura em conflito para preservar alterações
  de outra sessão; inserção concorrente também repete a leitura.
- Adicionar/remover anexos pelo identificador, sem reenviar arrays desatualizados
  ao salvar textos, ART ou checklist. Remoção continua sendo uma ação explícita.
- Trigger de proteção no banco também preserva chaves omitidas por clientes antigos.
- Manter o objeto no Storage quando uma chamada de metadados falha: uma resposta
  perdida após commit não pode resultar na exclusão de um arquivo já vinculado.
- Registrar o resultado de cada destinatário antes de enviar o próximo.
- Pausar/bloquear em rejeição de autenticação, sem consumir toda a lista com 535.
- Orçamento de tempo do lote e limites da conexão SMTP; devolver à fila somente
  destinatários nunca submetidos nesta execução, preservando o intervalo.
- Nova situação `uncertain` para interrupções ambíguas. Reservas com mais de 15
  minutos são isoladas, não reenviadas. Campanha com esses registros fica bloqueada
  e não pode ser retomada automaticamente pelo administrador.
- Área “Ver resultados” exclusiva do módulo administrativo, com destinatário,
  status, erro, horário e identificadores; filtros e paginação de 25 registros.

Os 100 registros antigos são isolados como `uncertain` pela migration. Isso não
os transforma em enviados nem falhas definitivas. A liberação exige conferência
com os registros do provedor; esta revisão não inclui reenvio da campanha.

## Verificação

- Testes de persistência: salvar checklist, metadados parciais, concorrência,
  remoção explícita, isolamento de ciclo, esquema legado e falhas de permissão.
- Navegador com `CompanyReport` real e fronteiras simuladas: upload de imagem e
  PDF, sair, salvar checklist, reabrir, salvar rascunho, recarregar e remover somente
  o arquivo selecionado. Links recriados a partir dos caminhos persistidos.
- Testes do processador: checkpoints individuais, 535, rejeição de destinatário,
  falha depois de DATA, falha na gravação, orçamento e pausa administrativa.
- Testes de transporte SMTP com conexão inteiramente simulada; nenhum envio real.
- Navegador com página administrativa real e fronteiras somente leitura: progresso
  de 96%, retomada bloqueada, resultados por destinatário, filtro e paginação.
- SQL transacional com rollback: proteção do JSON, recuperação sem duplicidade,
  permissões dos RPCs, fila existente e preservação de registros ao finalizar.

Aplicar somente as migrations novas, conciliadas com o histórico remoto em um
workspace temporário. Não usar `db push` irrestrito sobre migrations antigas com
versões divergentes. Publicar `process-email-campaigns` depois das migrations;
manter a autorização interna e `verify_jwt=false` já configurados.

Build de produção e lint aprovados (sete avisos de Fast Refresh já existentes).
A comparação de tipos com o commit anterior encontrou 53 erros anteriores e 48
na versão corrigida, sem novo erro introduzido; o projeto ainda não tem checagem
global de TypeScript limpa. As migrations foram reaprovadas pelos testes SQL
após a aplicação, e o cron retornou HTTP 200 com zero envios processados.

# Envios de e-mail em massa

O módulo separa a criação das campanhas do transporte de e-mail. A interface e o
cron não armazenam a senha da conta UOL no navegador nem nas tabelas públicas.
As credenciais ficam exclusivamente nas secrets da Edge Function.

## Produção — 14/10/2026

- Página administrativa: `https://www.firetetraedro.com.br/admin/emails`.
- Remetente e usuário SMTP: `comercial@firetetraedro.com.br`.
- Migration aplicada: `20260926145756_bulk_email_campaigns.sql`.
- Edge Function `process-email-campaigns` publicada no projeto
  `nvdvcjsiizqzmakbirfs`.
- Secrets SMTP e `PUBLIC_APP_URL=https://www.firetetraedro.com.br` cadastradas
  exclusivamente no Supabase.
- Job `bulk-email-dispatcher` ativo a cada minuto, com respostas HTTP 200
  confirmadas. A quantidade por lote e o intervalo são definidos por campanha.
- TLS e autenticação UOL validados dentro da própria Edge Function, sem envio
  de mensagem.
- Versão Vercel: `dpl_A5NzVtDPiNLNrMuTTCsXcYUfFXpa`, promovida para produção.
- Variável `VITE_PUBLIC_APP_URL` definida no ambiente Production da Vercel.

A migration foi testada em transação com rollback antes e depois da aplicação.
O teste em `supabase/tests/bulk_email_campaigns.sql` cobre fila, contadores,
intervalos, pausa, retomada, bloqueio, descadastro e RLS, sem manter dados de
teste nem enviar e-mails.

O histórico remoto contém migrations com versões diferentes de algumas cópias
locais antigas. Para esta publicação, foi criado um diretório temporário com
`supabase migration fetch --linked --project-ref nvdvcjsiizqzmakbirfs`; somente
a nova migration de e-mails foi acrescentada e aplicada. Nenhuma entrada do
histórico remoto foi removida ou marcada como revertida. Antes de futuras
migrations, concilie esse histórico ou repita o mesmo procedimento isolado.

O arquivo `.vercelignore` mantém secrets, arquivos de Supabase e artefatos de
teste fora do envio para a Vercel; `src/integrations/supabase` continua incluído
no build do frontend.

## Componentes

- `/admin/emails`: área exclusiva do super administrador para listas, editor
  HTML/CSS, pré-visualização e acompanhamento das campanhas.
- `process-email-campaigns`: Edge Function que reserva e processa um lote por
  chamada.
- `bulk-email-dispatcher`: job do `pg_cron` executado a cada minuto. A função só
  libera uma campanha quando `next_batch_at` vence, respeitando o tamanho do lote
  e o intervalo configurados pelo administrador.
- `/email/descadastrar/:token`: confirmação pública de descadastro, vinculada à
  lista global de supressões.

## Ativação no Supabase

Com o projeto vinculado à CLI:

```powershell
npx supabase db push --linked
npx supabase functions deploy process-email-campaigns --project-ref nvdvcjsiizqzmakbirfs
```

Depois da migration e da publicação da função, execute uma vez no SQL Editor:

```sql
select public.configure_bulk_email_worker(
  'https://nvdvcjsiizqzmakbirfs.supabase.co'
);
```

Esse comando cria um token interno no Vault e agenda o cron. O token não precisa
ser copiado para o frontend.

## Transporte direto pelo SMTP da UOL

A caixa usada no sistema é `comercial@firetetraedro.com.br`, tanto para
autenticação quanto para remetente. Novas campanhas usam esse endereço como
padrão de resposta.

O E-mail Profissional da UOL informa atualmente os seguintes parâmetros:

- servidor: `smtps.uhserver.com`;
- porta: `465`;
- criptografia: SSL/TLS desde o início da conexão;
- autenticação: endereço completo da caixa e sua senha.

A porta 465 está acessível e não faz parte das portas 25 e 587 bloqueadas pelo
Supabase. O processador possui um cliente SMTP/TLS próprio e não grava a senha no
banco, nos logs ou no frontend.

Quando o acesso ao Supabase estiver normalizado, copie o modelo privado:

```powershell
Copy-Item `
  supabase/functions/process-email-campaigns/.env.example `
  supabase/functions/process-email-campaigns/.env.local
```

Preencha o arquivo `.env.local` e envie as secrets sem expor a senha no histórico
do terminal:

```powershell
npx supabase secrets set `
  --project-ref nvdvcjsiizqzmakbirfs `
  --env-file supabase/functions/process-email-campaigns/.env.local
```

Antes do primeiro lote, faça um envio de teste para uma única conta e confirme
no painel da UOL se o acesso por aplicativo externo está habilitado.

Para habilitar o acesso externo no Painel UOL HOST:

1. Abra `E-mail Profissional` e selecione `Gerenciar E-mails` no domínio.
2. Na caixa usada pelo sistema, abra `Mais opções`.
3. Entre em `Ativar IMAP/POP para gerenciadores de email`.
4. Ative o IMAP e salve. Não é necessário ativar POP.
5. Se a autenticação continuar retornando `535`, altere a senha da própria caixa
   em `Mais opções > Alterar senha`; ela pode ser diferente da senha do titular
   da conta UOL.

Depois de cadastrar as secrets e publicar a função, o botão `Testar SMTP` da
página administrativa valida TLS e autenticação sem enviar nenhum e-mail.

O mesmo teste pode ser executado localmente, sem depender do Supabase, usando a
configuração privada em `supabase/functions/process-email-campaigns/.env.local`:

```powershell
npm run emails:smtp:check
```

Esse comando usa o mesmo cliente SMTP da Edge Function e não envia mensagens.
O campo `PUBLIC_APP_URL` pode permanecer vazio durante o teste de autenticação;
antes de ativar campanhas, preencha-o com a URL pública do **sistema Fire 360**,
onde a rota `/email/descadastrar/:token` estará publicada.

Em 14/10/2026, a conexão TLS e a autenticação dessa caixa foram confirmadas
localmente após a habilitação do acesso externo na UOL. A execução dentro do
Supabase deve ser verificada depois da publicação da função.

## Cópias no UOL — 27/10/2026

O SMTP não grava automaticamente os envios do sistema na caixa postal. A função
agora prepara uma cópia MIME durável antes da submissão SMTP e a arquiva por IMAP
somente depois que a entrega está registrada como `sent`, com o mesmo Message-ID.

- Servidor IMAP: `imap.uhserver.com:993`, TLS. Usuário e senha usam por padrão as
  secrets SMTP já existentes; nunca ficam no frontend.
- A pasta é descoberta pela flag `\\Sent`. Nesta caixa, o servidor retornou
  **Itens Enviados**. Nenhuma pasta paralela é criada.
- `UOL_SAVE_SENT_COPIES` é habilitado por padrão; `false` desliga a preparação de
  cópias para novos envios. Host, porta, credenciais e pasta aceitam sobrescrita
  com `UOL_IMAP_*` e `UOL_SENT_FOLDER`; não é necessário repetir secrets.
- `email_uol_sent_copies` guarda o MIME com RLS e acesso exclusivo de serviço.
  O corpo duplicado é apagado do banco após confirmação da cópia no IMAP.
- O cron existente processa até cinco cópias por chamada, independentemente do
  status da campanha. O envio SMTP e seus contadores nunca são revertidos se
  houver falha de arquivamento. Retentativas fazem primeiro busca de Message-ID
  para não duplicar uma cópia cujo APPEND foi aceito antes de uma interrupção.
- A tela “Ver resultados” informa se a cópia está pendente, salva ou em erro.
- A migration não cria cópias retroativas. Mensagens `failed` e `uncertain`
  nunca são arquivadas como enviadas. Importação do histórico confirmado exige
  solicitação administrativa específica e deve identificar as cópias reconstruídas.

`npm run emails:imap:check` só autentica e identifica a pasta, sem alterar mensagens.
Adicionar `-- --append-test` grava uma única cópia de teste claramente identificada,
verifica o UID e repete a busca para provar idempotência. Não há submissão SMTP.
Na validação inicial, o UOL confirmou a pasta `Itens Enviados` e o UID `19`.

As ações autenticadas `test_imap` e `archive_sent_copies` da Edge Function,
respectivamente, verificam a pasta e processam apenas cópias pendentes. Nenhuma
delas reserva destinatários ou chama o transporte SMTP.

## Transportes alternativos por API HTTPS

O processador já aceita Resend ou uma API HTTPS genérica. Exemplo para Resend:

```powershell
npx supabase secrets set --project-ref nvdvcjsiizqzmakbirfs `
  EMAIL_PROVIDER=resend `
  EMAIL_FROM_ADDRESS=contato@seudominio.com.br `
  PUBLIC_APP_URL=https://seu-site-publico.com.br `
  RESEND_API_KEY=sua_chave
```

Não salve chaves reais em `.env` versionado, commits, migrations ou no corpo das
campanhas.

## Ponte SMTP opcional

Se a conta específica não aceitar a porta 465 ou se a UOL restringir a execução
em ambiente de nuvem, o caminho alternativo é uma pequena ponte SMTP externa com
endpoint HTTPS. A Edge Function suporta esse modelo por
`EMAIL_PROVIDER=generic_http`.

Secrets para a ponte HTTPS:

```powershell
npx supabase secrets set --project-ref nvdvcjsiizqzmakbirfs `
  EMAIL_PROVIDER=generic_http `
  EMAIL_FROM_ADDRESS=contato@seudominio.com.br `
  PUBLIC_APP_URL=https://seu-site-publico.com.br `
  EMAIL_DELIVERY_API_URL=https://sua-ponte-segura.example/enviar `
  EMAIL_DELIVERY_API_TOKEN=token_secreto
```

A ponte recebe um `POST` JSON com `from`, `to`, `reply_to`, `subject`, `html`,
`headers` e `metadata`, e deve responder com `id` ou `message_id`.

## Uso responsável

Use somente destinatários com base legal ou consentimento compatível com a
finalidade da mensagem. O fracionamento reduz picos de envio, mas não substitui
reputação de domínio, SPF, DKIM, DMARC, limites do provedor e tratamento de
bounces e reclamações.

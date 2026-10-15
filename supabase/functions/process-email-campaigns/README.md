# process-email-campaigns

Processa um lote vencido de campanha a cada chamada. O cron do banco chama esta
funcao a cada minuto; a cadencia real e controlada por `batch_size`,
`interval_minutes` e `next_batch_at` em cada campanha.

## Secrets obrigatorios

- `EMAIL_PROVIDER`: `uol_smtp`, `resend` ou `generic_http`
- `EMAIL_FROM_ADDRESS`: remetente validado no provedor
- `PUBLIC_APP_URL`: URL publica da aplicacao para links de descadastro

Para `resend`:

- `RESEND_API_KEY`

Para `uol_smtp`:

- `UOL_SMTP_HOST`: `smtps.uhserver.com`
- `UOL_SMTP_PORT`: `465`
- `UOL_SMTP_USERNAME`: endereco completo da caixa UOL
- `UOL_SMTP_PASSWORD`: senha da caixa UOL

O transporte UOL usa TLS desde o inicio da conexao e autenticacao SMTP `LOGIN`.
As credenciais ficam somente nas secrets da Edge Function.

Copie `.env.example` para `.env.local`, preencha os valores reais e use:

```powershell
npx supabase secrets set `
  --project-ref nvdvcjsiizqzmakbirfs `
  --env-file supabase/functions/process-email-campaigns/.env.local
```

Para `generic_http`:

- `EMAIL_DELIVERY_API_URL`
- `EMAIL_DELIVERY_API_TOKEN`

O modo `generic_http` envia um POST JSON com remetente, destinatario, assunto,
HTML, cabecalhos de descadastro e IDs de rastreio. Ele pode ser conectado a uma
ponte SMTP externa caso o servidor de e-mail escolhido nao ofereca API HTTPS.

## Agendamento

Depois de aplicar a migration e publicar a Edge Function, execute uma vez com
credencial administrativa no SQL Editor:

```sql
select public.configure_bulk_email_worker(
  'https://SEU-PROJETO.supabase.co'
);
```

O comando gera um token interno aleatorio no Vault e cria o job
`bulk-email-dispatcher` no `pg_cron`.

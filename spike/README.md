# Onda 0 — Checklist de Setup Manual (Meta + Supabase)

## ✅ CONCLUÍDA em 2026-08-21 — Achados do spike (IMPORTANTES para as Ondas 1-2)

| Achado | Impacto |
|---|---|
| Meta **exige HTTPS** na Redirect URI (rejeitou `http://localhost`) | Vite dev server precisará de `server.https` com o cert local (`key.pem`/`cert.pem`) |
| App em Dev Mode retorna `data: []` nos comentários (com paginação fantasma) | App foi **publicado (Live)** — obrigatório para ler comentários do público; exigiu URL de política de privacidade |
| Política de privacidade publicada | https://privacidade-black.vercel.app/ (Vercel, conta atoldasrocasai) |
| Autor do comentário vem em **`from{username}`**, não em `username` | Campo correto p/ Edge Function `ig-import-comments`: `fields=id,text,timestamp,from{id,username},like_count,replies{id}` |
| P-08 validada: shortcode do permalink casa com `/me/media` (2 páginas p/ 32 mídias) | Estratégia da `ig-resolve-media` confirmada |
| App ID Meta: `1587425376299084` · IG App ID: `2064474281096441` (em `spike/.env`) | Token long-lived salvo em `spike/token.json`, expira ~2026-10-20 |


> Roteiro dos cliques. ⚠️ Nomes de menus e permissões mudam com frequência no painel do Meta —
> se algo não bater, procure o equivalente mais próximo ou confira a doc oficial
> (developers.facebook.com/docs/instagram-platform).

## Parte A — Conta Instagram (5 min)

- [ ] **A1.** No app do Instagram: **Configurações → Central de contas → Tipo de conta** (ou "Tipo de conta e ferramentas") → converter para **Profissional** → escolher **Business** ou **Creator** (qualquer um serve).

## Parte B — App no Meta for Developers (15 min)

- [ ] **B1.** Acessar [developers.facebook.com](https://developers.facebook.com) logado com sua conta Facebook → **My Apps → Create App**.
- [ ] **B2.** Tipo/caso de uso: **Business** (ou "Other → Business" dependendo do wizard).
- [ ] **B3.** No painel do app: **Add Product → Instagram** → configurar **"Instagram API with Instagram Login"** (⚠️ NÃO é o "Facebook Login for Business").
- [x] **B4.** Redirect URI registrada: `https://localhost:5173/auth/callback`
      (⚠️ o Meta **exige HTTPS** — `http://localhost` foi rejeitado; o spike sobe um servidor
      https local com certificado self-signed, gerado em `key.pem`/`cert.pem`).
- [ ] **B5.** Anotar o **Instagram App ID** e o **Instagram App Secret** (na mesma tela de configuração da API — atenção: é o App ID *do produto Instagram*, não o do app Facebook pai).
- [ ] **B6.** Em **App Roles → Roles → Add People → Instagram Tester**: adicionar o @ da sua conta.
- [ ] **B7.** No Instagram (web): **Configurações → Site e aplicativos → Convites de teste** (ou "Aplicativos e sites → Convites de testador") → **aceitar o convite**.
- [ ] **B8.** Conferir que as permissões `instagram_business_basic` e `instagram_business_manage_comments` aparecem disponíveis no fluxo de login (em Dev Mode com tester não precisa de App Review).

## Parte C — Supabase (5 min) — pode ser feita depois, só é necessária na Onda 1

- [ ] **C1.** Acessar [supabase.com](https://supabase.com) → **New project** (organização pessoal, projeto novo dedicado, ex.: `sorteio-instagram`).
- [ ] **C2.** Anotar: **Project URL**, **anon key**, **service_role key** (Settings → API).

## Parte D — Rodar o spike (5 min)

- [ ] **D1.** Copiar `.env.example` para `.env` e preencher `IG_APP_ID` e `IG_APP_SECRET`.
- [ ] **D2.** Rodar:

```bash
node spike/oauth-spike.mjs
```

- [ ] **D3.** Abrir a URL impressa no terminal, logado na conta tester → autorizar.
- [ ] **D4.** Ver o JSON de comentários impresso no terminal. 🎉
- [ ] **D5.** Validar a P-08 (permalink → media_id) rodando de novo com um link de post seu:

```bash
node spike/oauth-spike.mjs https://www.instagram.com/p/SEU_SHORTCODE/
```

## Gate da Onda 0 (critérios de saída)

| Critério | Como saber |
|---|---|
| Token long-lived obtido | Terminal mostra "LONG-LIVED OBTIDO — expira em ..." e `spike/token.json` existe |
| Mídias listadas | Terminal lista seus posts com contagem de comentários |
| Comentários chegando | JSON com `username`, `text`, `timestamp` impresso |
| P-08 validada | "P-08 VALIDADA: permalink resolvido → media_id ..." |

Se qualquer item falhar, o erro mais comum é o **convite de tester não aceito** (B7) ou o
**produto errado** adicionado ao app (B3). Só avance para a Onda 1 com o gate fechado.

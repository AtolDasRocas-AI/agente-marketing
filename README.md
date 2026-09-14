# Sorteio ATOL

Sistema próprio de sorteios a partir dos comentários do Instagram, com prova
criptográfica do resultado — qualquer participante pode recalcular o vencedor.

| Recurso | Link |
|---|---|
| App | https://app-one-fawn-32.vercel.app |
| Política de privacidade | https://privacidade-black.vercel.app |
| Painel Supabase | https://supabase.com/dashboard/project/uakwbtmbhwifiekwmsbq |
| App Meta | https://developers.facebook.com/apps/1587425376299084 |

Login do app: credenciais em `CREDENCIAIS-LOCAL.txt` (fora do Git).

---

## Como fazer um sorteio

1. **Novo sorteio** → escolha o post na galeria
2. Defina as regras: menções mínimas, palavra/hashtag obrigatória, quantos ganham, suplentes
3. O app importa os comentários em lotes e aplica as regras
4. **Participantes** → confira status e motivos
5. **Publique a semente** (stories, por exemplo) — precisa ser antes de sortear
6. **Sortear** → digite a semente, confirme e congele o snapshot
7. **Modo palco** → roleta animada para a live
8. **Comprovante** → card 1080×1920 para stories + CSV

### Vencedores vs suplentes

- **Vencedores** — todos premiados. `qtd_vencedores = 3` dá 1º, 2º e 3º lugar.
- **Suplentes** — reserva; só assumem se um vencedor for desclassificado.

A ordem de saída do sorteio é a classificação. Tudo vem de uma única passada
do Fisher-Yates semeado, sem repetir participante.

---

## Verificação pública

Qualquer pessoa confere o resultado com o CSV e a semente publicada:

```bash
node verificador/verificar.mjs participantes.csv "SEMENTE-PUBLICADA" 1 3
```

O script é autocontido (sem dependências) e reproduz `hash_lista`, `seed_final`,
vencedores e suplentes. Se bater com o comprovante, o sorteio é legítimo.

**Por que não dá para manipular:** `seed_final = SHA256(semente | hash_lista)`.
O `hash_lista` só existe depois do snapshot congelado, então não é possível
escolher uma semente que favoreça alguém.

---

## Identidade visual

O app segue o **design system da Atol AI** — ver [spec-kits/redesign-atol.handoff.md](spec-kits/redesign-atol.handoff.md).

| Camada | Onde |
|---|---|
| Tokens (cores, raios) + utilitários `ra-*` | `app/src/index.css` |
| Componentes `sx-*` | `app/src/styles/sorteio.css` |
| Ícones SVG inline | `app/src/components/Icone.tsx` |
| Logo da marca | `app/public/assets/rocas-logo.png` |

Fontes: **Manrope** (interface) · **Instrument Serif** (títulos, com a palavra-chave em
itálico teal) · **JetBrains Mono** (números, hashes, sementes). Fundo `--ink #061820`,
acento `--teal #5CC5BE`, apoio `--coral #ED9079`.

⚠️ O canvas do comprovante não lê variáveis CSS — a paleta está espelhada na constante `C`
de `Comprovante.tsx`, e o desenho aguarda `document.fonts.ready` antes do `fillText` (sem
isso o PNG sai com a serif de fallback do sistema).

## Estrutura

```
app/                    PWA React + TS + Vite
  src/lib/sorteio/      motores PUROS (regras, sorteio, motivos)
  src/lib/avatar/       avatares determinísticos e fita da roleta
  src/features/         conta, sorteios, histórico
supabase/
  migrations/           8 migrações (schema, RLS, funções, cron)
  functions/            8 Edge Functions
  functions/_shared/    cópia dos motores para o Deno (gerada)
verificador/            script público de verificação
scripts/                operação e diagnóstico
spec-kits/              especificação e plano
spike/                  spike descartável de OAuth (Onda 0)
```

`app/src/lib/sorteio/**` é a fonte da verdade dos motores. Depois de editar,
rode `node scripts/sincronizar-motores.mjs` — há um teste que falha se as
cópias das Edge Functions divergirem.

---

## Scripts

```bash
# fluxo completo pela linha de comando (alternativa à interface)
node scripts/pipeline-local.mjs [link] --vencedores 3 --palavra "EU QUERO" --nova
node scripts/executar-sorteio.mjs <SORTEIO_ID> "SEMENTE"

# diagnóstico
node scripts/diagnostico-suspeitos.mjs <SORTEIO_ID>   # por que caiu em SUSPEITO
node scripts/verificar-jobs.mjs                       # cron, token, respostas HTTP
node scripts/testar-refresh.mjs                       # prova o refresh automático

# manutenção
node scripts/configurar-cron.mjs                      # segredos + migrações + jobs
node scripts/sincronizar-motores.mjs                  # motores → Edge Functions
```

---

## Automações

| Job | Quando | O que faz |
|---|---|---|
| `renovar-token-instagram` | 03:10 UTC | renova tokens com menos de 7 dias |
| `expurgo-lgpd` | 03:40 UTC | apaga dados pessoais de sorteios com 90+ dias |
| `watchdog-importacao` | a cada 5 min | importação travada volta para a fila |

---

## Limites conhecidos

- Só posts das **contas próprias** conectadas (sem App Review no Meta)
- A API **não expõe** a foto de perfil dos comentaristas → avatares gerados
- A API **não permite** verificar "está seguindo" nem "curtiu o post"
- **Reels e Stories** não são suportados (só posts do feed)
- Retenção de dados pessoais: **90 dias** após a execução

---

## Desenvolvimento

```bash
cd app
npm install
npm run dev      # https://localhost:5173 (cert self-signed em ../spike)
npm test         # 68 testes
npm run build
```

O Meta exige HTTPS na Redirect URI, por isso o dev server usa TLS local.
Antes de qualquer deploy, confirme que nenhum segredo entrou no bundle:

```bash
grep -ri "IG_APP_SECRET\|service_role" app/dist/
```

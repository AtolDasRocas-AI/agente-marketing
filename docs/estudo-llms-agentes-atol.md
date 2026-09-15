# Estudo de LLMs por agente — ATOL Studio

Levantamento feito em 15/09/2026 direto no catálogo do OpenRouter (openrouter.ai/models), e não só da memória do modelo — o catálogo e os preços mudam com frequência, então os números abaixo têm essa data de validade. Antes de fixar qualquer um destes valores como secret de longo prazo, revalide preço e disponibilidade no OpenRouter, principalmente para os agentes 2–4, que ainda não têm código e podem só ser implementados semanas ou meses depois deste estudo.

Cobre os quatro agentes de IA previstos no produto (ver [atol-studio-estrategia-e-backlog.md](atol-studio-estrategia-e-backlog.md) e [agente-analista-instagram-atol.md](agente-analista-instagram-atol.md)): um já implementado e três ainda planejados.

## Como ler as tabelas

Cada agente tem um perfil de tarefa diferente — isso pesa mais que o preço bruto por token:

- **Volume e frequência**: uma chamada por briefing (sob aprovação humana) tolera um modelo um pouco mais caro; uma chamada por comentário importado não.
- **Rigidez do formato**: saída JSON estruturada em campos fixos exige boa aderência a instruções; texto livre tolera mais variação.
- **Custo de errar**: uma hipótese de correlação mal calibrada (alegar causalidade que não existe) é mais cara de corrigir depois do que classificar errado um comentário — por isso vale um modelo mais cuidadoso mesmo custando mais por token, já que roda pouco.

## 1. Agente de conteúdo editorial — implementado (`marketing-gerar-conteudo`)

Gera estratégia, ângulo, legenda, CTA e prompt de imagem a partir de um briefing pronto. Saída sempre em JSON, tom editorial em PT-BR, teto de 1200 tokens de saída por chamada, uso sob demanda (não é alto volume).

| Modelo | Slug OpenRouter | Entrada | Saída | Lançamento | Rank Marketing | Custo estimado/chamada* |
| --- | --- | --- | --- | --- | --- | --- |
| GPT-4o-mini (decidido nesta sessão, ainda não aplicado) | `openai/gpt-4o-mini` | $0,15/M | $0,60/M | jul/2024 | #20 | ~$0,0008 |
| **GPT-5.6 Luna (recomendado)** | `openai/gpt-5.6-luna` | $0,20/M | $1,20/M | jul/2026 | **#2** | ~$0,0015 |
| Gemini 2.5 Flash Lite | `google/gemini-2.5-flash-lite` | $0,10/M | $0,40/M | jul/2025 | #13 | ~$0,0005 |
| Claude Haiku 4.5 | `anthropic/claude-haiku-4.5` | $1,00/M | $5,00/M | out/2025 | #35 | ~$0,0065 |

\* Estimativa com ~500 tokens de entrada (briefing) + 1200 de saída (teto atual do código). Todas as opções ficam muito abaixo do teto de $0,02/execução já decidido — ou seja, **o teto de custo não é o critério de desempate aqui**, é a qualidade e atualidade do modelo.

**Recomendação:** trocar `MARKETING_AI_TEXT_MODEL` de `openai/gpt-4o-mini` para `openai/gpt-5.6-luna`. Custo por chamada quase dobra, mas continua irrisório frente ao teto, e o modelo é ranqueado #2 em Marketing no OpenRouter (contra #20 do gpt-4o-mini) além de ser ~2 anos mais novo. Se custo por token importar mais que qualidade em algum momento, `gemini-2.5-flash-lite` é a alternativa mais barata das quatro. Essa troca é só um valor de variável de ambiente — não muda nenhum código.

## 2. Agente analista de Instagram — classificação de comentários (planejado)

Ainda sem Edge Function própria. Perfil oposto ao agente 1: roda potencialmente uma vez por comentário importado (alto volume), tarefa é etiquetar tema/dúvida/elogio/risco — não gera texto criativo, só classifica.

| Modelo | Slug OpenRouter | Entrada | Saída | Nota |
| --- | --- | --- | --- | --- |
| **Gemini 2.5 Flash Lite (recomendado)** | `google/gemini-2.5-flash-lite` | $0,10/M | $0,40/M | Mais barato do grupo com raciocínio ainda razoável; #13 em Marketing |
| GPT-5.4 Nano | `openai/gpt-5.4-nano` | $0,20/M | $1,25/M | Descrito pelo próprio provedor como feito para "classification, data extraction... at scale" |
| GPT-5 Nano | `openai/gpt-5-nano` | $0,05/M | $0,40/M | O mais barato de todos; raciocínio limitado, mas classificação simples não exige muito |

**Recomendação:** `google/gemini-2.5-flash-lite` como padrão; se o volume real de comentários for muito alto e a régua de qualidade puder cair um pouco mais, `openai/gpt-5-nano` é ainda mais barato. Continua valendo a regra do handoff: chamadas de IA ficam desligadas até chave, modelo e orçamento serem configurados explicitamente — isso não muda com a escolha do modelo.

## 3. Agente analista de Instagram — correlação e hipóteses semanais (planejado)

A etapa mais delicada do agente analista: relacionar picos/quedas de métricas com notas de contexto e propor hipóteses **sem afirmar causalidade** (regra explícita do [agente-analista-instagram-atol.md](agente-analista-instagram-atol.md)). Roda no máximo semanalmente — baixíssimo volume, então o custo por chamada importa pouco; a qualidade do raciocínio e o cuidado ao não sobre-interpretar correlação importam muito.

| Modelo | Slug OpenRouter | Entrada | Saída | Nota |
| --- | --- | --- | --- | --- |
| **Claude Haiku 4.5 (recomendado)** | `anthropic/claude-haiku-4.5` | $1,00/M | $5,00/M | "Extended thinking" nativo; provedor afirma paridade com Sonnet 4 em raciocínio |
| GPT-5.6 Luna Pro | `openai/gpt-5.6-luna-pro` | $0,20/M | $1,20/M | Mesmo preço da Luna comum, com modo de raciocínio "pro" — opção se preferir manter tudo num único provedor |
| Claude Sonnet 5 | `anthropic/claude-sonnet-5` | $2,00/M | $10,00/M | Frontier; considerar só se o Haiku 4.5 se mostrar raso demais nas correlações |

**Recomendação:** `anthropic/claude-haiku-4.5`. Com uma chamada semanal, mesmo o preço por token mais alto que os demais agentes representa centavos por mês — o critério aqui é qualidade de raciocínio, não custo. `openai/gpt-5.6-luna-pro` é a opção caso a equipe prefira manter um único provedor com o agente 1.

## 4. Agente de geração de imagem — Sprint 5, mais distante (planejado)

Gera a imagem a partir do `PROMPT_IMAGEM` já aprovado por humano (não é o mesmo passo que gera o texto do prompt — esse já está coberto pelo agente 1). Nenhum código existe ainda; esta seção é direcional.

| Modelo | Entrada | Saída | Nota |
| --- | --- | --- | --- |
| **Nano Banana 2 Lite / Gemini 3.1 Flash Lite Image (recomendado p/ começar)** | $0,25/M | $30/M | Mais rápido e barato da família; bom para prototipar em escala |
| Nano Banana 2 / Gemini 3.1 Flash Image | $0,50/M | $60/M | Qualidade "Pro" a velocidade Flash — se a qualidade do Lite não bastar |
| GPT Image 1 Mini | $2,50/M | $8,00/M | Alternativa OpenAI mais barata da linha GPT Image |

**Atenção:** preço por token de modelos de imagem não é diretamente comparável ao de texto (tokens por imagem variam por modelo/resolução). Antes de fixar `MARKETING_AI_IMAGE_MODEL` e o teto de custo por execução, gerar algumas imagens de teste com prompts reais do produto e medir o custo efetivo por imagem de cada opção — não só extrapolar do $/M tokens.

## Resumo

| Agente | Estado | Modelo recomendado | Alternativa mais barata |
| --- | --- | --- | --- |
| 1. Conteúdo editorial | Implementado | `openai/gpt-5.6-luna` | `google/gemini-2.5-flash-lite` |
| 2. Classificação de comentários | Planejado | `google/gemini-2.5-flash-lite` | `openai/gpt-5-nano` |
| 3. Correlação e hipóteses semanais | Planejado | `anthropic/claude-haiku-4.5` | `openai/gpt-5.6-luna-pro` |
| 4. Geração de imagem | Planejado (Sprint 5) | Nano Banana 2 Lite | — (validar custo real por imagem antes) |

Nenhuma dessas trocas foi aplicada — são recomendações para revisão de quem decide o orçamento de IA, não uma mudança de configuração já feita.

# Agente analista de Instagram — ATOL

## Objetivo

Construir uma leitura contínua e auditável do desempenho da presença da ATOL no Instagram, conectando métricas de conteúdo a fatos reais de marca. O agente é analítico: não publica, não responde comentários e não toma decisões fora da revisão humana.

## Fontes a observar

- Publicações, Reels e carrosséis próprios: formato, data, texto, interações e métricas disponíveis pela API.
- Comentários próprios: volume, temas recorrentes, dúvidas, elogios e sinais de risco, sempre sem responder automaticamente.
- Marcações e menções: quando a permissão e a modalidade de conta disponibilizarem esses objetos à API.
- Stories: somente enquanto disponíveis pela API e pela janela de retenção da plataforma.
- Notas de contexto inseridas pela equipe: campanha, evento, lançamento, imprensa, mudança de produto ou evento externo.

## Nota de contexto

Cada nota registra data, categoria, título, descrição e fonte opcional. Exemplos: lançamento de funcionalidade, participação em evento, matéria na imprensa, mudança de oferta ou indisponibilidade de serviço. Essas notas permitem explicar alterações de alcance ou interação sem atribuir causalidade automática.

## Leitura semanal esperada

1. Comparar formatos e temas com maior interação observada.
2. Relacionar picos e quedas às notas de contexto próximas no tempo.
3. Destacar dúvidas ou objeções recorrentes em comentários.
4. Propor hipóteses para o próximo briefing, nunca conclusões definitivas.
5. Exigir revisão humana antes de qualquer uso editorial ou publicação.

## Proteções

- Dados de Instagram são importados somente após autorização explícita da conta ATOL.
- Chaves e tokens permanecem no servidor.
- Chamadas de IA ficam desligadas até a configuração explícita de chave, modelo e orçamento.
- Comentários, marcações e Stories dependem de permissões, acesso e limites da API em vigor no momento da ativação.

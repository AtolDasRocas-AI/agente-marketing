---
name: nestjs
description: Use ao escrever, revisar ou refatorar codigo NestJS (controllers, services, modules, guards, interceptors, pipes, DTOs, TypeORM/Prisma). Acione sempre que o usuario mencionar NestJS, ou trabalhar em arquivos .controller.ts/.service.ts/.module.ts num backend Nest.
---

# NestJS Backend Skill

Este guia orienta a criaÃ§Ã£o de cÃ³digo NestJS de qualidade de produÃ§Ã£o com Ãªnfase em qualidade arquitetural, resiliÃªncia, performance e manutenibilidade.
**Leia este arquivo antes de escrever qualquer mÃ³dulo, service, controller, job ou cÃ³digo de infraestrutura NestJS.**

---

## Architecture Thinking (Antes de Codar)

Antes de escrever qualquer cÃ³digo backend, considere:

1. **DomÃ­nio:** Qual domÃ­nio de negÃ³cio pertence a este mÃ³dulo? Quais sÃ£o os invariantes?
2. **Fluxo de dados:** Request â†’ ValidaÃ§Ã£o â†’ LÃ³gica de NegÃ³cio â†’ PersistÃªncia â†’ Response. Cada passo deve ser explÃ­cito.
3. **Modos de falha:** O que pode dar errado? Falhas de rede, dados invÃ¡lidos, race conditions, timeouts.
4. **Escalabilidade:** Este cÃ³digo vai funcionar com 10x a carga atual? Qual Ã© o gargalo?

---

## Diretrizes de Arquitetura de MÃ³dulo

### Responsabilidade em Camadas (enforcement estrito)

```
Controller (camada HTTP)
  â†“ recebe DTOs validados
Service (camada de lÃ³gica de negÃ³cio)
  â†“ orquestra operaÃ§Ãµes de domÃ­nio
Repository (camada de acesso a dados)
  â†“ abstrai operaÃ§Ãµes do Mongoose
Schema/Model (camada de definiÃ§Ã£o de dados)
```

**NUNCA viole estes limites:**

- Controllers NÃƒO DEVEM conter lÃ³gica de negÃ³cio, queries de banco ou transformaÃ§Ã£o de dados
- Services NÃƒO DEVEM importar Mongoose diretamente â€” sempre via Repository
- Repositories NÃƒO DEVEM conter lÃ³gica de negÃ³cio â€” apenas padrÃµes de acesso a dados
- Schemas NÃƒO DEVEM conter comportamento â€” use Services para lÃ³gica computada

### Limites de MÃ³dulo

- Cada mÃ³dulo exporta APENAS seu Service (nÃ£o Repository, nÃ£o Schema)
- ComunicaÃ§Ã£o entre mÃ³dulos Ã© Service-to-Service
- Se mÃ³dulo A precisa de dados do mÃ³dulo B, A importa o Module de B e injeta o Service de B
- DependÃªncias circulares sinalizam um problema de design â€” extraia lÃ³gica compartilhada para um novo mÃ³dulo

---

## Modelagem de Dados (MongoDB/Mongoose)

### PrincÃ­pios de Design de Schema

- **Embed** dados que sÃ£o sempre acessados juntos e pertencem ao pai (endereÃ§os, telefones)
- **Reference** dados que tÃªm seu prÃ³prio ciclo de vida ou sÃ£o compartilhados entre entidades
- **Denormalize** dados lidos frequentemente mas escritos raramente (nome do usuÃ¡rio em pedidos)
- **Nunca** embed arrays que crescem ilimitadamente â€” cap em ~100 itens, use referÃªncias alÃ©m disso

### EstratÃ©gia de Ãndices

```typescript
// Sempre indexar campos usados em:
// - filtros de find()
// - operaÃ§Ãµes de sort()
// - constraints unique

// Ãndice composto (ordem importa â€” campo mais seletivo primeiro)
OrderSchema.index({ userId: 1, status: 1, createdAt: -1 });

// Ãndice TTL para documentos auto-expirantes
SessionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 });
```

### PadrÃµes de Query

```typescript
// BOM: Paginado, com projeÃ§Ã£o, lean
async findAll(query: PaginationQueryDto) {
  const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = query;
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    this.model
      .find(filter)
      .select('-__v -internalField')    // projeÃ§Ã£o
      .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
      .skip(skip)
      .limit(limit)
      .lean()                            // objetos planos (mais rÃ¡pido)
      .exec(),
    this.model.countDocuments(filter).exec(),
  ]);

  return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
}

// RUIM: Sem paginaÃ§Ã£o, sem projeÃ§Ã£o, sem lean
async findAll() {
  return this.model.find().exec();  // âŒ Retorna TODOS os documentos com TODOS os campos
}
```

---

## EstratÃ©gia de Tratamento de Erros

### Hierarquia de ExceÃ§Ãµes

```typescript
// Usar exceÃ§Ãµes built-in do NestJS para erros HTTP
NotFoundException;          // 404 â€” recurso nÃ£o encontrado
BadRequestException;        // 400 â€” input invÃ¡lido
ConflictException;          // 409 â€” duplicado/conflito
UnauthorizedException;      // 401 â€” nÃ£o autenticado
ForbiddenException;         // 403 â€” nÃ£o autorizado
UnprocessableEntityException; // 422 â€” violaÃ§Ã£o de regra de negÃ³cio
```

### Regras de Tratamento de Erros

- **Toda** operaÃ§Ã£o async DEVE ter tratamento de erro explÃ­cito
- **Nunca** capturar e engolir erros silenciosamente (`catch () {}`)
- **Sempre** incluir contexto nos erros (ID da entidade, nome da operaÃ§Ã£o, dados relevantes)
- **Re-throw** com contexto de nÃ­vel mais alto ao capturar erros de nÃ­vel baixo
- **Log** no ponto de handling, nÃ£o no ponto de throw

---

## PadrÃµes BullMQ (se aplicÃ¡vel)

### PrincÃ­pios de Design de Job

1. **Idempotente:** Executar um job duas vezes produz o mesmo resultado
2. **Payload pequeno:** Armazenar apenas IDs e referÃªncias nos dados do job
3. **Retryable:** Configurar exponential backoff para falhas transitÃ³rias
4. **ObservÃ¡vel:** Logar cada passo (recebido, processando, concluÃ­do, falhado)
5. **Bounded:** Definir TTL e polÃ­ticas de cleanup

### ConfiguraÃ§Ã£o ObrigatÃ³ria

```typescript
await this.queue.add('job-name', data, {
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: { age: 86400, count: 1000 },
  removeOnFail: { age: 604800, count: 5000 },
});
```

---

## PadrÃµes de API REST

```
POST   /api/v1/{resources}          â†’ Create (201)
GET    /api/v1/{resources}          â†’ List com paginaÃ§Ã£o (200)
GET    /api/v1/{resources}/:id      â†’ Get por ID (200)
PATCH  /api/v1/{resources}/:id      â†’ Update parcial (200)
DELETE /api/v1/{resources}/:id      â†’ Soft/Hard delete (200/204)
```

### Response Envelope

```typescript
// Recurso Ãºnico
{ data: { ...resource } }

// Lista (paginada)
{ data: [...], meta: { total, page, limit, totalPages } }
```

---

## Checklist de Performance

Antes de finalizar qualquer cÃ³digo backend:

- [ ] Listagens paginadas (sem queries ilimitadas)
- [ ] Ãndices adequados para todos os padrÃµes de query
- [ ] `.lean()` usado para queries read-only
- [ ] ProjeÃ§Ãµes (`.select()`) para excluir campos desnecessÃ¡rios
- [ ] `Promise.all()` para operaÃ§Ãµes async independentes
- [ ] Sem queries N+1 (usar `$in`, `populate` ou `$lookup`)
- [ ] Jobs BullMQ com retry/backoff/cleanup configurados
- [ ] Payloads de response mÃ­nimos (sem vazar campos internos)

---

## Checklist de SeguranÃ§a

Antes de finalizar qualquer cÃ³digo backend:

- [ ] Todos os inputs validados via DTOs + class-validator
- [ ] Sem input raw do usuÃ¡rio em queries
- [ ] Senhas/segredos nunca em logs ou responses
- [ ] CORS restrito a origens conhecidas
- [ ] Helmet habilitado para security headers
- [ ] Rate limiting em endpoints sensÃ­veis
- [ ] VariÃ¡veis de ambiente para todos os segredos (nunca hardcoded)

---

## Quando Aplicar Este Skill

O **Coder Subagent** deve ler este arquivo quando:

- Criar qualquer novo mÃ³dulo NestJS
- Escrever services, controllers ou repositories
- Configurar jobs BullMQ (producers/processors)
- Trabalhar com schemas e queries Mongoose
- Configurar middleware ou configuraÃ§Ã£o de app

Este skill complementa o `CLAUDE.md` do repo (convenÃ§Ãµes de cÃ³digo e estrutura de pastas).
Este skill cobre **qualidade arquitetural, resiliÃªncia e padrÃµes de performance**.

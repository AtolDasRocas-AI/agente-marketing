---
name: nextjs
description: Use ao escrever, revisar ou refatorar codigo Next.js (App Router, Server Components, Server Actions, route handlers, middleware, caching, ISR/SSG/SSR). Acione quando o usuario mencionar Next.js ou trabalhar em projeto com app/ ou pages/.
---

# Next.js Skill

Este guia orienta a criacao de codigo Next.js de qualidade de producao com App Router, enfase em arquitetura, performance, seguranca e UX.
**Leia este arquivo antes de escrever qualquer page, layout, route handler ou server action.**

> O skill `ux-design.skill.md` e carregado automaticamente para principios de UX/design.

---

## Next.js Thinking (Antes de Codar)

Antes de escrever qualquer codigo Next.js, considere:

1. **Server vs Client:** Este componente precisa de interatividade? Se nao, mantenha como Server Component.
2. **Estrategia de dados:** De onde vem os dados, quao frescos precisam ser? Cache, revalidacao ou tempo real?
3. **Rendering:** SSG, ISR, SSR ou streaming? Qual estrategia otimiza para este caso de uso?
4. **Caching:** O que pode ser cacheado e por quanto tempo? Qual e o custo de stale data?

---

## App Router Architecture

### Convencoes de Arquivo

```
app/
  layout.tsx        # Layout raiz (persistente entre navegacoes)
  page.tsx          # Pagina da rota
  loading.tsx       # Suspense automatico (skeleton/spinner)
  error.tsx         # ErrorBoundary automatico
  not-found.tsx     # 404 customizado
  template.tsx      # Como layout, mas re-renderiza a cada navegacao
```

### Padroes de Rota

- **Route groups:** `(groupName)` â€” organiza sem afetar URL
- **Parallel routes:** `@slot` â€” renderiza multiplas paginas simultaneamente
- **Intercepting routes:** `(..)` â€” intercepta navegacao para modais
- **Dynamic routes:** `[param]`, catch-all `[...slug]`, optional `[[...slug]]`

### Regras de Layouts

- Nested layouts herdam â€” use para UI compartilhada (sidebar, header)
- `loading.tsx` envolve a page em `<Suspense>` automaticamente
- `error.tsx` envolve a page em `<ErrorBoundary>` automaticamente
- **NUNCA** espere que layouts re-renderizem na navegacao â€” use `template.tsx` se precisar disso

---

## Server Components vs Client Components

- Default e Server Component â€” zero JS enviado ao client
- Adicione `"use client"` APENAS quando necessario: `useState`, `useEffect`, event handlers, browser APIs
- Server Components PODEM importar Client Components (o inverso NAO)
- Passe dados do server como props para Client Components (apenas serializaveis â€” sem funcoes, sem Date)
- **NUNCA** marque um componente como `"use client"` apenas para usar uma lib client â€” encapsule-a

### Padrao de Composicao

```tsx
// app/dashboard/page.tsx (Server Component â€” busca dados)
import { getMetrics } from '@/lib/data';
import { MetricsChart } from './metrics-chart';

export default async function DashboardPage() {
  const metrics = await getMetrics();

  return (
    <div>
      <h1>Dashboard</h1>
      {/* Server data passed to Client Component */}
      <MetricsChart data={metrics} />
    </div>
  );
}
```

```tsx
// app/dashboard/metrics-chart.tsx (Client Component â€” interatividade)
'use client';

import { useState } from 'react';

interface MetricsChartProps {
  data: { label: string; value: number }[];
}

export function MetricsChart({ data }: MetricsChartProps) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <ul>
      {data.map((item) => (
        <li key={item.label} onClick={() => setSelected(item.label)}>
          {item.label}: {item.value} {selected === item.label && '(selected)'}
        </li>
      ))}
    </ul>
  );
}
```

---

## Data Fetching

### Server Components (preferido)

- `async/await` diretamente no corpo do componente
- `fetch()` com opcoes de cache:
  - `cache: 'force-cache'` â€” SSG (default)
  - `cache: 'no-store'` â€” SSR
  - `next: { revalidate: 3600 }` â€” ISR

### Server Actions

- Diretiva `"use server"`
- Chamadas via forms (`action={}`) ou programaticamente
- **Sempre** validar input com Zod
- Use `revalidatePath()` / `revalidateTag()` apos mutacoes
- Retorne resultados tipados, trate erros graciosamente

```tsx
// app/actions/create-post.ts
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';

const CreatePostSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
});

type ActionResult = { success: true; id: string } | { success: false; error: string };

export async function createPost(formData: FormData): Promise<ActionResult> {
  const parsed = CreatePostSchema.safeParse({
    title: formData.get('title'),
    content: formData.get('content'),
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  try {
    const post = await db.post.create({ data: parsed.data });
    revalidatePath('/posts');
    return { success: true, id: post.id };
  } catch {
    return { success: false, error: 'Failed to create post' };
  }
}
```

### Route Handlers

- `app/api/route.ts` com exports `GET`, `POST`, `PUT`, `DELETE`
- Use para webhooks, integracao com APIs externas, streaming
- Use `NextRequest` / `NextResponse`

---

## Rendering Strategies

| Estrategia | Quando | Como |
|---|---|---|
| **SSG** | Conteudo raramente muda | Default fetch ou `generateStaticParams` |
| **ISR** | Conteudo muda periodicamente | `next: { revalidate: N }` |
| **SSR** | Conteudo muda por request, personalizado | `cache: 'no-store'` ou `dynamic = 'force-dynamic'` |
| **Streaming** | Data fetches demorados | Suspense boundaries |

---

## Middleware

- Arquivo `middleware.ts` na raiz do projeto
- Matcher config para selecionar rotas
- Use para: auth checks, redirects, headers, geolocalizacao
- **NUNCA** faca computacao pesada no middleware

```typescript
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('session')?.value;

  if (!token && request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/settings/:path*'],
};
```

---

## Image & Font Optimization

- `next/image`: sempre use, `width`/`height` ou `fill`, `priority` para LCP, atributo `sizes`
- `next/font`: local ou Google, variable fonts preferidas, `display: 'swap'`

---

## Environment Variables

- Prefixo `NEXT_PUBLIC_` para variaveis acessiveis no client
- Variaveis server-only: **nunca** prefixe com `NEXT_PUBLIC_`
- Valide com Zod no startup
- **NUNCA** exponha segredos ao client

---

## Testing

- **Unit:** Vitest + React Testing Library
- **Server Components:** teste a logica de data fetching separadamente
- **Server Actions:** teste como funcoes com dependencias mockadas
- **E2E:** Playwright preferido
- Use MSW para mocking de APIs

---

## Security

- Server Actions: **sempre** valide input, verifique auth
- CSRF: tratado automaticamente por Server Actions
- Content Security Policy via `next.config.js` headers
- Sanitize conteudo gerado por usuario antes de renderizar

---

## Checklist de Performance

Antes de finalizar qualquer codigo Next.js:

- [ ] Imagens usam `next/image` com sizing adequado
- [ ] Fonts usam `next/font` com preload
- [ ] Componentes pesados em Client boundaries apenas onde necessario
- [ ] Suspense boundaries para data fetches independentes
- [ ] Paginas estaticas onde possivel (SSG > ISR > SSR)
- [ ] Metadata API usada para SEO (`generateMetadata`)
- [ ] Bundle size verificado (sem libs pesadas client-side em Server Components)
- [ ] Dynamic imports para componentes client pesados

---

## Checklist de Seguranca

Antes de finalizar qualquer codigo Next.js:

- [ ] Server Actions validam todo input com Zod
- [ ] Auth verificada em Server Actions e Route Handlers
- [ ] Sem segredos em variaveis `NEXT_PUBLIC_`
- [ ] Conteudo de usuario sanitizado
- [ ] CSP headers configurados
- [ ] API routes com rate limiting

---

## Quando Aplicar Este Skill

O **Coder Subagent** deve ler este arquivo quando:

- Criar qualquer page, layout ou template
- Escrever server actions ou route handlers
- Configurar middleware ou next.config
- Trabalhar com data fetching e caching strategies
- Otimizar performance ou SEO

Este skill complementa o `CLAUDE.md` do repo (convencoes de codigo e estrutura de pastas).
Este skill complementa o `ux-design.skill.md` (principios de UX e design).
Este skill cobre **arquitetura App Router, rendering strategies e padroes de performance**.

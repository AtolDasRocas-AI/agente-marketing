---
name: react
description: Use ao escrever, revisar ou refatorar codigo React (hooks, componentes funcionais, context, performance, suspense, server components). Acione quando o usuario mencionar React ou trabalhar em arquivos .jsx/.tsx em projeto React (nao Next.js especifico).
---

# React Skill

Guia para criaÃ§Ã£o de cÃ³digo React 18+ de qualidade de produÃ§Ã£o com foco em arquitetura de componentes, performance, tipagem e testabilidade.
**Leia este arquivo antes de escrever qualquer componente React, hook ou pÃ¡gina.**

> Para princÃ­pios de UX, design visual e acessibilidade, o skill `ux-design.skill.md` Ã© carregado automaticamente.

---

## React Thinking (Antes de Codar)

Antes de escrever qualquer componente, considere:

1. **Responsabilidade:** Este componente faz uma coisa bem? Se precisar explicar com "e", quebre em dois.
2. **Fluxo de dados:** Props descem, eventos sobem. Onde vive o estado? QuÃ£o longe ele precisa viajar?
3. **FrequÃªncia de render:** O que causa re-render? O custo Ã© aceitÃ¡vel? Precisa de memoizaÃ§Ã£o?
4. **ComposiÃ§Ã£o:** Posso compor componentes existentes em vez de criar um novo monolÃ­tico?

---

## Arquitetura de Componentes

### Regras Fundamentais

- **Functional components only** â€” nunca class components
- **Um componente por arquivo** â€” exceÃ§Ã£o: subcomponentes internos pequenos nÃ£o exportados
- **Props tipadas com interface** â€” sempre com JSDoc em props complexas
- **Desestruturar props** na assinatura da funÃ§Ã£o

```tsx
interface UserCardProps {
  user: User;
  variant?: 'compact' | 'full';
  onSelect?: (userId: string) => void;
}

export function UserCard({ user, variant = 'full', onSelect }: UserCardProps) {
  // ...
}
```

### ComposiÃ§Ã£o sobre HeranÃ§a

```tsx
// BOM: Compound components
<DataTable data={users} columns={columns}>
  <DataTable.Header />
  <DataTable.Body renderRow={(user) => <UserRow user={user} />} />
  <DataTable.Pagination />
</DataTable>

// RUIM: Mega componente com dezenas de props
<DataTable data={users} columns={columns} showHeader showPagination renderRow={...} />
```

### OrganizaÃ§Ã£o de Arquivos

```
features/
  users/
    components/          â†’ Componentes especÃ­ficos da feature
    hooks/               â†’ Custom hooks da feature
    types.ts             â†’ Tipos/interfaces
    api.ts               â†’ Chamadas de API (TanStack Query)
    index.ts             â†’ Public exports
```

---

## Hooks â€” Regras e PadrÃµes

### useState

- Use para estado local simples (toggles, inputs, contadores)
- Prefira um Ãºnico objeto para estados relacionados vs mÃºltiplos `useState`
- Use updater function quando o novo valor depende do anterior: `setState(prev => prev + 1)`

### useEffect

- **Sem efeitos para derivar dados** â€” use variÃ¡veis computadas ou `useMemo`
- **Cleanup obrigatÃ³rio** para subscriptions, timers, event listeners
- **Dependencies exatas** â€” nunca desabilite o lint de deps (`eslint-disable`)

```tsx
// RUIM: useEffect para derivar dados
const [fullName, setFullName] = useState('');
useEffect(() => { setFullName(`${first} ${last}`); }, [first, last]);

// BOM: variÃ¡vel derivada
const fullName = `${first} ${last}`;
```

### useCallback / useMemo

- `useCallback` para funÃ§Ãµes passadas como props a componentes memoizados
- `useMemo` para cÃ¡lculos custosos (sort, filter, transform em listas grandes)
- **NÃ£o memoize por default** â€” memoize quando hÃ¡ problema de performance medido

### Custom Hooks

- Prefixo `use` obrigatÃ³rio
- Um hook = uma responsabilidade
- Retorne objeto nomeado (nÃ£o array) quando hÃ¡ 3+ valores

```tsx
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
```

---

## State Management

### Estado Local (useState/useReducer)

- **Default para tudo** â€” sÃ³ escale quando necessÃ¡rio
- `useReducer` para estado complexo com mÃºltiplas aÃ§Ãµes relacionadas

### Estado do Servidor (TanStack Query)

```tsx
// Query
const { data, isLoading, error } = useQuery({
  queryKey: ['users', filters],
  queryFn: () => api.getUsers(filters),
  staleTime: 5 * 60 * 1000, // 5 min
});

// Mutation com invalidaÃ§Ã£o
const mutation = useMutation({
  mutationFn: api.createUser,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['users'] });
  },
});

// Optimistic update
const mutation = useMutation({
  mutationFn: api.updateUser,
  onMutate: async (updated) => {
    await queryClient.cancelQueries({ queryKey: ['users', updated.id] });
    const previous = queryClient.getQueryData(['users', updated.id]);
    queryClient.setQueryData(['users', updated.id], updated);
    return { previous };
  },
  onError: (_err, _vars, context) => {
    queryClient.setQueryData(['users', context.previous.id], context.previous);
  },
});
```

### Estado Global de UI (Zustand)

```tsx
interface UIStore {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
}

const useUIStore = create<UIStore>((set) => ({
  sidebarOpen: true,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
}));

// Uso com selector (evita re-renders desnecessÃ¡rios)
const sidebarOpen = useUIStore((s) => s.sidebarOpen);
```

---

## Performance

### React.memo

- Use em componentes que recebem props estÃ¡veis mas tÃªm pai que re-renderiza frequentemente
- **NÃ£o use em todo componente** â€” o overhead de comparaÃ§Ã£o pode ser maior que o re-render

### Code Splitting

```tsx
const AdminPanel = lazy(() => import('./features/admin/AdminPanel'));

function App() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AdminPanel />
    </Suspense>
  );
}
```

### VirtualizaÃ§Ã£o

- Use `@tanstack/react-virtual` para listas com 100+ itens
- Nunca renderize milhares de DOM nodes â€” virtualize

### Regras de Performance

- Evite criar objetos/arrays novos em render: `style={{ color: 'red' }}` causa re-render em filhos memoizados
- Keys estÃ¡veis em listas: use IDs, nunca Ã­ndice (exceto listas estÃ¡ticas)
- Imagens: lazy loading com `loading="lazy"`, formatos modernos (WebP/AVIF), `srcSet` para responsivo

---

## Error Boundaries & Suspense

```tsx
// Error Boundary (componente wrapper)
class ErrorBoundary extends Component<Props, State> {
  state = { hasError: false, error: null };
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) return <ErrorFallback error={this.state.error} />;
    return this.props.children;
  }
}

// Uso: encapsule features independentes
<ErrorBoundary fallback={<ErrorCard />}>
  <Suspense fallback={<Skeleton />}>
    <UserDashboard />
  </Suspense>
</ErrorBoundary>
```

---

## FormulÃ¡rios

### React Hook Form + Zod

```tsx
const schema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('Email invÃ¡lido'),
  role: z.enum(['admin', 'user', 'viewer']),
});

type FormData = z.infer<typeof schema>;

function UserForm({ onSubmit }: { onSubmit: (data: FormData) => void }) {
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <label htmlFor="name">Nome</label>
      <input id="name" {...register('name')} aria-describedby="name-error" />
      {errors.name && <span id="name-error" role="alert">{errors.name.message}</span>}
      {/* ... */}
    </form>
  );
}
```

---

## Testing

### Stack: Vitest + React Testing Library

### PrincÃ­pios

- **Teste comportamento, nÃ£o implementaÃ§Ã£o** â€” nunca teste state interno ou hooks diretamente
- **Query priorities:** `getByRole` > `getByLabelText` > `getByText` > `getByTestId`
- **`getByTestId` Ã© Ãºltimo recurso** â€” indica falta de acessibilidade

### PadrÃµes

```tsx
// Teste de componente
describe('UserCard', () => {
  it('renders user name and triggers select on click', async () => {
    const onSelect = vi.fn();
    render(<UserCard user={mockUser} onSelect={onSelect} />);

    expect(screen.getByRole('heading', { name: mockUser.name })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /selecionar/i }));
    expect(onSelect).toHaveBeenCalledWith(mockUser.id);
  });
});

// Teste async
it('shows users after loading', async () => {
  render(<UserList />);
  expect(screen.getByRole('progressbar')).toBeInTheDocument();
  expect(await screen.findByText('JoÃ£o Silva')).toBeInTheDocument();
});
```

### Mocks

```tsx
// Mock de hook
vi.mock('@/features/users/hooks/useUsers', () => ({
  useUsers: vi.fn(() => ({ data: mockUsers, isLoading: false })),
}));

// Mock de API (MSW recomendado para integraÃ§Ã£o)
```

---

## TypeScript â€” PadrÃµes

### Generic Components

```tsx
interface ListProps<T> {
  items: T[];
  renderItem: (item: T) => ReactNode;
  keyExtractor: (item: T) => string;
}

function List<T>({ items, renderItem, keyExtractor }: ListProps<T>) {
  return <ul>{items.map((item) => <li key={keyExtractor(item)}>{renderItem(item)}</li>)}</ul>;
}
```

### Discriminated Unions para Props

```tsx
type ButtonProps =
  | { variant: 'link'; href: string; onClick?: never }
  | { variant: 'button'; onClick: () => void; href?: never };
```

### Utility Types

```tsx
type UserFormData = Pick<User, 'name' | 'email' | 'role'>;
type PartialUser = Partial<User>;
type RequiredUser = Required<User>;
type ReadonlyUser = Readonly<User>;
```

---

## Checklist de Qualidade de CÃ³digo

Antes de finalizar qualquer cÃ³digo React:

- [ ] Componentes com responsabilidade Ãºnica
- [ ] Props tipadas com interface (nÃ£o `any` ou `object`)
- [ ] Custom hooks extraÃ­dos para lÃ³gica reutilizÃ¡vel
- [ ] TanStack Query para estado do servidor (nÃ£o `useEffect` + `useState`)
- [ ] Nenhum `useEffect` para derivar dados (usar variÃ¡veis computadas)
- [ ] Error boundaries em features independentes
- [ ] Suspense com fallbacks adequados
- [ ] Keys estÃ¡veis em listas (IDs, nÃ£o Ã­ndices)
- [ ] FormulÃ¡rios com validaÃ§Ã£o Zod + React Hook Form
- [ ] Testes cobrindo comportamento principal (render, interaÃ§Ã£o, estados)

---

## Quando Aplicar Este Skill

O **Coder Subagent** deve ler este arquivo quando:

- Criar qualquer componente React
- Construir hooks customizados
- Configurar state management
- Escrever testes de componentes
- Trabalhar em formulÃ¡rios ou data fetching

Este skill complementa o `CLAUDE.md` do repo (convenÃ§Ãµes de cÃ³digo e estrutura do projeto).
Este skill cobre **arquitetura de componentes, hooks, state management, performance e testing**.

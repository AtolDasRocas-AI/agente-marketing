---
name: angular
description: Use ao escrever, revisar ou refatorar codigo Angular 18+ (standalone components, signals, RxJS, change detection OnPush, lazy loading). Acione sempre que o usuario mencionar Angular, componentes/services/directives Angular, ou arquivos .component.ts/.service.ts em projeto Angular.
---

# Angular 18+ Skill

Guia para codigo Angular 18+ com qualidade de producao usando standalone components e signals.
Leia antes de escrever qualquer component, service ou directive.

> O skill `ux-design.skill.md` e carregado automaticamente para principios de UX/design.

---

## Angular Thinking (Antes de Codar)

Antes de abrir o editor, responda estas 4 perguntas:

1. **Component tree** â€” como esse componente se encaixa na hierarquia? Quem e o pai? Quais filhos ele renderiza?
2. **Change detection** â€” OnPush e viavel? O que dispara atualizacoes nesse componente?
3. **Signal vs Observable** â€” estamos lidando com estado derivado sincrono (signal) ou stream assincrono (RxJS)?
4. **Lazy loading** â€” essa rota ou componente deve ser deferido/lazy loaded?

---

## Standalone Components (sem NgModules)

- **TODOS** os novos componentes DEVEM ser `standalone: true` (padrao no Angular 18+).
- Importe dependencias diretamente em `@Component({ imports: [...] })`.
- Use `bootstrapApplication()` em vez de bootstrap via NgModule.
- Configure providers globais em `app.config.ts`: `provideRouter()`, `provideHttpClient()`, `provideAnimations()`.
- **NUNCA** crie novos NgModules â€” standalone e o padrao.

```typescript
@Component({
  selector: 'app-user-card',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (user()) {
      <div class="user-card">
        <h3>{{ user().name }}</h3>
        <a [routerLink]="['/users', user().id]">Ver perfil</a>
      </div>
    }
  `,
})
export class UserCardComponent {
  user = input.required<User>();
}
```

---

## Signals

### Core API

- `signal(initialValue)` â€” writable signal.
- `computed(() => ...)` â€” signal derivado (rastreia dependencias automaticamente).
- `effect(() => ...)` â€” efeitos colaterais que rastreiam signals (use com moderacao).

### Signal Inputs & Outputs (Angular 17.1+)

- `input<T>()` e `input.required<T>()` substituem `@Input()`.
- `output<T>()` substitui `@Output()` + `EventEmitter`.
- `model<T>()` para two-way binding.

### Quando usar Signals vs RxJS

| Use Signals                      | Use RxJS                            |
| -------------------------------- | ----------------------------------- |
| Estado derivado sincrono         | Requisicoes HTTP                    |
| Bindings no template             | Streams WebSocket                   |
| Estado simples de componente     | Orquestracao async complexa         |
| Comunicacao pai-filho            | Event streams entre componentes     |

### Exemplos de Patterns com Signals

```typescript
@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [CurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <input #search (input)="searchTerm.set(search.value)" placeholder="Buscar..." />
    <p>{{ filteredCount() }} produtos encontrados</p>
    @for (product of filteredProducts(); track product.id) {
      <div>{{ product.name }} - {{ product.price | currency:'BRL' }}</div>
    } @empty {
      <p>Nenhum produto encontrado.</p>
    }
  `,
})
export class ProductListComponent {
  private productService = inject(ProductService);

  products = signal<Product[]>([]);
  searchTerm = signal('');

  filteredProducts = computed(() => {
    const term = this.searchTerm().toLowerCase();
    return this.products().filter(p => p.name.toLowerCase().includes(term));
  });

  filteredCount = computed(() => this.filteredProducts().length);

  constructor() {
    this.productService.getAll().subscribe(data => this.products.set(data));
  }
}
```

---

## Template Control Flow

- `@if (condition) { } @else { }` â€” substitui `*ngIf`.
- `@for (item of items; track item.id) { } @empty { }` â€” substitui `*ngFor` (**track e OBRIGATORIO**).
- `@switch (value) { @case (x) { } @default { } }` â€” substitui `ngSwitch`.
- `@defer (on viewport) { } @loading { } @placeholder { } @error { }` â€” carregamento lazy de blocos.

**Regras:**

- **SEMPRE** use a nova sintaxe de control flow (nao structural directives).
- `@for` **DEVE** ter expressao `track` (use identificador unico, **nunca** `$index` para listas mutaveis).
- `@defer` para componentes pesados que nao sao imediatamente visiveis.

---

## Dependency Injection

- `providedIn: 'root'` para services singleton.
- Funcao `inject()` e preferida sobre constructor injection.
- `InjectionToken<T>` para configuracao e valores nao-classe.
- Providers no nivel do componente para instancias com escopo.
- Use functional providers: `provideHttpClient(withInterceptors([...]))`.

```typescript
// InjectionToken para configuracao
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL');

// Service usando inject()
@Injectable({ providedIn: 'root' })
export class OrderService {
  private http = inject(HttpClient);
  private baseUrl = inject(API_BASE_URL);

  getOrders(): Observable<Order[]> {
    return this.http.get<Order[]>(`${this.baseUrl}/orders`);
  }
}
```

---

## RxJS Patterns (quando necessario)

- **SEMPRE** use `takeUntilDestroyed()` para subscriptions em componentes (de `@angular/core/rxjs-interop`).
- `toSignal()` e `toObservable()` para ponte entre signals e RxJS.
- Prefira declarativo (pipe operators) sobre imperativo (subscribe + gerenciamento manual).
- Operators essenciais: `switchMap` (cancela anterior), `mergeMap` (paralelo), `concatMap` (sequencial), `combineLatest`, `debounceTime`.
- **NUNCA** aninhe subscribes.

```typescript
@Component({
  selector: 'app-search-results',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (result of results(); track result.id) {
      <app-result-card [result]="result" />
    }
  `,
})
export class SearchResultsComponent {
  private searchService = inject(SearchService);
  private destroyRef = inject(DestroyRef);

  searchTerm = model('');

  // Bridge signal -> observable -> signal
  results = toSignal(
    toObservable(this.searchTerm).pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(term => this.searchService.search(term)),
    ),
    { initialValue: [] },
  );
}
```

---

## Routing

- Lazy loading: `loadComponent` para standalone components.
- Route guards como funcoes (nao classes): `canActivate: [() => inject(AuthService).isLoggedIn()]`.
- Resolvers como funcoes.
- `withComponentInputBinding()` para vincular route params a inputs.

```typescript
export const routes: Routes = [
  {
    path: 'dashboard',
    loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent),
    canActivate: [() => inject(AuthService).isAuthenticated()],
  },
  {
    path: 'admin',
    loadChildren: () => import('./pages/admin/admin.routes').then(m => m.ADMIN_ROUTES),
    canActivate: [() => inject(AuthService).hasRole('admin')],
  },
  {
    path: 'products/:id',
    loadComponent: () => import('./pages/product-detail/product-detail.component').then(m => m.ProductDetailComponent),
    resolve: { product: (route: ActivatedRouteSnapshot) => inject(ProductService).getById(route.params['id']) },
  },
];

// app.config.ts
export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAnimations(),
  ],
};
```

---

## Reactive Forms

- `NonNullableFormBuilder` para typed forms.
- `FormGroup`, `FormControl`, `FormArray` com tipos genericos.
- Validators: `Validators.required`, `Validators.minLength`, custom validators como funcoes.
- Async validators para validacao server-side.

```typescript
@Component({
  selector: 'app-user-form',
  standalone: true,
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form [formGroup]="form" (ngSubmit)="onSubmit()">
      <input formControlName="name" />
      @if (form.controls.name.hasError('required')) {
        <span class="error">Nome obrigatorio</span>
      }
      <input formControlName="email" type="email" />
      <button type="submit" [disabled]="form.invalid">Salvar</button>
    </form>
  `,
})
export class UserFormComponent {
  private fb = inject(NonNullableFormBuilder);

  form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    role: this.fb.control<'admin' | 'user'>('user'),
  });

  submitted = output<UserFormData>();

  onSubmit(): void {
    if (this.form.valid) {
      this.submitted.emit(this.form.getRawValue());
    }
  }
}
```

---

## Testing

- `TestBed.configureTestingModule` com standalone component.
- `ComponentFixture` e `DebugElement` para interacao com o DOM.
- `HttpTestingController` para mock de HTTP.
- Component harnesses (`@angular/cdk/testing`) para APIs de teste reutilizaveis.
- `fakeAsync`/`tick` para testes dependentes de timing.

```typescript
describe('UserCardComponent', () => {
  let fixture: ComponentFixture<UserCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserCardComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(UserCardComponent);
  });

  it('should display the user name', () => {
    const user: User = { id: '1', name: 'Maria Silva' };
    fixture.componentRef.setInput('user', user);
    fixture.detectChanges();

    const el = fixture.debugElement.query(By.css('h3'));
    expect(el.nativeElement.textContent).toContain('Maria Silva');
  });
});
```

---

## Performance

- **OnPush** change detection em TODOS os componentes (com signals isso e natural).
- Expressao `track` no `@for` (obrigatorio).
- `@defer` para componentes pesados ou abaixo da dobra.
- **Pure pipes** para transformacoes no template.
- **Evite** chamadas de funcao no template (use computed signals ou pipes).
- Lazy load de rotas com `loadComponent`/`loadChildren`.

---

## Checklist de Qualidade

- [ ] Todos os componentes standalone com OnPush
- [ ] Signals para estado do componente (nao Subject/BehaviorSubject para estado simples)
- [ ] Nova sintaxe de control flow (`@if`, `@for`, `@switch`), nao structural directives
- [ ] `@for` sempre com `track` usando identificador unico
- [ ] `takeUntilDestroyed()` em todas as subscriptions
- [ ] Typed reactive forms (`NonNullableFormBuilder`)
- [ ] Rotas com lazy loading
- [ ] Sem chamadas de funcao no template
- [ ] Testes cobrem comportamento do componente com TestBed

## Checklist de Seguranca

- [ ] Input do usuario sanitizado (Angular faz por padrao, nunca bypasse com `bypassSecurityTrust*`)
- [ ] Auth guards em rotas protegidas
- [ ] HTTP interceptors para auth tokens
- [ ] Variaveis de ambiente para configuracao (nada hardcoded)
- [ ] CSRF token tratado em HTTP interceptor

---

## Quando Aplicar Este Skill

Ao criar componentes, services, directives, pipes, guards ou qualquer codigo especifico do Angular.
Complementa o `CLAUDE.md` do app e o `ux-design.skill.md`.

---
name: spring-boot
description: Use ao escrever, revisar ou refatorar codigo Spring Boot/Java (controllers, services, JPA/Hibernate, security, testes). Acione sempre que o usuario mencionar Spring/Spring Boot ou editar arquivos .java em projeto Spring.
---

# Java Spring Boot Skill

Guia para aplicaÃ§Ãµes Spring Boot de qualidade produtiva. **Leia antes de escrever qualquer controller, service, repository ou configuraÃ§Ã£o.**

---

## Architecture Thinking (Antes de Codar)

Antes de implementar qualquer feature, responda estas 4 perguntas:

1. **Domain** â€” Qual domÃ­nio de negÃ³cio? Quais sÃ£o os invariantes?
2. **Transaction scope** â€” Quais operaÃ§Ãµes precisam ser atÃ´micas?
3. **Exception flow** â€” O que pode falhar e como cada falha deve aparecer para o cliente?
4. **Testability** â€” Cada camada pode ser testada isoladamente?

Se nÃ£o conseguir responder com clareza, pare e refine o entendimento antes de codar.

---

## Arquitetura em Camadas (enforcement estrito)

```
Controller (camada HTTP)
  â†“ recebe DTOs validados
Service (camada de lÃ³gica de negÃ³cio)
  â†“ orquestra operaÃ§Ãµes de domÃ­nio
Repository (camada de acesso a dados)
  â†“ abstrai JPA/queries
Entity (camada de definiÃ§Ã£o de dados)
```

### Regras inviolÃ¡veis

- Controllers **NÃƒO DEVEM** conter lÃ³gica de negÃ³cio, queries ao banco ou transformaÃ§Ã£o de dados
- Services **NÃƒO DEVEM** usar EntityManager diretamente â€” sempre via Repository
- Repositories **NÃƒO DEVEM** conter lÃ³gica de negÃ³cio â€” apenas padrÃµes de acesso a dados
- Entities **NÃƒO DEVEM** conter lÃ³gica de apresentaÃ§Ã£o

ViolaÃ§Ã£o de qualquer regra acima Ã© motivo de rejeiÃ§Ã£o em code review.

### Package Structure (feature-based)

```
com.company.app/
  user/
    UserController.java
    UserService.java
    UserRepository.java
    User.java (entity)
    dto/
      CreateUserRequest.java
      UpdateUserRequest.java
      UserResponse.java
  order/
    OrderController.java
    OrderService.java
    OrderRepository.java
    Order.java
    dto/
      ...
  config/
    SecurityConfig.java
    CorsConfig.java
  common/
    exception/
      GlobalExceptionHandler.java
      BusinessException.java
      NotFoundException.java
      ConflictException.java
```

Agrupe por feature, nÃ£o por camada tÃ©cnica. Cada feature Ã© um pacote coeso.

---

## DTOs & Mapping

- **NUNCA** exponha entities diretamente nas respostas da API
- Use Java Records para DTOs (Java 17+): imutÃ¡veis, concisos, serializÃ¡veis
- Mapeie Entity <-> DTO na camada Service (ou use MapStruct para casos complexos)

```java
public record CreateUserRequest(
    @NotBlank String name,
    @Email String email,
    @NotNull Role role
) {}

public record UserResponse(
    UUID id, String name, String email, Role role, Instant createdAt
) {
    public static UserResponse from(User entity) {
        return new UserResponse(
            entity.getId(),
            entity.getName(),
            entity.getEmail(),
            entity.getRole(),
            entity.getCreatedAt()
        );
    }
}
```

Para listas, mapeie via stream: `users.stream().map(UserResponse::from).toList()`

---

## Spring Data JPA

### Repository

- Estenda `JpaRepository<Entity, ID>` para CRUD padrÃ£o
- Derived query methods: `findByEmailAndStatus`, `existsByEmail`
- `@Query` para JPQL customizado: `@Query("SELECT u FROM User u WHERE u.status = :status")`
- Specifications para filtros dinÃ¢micos/complexos
- Interface projections para leituras parciais

### Entity Design

```java
@Entity
@Table(name = "users", indexes = {
    @Index(columnList = "email", unique = true)
})
@EntityListeners(AuditingEntityListener.class)
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false, unique = true)
    private String email;

    @Enumerated(EnumType.STRING)
    private Role role;

    @CreatedDate
    @Column(updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;

    // Construtores, getters â€” sem lÃ³gica de apresentaÃ§Ã£o
}
```

- Use UUID ou Long para IDs
- `@CreatedDate`, `@LastModifiedDate` com auditing habilitado (`@EnableJpaAuditing`)
- Relationships: prefira lazy loading, use `@EntityGraph` para eager quando necessÃ¡rio
- Ãndices em todas as colunas filtradas/ordenadas

---

## ValidaÃ§Ã£o (Jakarta Bean Validation)

- `@Valid` no `@RequestBody` do controller
- AnotaÃ§Ãµes: `@NotBlank`, `@NotNull`, `@Size`, `@Email`, `@Min`, `@Max`, `@Pattern`
- Custom validator: anotaÃ§Ã£o `@Constraint` + implementaÃ§Ã£o de `ConstraintValidator<A, T>`
- Validation groups para validaÃ§Ã£o contextual (Create vs Update)

---

## Exception Handling

### @ControllerAdvice + ProblemDetail (RFC 7807)

```java
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(NotFoundException.class)
    ProblemDetail handleNotFound(NotFoundException ex) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(
            HttpStatus.NOT_FOUND, ex.getMessage()
        );
        pd.setTitle("Resource Not Found");
        pd.setProperty("resource", ex.getResource());
        return pd;
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ProblemDetail handleValidation(MethodArgumentNotValidException ex) {
        ProblemDetail pd = ProblemDetail.forStatus(HttpStatus.BAD_REQUEST);
        pd.setTitle("Validation Error");
        Map<String, String> errors = new HashMap<>();
        ex.getBindingResult().getFieldErrors()
            .forEach(e -> errors.put(e.getField(), e.getDefaultMessage()));
        pd.setProperty("errors", errors);
        return pd;
    }

    @ExceptionHandler(ConflictException.class)
    ProblemDetail handleConflict(ConflictException ex) {
        return ProblemDetail.forStatusAndDetail(
            HttpStatus.CONFLICT, ex.getMessage()
        );
    }
}
```

### Hierarquia de ExceÃ§Ãµes Customizadas

```java
public class BusinessException extends RuntimeException {
    public BusinessException(String message) { super(message); }
}

public class NotFoundException extends BusinessException {
    private final String resource;
    public NotFoundException(String resource, Object id) {
        super("%s not found with id %s".formatted(resource, id));
        this.resource = resource;
    }
    public String getResource() { return resource; }
}

public class ConflictException extends BusinessException {
    public ConflictException(String message) { super(message); }
}
```

---

## Security (Spring Security)

```java
@Configuration
@EnableMethodSecurity
public class SecurityConfig {

    @Bean
    SecurityFilterChain filterChain(HttpSecurity http, JwtAuthFilter jwtFilter) throws Exception {
        return http
            .csrf(AbstractHttpConfigurer::disable)
            .sessionManagement(sm -> sm.sessionCreationPolicy(STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/v1/auth/**").permitAll()
                .requestMatchers("/actuator/health").permitAll()
                .anyRequest().authenticated()
            )
            .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)
            .build();
    }
}
```

- SecurityFilterChain como bean (nÃ£o estender WebSecurityConfigurerAdapter)
- JWT via `OncePerRequestFilter`
- Method-level: `@PreAuthorize("hasRole('ADMIN')")`, `@PreAuthorize("#userId == authentication.principal.id")`
- CORS: bean `CorsConfigurationSource`
- **NUNCA** hardcode secrets â€” use variÃ¡veis de ambiente ou vault

---

## Testing

| AnotaÃ§Ã£o | Escopo | Uso |
|---|---|---|
| `@SpringBootTest` | Contexto completo | Testes de integraÃ§Ã£o |
| `@WebMvcTest` | Controller only | Testes da camada HTTP |
| `@DataJpaTest` | Repository only | Testes de banco |
| `@MockBean` / Mockito | Service unit | LÃ³gica de negÃ³cio |

### PadrÃµes

```java
@WebMvcTest(UserController.class)
class UserControllerTest {
    @Autowired MockMvc mockMvc;
    @MockBean UserService userService;

    @Test
    void shouldReturnUser() throws Exception {
        when(userService.findById(any())).thenReturn(mockUser);
        mockMvc.perform(get("/api/v1/users/{id}", userId))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.name").value("JoÃ£o"));
    }
}
```

### TestContainers para testes de integraÃ§Ã£o com banco real

```java
@SpringBootTest
@Testcontainers
class UserRepositoryIT {
    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16");

    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }
}
```

---

## Configuration

- `application.yml` com profiles: `application-dev.yml`, `application-prod.yml`
- `@ConfigurationProperties` para config tipada
- Nunca hardcode valores que mudam entre ambientes
- Use `@Value` com moderaÃ§Ã£o â€” prefira `@ConfigurationProperties`

```java
@ConfigurationProperties(prefix = "app.jwt")
public record JwtProperties(
    String secret,
    Duration expiration
) {}
```

---

## REST API Patterns

```
POST   /api/v1/{resources}      â†’ Create  (201 + Location header)
GET    /api/v1/{resources}      â†’ List    (200 + pagination)
GET    /api/v1/{resources}/{id} â†’ Get     (200)
PUT    /api/v1/{resources}/{id} â†’ Update  (200)
PATCH  /api/v1/{resources}/{id} â†’ Partial (200)
DELETE /api/v1/{resources}/{id} â†’ Delete  (204)
```

Envelope de resposta para listas paginadas:

```json
{ "data": [...], "meta": { "page": 0, "size": 20, "totalElements": 100, "totalPages": 5 } }
```

Use `Pageable` como parÃ¢metro do controller para receber `page`, `size`, `sort` automaticamente.

---

## Checklist de Performance

- [ ] PaginaÃ§Ã£o com `Pageable`/`Page<T>` â€” nunca queries sem limite
- [ ] `@EntityGraph` ou `JOIN FETCH` para prevenir N+1
- [ ] `@Cacheable` para dados lidos frequentemente e raramente escritos
- [ ] Connection pool ajustado (HikariCP defaults sÃ£o bons, ajuste `max-pool-size` conforme carga)
- [ ] Projections para queries read-only que nÃ£o precisam da entity completa
- [ ] Processamento async com `@Async` ou filas para operaÃ§Ãµes pesadas
- [ ] Ãndices no banco em todas as colunas filtradas/ordenadas

## Checklist de SeguranÃ§a

- [ ] Todos os inputs validados via Jakarta Validation
- [ ] Nenhum input de usuÃ¡rio cru em queries (use parametrizado)
- [ ] Secrets em variÃ¡veis de ambiente (nunca no cÃ³digo ou yml commitado)
- [ ] CORS restrito a origens conhecidas
- [ ] Rate limiting em endpoints sensÃ­veis
- [ ] Auth verificado em todos os endpoints nÃ£o-pÃºblicos
- [ ] Senhas hasheadas com BCrypt (nunca texto plano)

---

## Quando Aplicar Este Skill

Ao criar controllers, services, repositories, entities, DTOs, configuraÃ§Ã£o de seguranÃ§a ou qualquer cÃ³digo Spring Boot. Complementa o `CLAUDE.md` do app afetado.

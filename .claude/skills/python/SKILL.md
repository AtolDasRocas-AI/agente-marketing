---
name: python
description: Use ao escrever, revisar ou refatorar codigo Python (tipagem, async, packaging, testes pytest, FastAPI, Django, data science). Acione sempre que o usuario mencionar Python ou editar arquivos .py.
---

# Python Skill

Guia para aplicaÃ§Ãµes Python 3.10+ com qualidade de produÃ§Ã£o, com seÃ§Ã£o dedicada para FastAPI. Leia antes de escrever qualquer module, service, router ou script.

---

## Python Thinking (Antes de Codar)

Antes de escrever qualquer cÃ³digo, responda estas 4 perguntas:

1. **Type safety** â€” todas as assinaturas de funÃ§Ã£o e tipos de retorno estÃ£o anotados?
2. **Async boundaries** â€” o que Ã© I/O-bound vs CPU-bound? Onde async ajuda de fato?
3. **Error propagation** â€” onde exceÃ§Ãµes devem ser capturadas vs propagadas?
4. **Testability** â€” cada funÃ§Ã£o/classe pode ser testada isoladamente?

---

## Python 3.10+ Patterns

- Type hints **EVERYWHERE**: parÃ¢metros, retornos, variÃ¡veis quando nÃ£o Ã³bvio
- Union com pipe: `str | None` em vez de `Optional[str]`
- `match/case` para structural pattern matching
- `dataclasses` para estruturas de dados, `attrs` para casos avanÃ§ados
- f-strings para formataÃ§Ã£o (nunca `.format()` ou `%`)
- `pathlib.Path` sobre `os.path`
- Use `from __future__ import annotations` para forward references

```python
from __future__ import annotations
from typing import Any

def process_event(event: dict[str, Any]) -> str | None:
    match event:
        case {"type": "click", "target": str(target)}:
            return f"Clicked {target}"
        case {"type": "submit", "data": dict(data)}:
            return f"Submitted {len(data)} fields"
        case _:
            return None
```

---

## Estrutura de Projeto

```
project/
  src/
    app/
      __init__.py
      main.py              # Entry point
      config.py             # Settings (pydantic-settings)
      models/               # Database models / domain entities
      schemas/              # Pydantic models (DTOs)
      repositories/         # Data access layer
      services/             # Business logic
      routers/              # API routes (FastAPI) ou CLI commands
      dependencies.py       # DI (FastAPI Depends)
      exceptions.py         # Custom exceptions
  tests/
    conftest.py
    test_services/
    test_routers/
  pyproject.toml
  .env
```

### Config com pydantic-settings

```python
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    database_url: str
    redis_url: str = "redis://localhost:6379"
    debug: bool = False
    secret_key: str

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

settings = Settings()
```

---

## FastAPI (quando aplicavel)

### Router Architecture

- Um `APIRouter` por dominio: users, orders, products
- Inclua todos os routers na app principal com prefix e tags
- Use `response_model` para type safety e documentacao
- Status codes explicitos: `status_code=201`, `status_code=204`

```python
from fastapi import APIRouter, Depends

router = APIRouter(prefix="/api/v1/users", tags=["users"])

@router.post("/", response_model=UserResponse, status_code=201)
async def create_user(
    data: CreateUserRequest,
    service: UserService = Depends(get_user_service),
):
    return await service.create(data)

@router.get("/", response_model=PaginatedResponse[UserResponse])
async def list_users(
    page: int = 1,
    limit: int = 20,
    service: UserService = Depends(get_user_service),
):
    return await service.list(page=page, limit=limit)
```

### Pydantic v2 Models

- `BaseModel` para request/response schemas
- `model_validator` para validacao cross-field
- `field_validator` para logica custom por campo
- Config: `from_attributes=True` para compatibilidade ORM

```python
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from typing import Literal

class CreateUserRequest(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    role: Literal["admin", "user", "viewer"]

    @field_validator("name")
    @classmethod
    def name_must_be_title_case(cls, v: str) -> str:
        return v.strip()

class UserResponse(BaseModel):
    id: UUID
    name: str
    email: str
    role: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
```

### Dependency Injection

- `Depends()` para logica compartilhada (auth, DB session, services)
- Yield dependencies para cleanup (DB sessions, connections)
- Use factories para dependencies configuraveis

```python
from collections.abc import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session() as session:
        yield session

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    # validate token, return user
    ...
```

### Exception Handling (FastAPI)

```python
from fastapi import Request
from fastapi.responses import JSONResponse

class AppException(Exception):
    def __init__(self, status_code: int, detail: str):
        self.status_code = status_code
        self.detail = detail

@app.exception_handler(AppException)
async def app_exception_handler(request: Request, exc: AppException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
    )
```

### Security

- `OAuth2PasswordBearer` para token extraction
- JWT encode/decode com `python-jose` ou `PyJWT`
- Password hashing com `passlib[bcrypt]`
- Sempre valide e decodifique tokens em dependencies

---

## Python Geral (sem framework)

### Scripts & CLI

- Use `typer` para CLI tools (type-hint based, auto-help)
- Use `click` para CLI complexa com subcommands
- Entry points via `pyproject.toml`

### Logging

```python
import logging

logger = logging.getLogger(__name__)

# Configure once in main/config
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(name)s %(levelname)s %(message)s",
)
```

- Use structured logging (`structlog`) para producao
- Log levels: DEBUG para dev, INFO para operacoes, WARNING para problemas recuperaveis, ERROR para falhas
- **NUNCA** logue secrets, passwords, tokens ou PII

---

## Database (SQLAlchemy 2.0)

### Declarative Mapping

```python
from uuid import uuid4, UUID
from datetime import datetime
from sqlalchemy import String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

class User(Base):
    __tablename__ = "users"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(default=func.now())
    orders: Mapped[list["Order"]] = relationship(back_populates="user", lazy="selectin")
```

### Async Sessions

```python
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

engine = create_async_engine(settings.database_url, pool_size=20, max_overflow=10)
async_session = async_sessionmaker(engine, expire_on_commit=False)
```

### Repository Pattern

```python
from sqlalchemy import select, func

class UserRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def find_by_id(self, user_id: UUID) -> User | None:
        return await self.session.get(User, user_id)

    async def find_all(self, *, page: int = 1, limit: int = 20) -> tuple[list[User], int]:
        query = select(User).offset((page - 1) * limit).limit(limit)
        result = await self.session.execute(query)
        total = await self.session.scalar(select(func.count()).select_from(User))
        return list(result.scalars().all()), total
```

### Alembic Migrations

- Auto-generate: `alembic revision --autogenerate -m "description"`
- Sempre revise migrations geradas antes de aplicar
- Nunca edite models sem criar uma migration

---

## Testing (pytest)

### Fixtures

```python
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

@pytest.fixture
async def db_session():
    async with async_session() as session:
        yield session
        await session.rollback()

@pytest.fixture
def user_factory():
    def _create(**overrides):
        defaults = {"name": "Test User", "email": "test@example.com", "role": "user"}
        return User(**{**defaults, **overrides})
    return _create
```

### FastAPI Testing

```python
import pytest
from httpx import AsyncClient, ASGITransport

@pytest.fixture
async def client():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac

async def test_create_user(client: AsyncClient):
    response = await client.post(
        "/api/v1/users/",
        json={"name": "Joao", "email": "joao@test.com", "role": "user"},
    )
    assert response.status_code == 201
    assert response.json()["name"] == "Joao"
```

### Patterns

- `@pytest.mark.parametrize` para data-driven tests
- `@pytest.mark.asyncio` para async tests (com `pytest-asyncio`)
- Factory fixtures para criacao de test data
- Mock com `unittest.mock.patch` ou `pytest-mock`

---

## Error Handling

- Hierarquia custom: `AppException` -> `NotFoundException`, `ConflictException`, `ValidationException`
- Capture exceÃ§Ãµes especificas, nunca bare `except:`
- Use `raise ... from e` para exception chaining
- Deixe exceÃ§Ãµes inesperadas propagarem para o global handler

---

## Checklist de Qualidade

- [ ] Type hints em todas as assinaturas de funcao e tipos de retorno
- [ ] Pydantic models para todos os dados externos (API input/output, config)
- [ ] Repository pattern para acesso a dados (sem queries raw em services)
- [ ] Async para todas as operacoes I/O
- [ ] pytest tests cobrindo happy path + error cases
- [ ] Nenhum bare `except:` clause
- [ ] Logging com niveis adequados (sem `print()`)
- [ ] Dependencies injetadas (sem globals importados)

## Checklist de Seguranca

- [ ] Todos os inputs validados via Pydantic
- [ ] Nenhum input raw do usuario em SQL queries (use parameterized/ORM)
- [ ] Secrets em variaveis de ambiente (nunca no codigo)
- [ ] Passwords hasheados (bcrypt)
- [ ] Auth verificado em endpoints protegidos
- [ ] CORS configurado (nao `*`)
- [ ] Nenhum PII em logs

---

## Quando Aplicar Este Skill

Ao criar aplicacoes Python (FastAPI, scripts, CLI tools, data pipelines). Para FastAPI, siga a secao FastAPI. Para Python geral, siga a secao geral. Complementa o `CLAUDE.md` do app afetado.

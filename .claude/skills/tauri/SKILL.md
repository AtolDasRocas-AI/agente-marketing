---
name: tauri
description: Use ao escrever, revisar ou refatorar aplicacoes Tauri (comandos Rust, IPC, bundling, permissions, frontend integration). Acione quando o usuario mencionar Tauri, src-tauri/, ou desktop apps com Rust+web.
---

# Tauri Desktop Skill

ReferÃªncia para implementar features desktop com Tauri v2.
**Leia este arquivo quando trabalhar em `src-tauri/` ou em componentes desktop React.**

---

## Arquitetura Tauri v2

### Conceitos Core

- **Webview:** A app React roda dentro de uma webview nativa (nÃ£o Chromium â€” usa a webview do OS)
- **Rust Backend:** LÃ³gica nativa vive em `src-tauri/src/`, compilada como binÃ¡rio Rust
- **IPC (Inter-Process Communication):** Frontend chama funÃ§Ãµes Rust via `invoke`, Rust emite eventos via `emit`
- **Capabilities:** Sistema declarativo de permissÃµes â€” frontend sÃ³ pode acessar o que for explicitamente permitido
- **Plugins:** Estendem o Tauri com APIs nativas (fs, shell, dialog, notification, etc.)

### Fluxo IPC

```
React (TypeScript)                    Tauri (Rust)
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€                     â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
invoke('cmd', {args})    â”€â”€IPCâ”€â”€â–º  #[tauri::command] fn cmd(args) -> Result<T, E>
                         â—„â”€â”€IPCâ”€â”€  Ok(result) / Err(message)

listen('event', handler) â—„â”€â”€IPCâ”€â”€  app.emit("event", payload)
```

---

## PadrÃµes Rust para Comandos Tauri

### Estrutura de Comando

```rust
use serde::Serialize;

#[derive(Serialize)]
pub struct MyResponse {
    pub field: String,
    pub count: u32,
}

#[tauri::command]
pub fn my_command(param: &str, optional: Option<u32>) -> Result<MyResponse, String> {
    // Validar input
    if param.is_empty() {
        return Err("param cannot be empty".to_string());
    }

    // LÃ³gica de negÃ³cio
    Ok(MyResponse {
        field: param.to_string(),
        count: optional.unwrap_or(0),
    })
}
```

### Regras

1. **Sempre retornar `Result<T, String>`** â€” nunca `unwrap()` ou `expect()` em cÃ³digo de produÃ§Ã£o
2. **Derivar `Serialize`** em todos os tipos de retorno â€” Tauri os serializa para JSON no IPC
3. **Usar `Option<T>`** para parÃ¢metros opcionais â€” mapeia para `undefined` em TypeScript
4. **Registrar todo comando** em `lib.rs` â†’ `invoke_handler` e `commands/mod.rs`
5. **Comandos async** usam keyword `async` â€” para I/O, acesso a arquivos, chamadas HTTP
6. **Mensagens de erro** devem ser amigÃ¡veis ao usuÃ¡rio ou mapeadas para cÃ³digos de erro

### Comandos Async

```rust
#[tauri::command]
pub async fn fetch_data(app: tauri::AppHandle, url: &str) -> Result<String, String> {
    let response = reqwest::get(url)
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    response.text()
        .await
        .map_err(|e| format!("Failed to read response: {}", e))
}
```

---

## Design de Capabilities

### PrincÃ­pio: Least Privilege

Conceder apenas as permissÃµes que a feature realmente precisa:

```json
{
  "identifier": "feature-x",
  "description": "PermissÃµes para feature X",
  "windows": ["main"],
  "permissions": [
    "core:default",
    {
      "identifier": "fs:allow-read-text-file",
      "allow": [{ "path": "$APPDATA/feature-x/**" }]
    }
  ]
}
```

### PadrÃµes de PermissÃ£o Comuns

| Necessidade | PermissÃ£o | Plugin |
|---|---|---|
| Abrir URL no browser | `shell:allow-open` | tauri-plugin-shell |
| Ler arquivos | `fs:allow-read-text-file` (scoped) | tauri-plugin-fs |
| Escrever arquivos | `fs:allow-write-text-file` (scoped) | tauri-plugin-fs |
| Dialog de arquivo | `dialog:default` | tauri-plugin-dialog |
| NotificaÃ§Ã£o do sistema | `notification:default` | tauri-plugin-notification |

### Nunca FaÃ§a

- Conceder `fs:default` (dÃ¡ acesso total de leitura/escrita)
- Usar `shell:allow-execute` sem justificativa forte
- Adicionar `unsafe-eval` ao CSP
- Conceder permissÃµes a janelas `*`

---

## PadrÃµes de IntegraÃ§Ã£o Frontend

### Rendering Condicional

```tsx
import { isTauri } from '@/lib/tauri';

const MyComponent = () => {
  return (
    <div>
      <SharedContent />
      {isTauri() && <DesktopOnlyFeature />}
    </div>
  );
};
```

### Lazy Loading de MÃ³dulos Desktop

```tsx
import { isTauri } from '@/lib/tauri';
import { lazy, Suspense } from 'react';

const DesktopDashboard = isTauri()
  ? lazy(() => import('@/features/desktop/components/desktop-dashboard'))
  : null;
```

### PadrÃ£o de Desktop Service

```typescript
// src/lib/tauri-commands.ts
import { invoke } from '@tauri-apps/api/core';

export const desktopService = {
  readConfig: () => invoke<Config>('read_config'),
  saveConfig: (config: Config) => invoke<void>('save_config', { config }),
};
```

---

## UX Desktop Guidelines

### DiÃ¡logos Nativos

Usar plugins Tauri para diÃ¡logos nativos do OS ao invÃ©s de modais estilo browser:

```typescript
import { open, save, message } from '@tauri-apps/plugin-dialog';

// Picker de arquivo
const selected = await open({
  filters: [{ name: 'JSON', extensions: ['json'] }],
});
```

### NotificaÃ§Ãµes do Sistema

```typescript
import { sendNotification } from '@tauri-apps/plugin-notification';

sendNotification({
  title: 'Tarefa ConcluÃ­da',
  body: 'Sua exportaÃ§Ã£o foi finalizada.',
});
```

---

## Armadilhas Comuns

1. **NÃ£o chamar APIs Tauri fora do guard `isTauri()`** â€” elas lanÃ§am exceÃ§Ã£o em browsers web
2. **NÃ£o armazenar segredos no frontend** â€” usar o backend Rust para operaÃ§Ãµes sensÃ­veis
3. **NÃ£o usar `unwrap()`** â€” panics crasham a app desktop sem mensagem de erro para o usuÃ¡rio
4. **NÃ£o esquecer de atualizar capabilities** â€” uso de novo plugin falha silenciosamente sem permissÃµes
5. **NÃ£o hardcodar caminhos** â€” usar APIs de path do Tauri (`$APPDATA`, `$RESOURCE`, etc.)

---

## Quando Aplicar Este Skill

O **Coder Subagent** deve ler este arquivo quando:

- Criar ou modificar comandos Rust em `src-tauri/src/commands/`
- Construir componentes React desktop-only
- Configurar capabilities em `src-tauri/capabilities/`
- Adicionar novos plugins Tauri
- Implementar IPC entre frontend e Rust

Este skill complementa o `CLAUDE.md` do repo (convenÃ§Ãµes de cÃ³digo e estrutura do projeto).
Este skill cobre **arquitetura Tauri v2, padrÃµes Rust, seguranÃ§a IPC e integraÃ§Ã£o desktop**.

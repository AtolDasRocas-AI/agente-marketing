# Ativação de acesso Google-only da ATOL

O código já limita a interface à conta `atoldasrocas.ai@gmail.com` e a migração cria a função de bloqueio de novos usuários.

## Ações no Supabase Auth

1. Em **Auth > Providers**, habilitar somente **Google** e desabilitar Email, telefone e demais provedores.
2. Informar o Client ID e o Client Secret OAuth do Google.
3. Em **Auth > Hook**, selecionar `public.hook_permitir_somente_google_atol` como **Before User Created Hook**.
4. Em **URL Configuration**, manter a URL de produção e permitir o retorno `https://app-one-fawn-32.vercel.app/**`.

O hook bloqueia a criação de qualquer usuário cujo e-mail não seja exatamente o institucional ou cujo provedor não seja Google. A documentação oficial do Supabase confirma que o Before User Created Hook rejeita a criação de usuários antes do registro ser inserido.

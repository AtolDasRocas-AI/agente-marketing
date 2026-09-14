import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const arquivos = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter((arquivo) => /^(app\/src|scripts|supabase)\//.test(arquivo))
  .filter((arquivo) => /\.(?:js|mjs|ts|tsx|json|sql)$/.test(arquivo));

const riscos = [
  { nome: 'URL PostgreSQL com usuário e senha', padrao: /postgres(?:ql)?:\/\/[^\s:/]+:[^\s@]+@/i },
  { nome: 'validação TLS desativada', padrao: /rejectUnauthorized\s*:\s*false/i },
  {
    nome: 'senha literal em código',
    padrao: /\b(?:password|senha|serviceRoleKey|service_role_key)\s*[:=]\s*['"][^'"]{8,}['"]/i,
  },
];

const encontrados = [];
for (const arquivo of arquivos) {
  const conteudo = readFileSync(arquivo, 'utf8');
  for (const risco of riscos) {
    if (risco.padrao.test(conteudo)) encontrados.push(`${arquivo}: ${risco.nome}`);
  }
}

assert.deepEqual(
  encontrados,
  [],
  `Possíveis segredos ou conexões inseguras em arquivos versionados:\n${encontrados.join('\n')}`,
);
console.log(`Segurança: ${arquivos.length} arquivos versionados verificados sem credenciais literais.`);

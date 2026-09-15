import pg from 'pg';

/** Cria uma conexão PostgreSQL sem manter credenciais no repositório. */
export function criarClienteBanco() {
  const connectionString = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'Defina SUPABASE_DB_URL com a connection string do Supabase antes de executar este script.',
    );
  }
  return new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: true },
  });
}

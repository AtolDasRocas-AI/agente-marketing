import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Achado da Onda 0: o Meta exige HTTPS na Redirect URI, até em localhost.
// O dev server usa o mesmo certificado self-signed do spike.
const certDir = resolve(import.meta.dirname, '../spike');
const temCert = existsSync(resolve(certDir, 'key.pem'));

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true, // a Redirect URI registrada no Meta é fixa em :5173
    https: temCert
      ? {
          key: readFileSync(resolve(certDir, 'key.pem')),
          cert: readFileSync(resolve(certDir, 'cert.pem')),
        }
      : undefined,
  },
});

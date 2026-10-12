import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { apiPlugin } from './server/plugin.mjs';
import { externalAccountFile } from './server/files.mjs';

export default defineConfig(({ mode }) => {
    const env = { ...loadEnv(mode, '.', ''), ...process.env }; 
    return {
      server: {
        port: 3012,
        strictPort: true,
        host: env.HOST || '127.0.0.1',
        fs: { deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/admin-auth.local', '**/*.local', '**/server/**'] },
      },
      preview: { host: env.HOST || '127.0.0.1', port: 3012, strictPort: true },
      plugins: [apiPlugin(externalAccountFile(env.ADMIN_AUTH_FILE, __dirname), env), react()],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});

import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { localAuthPlugin } from './server/auth.mjs';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3012,
        strictPort: true,
        host: '127.0.0.1',
        fs: { deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/admin-auth.local'] },
      },
      plugins: [localAuthPlugin(path.resolve(__dirname, 'admin-auth.local')), react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});

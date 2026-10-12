import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { apiPlugin } from './server/plugin.mjs';

export default defineConfig(({ mode }) => {
    const env = { ...loadEnv(mode, '.', ''), ...process.env }; 
    return {
      server: {
        port: 3012,
        strictPort: true,
        host: env.HOST || '127.0.0.1',
        fs: { deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/admin-auth.local'] },
      },
      preview: { host: env.HOST || '127.0.0.1', port: 3012, strictPort: true },
      plugins: [apiPlugin(path.resolve(__dirname, 'admin-auth.local'), env), react()],
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

import { createChatMiddleware } from './chat.mjs';
import { createOpenRouterProvider } from './providers/openrouter.mjs';
import { privateFiles } from './files.mjs';
import { securityHeaders } from './security.mjs';
import { createAuthMiddleware } from './auth.mjs';
import { createN8nProvider } from './providers/n8n.mjs';
import { createServicesMiddleware } from './services.mjs';
import { createN8nSecurity } from './n8n-security.mjs';
import { createAccountStore, createAccountMiddleware } from './accounts.mjs';
// One ordered middleware list shared by the Vite plugin (dev/preview) and the production server.
export function createApiMiddlewares(accountFile, env) {
 const shared=env.AUTH_SESSION_STORE==='n8n' ? createN8nSecurity(env) : null;
 const accounts=shared && env.ACCOUNT_STORE==='n8n' ? createAccountStore(shared.request) : null;
 const accountRoutes=createAccountMiddleware({accounts,limiter:shared?.limiter,env});
 const auth=createAuthMiddleware(accountFile, env, shared ? {sessionStore:shared.sessions,limiter:shared.limiter,...(accounts?{accounts}:{})} : {});
 const provider=createN8nProvider(env);
 const services=createServicesMiddleware({getUser:auth.getUser,provider});
 const chat=createChatMiddleware({getUser:auth.getUser,provider:createOpenRouterProvider(env),services:provider});
 return [securityHeaders(env), privateFiles, accountRoutes, auth, services, chat];
}
export function apiPlugin(accountFile, env) {
 const install=server=>{ for(const middleware of createApiMiddlewares(accountFile, env)) server.middlewares.use(middleware); };
 return {name:'drivepilot-api',configureServer:install,configurePreviewServer:install};
}

import { createChatMiddleware } from './chat.mjs';
import { createOpenRouterProvider } from './providers/openrouter.mjs';
import { privateFiles } from './files.mjs';
import { securityHeaders } from './security.mjs';
import { createAuthMiddleware } from './auth.mjs';
import { createN8nProvider } from './providers/n8n.mjs';
import { createServicesMiddleware } from './services.mjs';
export function apiPlugin(accountFile, env) {
 const auth=createAuthMiddleware(accountFile, env);
 const provider=createN8nProvider(env);
 const services=createServicesMiddleware({getUser:auth.getUser,provider});
 const chat=createChatMiddleware({getUser:auth.getUser,provider:createOpenRouterProvider(env),services:provider});
 const install=server=>{ server.middlewares.use(securityHeaders(env)); server.middlewares.use(privateFiles); server.middlewares.use(auth); server.middlewares.use(services); server.middlewares.use(chat); };
 return {name:'drivepilot-api',configureServer:install,configurePreviewServer:install};
}

import { privateFiles } from './files.mjs';
import { securityHeaders } from './security.mjs';
import { createAuthMiddleware } from './auth.mjs';
import { createN8nProvider } from './providers/n8n.mjs';
import { createServicesMiddleware } from './services.mjs';
export function apiPlugin(accountFile, env) {
 const auth=createAuthMiddleware(accountFile, env);
 const services=createServicesMiddleware({getUser:auth.getUser,provider:createN8nProvider(env)});
 const install=server=>{ server.middlewares.use(securityHeaders(env)); server.middlewares.use(privateFiles); server.middlewares.use(auth); server.middlewares.use(services); };
 return {name:'drivepilot-api',configureServer:install,configurePreviewServer:install};
}

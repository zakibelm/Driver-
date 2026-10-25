import { createChatMiddleware } from './chat.mjs';
import { createOpenRouterProvider } from './providers/openrouter.mjs';
import { privateFiles } from './files.mjs';
import { securityHeaders } from './security.mjs';
import { createAuthMiddleware } from './auth.mjs';
import { createN8nProvider } from './providers/n8n.mjs';
import { createServicesMiddleware } from './services.mjs';
import { createServiceTypesMiddleware } from './service-types.mjs';
import { createRegistrationMiddleware } from './registration.mjs';
import { createFileAccountStore } from './accounts.mjs';
import { createMailer } from './mailer.mjs';
// One ordered middleware list shared by the Vite plugin (dev/preview) and the production server.
export function createApiMiddlewares(accountFile, env, accountsFile) {
 const store=accountsFile ? createFileAccountStore(accountsFile) : undefined;
 const auth=createAuthMiddleware(accountFile, env, {store});
 const registration=store ? createRegistrationMiddleware({store,mailer:createMailer(env),auth,env}) : (req,res,next)=>next();
 const provider=createN8nProvider(env);
 const services=createServicesMiddleware({getUser:auth.getUser,provider});
 const serviceTypes=createServiceTypesMiddleware({getUser:auth.getUser,provider});
 const chat=createChatMiddleware({getUser:auth.getUser,provider:createOpenRouterProvider(env),services:provider});
 return [securityHeaders(env), privateFiles, registration, auth, services, serviceTypes, chat];
}
export function apiPlugin(accountFile, env, accountsFile) {
 const install=server=>{ for(const middleware of createApiMiddlewares(accountFile, env, accountsFile)) server.middlewares.use(middleware); };
 return {name:'drivepilot-api',configureServer:install,configurePreviewServer:install};
}

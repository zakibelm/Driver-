import path from 'node:path';
import { realpathSync } from 'node:fs';
export function externalAccountFile(file, root) {
 if(!file || !path.isAbsolute(file)) return undefined;
 // Resolve symlinks without reading account contents; reject every served path.
 let target;
 try { target=realpathSync(file); } catch { return undefined; }
 const relative=path.relative(realpathSync(root),target);
 if(!relative || (!relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))) return undefined;
 return target;
}
export function privateFiles(req,res,next) {
 let url=req.url || '';
 try { for(let i=0;i<3;i++) url=decodeURIComponent(url); } catch { res.statusCode=400;return res.end(); }
 const normalized=url.replaceAll('\\','/').toLowerCase();
 // Precede Vite so sensitive filenames are rejected without any disk read.
 if(/(?:^|\/)(?:admin-auth\.local|\.env[^/]*|\.git|server)(?:[/?#;:.\\]|$)/.test(normalized)
    || normalized.includes('admin-auth.local') || /(?:^|\/)[^/?]+\.local(?:[?/#]|$)/.test(normalized)) {
  res.statusCode=403; return res.end('Forbidden');
 }
 next();
}

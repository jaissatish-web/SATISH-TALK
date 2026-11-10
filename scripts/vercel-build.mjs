import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const cli=fileURLToPath(new URL('../node_modules/convex/bin/main.js',import.meta.url));
function run(command,args){const result=spawnSync(command,args,{stdio:'inherit',env:process.env});if(result.status!==0)process.exit(result.status??1);}
if(process.env.VERCEL_ENV==='production') {
  if(!process.env.CONVEX_DEPLOY_KEY||!process.env.SATISH_EXPECTED_CONVEX_URL){console.error('Satish Talk production deploy configuration is incomplete.');process.exit(1);}
  // Convex injects its actual target URL into the pre-push command. The guard
  // refuses a wrong key before secret initialization, build or backend push.
  run(process.execPath,[cli,'deploy','--cmd','node scripts/production-channel.mjs && npm run build','--cmd-url-env-var-name','VITE_CONVEX_URL']);
} else run('npm',['run','build']);

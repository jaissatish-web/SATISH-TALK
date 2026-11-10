import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export function prepareChannel({actualUrl, expectedUrl, listNames, saveMissing, random = () => randomBytes(32).toString('base64url'), log = console.log}) {
  if (!expectedUrl || actualUrl !== expectedUrl) throw new Error('Production backend mismatch. No channel secrets changed.');
  const existing = new Set(listNames().split(/\r?\n/).map(s=>s.trim()));
  const names = ['ROOM_TOKEN','ACCESS_CODE','OWNER_TOKEN'];
  const missing = Object.fromEntries(names.filter(name=>!existing.has(name)).map(name=>[name,random()]));
  if (Object.keys(missing).length) saveMissing(missing);
  log(`Private channel configured; ${Object.keys(missing).length} missing credentials initialized. Existing credentials preserved.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fileURLToPath(new URL(`file://${process.argv[1]}`))) {
  const cli = fileURLToPath(new URL('../node_modules/convex/bin/main.js', import.meta.url));
  const run = args => execFileSync(process.execPath,[cli,'env',...args],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:120000});
  try {
    prepareChannel({actualUrl:process.env.VITE_CONVEX_URL,expectedUrl:process.env.SATISH_EXPECTED_CONVEX_URL,
      listNames:()=>run(['list','--names-only']),
      saveMissing:values=>{
        const dir=mkdtempSync(join(tmpdir(),'satish-channel-'));
        try {const path=join(dir,'private.env');writeFileSync(path,Object.entries(values).map(([k,v])=>`${k}=${v}`).join('\n'),{mode:0o600});run(['set','--from-file',path]);}
        finally {rmSync(dir,{recursive:true,force:true});}
      }});
  } catch {console.error('Private channel initialization failed. Check production deployment and deploy-key permissions. No credential values are logged.');process.exit(1);}
}

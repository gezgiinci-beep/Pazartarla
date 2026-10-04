import {readFile,readdir} from 'node:fs/promises';
import {digest,additiveStatements} from './safety/migration-policy.mjs';
try {
  const root=new URL('../supabase/',import.meta.url);
  const baseline=JSON.parse(await readFile(new URL('migration-baseline.json',root),'utf8'));
  const files=(await readdir(new URL('migrations/',root))).filter(n=>n.endsWith('.sql'));
  for(const [name,hash] of Object.entries(baseline))
    if(!files.includes(name)||digest(await readFile(new URL('migrations/'+name,root)))!==hash)
      throw Error('Historical migration changed/missing: '+name+'. Append a reviewed migration; never rewrite history.');
  for(const name of files.filter(n=>!Object.hasOwn(baseline,n)))
    additiveStatements(await readFile(new URL('migrations/'+name,root),'utf8'));
  console.log('Migration safety passed: historical SQL unchanged; new SQL passes fail-closed additive policy.');
}catch(e){console.error('MIGRATION SAFETY FAILED:',e.message);process.exitCode=1;}
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,mkdir,chmod,realpath,writeFile,rm,stat,open} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,relative,join} from 'node:path';
import {createHash} from 'node:crypto';
import {databaseTarget,PRODUCTION_REF} from './database-target.mjs';
import {backupPublicKey,encryptFile} from './encryption.mjs';
const exec=promisify(execFile);
const root=resolve(new URL('../../',import.meta.url).pathname);
async function run(command,args,options={}) {
  try{return await exec(command,args,{cwd:root,timeout:180000,maxBuffer:32*1024*1024,...options});}
  catch{throw Error(`${command} failed. Check tool version, TLS, permissions and private operator diagnostics; credentials/data are not logged.`);}
}
export function pgEnvironment(url,ca,env=process.env) {
  if(!ca)throw Error('Database CA file is required for verified TLS.');
  // Clear inherited libpq options, service and password-file overrides.
  const clean=Object.fromEntries(Object.entries(env).filter(([k])=>!k.startsWith('PG')));
  return {...clean,PGHOST:url.hostname,PGPORT:url.port||'5432',PGDATABASE:decodeURIComponent(url.pathname.slice(1)||'postgres'),
    PGUSER:decodeURIComponent(url.username),PGPASSWORD:decodeURIComponent(url.password),
    PGSSLMODE:'verify-full',PGSSLROOTCERT:resolve(ca),PGCONNECT_TIMEOUT:'15',PGAPPNAME:'pazartarla-readonly-backup',
    PGOPTIONS:'-c default_transaction_read_only=on -c statement_timeout=180000'};
}
async function hashFile(path) {
  const h=createHash('sha256');for await(const chunk of createReadStream(path))h.update(chunk);return h.digest('hex');
}
export async function createBackup(env=process.env) {
  const url=databaseTarget(env.SUPABASE_DATABASE_URL,PRODUCTION_REF);
  const key=backupPublicKey(env.PAZARTARLA_BACKUP_PUBLIC_KEY);
  const pgEnv=pgEnvironment(url,env.SUPABASE_DATABASE_CA_FILE,env);
  const git=(args,options={})=>run('git',args,{env,...options});
  await stat(pgEnv.PGSSLROOTCERT);
  const repo=(await git(['rev-parse','--show-toplevel'])).stdout.trim();
  const prefix=(await git(['rev-parse','--show-prefix'])).stdout.trim().replace(/\/$/,'');
  const sha=(await git(['rev-parse','HEAD'])).stdout.trim();
  if((await git(['status','--porcelain','--','.'])).stdout.trim())
    throw Error('Commit/review site changes first; code backup refuses a dirty checkout.');
  if(!env.PAZARTARLA_BACKUP_DIRECTORY)throw Error('Off-repository backup directory is required.');
  const destination=resolve(env.PAZARTARLA_BACKUP_DIRECTORY),rel=relative(repo,destination);
  if(!rel.startsWith('..')&&!rel.startsWith('/'))throw Error('Backups cannot be stored inside the code repository.');
  const names=(await git(['ls-tree','-r','--name-only',prefix?`${sha}:${prefix}`:sha])).stdout.split(/\r?\n/);
  if(names.some(n=>/(^|\/)\.env(?:$|\.)|\.(?:dump|pem|pzb)$/i.test(n)))
    throw Error('Sensitive/backup file found in committed code. Review before export.');
  await mkdir(destination,{recursive:true,mode:0o700});
  const physical=relative(await realpath(repo),await realpath(destination));
  if(!physical.startsWith('..')&&!physical.startsWith('/'))throw Error('Backup directory symlink points into the repository.');
  const dir=await mkdtemp(join(destination,'backup-'));await chmod(dir,0o700);
  const temp=await mkdtemp(join(tmpdir(),'pazartarla-private-backup-'));await chmod(temp,0o700);
  try {
    const dump=join(temp,'database.dump'),code=join(temp,'code.tar');
    const fd=await open(dump,'wx',0o600);
    try {
      await new Promise((accept,reject)=>{
        const child=spawn('pg_dump',['--format=custom','--no-owner'],{env:pgEnv,stdio:['ignore',fd.fd,'ignore']});
        const timer=setTimeout(()=>child.kill('SIGTERM'),180000);
        child.on('error',()=>{clearTimeout(timer);reject(Error('pg_dump unavailable.'));});
        child.on('close',status=>{clearTimeout(timer);status===0?accept():reject(Error('pg_dump failed; no successful backup recorded. Check client/server version, verified TLS and access.'));});
      });
    }finally{await fd.close();}
    const check=await open(dump);const magic=Buffer.alloc(5);
    try{await check.read(magic,0,5,0);}finally{await check.close();}
    if(magic.toString()!=='PGDMP')throw Error('Backup is not a PostgreSQL custom archive.');
    const toc=(await run('pg_restore',['--list',dump],{env:pgEnv})).stdout;
    for(const required of ['public listings','auth users','private depot_contacts'])
      if(!toc.includes('TABLE DATA '+required+' '))throw Error('Backup lacks required listing/user/contact data.');
    const tar=(await git(['archive','--format=tar',prefix?`${sha}:${prefix}`:sha],{encoding:'buffer'})).stdout;
    await writeFile(code,tar,{flag:'wx',mode:0o600});
    await encryptFile(dump,join(dir,'database.dump.pzb'),key);
    await encryptFile(code,join(dir,'code.tar.pzb'),key);
    const receipt={format:1,project:PRODUCTION_REF,codeCommit:sha,createdAt:new Date().toISOString(),
      archiveReadable:true,restoreDrillVerified:false,storageObjectBytesIncluded:false,
      files:{database:await hashFile(join(dir,'database.dump.pzb')),code:await hashFile(join(dir,'code.tar.pzb'))}};
    await writeFile(join(dir,'receipt.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx',mode:0o600});
    return {dir,receipt};
  }catch(e){await rm(dir,{recursive:true,force:true});throw e;}
  finally{await rm(temp,{recursive:true,force:true});}
}
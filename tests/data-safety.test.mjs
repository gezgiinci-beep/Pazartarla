import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import {mkdtemp,writeFile,readFile,rm,readdir,symlink,chmod} from 'node:fs/promises';
import {readFileSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,basename,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {testTarget,PRODUCTION_REF,assertTestEnvironment} from '../scripts/safety/database-target.mjs';
import {additiveStatements} from '../scripts/safety/migration-policy.mjs';
import {encryptFile,backupPublicKey} from '../scripts/safety/encryption.mjs';
import {decryptBackup} from '../scripts/decrypt-backup.mjs';
import {createBackup,pgEnvironment} from '../scripts/safety/backup.mjs';
import {verifyProtectedData} from '../scripts/safety/preservation.mjs';
const stage='abcdefghijklmnopqrst';
const url=ref=>`postgresql://postgres:FAKE_TEST_PASSWORD@db.${ref}.supabase.co/postgres`;
test('test targets fail closed: missing, live, wrong project, pooler disguise, apply/reset',()=>{
  for(const env of [{SUPABASE_DATABASE_URL:url(PRODUCTION_REF)},
    {PAZARTARLA_TEST_PROJECT_REF:PRODUCTION_REF,PAZARTARLA_TEST_DATABASE_URL:url(PRODUCTION_REF)},
    {PAZARTARLA_TEST_PROJECT_REF:stage,PAZARTARLA_TEST_DATABASE_URL:url(PRODUCTION_REF)},
    {PAZARTARLA_TEST_PROJECT_REF:stage,PAZARTARLA_TEST_DATABASE_URL:`postgresql://postgres.${PRODUCTION_REF}:fake@aws-0.example.pooler.supabase.com/postgres`}])
    assert.throws(()=>testTarget(env,[]));
  const env={PAZARTARLA_TEST_PROJECT_REF:stage,PAZARTARLA_TEST_DATABASE_URL:url(stage)};
  assert.equal(testTarget(env,[]).hostname,`db.${stage}.supabase.co`);
  for(const flag of ['--apply','--reset','--seed'])assert.throws(()=>testTarget(env,[flag]));
});
test('test database must have explicit test sentinel before fixtures',async()=>{
  await assertTestEnvironment({query:async()=>({rowCount:1,rows:[{environment:'test'}]})});
  for(const environment of ['production','staging',undefined])
    await assert.rejects(()=>assertTestEnvironment({query:async()=>({rowCount:1,rows:[{environment}]})}));
});
test('all legacy DB tests use isolated config+marker; cannot reuse production secret or apply',()=>{
  const dir=new URL('../scripts/',import.meta.url);
  for(const file of readdirSync(dir).filter(n=>/^check-.*-database\.mjs$/.test(n))) {
    const source=readFileSync(new URL(file,dir),'utf8');
    assert.match(source,/new pg.Client\(testDatabaseConfig\(\)\)/);
    assert.match(source,/await assertTestEnvironment\(/);
    assert.doesNotMatch(source,/SUPABASE_DATABASE_URL|--apply/);
  }
});
test('nullable columns/simple tables/indexes allowed; destructive/opaque SQL refused',()=>{
  assert.equal(additiveStatements("BEGIN; -- safe\nALTER TABLE public.listings ADD COLUMN IF NOT EXISTS new_note text; CREATE TABLE IF NOT EXISTS private.new_config (id uuid PRIMARY KEY, description text); COMMIT;").length,2);
  assert.equal(additiveStatements('CREATE INDEX IF NOT EXISTS new_email ON private.depot_contacts (email);').length,1);
  for(const s of [
    'DROP TABLE public.listings;','TRUNCATE public.listings;','DELETE FROM auth.users;','UPDATE public.listings SET title=NULL;',
    'ALTER TABLE public.listings DROP COLUMN title;','ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS x text DEFAULT wipe_data();',
    'CREATE TABLE IF NOT EXISTS private.copy AS SELECT wipe_data();',
    'DO $$ BEGIN DELETE FROM auth.users; END $$;','SELECT dangerous_function();',
    'COPY auth.users FROM STDIN;','COMMIT; ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS x text;',
    'CREATE INDEX IF NOT EXISTS x ON public.listings (dangerous_function(title));',
    'ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS x malicious_type;',
  ])assert.throws(()=>additiveStatements(s));
});
test('record disappearance or changed old fields blocks commit',async()=>{
  const list=[{query:'SAFE SYNTHETIC PROJECTION',before:{count:'1',hash:'old'}}];
  await verifyProtectedData({query:async()=>({rows:[{count:'1',hash:'old'}]})},list);
  for(const row of [{count:'0',hash:'old'},{count:'1',hash:'changed'}])
    await assert.rejects(()=>verifyProtectedData({query:async()=>({rows:[row]})},list));
});
const keys=generateKeyPairSync('rsa',{modulusLength:3072});
const pem=keys.publicKey.export({type:'spki',format:'pem'});
const privatePem=keys.privateKey.export({type:'pkcs8',format:'pem'});
test('encrypted archives roundtrip offline; wrong/tampered data cannot produce verified output',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'safety-unit-'));
  try {
    const input=join(dir,'fake'),encrypted=join(dir,'fake.pzb'),out=join(dir,'out');
    await writeFile(input,'ONLY SYNTHETIC TEST DATA',{mode:0o600});
    await encryptFile(input,encrypted,backupPublicKey(pem));
    await decryptBackup(encrypted,out,privatePem);
    assert.equal(await readFile(out,'utf8'),'ONLY SYNTHETIC TEST DATA');
    await assert.rejects(()=>decryptBackup(encrypted,out,privatePem));
    const wrong=generateKeyPairSync('rsa',{modulusLength:2048}).privateKey.export({type:'pkcs8',format:'pem'});
    await assert.rejects(()=>decryptBackup(encrypted,join(dir,'wrong'),wrong));
    const tampered=await readFile(encrypted);tampered[tampered.length-1]^=1;await writeFile(encrypted,tampered);
    await assert.rejects(()=>decryptBackup(encrypted,join(dir,'bad'),privatePem));
    assert.equal((await readdir(dir)).includes('bad'),false);
  }finally{await rm(dir,{recursive:true,force:true});}
});
test('backup credentials use verified TLS/read-only settings, not URL/query/argv overrides',()=>{
  const u=new URL(url(PRODUCTION_REF));u.search='?sslmode=disable&options=evil';
  const e=pgEnvironment(u,'/tmp/public-ca',{PGSSLMODE:'disable',PGSERVICE:'evil',PGPASSFILE:'/unsafe'});
  assert.equal(e.PGSSLMODE,'verify-full');assert.match(e.PGOPTIONS,/read_only=on/);
  assert.equal(e.PGSERVICE,undefined);assert.equal(e.PGPASSFILE,undefined);
});
test('backup process completion checks archive coverage; failed export leaves no successful artifact',async()=>{
    const dir=await mkdtemp(join(tmpdir(),'backup-unit-'));
  try {
    const bin=join(dir,'bin');const {mkdir}=await import('node:fs/promises');await mkdir(bin);
    const fixture=join(bin,'fake.mjs');
    await writeFile(fixture,`#!${process.execPath}
import{basename}from'node:path';
const cmd=basename(process.argv[1]),args=process.argv.slice(2);
if(cmd==='git'){
 if(args[0]==='rev-parse')console.log(args[1]==='--show-toplevel'?${JSON.stringify(resolve(new URL('../',import.meta.url).pathname))}:args[1]==='--show-prefix'?'':'a'.repeat(40));
 else if(args[0]==='status'){}
 else if(args[0]==='ls-tree')console.log('src/App.tsx');
 else if(args[0]==='archive')process.stdout.write('SYNTHETIC CODE TAR');
 else process.exit(99);
}else if(cmd==='pg_dump'){
 if(process.env.PGSSLMODE!=='verify-full'||!process.env.PGOPTIONS.includes('read_only=on'))process.exit(98);
 process.stdout.write('PGDMP SYNTHETIC ONLY');
}else if(cmd==='pg_restore'){
 if(process.env.FAKE_MISSING==='1')console.log('NO USER TABLE');
 else console.log('TABLE DATA public listings owner\\nTABLE DATA auth users owner\\nTABLE DATA private depot_contacts owner');
}else process.exit(97);
`,{mode:0o700});
    for(const name of ['git','pg_dump','pg_restore'])await symlink(fixture,join(bin,name));
    const ca=join(dir,'ca');await writeFile(ca,'SYNTHETIC CA');
    const env={PATH:bin,SUPABASE_DATABASE_URL:url(PRODUCTION_REF),SUPABASE_DATABASE_CA_FILE:ca,
      PAZARTARLA_BACKUP_PUBLIC_KEY:pem,PAZARTARLA_BACKUP_DIRECTORY:join(dir,'archive')};
    const ok=await createBackup(env);
    assert.equal(ok.receipt.archiveReadable,true);assert.equal(ok.receipt.storageObjectBytesIncluded,false);
    assert.deepEqual((await readdir(ok.dir)).sort(),['code.tar.pzb','database.dump.pzb','receipt.json']);
    await assert.rejects(()=>createBackup({...env,FAKE_MISSING:'1'}),/required/);
    assert.equal((await readdir(env.PAZARTARLA_BACKUP_DIRECTORY)).length,1);
    await assert.rejects(()=>createBackup({...env,PAZARTARLA_BACKUP_PUBLIC_KEY:''}),/PUBLIC/);
  }finally{await rm(dir,{recursive:true,force:true});}
});
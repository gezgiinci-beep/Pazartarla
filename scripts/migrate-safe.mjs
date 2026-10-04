import {readFile} from 'node:fs/promises';
import {rootCertificates} from 'node:tls';
import pg from 'pg';
import {databaseTarget,PRODUCTION_REF} from './safety/database-target.mjs';
import {digest,additiveStatements} from './safety/migration-policy.mjs';
import {createBackup} from './safety/backup.mjs';
import {captureProtectedData,verifyProtectedData} from './safety/preservation.mjs';
let client;
try {
  const file=process.argv[2];
  if(!/^\d{8}_[a-z0-9_]+\.sql$/.test(file||''))throw Error('Pass one new migration basename, not a path.');
  const root=new URL('../supabase/',import.meta.url);
  const baseline=JSON.parse(await readFile(new URL('migration-baseline.json',root),'utf8'));
  if(Object.hasOwn(baseline,file))throw Error('Historical migrations cannot be replayed in production.');
  const sql=await readFile(new URL('migrations/'+file,root),'utf8');
  const queries=additiveStatements(sql),hash=digest(sql);
  if(process.env.PAZARTARLA_CHANGE_APPROVAL!==`production:${PRODUCTION_REF}:${hash}`)
    throw Error('Explicit reviewed project+migration-hash approval is required.');
  const url=databaseTarget(process.env.SUPABASE_DATABASE_URL,PRODUCTION_REF);
  const ca=process.env.SUPABASE_DATABASE_CA_FILE;
  if(!ca)throw Error('Verified database CA file required.');
  // Always create a fresh verified/encrypted code+DB backup, never trust a
  // caller-written receipt or an old successful scheduled run as a bypass.
  const backup=await createBackup();
  client=new pg.Client({connectionString:url.toString(),connectionTimeoutMillis:15000,
    ssl:{ca:[...rootCertificates,await readFile(ca,'utf8')],rejectUnauthorized:true}});
  await client.connect();await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
  await client.query("SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s'; SET LOCAL timezone='UTC'");
  await client.query('SELECT pg_advisory_xact_lock(713,715)');
  await client.query(`CREATE TABLE IF NOT EXISTS private.safety_migrations(
    filename text PRIMARY KEY,sha256 text NOT NULL,code_commit text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())`);
  await client.query('ALTER TABLE private.safety_migrations ENABLE ROW LEVEL SECURITY; REVOKE ALL ON private.safety_migrations FROM PUBLIC,anon,authenticated');
  const old=(await client.query('SELECT sha256 FROM private.safety_migrations WHERE filename=$1',[file])).rows[0];
  if(old)throw Error(old.sha256===hash?'Migration already applied; no replay.':'Applied migration checksum changed.');
  const before=await captureProtectedData(client);
  for(const query of queries) {
    await client.query(query);
    const created=query.match(/^CREATE TABLE IF NOT EXISTS ((public|private)\.[a-z_][a-z0-9_]*) /i);
    if(created&&!before.some(t=>t.schema+'.'+t.name===created[1].toLowerCase())) {
      await client.query(`ALTER TABLE ${created[1]} ENABLE ROW LEVEL SECURITY`);
      await client.query(`REVOKE ALL ON ${created[1]} FROM PUBLIC,anon,authenticated`);
    }
  }
  await verifyProtectedData(client,before);
  await client.query('INSERT INTO private.safety_migrations(filename,sha256,code_commit) VALUES($1,$2,$3)',[file,hash,backup.receipt.codeCommit]);
  await client.query("NOTIFY pgrst,'reload schema'");
  await client.query('COMMIT');
  console.log('Migration committed; protected original fields/counts unchanged. Fresh encrypted backup retained.');
}catch(e){
  if(client)await client.query('ROLLBACK').catch(()=>{});
  console.error('MIGRATION STOPPED:',e.code||e.message);process.exitCode=1;
}finally{if(client)await client.end();}
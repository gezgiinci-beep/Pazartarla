// Entirely disposable PostgreSQL cluster. No Supabase or existing DB connection.
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import pg from 'pg';
import {captureProtectedData,verifyProtectedData} from './safety/preservation.mjs';
const exec=promisify(execFile),dir=await mkdtemp(join(tmpdir(),'pazartarla-isolated-pg-'));
const env={PATH:process.env.PATH,HOME:dir,LANG:'C'};
let running=false,client;
try {
  await exec('initdb',['-D',join(dir,'data'),'-U','safety_test','-A','trust','--no-locale','--encoding=UTF8'],{env});
  await exec('pg_ctl',['-D',join(dir,'data'),'-l',join(dir,'log'),'-o',`-c listen_addresses='' -c unix_socket_directories='${dir}' -p 63379`,'-w','start'],{env});
  running=true;
  client=new pg.Client({host:dir,port:63379,user:'safety_test',database:'postgres',ssl:false});await client.connect();
  await client.query(`CREATE SCHEMA auth; CREATE SCHEMA private;
    CREATE TABLE public.listings(id int PRIMARY KEY,title text);
    CREATE TABLE auth.users(id int PRIMARY KEY,email text);
    CREATE TABLE private.depot_contacts(id int PRIMARY KEY,name text);
    INSERT INTO public.listings VALUES(1,'Synthetic listing');
    INSERT INTO auth.users VALUES(1,'synthetic@example.invalid');
    INSERT INTO private.depot_contacts VALUES(1,'Synthetic contact')`);
  await client.query('BEGIN');
  const before=await captureProtectedData(client);
  await client.query('ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS note text');
  await verifyProtectedData(client,before);await client.query('COMMIT');
  for(const query of ['DELETE FROM public.listings','UPDATE auth.users SET email=\'changed@example.invalid\'','TRUNCATE private.depot_contacts']) {
    await client.query('BEGIN');
    const original=await captureProtectedData(client);
    await client.query(query);await assert.rejects(()=>verifyProtectedData(client,original),/Protected data/);
    await client.query('ROLLBACK');
  }
  assert.equal((await client.query('SELECT count(*)::int n FROM public.listings')).rows[0].n,1);
  assert.equal((await client.query('SELECT email FROM auth.users')).rows[0].email,'synthetic@example.invalid');
  assert.equal((await client.query('SELECT count(*)::int n FROM private.depot_contacts')).rows[0].n,1);
  console.log('Disposable PostgreSQL verified: nullable addition preserves records; deletion, user mutation and contact truncation detected/rolled back. No live data connected.');
}catch(e){console.error('Isolated preservation check failed:',e.code||e.name);process.exitCode=1;}
finally {
  if(client){await client.query('ROLLBACK').catch(()=>{});await client.end();}
  if(running)await exec('pg_ctl',['-D',join(dir,'data'),'-m','fast','-w','stop'],{env}).catch(()=>{});
  await rm(dir,{recursive:true,force:true});
}
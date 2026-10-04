import {readFileSync} from 'node:fs';
import {rootCertificates} from 'node:tls';
export const PRODUCTION_REF='srbarfjzsfkmglsnmbtw';
export function databaseTarget(value,ref) {
  if(!/^[a-z0-9]{20}$/.test(ref||''))throw Error('Expected Supabase project reference is missing.');
  let url;try{url=new URL(value);}catch{throw Error('Database URL is missing or invalid.');}
  const user=decodeURIComponent(url.username);
  if(!['postgres:','postgresql:'].includes(url.protocol)||!url.password||
    !(url.hostname===`db.${ref}.supabase.co`||
      (url.hostname.endsWith('.pooler.supabase.com')&&user.endsWith('.'+ref))))
    throw Error('Database target does not match the explicitly selected project.');
  // Never allow URL parameters to override TLS or connection/session options.
  url.search='';
  return url;
}
export function testTarget(env=process.env,args=process.argv) {
  if(args.includes('--apply')||args.includes('--reset')||args.includes('--seed'))
    throw Error('Database tests cannot apply/reset/seed. Use the reviewed migration process.');
  const ref=env.PAZARTARLA_TEST_PROJECT_REF;
  if(ref===PRODUCTION_REF)throw Error('Live database is locked against test fixtures.');
  return databaseTarget(env.PAZARTARLA_TEST_DATABASE_URL,ref);
}
export function testDatabaseConfig() {
  const url=testTarget();
  const ca=process.env.PAZARTARLA_TEST_DATABASE_CA_FILE;
  if(!ca)throw Error('Test database CA file is required.');
  return {connectionString:url.toString(),connectionTimeoutMillis:12000,
    ssl:{ca:[...rootCertificates,readFileSync(ca,'utf8')],rejectUnauthorized:true}};
}
export async function assertTestEnvironment(client) {
  const result=await client.query("SELECT environment FROM private.environment_guard WHERE singleton=true");
  if(result.rowCount!==1||result.rows[0].environment!=='test')
    throw Error('Database is not explicitly marked as an isolated test environment.');
}
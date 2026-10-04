const quote=s=>'"'+s.replaceAll('"','""')+'"';
export async function captureProtectedData(client) {
  const list=(await client.query(`
    SELECT n.nspname schema,c.relname name,array_agg(a.attname::text ORDER BY a.attnum) columns
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
    WHERE c.relkind IN ('r','p') AND (
      n.nspname IN ('public','private') OR
      (n.nspname='auth' AND c.relname IN ('users','identities')) OR
      (n.nspname='storage' AND c.relname IN ('objects','buckets')))
    GROUP BY n.nspname,c.relname ORDER BY n.nspname,c.relname
  `)).rows;
  for(const required of ['public.listings','auth.users','private.depot_contacts'])
    if(!list.some(t=>t.schema+'.'+t.name===required))throw Error('Protected core table missing.');
  for(const t of list) {
    t.table=quote(t.schema)+'.'+quote(t.name);
    await client.query(`LOCK TABLE ${t.table} IN SHARE MODE`);
    t.query=`SELECT count(*)::text count,encode(sha256(convert_to(coalesce(
      string_agg(to_jsonb(r)::text,E'\\n' ORDER BY to_jsonb(r)::text COLLATE "C"),''),'UTF8')),'hex') hash
      FROM (SELECT ${t.columns.map(quote).join(',')} FROM ${t.table}) r`;
    t.before=(await client.query(t.query)).rows[0];
  }
  return list;
}
export async function verifyProtectedData(client,list) {
  for(const t of list) {
    const after=(await client.query(t.query)).rows[0];
    if(after.count!==t.before.count||after.hash!==t.before.hash)
      throw Error('Protected data changed: transaction must roll back.');
  }
}
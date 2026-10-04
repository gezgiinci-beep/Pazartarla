import {createHash} from 'node:crypto';
export const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
// Conservative allowlist, not a general-purpose SQL parser. Unknown syntax is
// refused, never guessed safe. Function/trigger/data migrations need review.
export function statements(sql) {
  if(sql.length>100000)throw Error('Migration is too large for automatic review.');
  let clean='',quoted=false,comment=0;
  for(let i=0;i<sql.length;i++){
    const a=sql[i],b=sql[i+1];
    if(comment){if(a==='/'&&b==='*'){comment++;i++;}else if(a==='*'&&b==='/'){comment--;i++;}continue;}
    if(!quoted&&a==='-'&&b==='-'){while(i<sql.length&&sql[i]!=='\n')i++;clean+=' ';continue;}
    if(!quoted&&a==='/'&&b==='*'){comment++;i++;clean+=' ';continue;}
    if(a==="'"){if(quoted&&b==="'"){clean+="''";i++;continue;}quoted=!quoted;}
    if(!quoted&&(a==='$'||a==='\\'||a==='"'))throw Error('Advanced SQL requires separate reviewed maintenance.');
    clean+=a;
  }
  if(quoted||comment)throw Error('Unterminated migration string/comment.');
  // Only timeout literals may contain strings; no quoted semicolons supported.
  return clean.split(';').map(s=>s.trim().replace(/\s+/g,' ')).filter(Boolean);
}
const identifier='[a-z_][a-z0-9_]*';
const table=`(?:public|private)\\.${identifier}`;
const type='(?:integer|bigint|smallint|text|boolean|uuid|jsonb|date|timestamptz|numeric(?:\\(\\d{1,2}(?:,\\d{1,2})?\\))?)';
export function additiveStatements(sql) {
  let list=statements(sql);
  if(list[0]?.toUpperCase()==='BEGIN'&&list.at(-1)?.toUpperCase()==='COMMIT')list=list.slice(1,-1);
  if(!list.length)throw Error('Empty migration.');
  const patterns=[
    new RegExp(`^ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${identifier} ${type}$`,'i'),
    new RegExp(`^CREATE (?:UNIQUE )?INDEX IF NOT EXISTS ${identifier} ON ${table} \\(${identifier}(?:, ?${identifier})*\\)$`,'i'),
  ];
  for(const s of list) {
    if(patterns.some(p=>p.test(s)))continue;
    const create=s.match(new RegExp(`^CREATE TABLE IF NOT EXISTS ${table} \\((.+)\\)$`,'i'));
    if(create&&create[1].split(/,(?![^()]*\))/).every(col=>new RegExp(`^ ?${identifier} ${type}(?: NOT NULL)?(?: PRIMARY KEY)? ?$`,'i').test(col)))continue;
    throw Error('Migration blocked: only additive nullable columns, simple new tables and simple indexes are automatic. Data changes, reset/drop/truncate, functions, triggers and other SQL require separate reviewed maintenance.');
  }
  return list;
}
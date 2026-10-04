import {normalizePhone} from './contactDepot.ts';

export const IMPORT_MAX_ROWS=5000,IMPORT_MAX_BYTES=2*1024*1024,IMPORT_BATCH_SIZE=200;
export type ImportRow={row:number;name:string;email:string;phone:string};
export type ImportStatus='ready'|'invalid'|'duplicate'|'imported';
export type ImportResult={row:number;status:ImportStatus;reason:string};
export type ImportMapping={name:number;surname:number;email:number;phone:number};
export type ImportSheet={name:string;headers:string[];rows:unknown[][]};
export type ImportFile={sheets:ImportSheet[]};
export type PreparedImport={rows:ImportRow[];issues:ImportResult[];total:number};
const text=(v:unknown)=>typeof v==='string'?v.trim():typeof v==='number'&&Number.isFinite(v)?String(v):'';
const header=(v:string)=>v.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^a-z0-9]/g,'');
export function inferImportMapping(headers:string[]):ImportMapping {
  const names=headers.map(header);
  const find=(aliases:string[])=>names.findIndex(h=>aliases.includes(h));
  return {
    name:find(['adsoyad','adisoyadi','isimsoyisim','fullname','name','ad','adi','isim','firstname','unvan']),
    surname:find(['soyad','soyadi','soyisim','surname','lastname']),
    email:find(['eposta','epostaadresi','email','emailaddress','mail']),
    phone:find(['telefon','telefonnumarasi','ceptelefonu','cep','gsm','phone','phonenumber','mobile','tel']),
  };
}
function sheet(name:string,raw:unknown[][]):ImportSheet {
  const rows=raw.filter(r=>r.some(c=>text(c)!==''));
  if(rows.length<2)throw Error('Dosyada başlık satırı ve en az bir kişi olmalı.');
  if(rows.length-1>IMPORT_MAX_ROWS)throw Error('Bir dosyada en fazla 5.000 kişi yüklenebilir.');
  if(rows.some(r=>r.length>50))throw Error('Dosyada en fazla 50 sütun olabilir.');
  const headers=rows[0].map((cell,i)=>text(cell)||`Sütun ${i+1}`);
  if(headers.some(h=>h.length>120))throw Error('Sütun başlıkları çok uzun.');
  return {name,headers,rows:rows.slice(1)};
}
// Check ZIP metadata before expanding an uploaded workbook in the browser.
export function validateWorkbookArchive(bytes:ArrayBuffer) {
  const v=new DataView(bytes);let end=-1;
  for(let i=v.byteLength-22;i>=Math.max(0,v.byteLength-65557);i--){
    if(v.getUint32(i,true)===0x06054b50){end=i;break;}
  }
  if(end<0)throw Error('Excel arşivi geçersiz.');
  const entries=v.getUint16(end+10,true),directory=v.getUint32(end+16,true);
  if(v.getUint16(end+4,true)||v.getUint16(end+6,true)||entries>2000||entries===65535)
    throw Error('Excel arşivi desteklenen sınırları aşıyor.');
  let cursor=directory,total=0;
  for(let i=0;i<entries;i++){
    if(cursor+46>end||v.getUint32(cursor,true)!==0x02014b50)throw Error('Excel arşivi geçersiz.');
    const size=v.getUint32(cursor+24,true);
    if(size===0xffffffff||(v.getUint16(cursor+8,true)&1))throw Error('Şifreli veya ZIP64 Excel arşivi desteklenmiyor.');
    total+=size;
    if(total>50*1024*1024)throw Error('Excel açıldığında 50 MB sınırını aşıyor. Gereksiz sayfa ve görselleri çıkarın.');
    cursor+=46+v.getUint16(cursor+28,true)+v.getUint16(cursor+30,true)+v.getUint16(cursor+32,true);
  }
}
export async function readContactFile(file:File):Promise<ImportFile> {
  if(file.size>IMPORT_MAX_BYTES)throw Error('Dosya en fazla 2 MB olabilir.');
  if(!file.size)throw Error('Dosya boş.');
  const ext=file.name.split('.').pop()?.toLowerCase();
  if(ext==='csv') {
    const bytes=await file.arrayBuffer();let content:string;
    const marker=new Uint8Array(bytes);
    if(marker[0]===255&&marker[1]===254)content=new TextDecoder('utf-16le').decode(bytes);
    else if(marker[0]===254&&marker[1]===255)content=new TextDecoder('utf-16be').decode(bytes);
    else {
      try{content=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}
      catch{content=new TextDecoder('windows-1254').decode(bytes);}
    }
    const {default:Papa}=await import('papaparse');
    const parsed=Papa.parse<string[]>(content,{skipEmptyLines:'greedy',preview:IMPORT_MAX_ROWS+2});
    if(parsed.errors.length)throw Error('CSV okunamadı. Tırnakları ve satır biçimini kontrol edin.');
    if(parsed.meta.truncated)throw Error('Bir dosyada en fazla 5.000 kişi yüklenebilir.');
    return {sheets:[sheet('CSV',parsed.data)]};
  }
  if(ext==='xlsx') {
    validateWorkbookArchive(await file.arrayBuffer());
    const {default:readXlsx}=await import('read-excel-file/browser');
    try {
      const workbook=await readXlsx(file);
      if(!workbook.length||workbook.length>10)throw Error('Excel dosyasında 1–10 sayfa olmalı.');
      const sheets:ImportSheet[]=[];
      for(const page of workbook) {
        if(page.data.filter(r=>r.some(c=>text(c)!=='')).length>=2)sheets.push(sheet(page.sheet,page.data));
      }
      if(!sheets.length)throw Error('Excel dosyasında kişi bulunamadı.');
      return {sheets};
    }catch(e){
      if(e instanceof Error&&/kişi|sütun|başlık|sayfa/.test(e.message))throw e;
      throw Error('Excel okunamadı. Dosyayı Excel’den .xlsx olarak yeniden kaydedin.');
    }
  }
  throw Error('Yalnızca .csv ve .xlsx desteklenir. Eski .xls dosyasını .xlsx olarak kaydedin.');
}
export function prepareContactImport(s:ImportSheet,m:ImportMapping):PreparedImport {
  const chosen=Object.values(m).filter(i=>i>=0);
  if(m.name<0||(m.email<0&&m.phone<0))throw Error('Ad ve en az bir e-posta/telefon sütunu seçin.');
  if(chosen.some(i=>i>=s.headers.length)||new Set(chosen).size!==chosen.length)throw Error('Her alan için farklı bir sütun seçin.');
  const rows:ImportRow[]=[],issues:ImportResult[]=[],emails=new Set<string>(),phones=new Set<string>();
  s.rows.forEach((r,index)=>{
    const row=index+2;
    const name=[text(r[m.name]),m.surname<0?'':text(r[m.surname])].filter(Boolean).join(' ');
    const email=m.email<0?'':text(r[m.email]).toLowerCase();
    const raw=m.phone<0?'':text(r[m.phone]);
    const phone=raw?normalizePhone(raw):'';
    let reason='';
    if(chosen.some(i=>r[i]!=null&&typeof r[i]!=='string'&&typeof r[i]!=='number'))reason='Ad, soyad, e-posta ve telefon hücreleri metin/sayı olmalı; tarih veya mantıksal değer olamaz.';
    else if(!name||name.length>120)reason='Ad/soyad boş veya 120 karakterden uzun.';
    else if(email&&(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))reason='Geçersiz e-posta.';
    else if(raw&&(!phone||raw.length>40))reason='Geçersiz telefon. Uluslararası numara +ülke koduyla yazılmalı.';
    else if(!email&&!phone)reason='E-posta ve telefon birlikte boş.';
    if(reason){issues.push({row,status:'invalid',reason});return;}
    if((email&&emails.has(email))||(phone&&phones.has(phone))){
      issues.push({row,status:'duplicate',reason:'Dosyada aynı e-posta veya telefon önceki satırda var.'});return;
    }
    if(email)emails.add(email);if(phone)phones.add(phone);
    rows.push({row,name,email,phone:phone||''});
  });
  return {rows,issues,total:s.rows.length};
}
export function parseImportResults(value:unknown,expected:ImportRow[],saving:boolean):ImportResult[] {
  if(!Array.isArray(value)||value.length!==expected.length)throw Error('Sunucu içe aktarım sonucunu doğrulamadı.');
  const indexes=new Set(expected.map(r=>r.row)),seen=new Set<number>();
  for(const r of value) {
    if(!r||!indexes.has(r.row)||seen.has(r.row)||typeof r.reason!=='string'||
      !(saving?['imported','invalid','duplicate']:['ready','invalid','duplicate']).includes(r.status))
      throw Error('Sunucu içe aktarım sonucunu doğrulamadı.');
    seen.add(r.row);
  }
  return value as ImportResult[];
}
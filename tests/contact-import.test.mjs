import test from 'node:test';
import assert from 'node:assert/strict';
import {inferImportMapping,prepareContactImport,readContactFile,parseImportResults,validateWorkbookArchive,IMPORT_MAX_BYTES} from '../src/lib/contactImport.ts';

test('Turkish/English headers map automatically; separate first/last names combine',()=>{
  const headers=['ADI','SOYADI','E-Posta Adresi','Cep Telefonu'];
  const mapping=inferImportMapping(headers);
  assert.deepEqual(mapping,{name:0,surname:1,email:2,phone:3});
  const result=prepareContactImport({name:'Test',headers,rows:[['Test','Person','TEST@EXAMPLE.INVALID','0555 000 00 01']]},mapping);
  assert.deepEqual(result.rows,[{row:2,name:'Test Person',email:'test@example.invalid',phone:'+905550000001'}]);
});
test('reject populated invalid fields; skip later same email OR normalized phone; do not reserve invalid row endpoints',()=>{
  const headers=['Ad','Soyad','E-posta','Telefon'],mapping=inferImportMapping(headers);
  const result=prepareContactImport({name:'Test',headers,rows:[
    ['Bad','Person','bad','05550000001'],['Test','One','t@example.invalid','05550000001'],
    ['Phone','Duplicate','second@example.invalid','+905550000001'],
    ['Email','Duplicate','T@EXAMPLE.INVALID','05550000002'],
    ['Empty','','',''],['Date','Phone','date@example.invalid',new Date('2026-01-01')],
  ]},mapping);
  assert.equal(result.rows.length,1);
  assert.deepEqual(result.issues.map(r=>r.status),['invalid','duplicate','duplicate','invalid','invalid']);
  assert.throws(()=>prepareContactImport({name:'T',headers,rows:[]},{...mapping,phone:2}),/farklı/);
});
test('CSV semicolon/quoted comma/BOM, Windows Turkish and UTF16 parse safely without storing source file',async()=>{
  const file=new File(['\ufeffAd;Soyad;E-posta;Telefon\n"Test, Ad";Soyad;test@example.invalid;05550000001'], 'list.csv');
  const parsed=await readContactFile(file);
  assert.equal(parsed.sheets[0].rows[0][0],'Test, Ad');
  const win=new File([new Uint8Array([65,100,59,84,101,108,101,102,111,110,10,221,59,48,53,53,53,48,48,48,48,48,48,49])],'tr.csv');
  assert.equal((await readContactFile(win)).sheets[0].rows[0][0],'İ');
  const raw=Buffer.from('\ufeffAd\tTelefon\nTest\t05550000001','utf16le');
  assert.equal((await readContactFile(new File([raw],'utf16.csv'))).sheets[0].rows[0][0],'Test');
});
test('empty/corrupt/oversized/unsupported/too-many-rows files fail explicitly',async()=>{
  for(const [file,message] of [
    [new File([],'empty.csv'),/boş/],
    [new File(['bad'],'old.xls'),/\.xlsx/],
    [new File(['Ad,Telefon\n"broken,123'],'bad.csv'),/CSV okunamadı/],
    [new File([new Uint8Array(IMPORT_MAX_BYTES+1)],'huge.csv'),/2 MB/],
    [new File(['Ad,Telefon\n'+Array.from({length:5001},()=> 'Test,05550000001').join('\n')],'many.csv'),/5.000/],
  ])await assert.rejects(()=>readContactFile(file),message);
});
test('batch reader refuses missing, duplicate ordinal and fabricated success results',()=>{
  const rows=[{row:2,name:'T',email:'t@example.invalid',phone:''}];
  assert.deepEqual(parseImportResults([{row:2,status:'ready',reason:''}],rows,false),[{row:2,status:'ready',reason:''}]);
  for(const data of [[],[{row:3,status:'ready',reason:''}],[{row:2,status:'imported',reason:''}]])
    assert.throws(()=>parseImportResults(data,rows,false),/doğrulamadı/);
});
test('workbook metadata blocks malformed and overexpanded zip before decompression',()=>{
  assert.throws(()=>validateWorkbookArchive(new ArrayBuffer(10)),/geçersiz/);
  const bytes=new ArrayBuffer(68),v=new DataView(bytes);
  v.setUint32(0,0x02014b50,true);v.setUint32(24,60*1024*1024,true);
  v.setUint32(46,0x06054b50,true);v.setUint16(56,1,true);v.setUint32(62,0,true);
  assert.throws(()=>validateWorkbookArchive(bytes),/50 MB/);
});
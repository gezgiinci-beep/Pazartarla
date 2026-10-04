// Isolated component harness: synthetic inputs/in-memory responses only.
// Not imported by production entry; never authenticates or touches a real database.
import React,{useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import ContactBulkImport from '../src/components/ContactBulkImport';
import type {useContactDepot} from '../src/hooks/useContactDepot';
import type {ImportResult,ImportRow} from '../src/lib/contactImport';
import '../src/components/contact-depot.css';
function Harness() {
  const [counter,setCounter]=useState(0);
  const [closed,setClosed]=useState(false);
  const stored=useRef(new Map<string,ImportRow>()).current;
  const receipts=useRef(new Map<string,ImportResult[]>()).current;
  const lost=useRef(false);
  const state={
    busy:false,refresh:async()=>true,
    processImport:async(rows:ImportRow[],save:boolean,id:string)=>{
      if(save&&receipts.has(id))return receipts.get(id)!;
      const results:ImportResult[]=rows.map(row=>{
        const duplicate=[...stored.values()].some(r=>(row.email&&r.email===row.email)||(row.phone&&r.phone===row.phone));
        if(save&&!duplicate)stored.set(row.email||row.phone,row);
        return {row:row.row,status:duplicate?'duplicate':save?'imported':'ready',reason:duplicate?'İzole test: mevcut kayıt.':''};
      });
      if(save){
        receipts.set(id,results);setCounter(stored.size);
        if(new URLSearchParams(location.search).has('fail_after_commit')&&stored.size>200&&!lost.current){
          lost.current=true;throw Error('İzole test: sunucu kaydetti, paket onayı bağlantıda kayboldu.');
        }
      }
      return results;
    },
  } as ReturnType<typeof useContactDepot>;
  return <main style={{maxWidth:700,margin:'auto',padding:12}}>
    <p style={{background:'#fef08a',padding:12}}>İZOLE TEST: Sentetik bilgiler. Gerçek giriş, veri kaydı veya mesaj gönderimi yok.</p>
    <p data-testid="fixture-count">Sentetik kayıt: {counter}</p>
    {closed?<button onClick={()=>setClosed(false)}>Yüklemeyi tekrar aç</button>:<ContactBulkImport state={state} onClose={()=>setClosed(true)} />}
  </main>;
}
createRoot(document.getElementById('root')!).render(<Harness/>);
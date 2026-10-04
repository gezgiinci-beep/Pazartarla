import {useState} from 'react';
import {depotRpc} from '../lib/contactDepot';
export default function ContactUnsubscribe({token,url,publicKey}:{token:string;url:string;publicKey:string}) {
  const [busy,setBusy]=useState(false),[done,setDone]=useState(false),[error,setError]=useState('');
  async function cancel() {
    if(busy||done)return;
    setBusy(true);setError('');
    try {
      if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token))
        throw Error('Çıkış bağlantısı geçersiz.');
      const result=await depotRpc(url,{apikey:publicKey},'unsubscribe_depot_contact',{p_token:token});
      if(result!==true)throw Error('Çıkış doğrulanamadı. Tekrar deneyin.');
      setDone(true);
    }catch(e){setError(e instanceof Error?e.message:'İstek kaydedilemedi.');}
    finally{setBusy(false);}
  }
  return <section style={{padding:18,background:'#fff',border:'1px solid #dce2d3',borderRadius:12,marginBottom:18}}
    aria-label="Mesaj aboneliğinden çıkış" data-testid="contact-unsubscribe">
    <h2>Mesaj aboneliğinden çıkış</h2>
    {done?<p role="status">Bu bağlantının kanalındaki mesaj izni kapatıldı; bekleyen mesajlar iptal edildi.
      Önceden başlamış gönderimler geri alınamaz.</p>:<>
      <p>İlgili kanaldaki toplu mesaj izninizi kapatmak için onaylayın. İlanınız silinmez.</p>
      <button type="button" disabled={busy} onClick={()=>void cancel()}>{busy?'Kaydediliyor…':'Mesaj iznimi kapat'}</button>
    </>}
    {error&&<p role="alert">{error}</p>}
  </section>;
}
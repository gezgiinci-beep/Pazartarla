import {useEffect,useRef,useState} from 'react';
import {EDIT_FIELDS,listingDraft,listingChanges,editError} from '../lib/listingEditor';

export default function ListingEditor({client,itemId,userId,isAdmin,categories,onSaved,onCancel}: any) {
  const [original,setOriginal]=useState<any>(null);
  const [token,setToken]=useState('');
  const [draft,setDraft]=useState<Record<string,string>>({});
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const generation=useRef(0);
  async function load() {
    const current=++generation.current;
    setLoading(true);setError('');
    try {
      const {data,error:failure}=await client.rpc('get_listing_for_edit',{p_listing_id:itemId});
      if (failure) throw failure;
      if (!data?.listing || String(data.listing.id)!==String(itemId) || !/^[a-f0-9]{64}$/.test(data.edit_token))
        throw new Error('Invalid listing response');
      if (current!==generation.current) return;
      setOriginal(data.listing);setToken(data.edit_token);setDraft(listingDraft(data.listing));
    } catch(failure) {if(current===generation.current)setError(editError(failure));}
    finally {if(current===generation.current)setLoading(false);}
  }
  useEffect(()=>{void load();return()=>{generation.current++;};},[client,itemId,userId]);
  async function save(event: any) {
    event.preventDefault();if(saving||!original)return;
    const current=generation.current;
    setSaving(true);setError('');
    try {
      const changes=listingChanges(original,draft);
      const {data,error:failure}=await client.rpc('update_listing_details',{
        p_listing_id:original.id,p_changes:changes,p_edit_token:token,
      });
      if(failure)throw failure;
      if(!data?.listing || String(data.listing.id)!==String(original.id) ||
        typeof data.reapproval_required!=='boolean'||typeof data.changed!=='boolean')
        throw new Error('Invalid save acknowledgement');
      if(current===generation.current)await onSaved(data);
    }catch(failure){if(current===generation.current)setError(editError(failure));}
    finally{if(current===generation.current)setSaving(false);}
  }
  const labels: Record<string,string>={title:'Başlık',price:'Fiyat (TL)',category:'Kategori',subCategory:'Alt kategori',location:'Konum',description:'Açıklama',seller:'Satıcı adı',phone:'Telefon'};
  const inputStyle={width:'100%',boxSizing:'border-box' as const,padding:10,border:'1px solid #cbd5e1',borderRadius:6};
  function change(key: string,value: string) {
    setDraft(previous=>({...previous,[key]:value,...(key==='category'?{subCategory:categories?.[value]?.[0]||''}:{})}));
  }
  return <section data-testid="listing-editor" aria-labelledby="listing-editor-title" style={{background:'#fff',padding:18,borderRadius:12,border:'1px solid #dce5dc'}}>
    <h2 id="listing-editor-title">İlanı Düzenle / Güncelle</h2>
    <p>{isAdmin?'Yönetici düzenlemesi mevcut onay durumunu korur.':'İçerik, fiyat, kategori ve iletişim değişiklikleri yeniden yönetici onayına gönderilir; onaylanana kadar ilan yayından kalkar.'}</p>
    <p style={{fontSize:12,color:'#64748b'}}>İlan numarası, sahibi, ilk tarihi, fotoğrafları ve vitrin bilgisi değişmez. Düzenleme yeni ilan kotası kullanmaz.</p>
    {error&&<div role="alert" style={{color:'#9e3d35',marginBottom:12}}>{error} <button type="button" disabled={saving} onClick={()=>{if(!original||window.confirm('Güncel ilanı yüklemek taslağınızı değiştirecek. Devam edilsin mi?'))void load();}}>Güncel ilanı yükle</button></div>}
    {loading?<p role="status">İlan yükleniyor…</p>:original&&<form onSubmit={save}>
      <fieldset disabled={saving} style={{border:0,padding:0,display:'grid',gap:12}}>
        {EDIT_FIELDS.map(key=><label key={key}>{labels[key]}
          {key==='category'||key==='subCategory'?<select style={inputStyle} aria-label={labels[key]} required value={draft[key]} onChange={e=>change(key,e.target.value)}>
            {(key==='category'?Object.keys(categories||{}):categories?.[draft.category]||[]).includes(draft[key])?null:<option value={draft[key]}>{draft[key]} (mevcut)</option>}
            {(key==='category'?Object.keys(categories||{}):categories?.[draft.category]||[]).map((value: string)=><option key={value} value={value}>{value}</option>)}
          </select>:key==='description'?<textarea style={inputStyle} aria-label={labels[key]} maxLength={5000} rows={5} value={draft[key]} onChange={e=>change(key,e.target.value)}/>:<input style={inputStyle} aria-label={labels[key]} required={['title','price','seller','phone'].includes(key)} type={key==='price'?'number':key==='phone'?'tel':'text'} min={key==='price'?0:undefined} step={key==='price'?'0.01':undefined} maxLength={key==='title'||key==='location'?200:key==='seller'?120:key==='phone'?32:undefined} value={draft[key]} onChange={e=>change(key,e.target.value)}/>}
        </label>)}
        <button type="submit" style={{background:'#1b3a2b',color:'#fff',padding:12,border:0,borderRadius:6}}>{saving?'Kaydediliyor…':'Değişiklikleri Kaydet'}</button>
      </fieldset>
    </form>}
    <button type="button" disabled={saving} onClick={onCancel} style={{marginTop:12}}>Vazgeç</button>
  </section>;
}
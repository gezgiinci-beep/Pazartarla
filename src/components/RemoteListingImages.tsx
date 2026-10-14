import React, {useEffect, useId, useRef, useState} from 'react';
import {listingFilePreviews} from '../lib/listingMedia.mjs';
import {clipboardImageFiles, imagePreviewFromUrl, readClipboardImages} from '../lib/remoteListingImages.mjs';

type Props = {
  disabled: boolean;
  count: number;
  onAdd: (images: string[]) => void | Promise<void>;
  onBusyChange: (busy: boolean) => void;
};

export default function RemoteListingImages({disabled, count, onAdd, onBusyChange}: Props) {
  const id = useId();
  const [address, setAddress] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const running = useRef(false);
  const alive = useRef(true);
  const latest = useRef({disabled, count, onAdd});
  latest.current = {disabled, count, onAdd};
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; onBusyChange(false); };
  }, [onBusyChange]);

  const run = async (load: () => Promise<string[]>) => {
    if (running.current || latest.current.disabled) return;
    setError(''); setMessage('');
    if (latest.current.count >= 10) {
      setError('En fazla 10 fotoğraf ekleyebilirsiniz. Önce galeriden bir fotoğraf kaldırın.');
      return;
    }
    running.current = true;
    setBusy(true); onBusyChange(true);
    try {
      const images = await load();
      if (!alive.current) return;
      if (latest.current.disabled) throw new Error('Fotoğraf ekleme şu anda kullanılamıyor.');
      if (latest.current.count + images.length > 10) throw new Error('Toplam en fazla 10 fotoğraf ekleyebilirsiniz.');
      await latest.current.onAdd(images);
      if (alive.current) {
        setAddress('');
        setMessage(`${images.length} fotoğraf galeriye eklendi. İlanı kaydettiğinizde fotoğraflar da kaydedilir.`);
      }
    } catch (problem) {
      if (alive.current) setError(problem instanceof Error ? problem.message : 'Fotoğraf eklenemedi.');
    } finally {
      running.current = false;
      if (alive.current) { setBusy(false); onBusyChange(false); }
    }
  };
  const locked = disabled || busy || count >= 10;
  const paste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    const files = clipboardImageFiles(event.clipboardData);
    void run(async () => {
      if (!files.length) throw new Error('Panoda fotoğraf yok. Fotoğrafın kendisini kopyalayın veya fotoğraf bağlantısını üstteki adres alanına yapıştırın.');
      return listingFilePreviews(files);
    });
  };
  const buttonStyle = {padding: '8px 10px', border: '1px solid #86efac', borderRadius: 6, background: '#ecfdf5', color: '#166534', fontWeight: 700, cursor: locked ? 'not-allowed' : 'pointer'};

  return <div style={{display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 8, borderTop: '1px solid #cbd5e1', color: '#0f172a'}}>
    <label htmlFor={id} style={{fontSize: 12, fontWeight: 700}}>Başka yerden fotoğraf ekle</label>
    <input id={id} type="text" inputMode="url" value={address} disabled={locked}
      onChange={event => setAddress(event.target.value)}
      onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); if (address.trim()) void run(async () => [await imagePreviewFromUrl(address)]); } }}
      placeholder="https://… doğrudan fotoğraf adresi"
      aria-describedby={`${id}-help`}
      style={{width: '100%', boxSizing: 'border-box', padding: 9, border: '1px solid #cbd5e1', borderRadius: 6, color: '#0f172a', background: '#fff'}} />
    <div style={{display: 'flex', gap: 8, flexWrap: 'wrap'}}>
      <button type="button" disabled={locked || !address.trim()} onClick={() => void run(async () => [await imagePreviewFromUrl(address)])} style={buttonStyle}>Adresten fotoğraf ekle</button>
      <button type="button" disabled={locked} onClick={() => void run(() => readClipboardImages())} style={buttonStyle}>Panodan fotoğraf ekle</button>
    </div>
    <div role="textbox" aria-label="Kopyaladığınız fotoğrafı buraya yapıştırın" aria-disabled={locked}
      contentEditable={!locked} suppressContentEditableWarning tabIndex={locked ? -1 : 0}
      onPaste={paste}
      onBeforeInput={event => event.preventDefault()}
      style={{padding: 12, border: '1px dashed #94a3b8', borderRadius: 6, fontSize: 12, color: '#475569'}}>
      Fotoğrafı başka yerde kopyalayın; buraya tıklayıp Ctrl+V yapın veya uzun basıp Yapıştır seçin.
    </div>
    <small id={`${id}-help`} style={{color: '#64748b'}}>Cihazınıza kaydetmeniz gerekmez. JPEG, PNG, WebP ve GIF; fotoğraf başına en fazla 2 MB. Kaynak site adresten indirmeyi engellerse fotoğrafın kendisini kopyalayıp yapıştırın.</small>
    {busy && <p role="status" style={{margin: 0, fontSize: 12}}>Fotoğraf ekleniyor…</p>}
    {message && <p role="status" style={{margin: 0, color: '#166534', fontSize: 12}}>{message}</p>}
    {error && <p role="alert" style={{margin: 0, color: '#b91c1c', fontSize: 12}}>{error}</p>}
  </div>;
}

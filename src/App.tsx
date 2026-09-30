import React, { useState, useEffect } from 'react';

export default function App() {
  const [listings, setListings] = useState<any[]>([]);
  const [view, setView] = useState<'home' | 'create'>('home');

  const [seller, setSeller] = useState('Can İnce');
  const [phone, setPhone] = useState('0535 768 1550');
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('Canlı Hayvanlar');
  const [location, setLocation] = useState('Kocaeli / Gebze');
  const [image, setImage] = useState('');
  const [description, setDescription] = useState('');

  const SUPABASE_URL = 'https://srbarfjzsfkmglsnmbtw.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable__8tUtClK2adq_ORRuL5PQ_oft6c';

  useEffect(() => {
    // Supabase kütüphanesini tarayıcıya dinamik yükleyip verileri çekiyoruz
    if ((window as any).supabase) {
      fetchListings();
    } else {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      script.async = true;
      script.onload = () => fetchListings();
      document.body.appendChild(script);
    }
  }, []);

  const getClient = () => {
    const sb = (window as any).supabase;
    if (sb) {
      return sb.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    return null;
  };

  const fetchListings = async () => {
    const client = getClient();
    if (!client) return;
    const { data, error } = await client.from('listings').select('*').order('created_at', { ascending: false });
    if (!error && data) {
      setListings(data);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const client = getClient();
    if (!client) {
      alert('Veritabanı bağlantısı yükleniyor, lütfen 2 saniye bekleyip tekrar deneyin.');
      return;
    }

    const rawPrice = price.toString().replace(/[^\d]/g, '');
    const parsedPrice = Number(rawPrice) || 0;
    const finalImage = image.trim() || 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&q=80&w=800';

    const listingData = {
      title: title.trim() || 'Yeni Tarım İlanı',
      price: parsedPrice,
      category: category.trim() || 'Mahsuller',
      location: location.trim() || 'Gönen / Balıkesir',
      description: description.trim() || 'Detaylı bilgi için iletişime geçiniz.',
      seller: seller.trim() || 'Can İnce',
      phone: phone.trim() || '0535 768 1550',
      image: finalImage,
      status: 'approved'
    };

    try {
      const { error } = await client
        .from('listings')
        .insert([listingData]);

      if (error) {
        alert('İlan eklenirken hata oluştu: ' + error.message);
      } else {
        alert('🎉 İlan başarıyla yayınlandı!');
        setTitle('');
        setPrice('');
        setDescription('');
        setImage('');
        setView('home');
        fetchListings();
      }
    } catch (err: any) {
      alert('Sunucu bağlantısında bir sorun oluştu.');
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#f8fafc', fontFamily: 'system-ui, sans-serif', padding: '20px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '800px', margin: '0 auto 20px auto', borderBottom: '1px solid #334155', paddingBottom: '15px' }}>
        <h1 style={{ color: '#4ade80', fontSize: '22px', margin: 0 }}>🌾 PazarTarla</h1>
        <div>
          <button onClick={() => setView('home')} style={{ background: view === 'home' ? '#22c55e' : '#334155', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', marginRight: '10px', cursor: 'pointer' }}>İlanlar</button>
          <button onClick={() => setView('create')} style={{ background: view === 'create' ? '#22c55e' : '#334155', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}>+ İlan Ver</button>
        </div>
      </header>

      <main style={{ maxWidth: '800px', margin: '0 auto' }}>
        {view === 'home' ? (
          <div>
            <h2>Yayındaki İlanlar</h2>
            {listings.length === 0 ? (
              <p style={{ color: '#94a3b8' }}>Henüz ilan bulunmuyor.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                {listings.map((item) => (
                  <div key={item.id} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', overflow: 'hidden', padding: '15px' }}>
                    <img src={item.image} alt={item.title} style={{ width: '100%', height: '140px', objectFit: 'cover', borderRadius: '6px' }} />
                    <h3 style={{ fontSize: '16px', margin: '10px 0 5px 0', color: '#fff' }}>{item.title}</h3>
                    <p style={{ color: '#4ade80', fontWeight: 'bold', margin: '0 0 5px 0' }}>{item.price.toLocaleString()} TL</p>
                    <p style={{ fontSize: '12px', color: '#94a3b8', margin: '0 0 5px 0' }}>📍 {item.location}</p>
                    <p style={{ fontSize: '13px', color: '#cbd5e1', margin: 0 }}>{item.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div style={{ background: '#1e293b', padding: '20px', borderRadius: '12px', border: '1px solid #334155' }}>
            <h2 style={{ marginTop: 0, color: '#4ade80' }}>Yeni İlan Ver</h2>
            <form onSubmit={handleSubmit}>
              <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Ad Soyad</label>
              <input type="text" value={seller} onChange={(e) => setSeller(e.target.value)} style={{ width: '100%', padding: '10px', marginBottom: '10px', background: '#0f172a', color: '#fff', border: '1px solid #475569', borderRadius: '6px', boxSizing: 'border-box' }} />

              <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Telefon</label>
              <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} style={{ width: '100%', padding: '10px', marginBottom: '10px', background: '#0f172a', color: '#fff', border: '1px solid #475569', borderRadius: '6px', boxSizing: 'border-box' }} />

              <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>İlan Başlığı *</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Örn: Yağlı Süt Efsanesi Orijinal Danimarka Jersey" required style={{ width: '100%', padding: '10px', marginBottom: '10px', background: '#0f172a', color: '#fff', border: '1px solid #475569', borderRadius: '6px', boxSizing: 'border-box' }} />

              <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Fiyat (TL) *</label>
              <input type="text" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Örn: 190000" required style={{ width: '100%', padding: '10px', marginBottom: '10px', background: '#0f172a', color: '#fff', border: '1px solid #475569', borderRadius: '6px', boxSizing: 'border-box' }} />

              <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Kategori</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ width: '100%', padding: '10px', marginBottom: '10px', background: '#0f172a', color: '#fff', border: '1px solid #475569', borderRadius: '6px', boxSizing: 'border-box' }}>
                <option value="Canlı Hayvanlar">Canlı Hayvanlar</option>
                <option value="Mahsuller">Mahsuller</option>
                <option value="Arazi & Tarla">Arazi & Tarla</option>
                <option value="Traktör & Ekipman">Traktör & Ekipman</option>
                <option value="Arıcılık">Arıcılık</option>
              </select>

              <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Konum</label>
              <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Örn: Kocaeli / Gebze" style={{ width: '100%', padding: '10px', marginBottom: '10px', background: '#0f172a', color: '#fff', border: '1px solid #475569', borderRadius: '6px', boxSizing: 'border-box' }} />

              <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Görsel URL (İsteğe bağlı)</label>
              <input type="text" value={image} onChange={(e) => setImage(e.target.value)} placeholder="https://..." style={{ width: '100%', padding: '10px', marginBottom: '10px', background: '#0f172a', color: '#fff', border: '1px solid #475569', borderRadius: '6px', boxSizing: 'border-box' }} />

              <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Açıklama</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="İlan detayları..." style={{ width: '100%', padding: '10px', marginBottom: '15px', background: '#0f172a', color: '#fff', border: '1px solid #475569', borderRadius: '6px', boxSizing: 'border-box', height: '100px' }}></textarea>

              <button type="submit" style={{ width: '100%', padding: '12px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '15px' }}>🚀 İlanı Gönder</button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}

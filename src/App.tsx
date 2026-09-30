import React, { useState, useEffect } from 'react';

const SUPABASE_URL = 'https://srbarfjzsfkmglsnmbtw.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable__8tUtClK2adq_ORRuL5PQ_oft6c';

export default function App() {
  const [listings, setListings] = useState<any[]>([]);
  const [filteredListings, setFilteredListings] = useState<any[]>([]);
  const [view, setView] = useState<'home' | 'create'>('home');
  const [selectedCategory, setSelectedCategory] = useState('Tümü');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeListing, setActiveListing] = useState<any>(null);

  // Form State'leri
  const [seller, setSeller] = useState('Can İnce');
  const [phone, setPhone] = useState('0535 768 1550');
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('Canlı Hayvanlar');
  const [location, setLocation] = useState('Kocaeli / Gebze');
  const [image, setImage] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
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

  useEffect(() => {
    let result = listings;
    if (selectedCategory !== 'Tümü') {
      result = result.filter(item => item.category === selectedCategory);
    }
    if (searchQuery.trim() !== '') {
      result = result.filter(item => 
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        item.location.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    setFilteredListings(result);
  }, [selectedCategory, searchQuery, listings]);

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
      setFilteredListings(data);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const client = getClient();
    if (!client) {
      alert('Bağlantı yükleniyor, lütfen birkaç saniye bekleyin.');
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
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#f8fafc', fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ background: '#1e293b', borderBottom: '1px solid #334155', padding: '15px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }} onClick={() => setView('home')}>
          <span style={{ fontSize: '26px' }}>🌾</span>
          <h1 style={{ color: '#4ade80', fontSize: '22px', margin: 0, fontWeight: 'bold' }}>PazarTarla</h1>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => setView('home')} style={{ background: view === 'home' ? '#22c55e' : '#334155', color: '#fff', border: 'none', padding: '8px 18px', borderRadius: '8px', cursor: 'pointer', fontWeight: '500' }}>İlanlar</button>
          <button onClick={() => setView('create')} style={{ background: '#22c55e', color: '#fff', border: 'none', padding: '8px 18px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 4px 12px rgba(34, 197, 94, 0.3)' }}>+ Ücretsiz İlan Ver</button>
        </div>
      </header>

      <main style={{ maxWidth: '1100px', margin: '30px auto', padding: '0 20px' }}>
        {view === 'home' ? (
          <div>
            <div style={{ background: '#1e293b', padding: '20px', borderRadius: '12px', border: '1px solid #334155', marginBottom: '25px', display: 'flex', flexWrap: 'wrap', gap: '15px', justifyContent: 'space-between', alignItems: 'center' }}>
              <input 
                type="text" 
                placeholder="İlan başlığı veya konum ara (örn: Jersey, Gönen)..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ flex: 1, minWidth: '280px', padding: '12px 16px', background: '#0f172a', border: '1px solid #475569', borderRadius: '8px', color: '#fff', fontSize: '14px' }}
              />
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {['Tümü', 'Canlı Hayvanlar', 'Mahsuller', 'Arazi & Tarla', 'Traktör & Ekipman', 'Arıcılık'].map((cat) => (
                  <button 
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    style={{ background: selectedCategory === cat ? '#22c55e' : '#334155', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: selectedCategory === cat ? 'bold' : 'normal' }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <h2 style={{ fontSize: '20px', marginBottom: '20px', color: '#f8fafc', borderBottom: '2px solid #334155', paddingBottom: '10px' }}>Yayındaki Tarım ve Hayvancılık İlanları</h2>
            
            {filteredListings.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px', background: '#1e293b', borderRadius: '12px', border: '1px solid #334155' }}>
                <p style={{ color: '#94a3b8', fontSize: '16px', marginBottom: '15px' }}>Henüz ilan bulunmuyor veya yükleniyor...</p>
                <button onClick={() => { setSelectedCategory('Tümü'); setSearchQuery(''); fetchListings(); }} style={{ background: '#334155', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer' }}>Yenile</button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '20px' }}>
                {filteredListings.map((item) => (
                  <div 
                    key={item.id} 
                    onClick={() => setActiveListing(item)}
                    style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', overflow: 'hidden', cursor: 'pointer', transition: 'transform 0.2s, border-color 0.2s', boxShadow: '0 4px 6px rgba(0,0,0,0.2)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.borderColor = '#22c55e'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = '#334155'; }}
                  >
                    <img src={item.image} alt={item.title} style={{ width: '100%', height: '180px', objectFit: 'cover' }} />
                    <div style={{ padding: '15px' }}>
                      <span style={{ fontSize: '11px', background: '#334155', color: '#4ade80', padding: '3px 8px', borderRadius: '4px', fontWeight: '500' }}>{item.category}</span>
                      <h3 style={{ fontSize: '16px', margin: '10px 0 8px 0', color: '#fff', lineHeight: '1.4', height: '44px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{item.title}</h3>
                      <p style={{ color: '#4ade80', fontSize: '18px', fontWeight: 'bold', margin: '0 0 8px 0' }}>{item.price.toLocaleString()} TL</p>
                      <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0, display: 'flex', alignItems: 'center', gap: '5px' }}>📍 {item.location}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div style={{ background: '#1e293b', padding: '30px', borderRadius: '16px', border: '1px solid #334155', maxWidth: '650px', margin: '0 auto' }}>
            <h2 style={{ marginTop: 0, color: '#4ade80', fontSize: '22px', borderBottom: '1px solid #334155', paddingBottom: '15px' }}>PazarTarla'ya Yeni İlan Ekle</h2>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' }}>
              <div>
                <label style={{ fontSize: '13px', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>Ad Soyad</label>
                <input type="text" value={seller} onChange={(e) => setSeller(e.target.value)} style={{ width: '100%', padding: '12px', background: '#0f172a', color: '#fff', border: '1px solid #475569', borderRadius: '8px', boxSizing: 'border-box' }} />
              </div>

              <div>
                <label style={{ fontSize: '13px', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>Telefon Numarası</label>
                <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} style={{ width: '100%', padding: '12px', background: '#0f172a', color: '#fff', border: '1px solid #475569', borderRadius: '8px', boxSizing: 'border-box' }} />
              </div>

              <div>
                <label style={{ fontSize: '13px', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>İlan Başlığı *</label>
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Örn: Yağlı Süt Efsanesi Orijinal Danimarka Jersey" required style={{ width: '100%', padding: '12px', background: '#0f172a', color: '#fff', border: '1px solid #475569', borderRadius: '8px', boxSizing: 'border-box' }} />
              </div>

              <div>
                <label style={{ fontSize: '13px', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>Fiyat (TL) *</label>
                <input type="text" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Örn: 190000" required style={{ width: '100%', padding: '12px', background: '#0f172a', color: '#fff', border: '1px solid #475569', borderRadius: '8px', boxSizing: 'border-box' }} />
              </div>

              <div>
                <label style={{ fontSize: '13px', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>Kategori</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ width: '100%', padding: '12px', background: '#0f172a', color: '#fff', border: '1px solid #475569', borderRadius: '8px', boxSizing: 'border-box' }}>
                  <option value="Canlı Hayvanlar">Canlı Hayvanlar</option>
                  <option value="Mahsuller">Mahsuller</option>
                  <option value="Arazi & Tarla">Arazi & Tarla</option>
                  <option value="Traktör & Ekipman">Traktör & Ekipman</option>
                  <option value="Arıcılık">Arıcılık</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '13px', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>Konum (Şehir / İlçe)</label>
                <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Örn: Kocaeli / Gebze" style={{ width: '100%', padding: '12px', background: '#0f172a', color: '#fff', border: '1px solid #475569', borderRadius: '8px', boxSizing: 'border-box' }} />
              </div>

              <div>
                <label style={{ fontSize: '13px', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>Görsel URL (İsteğe bağlı)</label>
                <input type="text" value={image} onChange={(e) => setImage(e.target.value)} placeholder="https://..." style={{ width: '100%', padding: '12px', background: '#0f172a', color: '#fff', border: '1px solid #475569', borderRadius: '8px', boxSizing: 'border-box' }} />
              </div>

              <div>
                <label style={{ fontSize: '13px', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>Açıklama</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="İlan detayları..." style={{ width: '100%', padding: '12px', background: '#0f172a', color: '#fff', border: '1px solid #475569', borderRadius: '8px', boxSizing: 'border-box', height: '120px' }}></textarea>
              </div>

              <button type="submit" style={{ width: '100%', padding: '14px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px', marginTop: '10px' }}>🚀 İlanı Yayınla</button>
            </form>
          </div>
        )}
      </main>

      {activeListing && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px' }} onClick={() => setActiveListing(null)}>
          <div style={{ background: '#1e293b', width: '100%', maxWidth: '650px', borderRadius: '16px', border: '1px solid #334155', overflow: 'hidden', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
            <img src={activeListing.image} alt={activeListing.title} style={{ width: '100%', height: '260px', objectFit: 'cover' }} />
            <div style={{ padding: '25px', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '12px', background: '#334155', color: '#4ade80', padding: '4px 10px', borderRadius: '6px', fontWeight: '500' }}>{activeListing.category}</span>
                <span style={{ fontSize: '13px', color: '#94a3b8' }}>📍 {activeListing.location}</span>
              </div>
              <h2 style={{ fontSize: '22px', color: '#fff', margin: '10px 0 15px 0' }}>{activeListing.title}</h2>
              <p style={{ color: '#4ade80', fontSize: '24px', fontWeight: 'bold', marginBottom: '20px' }}>{activeListing.price.toLocaleString()} TL</p>
              
              <div style={{ background: '#0f172a', padding: '15px', borderRadius: '10px', marginBottom: '20px', border: '1px solid #334155' }}>
                <h4 style={{ margin: '0 0 8px 0', color: '#cbd5e1', fontSize: '14px' }}>İlan Açıklaması</h4>
                <p style={{ color: '#94a3b8', fontSize: '14px', lineHeight: '1.6', whiteSpace: 'pre-line', margin: 0 }}>{activeListing.description}</p>
              </div>

              <div style={{ background: '#0f172a', padding: '15px', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #334155' }}>
                <div>
                  <p style={{ margin: '0 0 3px 0', fontSize: '12px', color: '#94a3b8' }}>Satıcı</p>
                  <p style={{ margin: 0, fontWeight: 'bold', color: '#fff' }}>{activeListing.seller}</p>
                </div>
                <a href={`tel:${activeListing.phone}`} style={{ background: '#22c55e', color: '#fff', padding: '10px 20px', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold', fontSize: '14px' }}>📞 {activeListing.phone}</a>
              </div>

              <button onClick={() => setActiveListing(null)} style={{ width: '100%', marginTop: '20px', background: '#334155', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Kapat</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

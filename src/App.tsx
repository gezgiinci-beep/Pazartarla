import React, { useState, useEffect } from 'react';

export default function App() {
  const [activeTab, setActiveTab] = useState('home'); // 'home' veya 'admin'
  const [listings, setListings] = useState([]);
  const [form, setForm] = useState({ title: '', price: '', category: '', location: '', image: '' });

  // Sayfa açıldığında kayıtlı ilanları yükle (Eğer yoksa örnek bir tarım ilanı koyalım)
  useEffect(() => {
    const savedListings = JSON.parse(localStorage.getItem('pazartarla_listings'));
    if (savedListings && savedListings.length > 0) {
      setListings(savedListings);
    } else {
      const defaultListings = [
        { id: 1, title: 'Chandler Ceviz (Kabuklu)', price: '250 TL/Kg', category: 'Tarım Ürünleri', location: 'Gönen / Balıkesir', image: '' },
        { id: 2, title: 'Doğal Çiçek Balı', price: '400 TL', category: 'Arıcılık', location: 'Gönen / Kalburcu', image: '' }
      ];
      setListings(defaultListings);
      localStorage.setItem('pazartarla_listings', JSON.stringify(defaultListings));
    }
  }, []);

  // Form değişikliklerini takip et
  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // Yeni ilan ekle
  const handleAddListing = (e) => {
    e.preventDefault();
    if (!form.title || !form.price) {
      alert('Lütfen başlık ve fiyat alanlarını doldurun.');
      return;
    }

    const newListings = [...listings, { ...form, id: Date.now() }];
    setListings(newListings);
    localStorage.setItem('pazartarla_listings', JSON.stringify(newListings));
    
    // Formu sıfırla ve ana sayfaya yönlendir
    setForm({ title: '', price: '', category: '', location: '', image: '' });
    setActiveTab('home');
    alert('İlan başarıyla eklendi!');
  };

  // İlan sil
  const handleDelete = (id) => {
    const filteredListings = listings.filter(item => item.id !== id);
    setListings(filteredListings);
    localStorage.setItem('pazartarla_listings', JSON.stringify(filteredListings));
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#121212', color: '#e0e0e0', fontFamily: 'Arial, sans-serif' }}>
      {/* Üst Menü / Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 40px', borderBottom: '1px solid #333', backgroundColor: '#1e1e1e' }}>
        <h1 style={{ color: '#27ae60', margin: 0, fontSize: '24px', cursor: 'pointer' }} onClick={() => setActiveTab('home')}>
          🌿 PazarTarla
        </h1>
        <nav style={{ display: 'flex', gap: '15px' }}>
          <button 
            onClick={() => setActiveTab('home')} 
            style={{ background: activeTab === 'home' ? '#27ae60' : 'transparent', color: activeTab === 'home' ? '#fff' : '#aaa', border: '1px solid #444', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            Ana Sayfa (İlanlar)
          </button>
          <button 
            onClick={() => setActiveTab('admin')} 
            style={{ background: activeTab === 'admin' ? '#27ae60' : 'transparent', color: activeTab === 'admin' ? '#fff' : '#aaa', border: '1px solid #444', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            Yönetim Paneli (İlan Ekle)
          </button>
        </nav>
      </header>

      {/* Ana İçerik Alanı */}
      <main style={{ padding: '30px 40px', maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* ANA SAYFA GÖRÜNÜMÜ */}
        {activeTab === 'home' && (
          <div>
            <div style={{ marginBottom: '30px', textAlign: 'center' }}>
              <h2 style={{ color: '#fff', fontSize: '28px', marginBottom: '10px' }}>Tarım ve Üretici Pazarı</h2>
              <p style={{ color: '#aaa' }}>Gönen ve çevresindeki üreticilerin taze ürünleri, cevizler ve doğal mahsuller.</p>
            </div>

            <h3 style={{ borderBottom: '2px solid #27ae60', paddingBottom: '10px', marginBottom: '20px' }}>Güncel İlanlar ({listings.length})</h3>
            
            {listings.length === 0 ? (
              <p style={{ color: '#777', textAlign: 'center', padding: '40px' }}>Henüz sergilenen ilan bulunmuyor.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                {listings.map((item) => (
                  <div key={item.id} style={{ background: '#1e1e1e', border: '1px solid #333', borderRadius: '8px', padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <span style={{ fontSize: '12px', background: '#27ae6033', color: '#27ae60', padding: '3px 8px', borderRadius: '4px', fontWeight: 'bold' }}>
                        {item.category || 'Genel'}
                      </span>
                      <h4 style={{ margin: '15px 0 10px 0', fontSize: '18px', color: '#fff' }}>{item.title}</h4>
                      <p style={{ margin: '0 0 10px 0', color: '#27ae60', fontSize: '20px', fontWeight: 'bold' }}>{item.price}</p>
                      <p style={{ margin: 0, color: '#aaa', fontSize: '14px' }}>📍 {item.location || 'Konum belirtilmemiş'}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ADMIN / İLAN EKLEME PANELİ */}
        {activeTab === 'admin' && (
          <div style={{ background: '#1e1e1e', padding: '30px', borderRadius: '8px', border: '1px solid #333' }}>
            <h2 style={{ color: '#fff', borderBottom: '2px solid #27ae60', paddingBottom: '10px', marginTop: 0 }}>
              PazarTarla - İlan Yönetim Paneli
            </h2>

            <form onSubmit={handleAddListing} style={{ marginTop: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', color: '#aaa' }}>İlan Başlığı *</label>
                  <input 
                    type="text" 
                    name="title" 
                    placeholder="Örn: Chandler Ceviz (1. Sınıf)" 
                    value={form.title} 
                    onChange={handleChange} 
                    style={{ width: '100%', padding: '12px', borderRadius: '4px', border: '1px solid #444', backgroundColor: '#121212', color: '#fff' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', color: '#aaa' }}>Fiyat *</label>
                  <input 
                    type="text" 
                    name="price" 
                    placeholder="Örn: 250 TL / Kg" 
                    value={form.price} 
                    onChange={handleChange} 
                    style={{ width: '100%', padding: '12px', borderRadius: '4px', border: '1px solid #444', backgroundColor: '#121212', color: '#fff' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', color: '#aaa' }}>Kategori</label>
                  <input 
                    type="text" 
                    name="category" 
                    placeholder="Örn: Tarım Ürünleri / Ceviz" 
                    value={form.category} 
                    onChange={handleChange} 
                    style={{ width: '100%', padding: '12px', borderRadius: '4px', border: '1px solid #444', backgroundColor: '#121212', color: '#fff' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', color: '#aaa' }}>Konum</label>
                  <input 
                    type="text" 
                    name="location" 
                    placeholder="Örn: Gönen / Balıkesir" 
                    value={form.location} 
                    onChange={handleChange} 
                    style={{ width: '100%', padding: '12px', borderRadius: '4px', border: '1px solid #444', backgroundColor: '#121212', color: '#fff' }}
                  />
                </div>
              </div>

              <button 
                type="submit" 
                style={{ background: '#27ae60', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' }}
              >
                İlanı Yayınla
              </button>
            </form>

            <div style={{ marginTop: '40px' }}>
              <h3 style={{ color: '#fff', borderBottom: '1px solid #333', paddingBottom: '10px' }}>Mevcut İlanları Yönet / Kaldır</h3>
              {listings.map((item) => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#121212', padding: '15px', borderRadius: '6px', border: '1px solid #333', marginBottom: '10px' }}>
                  <div>
                    <h4 style={{ margin: '0 0 5px 0', color: '#fff' }}>{item.title} - <span style={{ color: '#27ae60' }}>{item.price}</span></h4>
                    <p style={{ margin: 0, color: '#888', fontSize: '13px' }}>{item.location} | {item.category}</p>
                  </div>
                  <button 
                    onClick={() => handleDelete(item.id)}
                    style={{ background: '#e74c3c', color: 'white', border: 'none', padding: '8px 14px', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    Sil
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

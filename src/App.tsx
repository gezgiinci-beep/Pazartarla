import React, { useState, useEffect } from 'react';

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [listings, setListings] = useState([]);
  const [form, setForm] = useState({ title: '', price: '', category: '', location: '', description: '' });

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem('pazartarla_listings'));
    if (saved && saved.length > 0) {
      setListings(saved);
    } else {
      const initial = [
        { id: 1, title: 'Chandler Ceviz (5 Yaş / Kalburcu)', price: '250 TL/Kg', category: 'Tarım Ürünleri', location: 'Gönen / Balıkesir', description: 'Özenle yetiştirilmiş kaliteli cevizler.' },
        { id: 2, title: 'Doğal Çiçek Balı', price: '400 TL', category: 'Arıcılık', location: 'Gönen', description: 'Meşe ağaçları çevresindeki kovanlarımızdan.' }
      ];
      setListings(initial);
      localStorage.setItem('pazartarla_listings', JSON.stringify(initial));
    }
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleAdd = (e) => {
    e.preventDefault();
    if (!form.title || !form.price) {
      alert('Lütfen başlık ve fiyat girin.');
      return;
    }
    const updated = [...listings, { ...form, id: Date.now() }];
    setListings(updated);
    localStorage.setItem('pazartarla_listings', JSON.stringify(updated));
    setForm({ title: '', price: '', category: '', location: '', description: '' });
    setActiveTab('home');
  };

  const handleDelete = (id) => {
    const filtered = listings.filter(item => item.id !== id);
    setListings(filtered);
    localStorage.setItem('pazartarla_listings', JSON.stringify(filtered));
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f4f7f6', color: '#333', fontFamily: 'Arial, sans-serif' }}>
      {/* Üst Kısım / Navbar */}
      <header style={{ backgroundColor: '#2c3e50', color: '#fff', padding: '15px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <h1 style={{ margin: 0, fontSize: '22px', cursor: 'pointer', color: '#27ae60' }} onClick={() => setActiveTab('home')}>
          🌿 PazarTarla Tarım Pazarı
        </h1>
        <div>
          <button 
            onClick={() => setActiveTab('home')} 
            style={{ backgroundColor: activeTab === 'home' ? '#27ae60' : 'transparent', color: '#fff', border: '1px solid #27ae60', padding: '8px 16px', marginRight: '10px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            Ana Sayfa
          </button>
          <button 
            onClick={() => setActiveTab('admin')} 
            style={{ backgroundColor: activeTab === 'admin' ? '#27ae60' : 'transparent', color: '#fff', border: '1px solid #27ae60', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            Yönetim Paneli (İlan Ekle)
          </button>
        </div>
      </header>

      <main style={{ padding: '30px', maxWidth: '1100px', margin: '0 auto' }}>
        {activeTab === 'home' && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '30px', background: '#fff', padding: '30px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <h2 style={{ color: '#2c3e50', marginTop: 0 }}>Gönen ve Çevresi Üretici Pazarı</h2>
              <p style={{ color: '#666' }}>Doğal mahsuller, taze tarım ürünleri ve yerel üreticilerin ilanları.</p>
            </div>

            <h3 style={{ borderBottom: '2px solid #27ae60', paddingBottom: '10px', color: '#2c3e50' }}>Aktif İlanlar ({listings.length})</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px', marginTop: '20px' }}>
              {listings.map(item => (
                <div key={item.id} style={{ backgroundColor: '#fff', border: '1px solid #e1e1e1', borderRadius: '8px', padding: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                  <span style={{ fontSize: '11px', backgroundColor: '#e8f8f0', color: '#27ae60', padding: '4px 8px', borderRadius: '4px', fontWeight: 'bold' }}>
                    {item.category || 'Genel'}
                  </span>
                  <h4 style={{ margin: '15px 0 10px 0', fontSize: '18px', color: '#2c3e50' }}>{item.title}</h4>
                  <p style={{ fontSize: '20px', color: '#27ae60', fontWeight: 'bold', margin: '0 0 10px 0' }}>{item.price}</p>
                  <p style={{ fontSize: '13px', color: '#777', margin: '0 0 10px 0' }}>📍 {item.location || 'Konum belirtilmemiş'}</p>
                  {item.description && <p style={{ fontSize: '14px', color: '#555', margin: 0 }}>{item.description}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'admin' && (
          <div style={{ backgroundColor: '#fff', padding: '30px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
            <h2 style={{ color: '#2c3e50', borderBottom: '2px solid #27ae60', paddingBottom: '10px', marginTop: 0 }}>Yeni İlan Ekleme ve Yönetim</h2>
            
            <form onSubmit={handleAdd} style={{ marginTop: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                <input type="text" name="title" placeholder="İlan Başlığı" value={form.title} onChange={handleChange} style={{ padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }} />
                <input type="text" name="price" placeholder="Fiyat (Örn: 250 TL)" value={form.price} onChange={handleChange} style={{ padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }} />
                <input type="text" name="category" placeholder="Kategori" value={form.category} onChange={handleChange} style={{ padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }} />
                <input type="text" name="location" placeholder="Konum" value={form.location} onChange={handleChange} style={{ padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }} />
              </div>
              <textarea name="description" placeholder="Açıklama" value={form.description} onChange={handleChange} style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ccc', marginBottom: '15px', height: '80px' }} />
              <button type="submit" style={{ backgroundColor: '#27ae60', color: '#fff', border: 'none', padding: '12px 20px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>İlanı Kaydet</button>
            </form>

            <h3 style={{ marginTop: '40px', color: '#2c3e50' }}>Mevcut İlanları Yönet</h3>
            {listings.map(item => (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', borderBottom: '1px solid #eee' }}>
                <span><b>{item.title}</b> - {item.price}</span>
                <button onClick={() => handleDelete(item.id)} style={{ backgroundColor: '#e74c3c', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}>Sil</button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

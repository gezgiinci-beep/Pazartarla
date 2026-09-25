import React, { useState, useEffect } from 'react';

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [listings, setListings] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Tüm kategoriler');
  const [form, setForm] = useState({ title: '', price: '', category: 'Traktör', location: 'Gönen / Balıkesir', description: '' });

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem('tarlepazar_listings'));
    if (saved && saved.length > 0) {
      setListings(saved);
    } else {
      const initial = [
        { id: 1, title: 'John Deere 6130M - Düşük saat, tek elden', price: '2.450.000 TL', category: 'Traktör', location: 'Gönen / Balıkesir', description: 'Bakımları yetkili serviste yapılmıştır.' },
        { id: 2, title: 'New Holland T6050 - Bakımlı ve hazır', price: '1.850.000 TL', category: 'Traktör', location: 'Balıkesir Merkez', description: 'Tarla ve bağ işleri için ideal.' }
      ];
      setListings(initial);
      localStorage.setItem('tarlepazar_listings', JSON.stringify(initial));
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
    localStorage.setItem('tarlepazar_listings', JSON.stringify(updated));
    setForm({ title: '', price: '', category: 'Traktör', location: '', description: '' });
    setActiveTab('home');
    alert('İlan başarıyla eklendi!');
  };

  const handleDelete = (id) => {
    const filtered = listings.filter(item => item.id !== id);
    setListings(filtered);
    localStorage.setItem('tarlepazar_listings', JSON.stringify(filtered));
  };

  const filteredListings = listings.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) || item.location.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'Tüm kategoriler' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8f9fa', color: '#2c3e50', fontFamily: 'Arial, sans-serif' }}>
      {/* Üst Header */}
      <header style={{ backgroundColor: '#1e3d2f', color: '#fff', padding: '15px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }} onClick={() => setActiveTab('home')}>
          <span style={{ fontSize: '24px' }}>🚜</span>
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 'bold' }}>TarlaPazar</h1>
        </div>
        <div style={{ display: 'flex', gap: '15px' }}>
          <button 
            onClick={() => setActiveTab('home')} 
            style={{ backgroundColor: activeTab === 'home' ? '#27ae60' : 'transparent', color: '#fff', border: '1px solid #27ae60', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            İlanları Keşfet
          </button>
          <button 
            onClick={() => setActiveTab('admin')} 
            style={{ backgroundColor: activeTab === 'admin' ? '#27ae60' : '#27ae60', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            + İlan Ver
          </button>
        </div>
      </header>

      {/* Ana İçerik */}
      <main style={{ padding: '30px 40px', maxWidth: '1200px', margin: '0 auto' }}>
        {activeTab === 'home' && (
          <div>
            <div style={{ marginBottom: '30px' }}>
              <h2 style={{ fontSize: '28px', color: '#1e3d2f', marginBottom: '8px' }}>İlanları keşfet</h2>
              <p style={{ color: '#666', margin: 0 }}>Tarlana, işine ve bütçene uygun ekipmanı bul.</p>
            </div>

            {/* Arama ve Filtre Çubuğu */}
            <div style={{ display: 'flex', gap: '15px', marginBottom: '30px', flexWrap: 'wrap' }}>
              <input 
                type="text" 
                placeholder="Marka, model, şehir ara..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ flex: 1, minWidth: '280px', padding: '12px 16px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '15px' }}
              />
              <select 
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                style={{ padding: '12px 16px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '15px', backgroundColor: '#fff' }}
              >
                <option value="Tüm kategoriler">Tüm kategoriler</option>
                <option value="Traktör">Traktör</option>
                <option value="Biçerdöver">Biçerdöver</option>
                <option value="Tarım Ekipmanları">Tarım Ekipmanları</option>
              </select>
            </div>

            <h3 style={{ fontSize: '18px', marginBottom: '20px', color: '#333' }}>{filteredListings.length} ilan bulundu</h3>

            {/* İlan Kartları Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
              {filteredListings.map(item => (
                <div key={item.id} style={{ backgroundColor: '#fff', border: '1px solid #e1e8ed', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div style={{ height: '180px', backgroundColor: '#e9ecef', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '40px' }}>
                    🚜
                  </div>
                  <div style={{ padding: '20px' }}>
                    <span style={{ fontSize: '11px', backgroundColor: '#e8f8f0', color: '#27ae60', padding: '4px 8px', borderRadius: '4px', fontWeight: 'bold' }}>
                      {item.category}
                    </span>
                    <h4 style={{ margin: '12px 0 8px 0', fontSize: '17px', color: '#2c3e50', lineHeight: '1.4' }}>{item.title}</h4>
                    <p style={{ fontSize: '20px', color: '#27ae60', fontWeight: 'bold', margin: '0 0 10px 0' }}>{item.price}</p>
                    <p style={{ fontSize: '13px', color: '#7f8c8d', margin: '0 0 10px 0' }}>📍 {item.location}</p>
                    <p style={{ fontSize: '13px', color: '#555', margin: 0 }}>{item.description}</p>
                  </div>
                  <div style={{ padding: '12px 20px', borderTop: '1px solid #f1f1f1', display: 'flex', justifyContent: 'flex-end' }}>
                    <button onClick={() => handleDelete(item.id)} style={{ backgroundColor: '#e74c3c', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>İlanı Kaldır</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'admin' && (
          <div style={{ backgroundColor: '#fff', padding: '40px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', maxWidth: '700px', margin: '0 auto' }}>
            <h2 style={{ color: '#1e3d2f', marginTop: 0, marginBottom: '20px', borderBottom: '2px solid #27ae60', paddingBottom: '10px' }}>TarlaPazar - Yeni İlan Ver</h2>
            
            <form onSubmit={handleAdd}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', fontSize: '14px' }}>İlan Başlığı *</label>
                <input type="text" name="title" placeholder="Örn: New Holland T6050" value={form.title} onChange={handleChange} style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #ccc', boxSizing: 'border-box' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', fontSize: '14px' }}>Fiyat (TL) *</label>
                  <input type="text" name="price" placeholder="Örn: 1.850.000 TL" value={form.price} onChange={handleChange} style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #ccc', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', fontSize: '14px' }}>Kategori</label>
                  <select name="category" value={form.category} onChange={handleChange} style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #ccc', backgroundColor: '#fff', boxSizing: 'border-box' }}>
                    <option value="Traktör">Traktör</option>
                    <option value="Biçerdöver">Biçerdöver</option>
                    <option value="Tarım Ekipmanları">Tarım Ekipmanları</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', fontSize: '14px' }}>Konum (Şehir / İlçe)</label>
                <input type="text" name="location" placeholder="Örn: Gönen / Balıkesir" value={form.location} onChange={handleChange} style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #ccc', boxSizing: 'border-box' }} />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', fontSize: '14px' }}>Açıklama</label>
                <textarea name="description" placeholder="Makinenin durumu, bakımları vb. detaylar..." value={form.description} onChange={handleChange} style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #ccc', height: '100px', boxSizing: 'border-box' }} />
              </div>

              <button type="submit" style={{ backgroundColor: '#27ae60', color: '#fff', border: 'none', padding: '14px 24px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px', width: '100%' }}>İlanı Yayınla</button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}

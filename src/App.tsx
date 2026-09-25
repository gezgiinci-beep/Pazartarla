import React, { useState, useEffect } from 'react';

export default function App() {
  const [listings, setListings] = useState([]);
  const [form, setForm] = useState({ title: '', price: '', category: '', location: '', image: '' });

  // Sayfa açıldığında kayıtlı ilanları yükle
  useEffect(() => {
    const savedListings = JSON.parse(localStorage.getItem('pazartarla_listings')) || [];
    setListings(savedListings);
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
    
    // Formu sıfırla
    setForm({ title: '', price: '', category: '', location: '', image: '' });
  };

  // İlan sil
  const handleDelete = (id) => {
    const filteredListings = listings.filter(item => item.id !== id);
    setListings(filteredListings);
    localStorage.setItem('pazartarla_listings', JSON.stringify(filteredListings));
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1000px', margin: '0 auto', fontFamily: 'Arial, sans-serif' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #27ae60', paddingBottom: '10px', marginBottom: '20px' }}>
        <h1 style={{ color: '#2c3e50', margin: 0, fontSize: '24px' }}>PazarTarla</h1>
        <span style={{ background: '#27ae60', color: 'white', padding: '5px 10px', borderRadius: '4px', fontSize: '14px' }}>Yönetim ve İlan Paneli</span>
      </header>

      {/* İlan Ekleme Formu */}
      <form onSubmit={handleAddListing} style={{ background: '#f9f9f9', padding: '20px', borderRadius: '8px', marginBottom: '30px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <h3 style={{ marginTop: 0, color: '#333' }}>Yeni İlan Ekle</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
          <input 
            type="text" 
            name="title" 
            placeholder="İlan Başlığı (Örn: Chandler Ceviz)" 
            value={form.title} 
            onChange={handleChange} 
            style={{ padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }}
          />
          <input 
            type="text" 
            name="price" 
            placeholder="Fiyat (Örn: 250 TL/Kg)" 
            value={form.price} 
            onChange={handleChange} 
            style={{ padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }}
          />
          <input 
            type="text" 
            name="category" 
            placeholder="Kategori (Örn: Tarım Ürünleri)" 
            value={form.category} 
            onChange={handleChange} 
            style={{ padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }}
          />
          <input 
            type="text" 
            name="location" 
            placeholder="Konum (Örn: Gönen / Balıkesir)" 
            value={form.location} 
            onChange={handleChange} 
            style={{ padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }}
          />
        </div>
        <button 
          type="submit" 
          style={{ background: '#27ae60', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          İlanı Kaydet
        </button>
      </form>

      {/* Mevcut İlanlar Listesi */}
      <div>
        <h3 style={{ color: '#333' }}>Mevcut İlanlar ({listings.length})</h3>
        {listings.length === 0 ? (
          <p style={{ color: '#7f8c8d' }}>Henüz eklenmiş bir ilan bulunmuyor.</p>
        ) : (
          <div style={{ display: 'grid', gap: '10px' }}>
            {listings.map((item) => (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '15px', borderRadius: '6px', border: '1px solid #e1e1e1' }}>
                <div>
                  <h4 style={{ margin: '0 0 5px 0', color: '#333' }}>{item.title}</h4>
                  <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>
                    Fiyat: <b>{item.price}</b> | Konum: {item.location || 'Belirtilmemiş'} | Kategori: {item.category || 'Genel'}
                  </p>
                </div>
                <button 
                  onClick={() => handleDelete(item.id)}
                  style={{ background: '#e74c3c', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '4px', cursor: 'pointer' }}
                >
                  Sil
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

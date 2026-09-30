import React, { useState } from 'react';

export default function App() {
  const [formData, setFormData] = useState({
    title: '',
    price: '',
    category: 'Mahsuller',
    location: 'Gönen / Balıkesir',
    seller: 'Can İnce',
    phone: '0535 768 1550',
    image: '',
    description: ''
  });

  const presets: Record<string, any> = {
    arazi: { title: "Gönen Kalburcu'da 5 Yıllık Cevizli Tarla", price: 2850000, category: "Arazi & Tarla", location: "Balıkesir / Gönen", image: "https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&q=80&w=800", description: "8.300 m2 içinde damla sulama sistemi kurulu, verimli cevizli tarla." },
    ceviz: { title: "Tarladan Doğrudan Taze Chandler Ceviz", price: 140, category: "Mahsuller", location: "Gönen / Balıkesir", image: "https://images.unsplash.com/photo-1559181567-c3190ca9959b?auto=format&fit=crop&q=80&w=800", description: "Kendi bahçemizin ürünü, ilaçsız ve dolgun Chandler ceviz." },
    traktor: { title: "New Holland TD100D Tarım Traktörü", price: 1450000, category: "Traktör", location: "Balıkesir / Gönen", image: "https://images.unsplash.com/photo-1592841202223-ca33cfd81b6f?auto=format&fit=crop&q=80&w=800", description: "Tertemiz, bakımları tam tarla traktörü." },
    kovan: { title: "Meşe Ormanı Çevresinde 10 Kovan Arı ve Bal", price: 3500, category: "Arıcılık", location: "Gönen / Kalburcu", image: "https://images.unsplash.com/photo-1587049352847-4a222e784d38?auto=format&fit=crop&q=80&w=800", description: "Zengin flora çevresinde üretilen doğal arı kovanı ve bal seti." },
    zeytin: { title: "Soğuk Sıkım Natürel Sızma Zeytinyağı (5 Lt)", price: 1750, category: "Mahsuller", location: "Balıkesir / Edremit", image: "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&q=80&w=800", description: "Düşük asit oranına sahip, kendi sıkımımız taze zeytinyağı." },
    koyun: { title: "Damızlık Safkan Merinos Koyun Sürüsü", price: 9500, category: "Canlı Hayvanlar", location: "Bandırma / Balıkesir", image: "https://images.unsplash.com/photo-1484557077804-d5c63391d79e?auto=format&fit=crop&q=80&w=800", description: "Sağlık kontrolleri yapılmış, aşılı damızlık koyunlar." }
  };

  const handlePresetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (!val || !presets[val]) return;
    const p = presets[val];
    setFormData({
      ...formData,
      title: p.title,
      price: p.price,
      category: p.category,
      location: p.location,
      image: p.image,
      description: p.description
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const sendToListings = async () => {
    const SUPABASE_URL = 'https://srbarfjzsfkmglsnmbtw.supabase.co';
    const SUPABASE_ANON_KEY = 'sb_publishable__8tUtClK2adq_ORRuL5PQ_oft6c';

    const payload = {
      title: formData.title.trim(),
      price: Number(formData.price),
      category: formData.category.trim(),
      location: formData.location.trim(),
      description: formData.description.trim(),
      seller: formData.seller.trim(),
      phone: formData.phone.trim(),
      image: formData.image.trim() || 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&q=80&w=800',
      status: 'approved'
    };

    if (!payload.title || !payload.price) {
      alert('Lütfen başlık ve fiyat alanlarını doldurun!');
      return;
    }

    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/listings`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        alert('🎉 Başarıyla eklendi! Sitenizde anında görünecektir.');
        setFormData({ ...formData, title: '', price: '', description: '' });
      } else {
        const err = await res.text();
        alert('Sunucu reddetti: ' + err);
      }
    } catch (e) {
      alert('Bağlantı hatası oluştu!');
    }
  };

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', background: '#0f172a', padding: '20px', minHeight: '100vh', color: '#f8fafc' }}>
      <div style={{ background: '#1e293b', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', border: '1px solid #334155', maxWidth: '480px', margin: '0 auto' }}>
        <h2 style={{ marginTop: 0, color: '#4ade80', fontSize: '18px' }}>🌾 PazarTarla Tarım & Arazi İlan Aracı</h2>
        
        <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Tarım & Arazi Şablonu Seç:</label>
        <select onChange={handlePresetChange} style={{ width: '100%', padding: '10px', marginBottom: '10px', background: '#0f172a', color: '#fff', border: '1px solid #475569', borderRadius: '6px', boxSizing: 'border-box' }}>
          <option value="">-- Tüm Tarım Kategorilerinden Seçin --</option>
          <option value="arazi">Satılık Cevizli Tarla / Arazi</option>
          <option value="ceviz">Tarladan Doğrudan Taze Chandler Ceviz</option>
          <option value="traktor">New Holland TD100D Tarım Traktörü</option>
          <option value="kovan">Arıcılık: 10 Çerçeveli Bal Kovanı</option>
          <option value="zeytin">Erken Hasat Sızma Zeytinyağı</option>
          <option value="koyun">Damızlık Merinos Koyun Sürüsü</option>
        </select>

        <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>İlan Başlığı *</label>
        <input type="text" name="title" value={formData.title} onChange={handleChange} placeholder="Örn: Gönen'de Satılık Tarla" style={{ width: '100%', padding: '10px', marginBottom: '10px', background: '#0f172a', color: '#fff', border: '1px solid #475569', borderRadius: '6px', boxSizing: 'border-box' }} />

        <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Fiyat (TL) *</label>
        <input type="number" name="price" value={formData.price} onChange={handleChange} placeholder="1250000" style={{ width: '100%', padding: '10px', marginBottom: '10px', background: '#0f172a', color: '#fff', border: '1px solid #475569', borderRadius: '6px', boxSizing: 'border-box' }} />

        <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Kategori</label>
        <input type="text" name="category" value={formData.category} onChange={handleChange} placeholder="Mahsuller / Traktör / Arazi" style={{ width: '100%', padding: '10px', marginBottom: '10px', background: '#0f172a', color: '#fff', border: '1px solid #475569', borderRadius: '6px', boxSizing: 'border-box' }} />

        <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Konum</label>
        <input type="text" name="location" value={formData.location} onChange={handleChange} placeholder="Konum" style={{ width: '100%', padding: '10px', marginBottom: '10px', background: '#0f172a', color: '#fff', border: '1px solid #475569', borderRadius: '6px', boxSizing: 'border-box' }} />

        <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Satıcı ve Telefon</label>
        <input type="text" name="seller" value={formData.seller} onChange={handleChange} style={{ width: '100%', padding: '10px', marginBottom: '10px', background: '#0f172a', color: '#fff', border: '1px solid #475569', borderRadius: '6px', boxSizing: 'border-box' }} />
        <input type="text" name="phone" value={formData.phone} onChange={handleChange} style={{ width: '100%', padding: '10px', marginBottom: '10px', background: '#0f172a', color: '#fff', border: '1px solid #475569', borderRadius: '6px', boxSizing: 'border-box' }} />

        <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Görsel URL</label>
        <input type="text" name="image" value={formData.image} onChange={handleChange} placeholder="https://..." style={{ width: '100%', padding: '10px', marginBottom: '10px', background: '#0f172a', color: '#fff', border: '1px solid #475569', borderRadius: '6px', boxSizing: 'border-box' }} />

        <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Açıklama</label>
        <textarea name="description" value={formData.description} onChange={handleChange} placeholder="Detaylı tarım ve arazi açıklaması..." style={{ width: '100%', padding: '10px', marginBottom: '10px', background: '#0f172a', color: '#fff', border: '1px solid #475569', borderRadius: '6px', boxSizing: 'border-box', height: '60px' }}></textarea>

        <button onClick={sendToListings} style={{ width: '100%', padding: '12px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' }}>🚀 Doğrudan Yayına Gönder</button>
      </div>
    </div>
  );
}

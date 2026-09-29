import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, SlidersHorizontal, MapPin, Phone, MessageCircle, Plus, 
  Heart, Share2, ShieldCheck, CheckCircle2, ChevronRight, ChevronDown, X, 
  Car, Tractor, Wrench, ArrowRight, Bell, User, Filter, AlertCircle, Trash2, Settings, Lock, Check, Mail, Globe, Copy, HelpCircle, Users, Image as ImageIcon, Bug, Shield, Package, ArrowLeft, Menu, ArrowUpDown, LayoutList, Star, Send, ShieldAlert, FolderPlus, Tag, Edit3, Sparkles, Megaphone, CheckCircle, Bot 
} from 'lucide-react';

const SUPABASE_URL = 'https://srbarfjzsfkmglsnmbtw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNyYmFyZmp6c2ZrbWdsc25tYnR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2ODAzMTQsImV4cCI6MjEwNjI1NjMxNH0.pTYlQxbTvVOHAarNW7ITckRJxffgDkZNO5li17F76xQ';

const dbHeaders = {
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
};

const DEFAULT_START_LISTINGS = [
  {
    id: 1,
    title: 'Tarladan Doğrudan Taze Chandler Ceviz',
    price: 140,
    category: 'Mahsuller',
    subCategory: 'Ceviz',
    mode: 'Satılık',
    location: 'Gönen / Balıkesir',
    amount: '1 Ton',
    description: 'Kendi bahçemizin ürünü, ilaçsız ve dolgun Chandler ceviz.',
    seller: 'Can İnce',
    phone: '0535 768 1550',
    image: 'https://images.unsplash.com/photo-1559181567-c3190ca9959b?auto=format&fit=crop&q=80&w=800',
    seoTags: 'taze ceviz, chandler ceviz, gönen ceviz, tarım ilanı, mahsul',
    status: 'approved'
  }
];

const FALLBACK_CATEGORIES = {
  'Mahsuller': ['Kiraz', 'Ceviz', 'Zeytin & Zeytinyağı', 'Buğday', 'Bakliyat', 'Meyve & Sebze'],
  'Canlı Hayvanlar': ['Büyükbaş', 'Küçükbaş', 'Kanatlı'],
  'Hayvan Yemleri ve Ekipmanları': ['Yem Çeşitleri', 'Suluk / Yemlik'],
  'Arıcılık': ['Bal', 'Polen', 'Arı Ekmeği', 'Arı Sütü', 'Kovan ve Ekipmanları'],
  'Traktör': ['İkinci El Traktör', 'Sıfır Traktör', 'Ekipmanlar'],
  'Biçerdöver': ['Biçerdöver'],
  'Tarım Ekipmanları': ['Römork', 'İlaçlama Makinesi', 'Çapa Makinası', 'Pulluk', 'Kepçe & Yükleyici'],
  'Tarım İşçileri': ['Hasat Ekibi', 'Budama Ekibi'],
  'Uzmanlar': ['Veterinerler', 'Ziraatçiler']
};

export default function App() {
  const [showSplash, setShowSplash] = useState(false);
  const [activeTab, setActiveTab] = useState('home'); 
  
  const [listings, setListings] = useState(DEFAULT_START_LISTINGS);
  const [categoriesWithSubs, setCategoriesWithSubs] = useState(FALLBACK_CATEGORIES);

  const [selectedListing, setSelectedListing] = useState(null);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Tüm kategoriler');
  const [selectedSubCategory, setSelectedSubCategory] = useState('Tümü');
  
  const [lastAddedListing, setLastAddedListing] = useState(null);

  const [form, setForm] = useState({
    title: '',
    price: '',
    category: 'Mahsuller',
    subCategory: 'Ceviz',
    mode: 'Satılık',
    location: 'Türkiye Geneli',
    amount: '',
    description: '',
    seller: '',
    phone: '',
    image: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&q=80&w=800',
    status: 'pending'
  });

  const fetchListings = async () => {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/listings?select=*`, {
        headers: dbHeaders
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          setListings(data);
        }
      }
    } catch (e) {
      console.error('Veri çekme hatası:', e);
    }
  };

  useEffect(() => {
    fetchListings();
  }, []);

  const changeTab = (tabName) => {
    setActiveTab(tabName);
    window.scrollTo(0, 0);
  };

  const sanitizeInput = (str) => {
    if (typeof str !== 'string') return str;
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => {
      const updated = { ...prev, [name]: value };
      if (name === 'category') {
        const subList = categoriesWithSubs[value] || ['Genel'];
        updated.subCategory = subList[0];
      }
      return updated;
    });
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('Dosya boyutu 2 MB sınırını aşamaz!');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => setForm(prev => ({ ...prev, image: reader.result }));
      reader.readAsDataURL(file);
    }
  };

  const handleDirectAdd = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.price || !form.phone.trim() || !form.seller.trim()) {
      alert('Lütfen zorunlu alanları eksiksiz doldurun.');
      return;
    }

    const newEntry = {
      title: sanitizeInput(form.title),
      price: Number(form.price),
      category: form.category,
      subCategory: form.subCategory,
      mode: form.mode || 'Satılık',
      location: sanitizeInput(form.location || 'Türkiye Geneli'),
      amount: sanitizeInput(form.amount || ''),
      description: sanitizeInput(form.description || ''),
      seller: sanitizeInput(form.seller),
      phone: sanitizeInput(form.phone),
      image: form.image,
      status: 'pending'
    };

    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/listings`, {
        method: 'POST',
        headers: dbHeaders,
        body: JSON.stringify(newEntry)
      });

      if (!res.ok) {
        const errDetail = await res.text();
        alert(`Veritabanı reddetti: ${errDetail}`);
        return;
      }

      fetchListings();
      setLastAddedListing(newEntry);
      changeTab('success-wa');
    } catch (err) {
      alert('Bağlantı hatası oluştu.');
    }
  };

  const approvedListings = listings.filter(item => item.status === 'approved');
  const filteredListings = (selectedCategory === 'Tüm kategoriler' && selectedSubCategory === 'Tümü')
    ? approvedListings
    : approvedListings.filter(item => {
        const matchesCategory = selectedCategory === 'Tüm kategoriler' || item.category === selectedCategory;
        const matchesSubCategory = selectedSubCategory === 'Tümü' || item.subCategory === selectedSubCategory;
        return matchesCategory && matchesSubCategory;
      });

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f4f6f8', color: '#1e293b', fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column', width: '100%', maxWidth: '100vw', boxSizing: 'border-box' }}>
      <header style={{ backgroundColor: '#1b3a2b', color: '#ffffff', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }} onClick={() => { changeTab('home'); setSelectedCategory('Tüm kategoriler'); }}>
          <div style={{ backgroundColor: '#22c55e', padding: '6px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span>🌾</span>
            <Tractor size={18} color="#fff" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '18px', fontWeight: '800' }}>PazarTarla</h1>
            <span style={{ fontSize: '10px', color: '#86efac' }}>Canlı Ortak Platform</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button onClick={() => changeTab('add')} style={{ backgroundColor: '#22c55e', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: '700', fontSize: '13px' }}>
            <Plus size={16} /> İlan Ver
          </button>
        </div>
      </header>

      <main style={{ width: '100%', maxWidth: '600px', margin: '0 auto', padding: '12px', flex: 1, boxSizing: 'border-box' }}>
        {activeTab === 'success-wa' && (
          <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '24px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
            <CheckCircle size={36} color="#166534" style={{ margin: '0 auto 12px auto' }} />
            <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#1b3a2b', margin: '0 0 8px 0' }}>İlanınız Başarıyla Alındı!</h2>
            <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '20px' }}>Yönetici onayından sonra tüm cihazlarda görünecektir.</p>
            
            {lastAddedListing && (
              <a 
                href={`https://wa.me/905357681550?text=${encodeURIComponent(`🔔 *Yeni İlan Onay Bekliyor!*\n\n*Başlık:* ${lastAddedListing.title}\n*Fiyat:*${lastAddedListing.price} TL\n*Kategori:* ${lastAddedListing.category} /${lastAddedListing.subCategory}\n*Satıcı:* ${lastAddedListing.seller} (${lastAddedListing.phone})`)}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', backgroundColor: '#22c55e', color: '#fff', padding: '12px', borderRadius: '8px', fontWeight: '800', textDecoration: 'none', fontSize: '14px', marginBottom: '12px' }}
              >
                <MessageCircle size={18} /> WhatsApp ile Ekipten Onay İste
              </a>
            )}

            <button onClick={() => changeTab('home')} style={{ background: 'none', border: 'none', color: '#64748b', fontWeight: '700', cursor: 'pointer' }}>← Ana Sayfaya Dön</button>
          </div>
        )}

        {activeTab === 'home' && (
          <div>
            <div style={{ backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
              <div style={{ backgroundColor: '#1b3a2b', color: '#fff', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Menu size={20} />
                <span style={{ fontSize: '16px', fontWeight: '700' }}>Kategoriler (Canlı)</span>
              </div>

              <div onClick={() => { setSelectedCategory('Tüm kategoriler'); setSelectedSubCategory('Tümü'); changeTab('results'); }} style={{ padding: '14px 16px', borderBottom: '1px solid #edf2f7', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', backgroundColor: '#f8fafc' }}>
                <span style={{ fontWeight: '700', color: '#1b3a2b', fontSize: '15px' }}>Tüm Türkiye Tarım İlanları</span>
                <span style={{ color: '#22c55e', fontWeight: '700' }}>({approvedListings.length})</span>
              </div>

              {Object.keys(categoriesWithSubs).map(cat => (
                <div key={cat} onClick={() => { setSelectedCategory(cat); setSelectedSubCategory('Tümü'); changeTab('results'); }} style={{ padding: '14px 16px', borderBottom: '1px solid #edf2f7', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                  <span style={{ fontWeight: '600', color: '#334155', fontSize: '14px' }}>{cat}</span>
                  <span style={{ color: '#94a3b8', fontSize: '13px' }}>({approvedListings.filter(i => i.category === cat).length})</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'results' && (
          <div>
            <div style={{ backgroundColor: '#1b3a2b', color: '#fff', borderRadius: '10px', padding: '10px 14px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button onClick={() => changeTab('home')} style={{ background: 'none', border: 'none', color: '#86efac', fontWeight: '700', cursor: 'pointer' }}><ArrowLeft size={16} /> Kategoriler</button>
              <span>{filteredListings.length} sonuç</span>
            </div>

            {filteredListings.map(item => (
              <div key={item.id} onClick={() => { setSelectedListing(item); changeTab('detail'); }} style={{ backgroundColor: '#fff', borderRadius: '10px', overflow: 'hidden', border: '1px solid #e2e8f0', cursor: 'pointer', display: 'flex', gap: '10px', padding: '10px', marginBottom: '10px' }}>
                <img src={item.image} alt={item.title} style={{ width: '90px', height: '90px', objectFit: 'cover', borderRadius: '8px' }} />
                <div style={{ flex: 1 }}>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '13px', fontWeight: '700' }}>{item.title}</h4>
                  <div style={{ fontSize: '15px', fontWeight: '800', color: '#1b3a2b' }}>{Number(item.price).toLocaleString('tr-TR')} TL</div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>📍 {item.location}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'detail' && selectedListing && (
          <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '16px', border: '1px solid #e2e8f0' }}>
            <button onClick={() => changeTab('results')} style={{ background: 'none', border: 'none', color: '#64748b', fontWeight: '600', cursor: 'pointer', marginBottom: '10px' }}>← Listeye Dön</button>
            <img src={selectedListing.image} alt={selectedListing.title} style={{ width: '100%', height: '220px', objectFit: 'cover', borderRadius: '8px', marginBottom: '10px' }} />
            <h2 style={{ fontSize: '18px', fontWeight: '800', margin: '8px 0' }}>{selectedListing.title}</h2>
            <div style={{ fontSize: '22px', fontWeight: '800', color: '#1b3a2b', marginBottom: '4px' }}>{Number(selectedListing.price).toLocaleString('tr-TR')} TL</div>
            <p style={{ color: '#475569', fontSize: '13px', marginBottom: '16px' }}>{selectedListing.description}</p>
            <a href={`tel:${selectedListing.phone}`} style={{ width: '100%', backgroundColor: '#1b3a2b', color: '#fff', padding: '12px', borderRadius: '8px', textAlign: 'center', fontWeight: '700', textDecoration: 'none', display: 'block' }}>
              📞 {selectedListing.phone} ({selectedListing.seller})
            </a>
          </div>
        )}

        {activeTab === 'add' && (
          <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '16px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <button onClick={() => changeTab('home')} style={{ background: 'none', border: 'none', color: '#64748b', fontWeight: '600', cursor: 'pointer' }}>← Vazgeç</button>
              <h2 style={{ fontSize: '16px', fontWeight: '800', margin: 0 }}>İlan Ver</h2>
            </div>
            <form onSubmit={handleDirectAdd} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input type="text" name="seller" placeholder="Adınız Soyadınız *" value={form.seller} onChange={handleFormChange} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
              <input type="text" name="phone" placeholder="Telefon Numaranız *" value={form.phone} onChange={handleFormChange} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
              <input type="text" name="title" placeholder="İlan Başlığı *" value={form.title} onChange={handleFormChange} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
              <input type="number" name="price" placeholder="Fiyat (TL) *" value={form.price} onChange={handleFormChange} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
             
              <select name="category" value={form.category} onChange={handleFormChange} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                {Object.keys(categoriesWithSubs).map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>

              <select name="subCategory" value={form.subCategory} onChange={handleFormChange} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                {(categoriesWithSubs[form.category] || ['Genel']).map(sub => <option key={sub} value={sub}>{sub}</option>)}
              </select>

              <input type="text" name="location" placeholder="Konum (Örn: Gönen / Balıkesir)" value={form.location} onChange={handleFormChange} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
             
              <div style={{ backgroundColor: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569' }}>📷 Fotoğraf (Opsiyonel / Hazır Resim Kullanılır)</label>
                <input type="file" accept="image/*" onChange={handleImageUpload} style={{ width: '100%', fontSize: '12px' }} />
              </div>

              <textarea name="description" placeholder="Açıklama..." value={form.description} onChange={handleFormChange} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', height: '80px' }} />

              <button type="submit" style={{ backgroundColor: '#22c55e', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}>İlanı Gönder</button>
            </form>
          </div>
        )}

        {activeTab === 'admin' && (
          <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '16px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <button onClick={() => changeTab('home')} style={{ background: 'none', border: 'none', color: '#64748b', fontWeight: '600', cursor: 'pointer' }}>← Ana Sayfaya Dön</button>
              <h2 style={{ fontSize: '16px', fontWeight: '800', margin: 0 }}>Admin Paneli</h2>
            </div>
            {!isAdminLoggedIn ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <input type="password" placeholder="Admin Şifresi" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                <button onClick={() => { if (adminPassword === '1234') setIsAdminLoggedIn(true); else alert('Hatalı Şifre!'); }} style={{ backgroundColor: '#1b3a2b', color: '#fff', padding: '10px', borderRadius: '6px', border: 'none', fontWeight: '700', cursor: 'pointer' }}>Giriş Yap</button>
              </div>
            ) : (
              <div>
                <p style={{ color: '#166534', fontWeight: '700', marginBottom: '12px' }}>✓ Admin Girişi Başarılı (Bekleyen İlan Yönetimi)</p>
                {listings.map(item => (
                  <div key={item.id} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: '700', fontSize: '13px' }}>{item.title}</div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>Durum: {item.status}</div>
                    </div>
                    {item.status !== 'approved' ? (
                      <button onClick={async () => {
                        await fetch(`${SUPABASE_URL}/rest/v1/listings?id=eq.${item.id}`, {
                          method: 'PATCH',
                          headers: dbHeaders,
                          body: JSON.stringify({ status: 'approved' })
                        });
                        fetchListings();
                      }} style={{ backgroundColor: '#22c55e', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Onayla</button>
                    ) : (
                      <span style={{ color: '#166534', fontSize: '12px', fontWeight: '700' }}>Onaylı</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      <footer style={{ backgroundColor: '#ffffff', borderTop: '1px solid #e5e7eb', padding: '24px 0', marginTop: '48px', textAlign: 'center' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <p style={{ color: '#4b5563', fontSize: '14px', margin: 0 }}>© 2026 PazarTarla - Tarım ve Ürün Pazarı</p>
          <button 
            onClick={() => changeTab('admin')} 
            style={{ background: 'none', border: 'none', color: '#047857', fontWeight: '600', cursor: 'pointer', fontSize: '14px' }}
          >
            Admin Paneli
          </button>
        </div>
      </footer>
    </div>
  );
}

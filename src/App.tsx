import React, { useState, useEffect } from 'react';
import { 
  Search, SlidersHorizontal, MapPin, Phone, MessageCircle, Plus, 
  Heart, Share2, ShieldCheck, CheckCircle2, ChevronRight, X, 
  Car, Tractor, Wrench, ArrowRight, Bell, User, Filter, AlertCircle, Trash2, Settings, Lock, Check, Mail, Globe, Copy, HelpCircle, Users, Send 
} from 'lucide-react';

const INITIAL_LISTINGS = [
  {
    id: 1,
    title: 'John Deere 6130M - Düşük saat, tek elden',
    price: 2450000,
    category: 'Traktör',
    mode: 'Satılık',
    location: 'Gönen / Balıkesir',
    city: 'Balıkesir',
    year: 2021,
    hours: 1200,
    power: '130 HP',
    description: 'Kapalı garaj traktörüdür. Tüm bakımları yetkili serviste yapılmıştır. Hiçbir masrafı yoktur, lastikleri %90 durumdadır.',
    seller: 'Ahmet Yılmaz',
    phone: '0532 555 0192',
    verified: true,
    featured: true,
    image: 'https://images.unsplash.com/photo-1592417817098-8f3d69204052?auto=format&fit=crop&q=80&w=800',
    date: 'Bugün'
  },
  {
    id: 2,
    title: 'Ceviz Hasadı İçin 10 Kişilik Tecrübeli İşçi Ekibi',
    price: 1200,
    category: 'Tarım İşçileri',
    mode: 'Hizmet',
    location: 'Gönen / Balıkesir',
    city: 'Balıkesir',
    year: 2026,
    hours: 0,
    power: '10 Kişi',
    description: 'Ceviz silkme, toplama ve ayıklama işlerinde tecrübeli ekibimizle hizmetinizdeyiz. Günlük yevmiye usulü veya götürü usulü görüşülür.',
    seller: 'Mehmet Dayıbaşı',
    phone: '0535 444 3322',
    verified: true,
    featured: true,
    image: 'https://images.unsplash.com/photo-1595974482597-4f8cae7d1743?auto=format&fit=crop&q=80&w=800',
    date: 'Bugün'
  }
];

export default function App() {
  const [activeTab, setActiveTab] = useState('home'); 
  const [listings, setListings] = useState(INITIAL_LISTINGS);
  const [selectedListing, setSelectedListing] = useState(null);
  
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMode, setSelectedMode] = useState('Tümü'); 
  const [selectedCategory, setSelectedCategory] = useState('Tüm kategoriler');
  const [selectedCity, setSelectedCity] = useState('Tüm Türkiye');

  const [form, setForm] = useState({
    title: '',
    price: '',
    category: 'Traktör',
    mode: 'Satılık',
    location: 'Gönen / Balıkesir',
    city: 'Balıkesir',
    year: '2026',
    hours: '',
    power: '',
    description: '',
    seller: '',
    phone: '',
    image: 'https://images.unsplash.com/photo-1592417817098-8f3d69204052?auto=format&fit=crop&q=80&w=800'
  });

  const [pendingListing, setPendingListing] = useState(null);

  useEffect(() => {
    const saved = localStorage.getItem('pazartarla_listings');
    if (saved) {
      try {
        setListings(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const saveListings = (newListings) => {
    setListings(newListings);
    localStorage.setItem('pazartarla_listings', JSON.stringify(newListings));
  };

  const handleFormChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // İlan verince direkt WhatsApp onay ekranına yönlendirir
  const handleInitiateAdd = (e) => {
    e.preventDefault();
    if (!form.title || !form.price || !form.phone || !form.seller) {
      alert('Lütfen başlık, fiyat/yevmiye, ad Soyad ve telefon numarası alanlarını doldurun.');
      return;
    }

    const newEntry = {
      ...form,
      id: Date.now(),
      price: Number(form.price),
      verified: true,
      featured: false,
      date: 'Bugün'
    };

    setPendingListing(newEntry);
    setActiveTab('whatsapp-pending');
  };

  const handleFinalPublish = () => {
    const updated = [pendingListing, ...listings];
    saveListings(updated);
    setPendingListing(null);
    setActiveTab('home');
    alert('İlan başarıyla onaylandı ve yayına alındı!');
  };

  const handleDeleteListing = (id) => {
    if (window.confirm('Bu ilanı silmek istediğinize emin misiniz?')) {
      const updated = listings.filter(item => item.id !== id);
      saveListings(updated);
    }
  };

  const handleAdminLogin = (e) => {
    e.preventDefault();
    if (adminPassword === '1234' || adminPassword === 'admin') {
      setIsAdminLoggedIn(true);
    } else {
      alert('Hatalı şifre!');
    }
  };

  const handleForgotPassword = () => {
    alert('Admin Paneli Şifreniz: 1234');
  };

  const shareOnFacebook = (title) => {
    const url = window.location.href;
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(title)}`, '_blank');
  };

  const shareOnTwitter = (title) => {
    const url = window.location.href;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(title + ' - PazarTarla üzerinden incele:')}&url=${encodeURIComponent(url)}`, '_blank');
  };

  const shareOnWhatsApp = (title) => {
    const url = window.location.href;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(title + ' İlanı: ' + url)}`, '_blank');
  };

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    alert('İlan bağlantısı panoya kopyalandı!');
  };

  const filteredListings = listings.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.location.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesMode = selectedMode === 'Tümü' || item.mode === selectedMode;
    const matchesCategory = selectedCategory === 'Tüm kategoriler' || item.category === selectedCategory;
    const matchesCity = selectedCity === 'Tüm Türkiye' || item.city === selectedCity;

    return matchesSearch && matchesMode && matchesCategory && matchesCity;
  });

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', color: '#1e293b', fontFamily: 'system-ui, -apple-system, sans-serif', display: 'flex', flexDirection: 'column' }}>
      
      {/* ÜST HEADER */}
      <header style={{ backgroundColor: '#1b3a2b', color: '#ffffff', padding: '16px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 10px rgba(0,0,0,0.1)', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }} onClick={() => setActiveTab('home')}>
          <div style={{ backgroundColor: '#22c55e', padding: '8px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Tractor size={24} color="#fff" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '800', letterSpacing: '-0.5px' }}>PazarTarla</h1>
            <span style={{ fontSize: '11px', color: '#86efac' }}>Tarım Makineleri ve İşçi Pazaryeri</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button 
            onClick={() => setActiveTab('home')}
            style={{ backgroundColor: activeTab === 'home' ? 'rgba(255,255,255,0.15)' : 'transparent', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}
          >
            İlanları Keşfet
          </button>
          <button 
            onClick={() => setActiveTab('add')}
            style={{ backgroundColor: '#22c55e', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: '700', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(34, 197, 94, 0.3)' }}
          >
            <Plus size={18} /> İlan Ver
          </button>
        </div>
      </header>

      {/* ANA İÇERİK */}
      <main style={{ maxWidth: '1280px', width: '100%', margin: '0 auto', padding: '32px 20px', flex: 1, boxSizing: 'border-box' }}>
        
        {activeTab === 'home' && (
          <div>
            <div style={{ marginBottom: '32px' }}>
              <h2 style={{ fontSize: '32px', fontWeight: '800', color: '#0f172a', margin: '0 0 8px 0', letterSpacing: '-1px' }}>
                İlanları keşfet
              </h2>
              <p style={{ color: '#64748b', fontSize: '16px', margin: 0 }}>
                Tarlana uygun makineyi veya hasat için tarım işçi ekibini hemen bul.
              </p>
            </div>

            <div style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', marginBottom: '32px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid #f1f5f9', paddingBottom: '16px', flexWrap: 'wrap' }}>
                {['Tümü', 'Satılık', 'Kiralık', 'Hizmet'].map(mode => (
                  <button
                    key={mode}
                    onClick={() => setSelectedMode(mode)}
                    style={{
                      padding: '8px 20px',
                      borderRadius: '8px',
                      border: 'none',
                      fontWeight: '600',
                      fontSize: '14px',
                      cursor: 'pointer',
                      backgroundColor: selectedMode === mode ? '#1b3a2b' : '#f1f5f9',
                      color: selectedMode === mode ? '#fff' : '#475569',
                      transition: 'all 0.2s'
                    }}
                  >
                    {mode}
                  </button>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px 200px', gap: '16px', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Search size={20} color="#94a3b8" style={{ position: 'absolute', left: '14px' }} />
                  <input 
                    type="text"
                    placeholder="Marka, model, işçi grubu, şehir ara..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 14px 12px 46px',
                      borderRadius: '10px',
                      border: '1px solid #cbd5e1',
                      fontSize: '15px',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <select 
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  style={{ padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '15px', backgroundColor: '#fff', outline: 'none', cursor: 'pointer' }}
                >
                  <option value="Tüm kategoriler">Tüm Kategoriler</option>
                  <option value="Traktör">Traktör</option>
                  <option value="Biçerdöver">Biçerdöver</option>
                  <option value="Tarım Ekipmanları">Tarım Ekipmanları</option>
                  <option value="Tarım İşçileri">Tarım İşçileri / Ekipler</option>
                </select>

                <select 
                  value={selectedCity}
                  onChange={(e) => setSelectedCity(e.target.value)}
                  style={{ padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '15px', backgroundColor: '#fff', outline: 'none', cursor: 'pointer' }}
                >
                  <option value="Tüm Türkiye">Tüm Türkiye</option>
                  <option value="Balıkesir">Balıkesir</option>
                  <option value="Bursa">Bursa</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#334155', margin: 0 }}>
                {filteredListings.length} ilan bulundu
              </h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '24px' }}>
              {filteredListings.map(item => (
                <div 
                  key={item.id} 
                  onClick={() => { setSelectedListing(item); setActiveTab('detail'); }}
                  style={{ backgroundColor: '#fff', borderRadius: '16px', overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', cursor: 'pointer', display: 'flex', flexDirection: 'column' }}
                >
                  <div style={{ position: 'relative', height: '180px', backgroundColor: '#f1f5f9' }}>
                    <img src={item.image} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <span style={{ position: 'absolute', top: '12px', left: '12px', backgroundColor: item.mode === 'Satılık' ? '#22c55e' : item.mode === 'Kiralık' ? '#f59e0b' : '#3b82f6', color: '#fff', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '700' }}>
                      {item.mode}
                    </span>
                  </div>
                  <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between' }}>
                    <div>
                      <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>{item.category}</span>
                      <h4 style={{ margin: '6px 0 12px 0', fontSize: '16px', fontWeight: '700', color: '#0f172a', lineHeight: '1.4' }}>{item.title}</h4>
                    </div>
                    <div>
                      <div style={{ fontSize: '20px', fontWeight: '800', color: '#1b3a2b', marginBottom: '12px' }}>
                        {item.price.toLocaleString('tr-TR')} TL
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '12px', fontSize: '13px', color: '#64748b' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><MapPin size={14} /> {item.location}</span>
                        <span>{item.date}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'detail' && selectedListing && (
          <div style={{ maxWidth: '800px', margin: '0 auto', backgroundColor: '#fff', borderRadius: '20px', padding: '32px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <button onClick={() => setActiveTab('home')} style={{ background: 'none', border: 'none', color: '#64748b', fontWeight: '600', cursor: 'pointer' }}>← Geri dön</button>
            </div>
            <div style={{ height: '350px', borderRadius: '12px', overflow: 'hidden', marginBottom: '24px' }}>
              <img src={selectedListing.image} alt={selectedListing.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', margin: '12px 0' }}>{selectedListing.title}</h2>
            <div style={{ fontSize: '28px', fontWeight: '800', color: '#1b3a2b', marginBottom: '20px' }}>{selectedListing.price.toLocaleString('tr-TR')} TL</div>
            <p style={{ color: '#475569', lineHeight: '1.6' }}>{selectedListing.description}</p>
          </div>
        )}

        {activeTab === 'add' && (
          <div style={{ maxWidth: '700px', margin: '0 auto', backgroundColor: '#fff', borderRadius: '20px', padding: '32px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
            <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', marginBottom: '24px' }}>PazarTarla - Yeni İlan Ver</h2>
            <form onSubmit={handleInitiateAdd} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', fontSize: '14px' }}>İlan Başlığı *</label>
                <input type="text" name="title" placeholder="Örn: 10 Kişilik Ceviz Hasat Ekibi veya Traktör" value={form.title} onChange={handleFormChange} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', fontSize: '14px' }}>Fiyat / Yevmiye (TL) *</label>
                  <input type="number" name="price" placeholder="Örn: 1500" value={form.price} onChange={handleFormChange} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', fontSize: '14px' }}>Kategori</label>
                  <select name="category" value={form.category} onChange={handleFormChange} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', backgroundColor: '#fff' }}>
                    <option value="Traktör">Traktör</option>
                    <option value="Biçerdöver">Biçerdöver</option>
                    <option value="Tarım Ekipmanları">Tarım Ekipmanları</option>
                    <option value="Tarım İşçileri">Tarım İşçileri / Ekipler</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', fontSize: '14px' }}>İletişim Adı / Dayıbaşı *</label>
                <input type="text" name="seller" placeholder="Adınız Soyadınız" value={form.seller} onChange={handleFormChange} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', fontSize: '14px' }}>Telefon Numarası *</label>
                <input type="text" name="phone" placeholder="0532 000 0000" value={form.phone} onChange={handleFormChange} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
              </div>
              <button type="submit" style={{ backgroundColor: '#25D366', color: '#fff', border: 'none', padding: '14px', borderRadius: '12px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <MessageCircle size={20} /> WhatsApp ile Yöneticiye Gönder
              </button>
            </form>
          </div>
        )}

        {activeTab === 'whatsapp-pending' && pendingListing && (
          <div style={{ maxWidth: '520px', margin: '40px auto', backgroundColor: '#fff', borderRadius: '20px', padding: '32px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0', textAlign: 'center' }}>
            <div style={{ backgroundColor: '#dcfce7', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto' }}>
              <MessageCircle size={32} color="#16a34a" />
            </div>
            <h2 style={{ fontSize: '22px', fontWeight: '800', color: '#0f172a', marginBottom: '8px' }}>WhatsApp Onayı Gerekiyor</h2>
            <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '24px' }}>
              İlanınızın yayınlanması için yöneticinin (Can - 0535 768 1550) WhatsApp üzerinden onay vermesi gerekmektedir.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <a 
                href={`https://wa.me/905357681550?text=${encodeURIComponent(`Merhaba Can, PazarTarla yeni ilan onayı:\n\nBaşlık: ${pendingListing.title}\nFiyat: ${pendingListing.price} TL\nKategori:${pendingListing.category}\nİletişim: ${pendingListing.seller} (${pendingListing.phone})\n\nOnaylıyorum.`)}`}
                target="_blank"
                rel="noreferrer"
                style={{ backgroundColor: '#25D366', color: '#fff', border: 'none', padding: '14px', borderRadius: '12px', fontWeight: '700', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                <MessageCircle size={20} /> WhatsApp'ta Onaya Gönder
              </a>
              <button 
                onClick={handleFinalPublish}
                style={{ backgroundColor: '#1b3a2b', color: '#fff', border: 'none', padding: '14px', borderRadius: '12px', fontWeight: '700', cursor: 'pointer' }}
              >
                Yönetici Olarak Onayla ve Yayınla
              </button>
            </div>
          </div>
        )}

        {activeTab === 'admin' && (
          <div style={{ maxWidth: '900px', margin: '0 auto', backgroundColor: '#fff', borderRadius: '20px', padding: '32px', border: '1px solid #e2e8f0' }}>
            {!isAdminLoggedIn ? (
              <div style={{ maxWidth: '400px', margin: '40px auto', textAlign: 'center' }}>
                <h2 style={{ fontSize: '22px', fontWeight: '800', marginBottom: '8px' }}>Admin Girişi</h2>
                <form onSubmit={handleAdminLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <input type="password" placeholder="Admin Şifresi" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', textAlign: 'center' }} />
                  <button type="submit" style={{ backgroundColor: '#1b3a2b', color: '#fff', border: 'none', padding: '12px', borderRadius: '10px', fontWeight: '700' }}>Giriş Yap</button>
                </form>
                <button type="button" onClick={handleForgotPassword} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', marginTop: '16px', textDecoration: 'underline' }}>Şifremi Unuttum?</button>
              </div>
            ) : (
              <div>
                <h2>Yönetim Paneli</h2>
                {listings.map(item => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', borderBottom: '1px solid #eee' }}>
                    <span>{item.title}</span>
                    <button onClick={() => handleDeleteListing(item.id)} style={{ backgroundColor: '#fee2e2', color: '#dc2626', border: 'none', padding: '6px 10px', borderRadius: '6px' }}>Sil</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </main>

      <footer style={{ backgroundColor: '#1b3a2b', color: '#94a3b8', padding: '24px 32px', textAlign: 'center', fontSize: '13px', marginTop: 'auto' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <span>© 2026 PazarTarla - Tel: 0535 768 1550</span>
          <button onClick={() => setActiveTab('admin')} style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}><Settings size={14} /> Yönetici Paneli</button>
        </div>
      </footer>
    </div>
  );
}

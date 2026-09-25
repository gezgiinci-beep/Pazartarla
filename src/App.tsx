import React, { useState, useEffect } from 'react';
import { 
  Search, SlidersHorizontal, MapPin, Phone, MessageCircle, Plus, 
  Heart, Share2, ShieldCheck, CheckCircle2, ChevronRight, X, 
  Car, Tractor, Wrench, ArrowRight, Bell, User, Filter, AlertCircle, Trash2, Settings, Lock, Check, Mail, Globe, Copy, HelpCircle 
} from 'lucide-react';

// --- ÖRNEK İLAN VERİLERİ (PAZARTARLA) ---
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
    title: 'New Holland T6050 - Bakımlı ve hazır',
    price: 1850000,
    category: 'Traktör',
    mode: 'Satılık',
    location: 'Gönen / Balıkesir',
    city: 'Balıkesir',
    year: 2013,
    hours: 4500,
    power: '125 HP',
    description: 'Tarla ve bağ işleri için idealdir. Motoru ve yürüyen aksamı kusursuzdur. Muayenesi yenidir.',
    seller: 'Mehmet Demir',
    phone: '0533 444 5566',
    verified: true,
    featured: true,
    image: 'https://images.unsplash.com/photo-1530267981375-f0d7943d226d?auto=format&fit=crop&q=80&w=800',
    date: 'Dün'
  },
  {
    id: 3,
    title: 'Tumosan 8185 Yarı Otomatik',
    price: 1450000,
    category: 'Traktör',
    mode: 'Satılık',
    location: 'Bandırma / Balıkesir',
    city: 'Balıkesir',
    year: 2018,
    hours: 2800,
    power: '85 HP',
    description: 'İlk sahibinden temiz kullanılmış traktör. Klima aktiftir.',
    seller: 'Hüseyin Kaya',
    phone: '0535 111 2233',
    verified: false,
    featured: false,
    image: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&q=80&w=800',
    date: '3 gün önce'
  },
  {
    id: 4,
    title: 'Case IH JX110 - Sezonluk Kiralık',
    price: 45000,
    category: 'Traktör',
    mode: 'Kiralık',
    location: 'Karacabey / Bursa',
    city: 'Bursa',
    year: 2020,
    hours: 2100,
    power: '110 HP',
    description: 'Sezonluk veya aylık kiralıktır. Operatörlü/operatörsüz görüşülür.',
    seller: 'Tarım A.Ş.',
    phone: '0542 999 8877',
    verified: true,
    featured: false,
    image: 'https://images.unsplash.com/photo-1563514227147-6d2ff665a6a0?auto=format&fit=crop&q=80&w=800',
    date: '1 hafta önce'
  }
];

export default function App() {
  const [activeTab, setActiveTab] = useState('home'); // 'home', 'detail', 'add', 'verify', 'admin'
  const [listings, setListings] = useState(INITIAL_LISTINGS);
  const [selectedListing, setSelectedListing] = useState(null);
  
  // Admin Şifre Kontrolü
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');

  // Filtre State'leri
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMode, setSelectedMode] = useState('Tümü'); 
  const [selectedCategory, setSelectedCategory] = useState('Tüm kategoriler');
  const [selectedCity, setSelectedCity] = useState('Tüm Türkiye');

  // Yeni İlan Form State
  const [form, setForm] = useState({
    title: '',
    price: '',
    category: 'Traktör',
    mode: 'Satılık',
    location: 'Gönen / Balıkesir',
    city: 'Balıkesir',
    year: '2023',
    hours: '',
    power: '',
    description: '',
    seller: '',
    phone: '',
    image: 'https://images.unsplash.com/photo-1592417817098-8f3d69204052?auto=format&fit=crop&q=80&w=800'
  });

  // Telefon Doğrulama (SMS) State'leri
  const [verificationCode, setVerificationCode] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [pendingListing, setPendingListing] = useState(null);

  // LocalStorage senkronizasyonu
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

  const handleInitiateAdd = (e) => {
    e.preventDefault();
    if (!form.title || !form.price || !form.phone || !form.seller) {
      alert('Lütfen başlık, fiyat, ad Soyad ve telefon numarası alanlarını doldurun.');
      return;
    }

    const randomCode = Math.floor(1000 + Math.random() * 9000).toString();
    setGeneratedCode(randomCode);

    const newEntry = {
      ...form,
      id: Date.now(),
      price: Number(form.price),
      verified: true,
      featured: false,
      date: 'Bugün'
    };

    setPendingListing(newEntry);
    setActiveTab('verify');
  };

  const handleConfirmVerification = (e) => {
    e.preventDefault();
    if (verificationCode === generatedCode) {
      const updated = [pendingListing, ...listings];
      saveListings(updated);
      setVerificationCode('');
      setPendingListing(null);
      setActiveTab('home');
      alert('Telefon numarası doğrulandı ve ilanınız başarıyla yayınlandı!');
    } else {
      alert('Hatalı doğrulama kodu! Lütfen tekrar deneyin.');
    }
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
            <span style={{ fontSize: '11px', color: '#86efac' }}>Tarım Makineleri Pazaryeri</span>
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
        
        {/* LİSTELEME EKRANI */}
        {activeTab === 'home' && (
          <div>
            <div style={{ marginBottom: '32px' }}>
              <h2 style={{ fontSize: '32px', fontWeight: '800', color: '#0f172a', margin: '0 0 8px 0', letterSpacing: '-1px' }}>
                İlanları keşfet
              </h2>
              <p style={{ color: '#64748b', fontSize: '16px', margin: 0 }}>
                Tarlana, işine ve bütçene uygun ekipmanı bul.
              </p>
            </div>

            {/* FİLTRELEME PANELİ */}
            <div style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', marginBottom: '32px', border: '1px solid #e2e8f0' }}>
              
              <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid #f1f5f9', paddingBottom: '16px' }}>
                {['Tümü', 'Satılık', 'Kiralık'].map(mode => (
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px 200px', gap: '16px', flexWrap: 'wrap' }}>
                
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Search size={20} color="#94a3b8" style={{ position: 'absolute', left: '14px' }} />
                  <input 
                    type="text"
                    placeholder="Marka, model, şehir ara..."
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
                  style={{
                    padding: '12px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    fontSize: '15px',
                    backgroundColor: '#fff',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <option value="Tüm kategoriler">Tüm Kategoriler</option>
                  <option value="Traktör">Traktör</option>
                  <option value="Biçerdöver">Biçerdöver</option>
                  <option value="Tarım Ekipmanları">Tarım Ekipmanları</option>
                </select>

                <select 
                  value={selectedCity}
                  onChange={(e) => setSelectedCity(e.target.value)}
                  style={{
                    padding: '12px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    fontSize: '15px',
                    backgroundColor: '#fff',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
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

            {/* İLAN KARTLARI GRID */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '24px' }}>
              {filteredListings.map(item => (
                <div 
                  key={item.id} 
                  onClick={() => { setSelectedListing(item); setActiveTab('detail'); }}
                  style={{ 
                    backgroundColor: '#fff', 
                    borderRadius: '16px', 
                    overflow: 'hidden', 
                    border: '1px solid #e2e8f0', 
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', 
                    cursor: 'pointer',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    display: 'flex',
                    flexDirection: 'column'
                  }}
                >
                  <div style={{ position: 'relative', height: '180px', backgroundColor: '#f1f5f9' }}>
                    <img 
                      src={item.image} 
                      alt={item.title} 
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                    />
                    <span style={{ 
                      position: 'absolute', top: '12px', left: '12px', 
                      backgroundColor: item.mode === 'Satılık' ? '#22c55e' : '#f59e0b', 
                      color: '#fff', padding: '4px 10px', borderRadius: '6px', 
                      fontSize: '12px', fontWeight: '700' 
                    }}>
                      {item.mode}
                    </span>
                    {item.verified && (
                      <span style={{ 
                        position: 'absolute', top: '12px', right: '12px', 
                        backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
                        color: '#fff', padding: '4px 8px', borderRadius: '6px', 
                        fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' 
                      }}>
                        <ShieldCheck size={12} color="#4ade80" /> Doğrulanmış
                      </span>
                    )}
                  </div>

                  <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between' }}>
                    <div>
                      <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>
                        {item.category}
                      </span>
                      <h4 style={{ margin: '6px 0 12px 0', fontSize: '16px', fontWeight: '700', color: '#0f172a', lineHeight: '1.4' }}>
                        {item.title}
                      </h4>
                    </div>

                    <div>
                      <div style={{ fontSize: '20px', fontWeight: '800', color: '#1b3a2b', marginBottom: '12px' }}>
                        {item.price.toLocaleString('tr-TR')} TL
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '12px', fontSize: '13px', color: '#64748b' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <MapPin size={14} /> {item.location}
                        </span>
                        <span>{item.date}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

          </div>
        )}

        {/* İLAN DETAY EKRANI */}
        {activeTab === 'detail' && selectedListing && (
          <div style={{ maxWidth: '800px', margin: '0 auto', backgroundColor: '#fff', borderRadius: '20px', padding: '32px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <button 
                onClick={() => setActiveTab('home')}
                style={{ background: 'none', border: 'none', color: '#64748b', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                ← Geri dön
              </button>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '600', marginRight: '4px' }}>Paylaş:</span>
                <button 
                  onClick={() => shareOnFacebook(selectedListing.title)}
                  style={{ backgroundColor: '#1877f2', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Facebook
                </button>
                <button 
                  onClick={() => shareOnTwitter(selectedListing.title)}
                  style={{ backgroundColor: '#000000', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                >
                  X (Twitter)
                </button>
                <button 
                  onClick={() => shareOnWhatsApp(selectedListing.title)}
                  style={{ backgroundColor: '#25D366', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                >
                  WhatsApp
                </button>
                <button 
                  onClick={copyLink}
                  style={{ backgroundColor: '#e2e8f0', color: '#334155', border: 'none', padding: '6px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                  title="Bağlantıyı Kopyala"
                >
                  <Copy size={14} />
                </button>
              </div>
            </div>

            <div style={{ height: '350px', borderRadius: '12px', overflow: 'hidden', marginBottom: '24px' }}>
              <img src={selectedListing.image} alt={selectedListing.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <span style={{ backgroundColor: '#e2e8f0', color: '#334155', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '600' }}>
                  {selectedListing.category}
                </span>
                <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', margin: '12px 0' }}>
                  {selectedListing.title}
                </h2>
                <p style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', margin: 0 }}>
                  <MapPin size={16} /> {selectedListing.location}
                </p>
              </div>
              <div style={{ fontSize: '28px', fontWeight: '800', color: '#1b3a2b' }}>
                {selectedListing.price.toLocaleString('tr-TR')} TL
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', backgroundColor: '#f8fafc', padding: '20px', borderRadius: '12px', margin: '24px 0' }}>
              <div>
                <span style={{ fontSize: '12px', color: '#64748b', display: 'block' }}>Yıl</span>
                <strong style={{ fontSize: '16px', color: '#0f172a' }}>{selectedListing.year}</strong>
              </div>
              <div>
                <span style={{ fontSize: '12px', color: '#64748b', display: 'block' }}>Çalışma Saati</span>
                <strong style={{ fontSize: '16px', color: '#0f172a' }}>{selectedListing.hours || 'Belirtilmemiş'} saat</strong>
              </div>
              <div>
                <span style={{ fontSize: '12px', color: '#64748b', display: 'block' }}>Motor Gücü</span>
                <strong style={{ fontSize: '16px', color: '#0f172a' }}>{selectedListing.power || 'Belirtilmemiş'}</strong>
              </div>
            </div>

            <div style={{ marginBottom: '32px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '12px' }}>Açıklama</h3>
              <p style={{ color: '#475569', lineHeight: '1.6', margin: 0 }}>
                {selectedListing.description}
              </p>
            </div>

            <div style={{ display: 'flex', gap: '16px', borderTop: '1px solid #e2e8f0', paddingTop: '24px' }}>
              <a 
                href={`https://wa.me/905325550192?text=Merhaba, ${selectedListing.title} ilanınız hakkında bilgi almak istiyorum.`} 
                target="_blank" 
                rel="noreferrer"
                style={{ 
                  flex: 1, backgroundColor: '#25D366', color: '#fff', 
                  padding: '14px', borderRadius: '12px', textAlign: 'center', 
                  fontWeight: '700', textDecoration: 'none', display: 'flex', 
                  alignItems: 'center', justifyContent: 'center', gap: '8px',
                  boxShadow: '0 4px 12px rgba(37, 211, 102, 0.3)'
                }}
              >
                <MessageCircle size={20} /> WhatsApp ile Satıcıya Ulaş
              </a>
              <a 
                href={`tel:${selectedListing.phone}`}
                style={{ 
                  flex: 1, backgroundColor: '#1b3a2b', color: '#fff', 
                  padding: '14px', borderRadius: '12px', textAlign: 'center', 
                  fontWeight: '700', textDecoration: 'none', display: 'flex', 
                  alignItems: 'center', justifyContent: 'center', gap: '8px'
                }}
              >
                <Phone size={20} /> {selectedListing.phone}
              </a>
            </div>

          </div>
        )}

        {/* YENİ İLAN EKLEME EKRANI */}
        {activeTab === 'add' && (
          <div style={{ maxWidth: '700px', margin: '0 auto', backgroundColor: '#fff', borderRadius: '20px', padding: '32px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
            
            <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', marginBottom: '24px' }}>
              PazarTarla - Yeni İlan Ver
            </h2>

            <form onSubmit={handleInitiateAdd} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              <div>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', fontSize: '14px' }}>İlan Başlığı *</label>
                <input 
                  type="text" 
                  name="title" 
                  placeholder="Örn: John Deere 6130M - Temiz Traktör"
                  value={form.title} 
                  onChange={handleFormChange}
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', fontSize: '14px' }}>Fiyat (TL) *</label>
                  <input 
                    type="number" 
                    name="price" 
                    placeholder="Örn: 2450000"
                    value={form.price} 
                    onChange={handleFormChange}
                    style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', fontSize: '14px' }}>İlan Türü</label>
                  <select 
                    name="mode" 
                    value={form.mode} 
                    onChange={handleFormChange}
                    style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', backgroundColor: '#fff', boxSizing: 'border-box' }}
                  >
                    <option value="Satılık">Satılık</option>
                    <option value="Kiralık">Kiralık</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', fontSize: '14px' }}>Kategori</label>
                  <select 
                    name="category" 
                    value={form.category} 
                    onChange={handleFormChange}
                    style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', backgroundColor: '#fff', boxSizing: 'border-box' }}
                  >
                    <option value="Traktör">Traktör</option>
                    <option value="Biçerdöver">Biçerdöver</option>
                    <option value="Tarım Ekipmanları">Tarım Ekipmanları</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', fontSize: '14px' }}>Konum (İl / İlçe)</label>
                  <input 
                    type="text" 
                    name="location" 
                    placeholder="Örn: Gönen / Balıkesir"
                    value={form.location} 
                    onChange={handleFormChange}
                    style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', fontSize: '14px' }}>İletişim Adı *</label>
                  <input 
                    type="text" 
                    name="seller" 
                    placeholder="Adınız Soyadınız"
                    value={form.seller} 
                    onChange={handleFormChange}
                    style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', fontSize: '14px' }}>Telefon Numarası (SMS Doğrulama için) *</label>
                  <input 
                    type="text" 
                    name="phone" 
                    placeholder="0532 000 0000"
                    value={form.phone} 
                    onChange={handleFormChange}
                    style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', fontSize: '14px' }}>Açıklama</label>
                <textarea 
                  name="description" 
                  placeholder="Makinenizin durumu, bakımları ve ek detayları yazın..."
                  value={form.description} 
                  onChange={handleFormChange}
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', height: '120px', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '16px', marginTop: '10px' }}>
                <button 
                  type="button" 
                  onClick={() => setActiveTab('home')}
                  style={{ flex: 1, backgroundColor: '#f1f5f9', color: '#475569', border: 'none', padding: '14px', borderRadius: '12px', fontWeight: '700', cursor: 'pointer' }}
                >
                  İptal
                </button>
                <button 
                  type="submit" 
                  style={{ flex: 2, backgroundColor: '#22c55e', color: '#fff', border: 'none', padding: '14px', borderRadius: '12px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 4px 12px rgba(34, 197, 94, 0.3)' }}
                >
                  Devam Et & SMS Doğrula
                </button>
              </div>

            </form>

          </div>
        )}

        {/* TELEFON (SMS) DOĞRULAMA EKRANI */}
        {activeTab === 'verify' && (
          <div style={{ maxWidth: '480px', margin: '40px auto', backgroundColor: '#fff', borderRadius: '20px', padding: '32px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0', textAlign: 'center' }}>
            
            <div style={{ backgroundColor: '#e8f8f0', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto' }}>
              <Phone size={28} color="#22c55e" />
            </div>

            <h2 style={{ fontSize: '22px', fontWeight: '800', color: '#0f172a', marginBottom: '8px' }}>Telefon Doğrulama</h2>
            <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '24px' }}>
              <strong>{form.phone}</strong> numaralı telefonunuza gönderilen 4 haneli doğrulama kodunu girin.
            </p>

            <div style={{ backgroundColor: '#fef3c7', border: '1px solid #f59e0b', color: '#b45309', padding: '12px', borderRadius: '8px', fontSize: '14px', marginBottom: '20px' }}>
              Simülasyon SMS Kodu: <strong>{generatedCode}</strong>
            </div>

            <form onSubmit={handleConfirmVerification} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <input 
                type="text" 
                maxLength={4}
                placeholder="4 haneli kod"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                style={{ width: '100%', padding: '14px', borderRadius: '10px', border: '1px solid #cbd5e1', boxSizing: 'border-box', textAlign: 'center', fontSize: '24px', letterSpacing: '8px', fontWeight: 'bold' }}
              />
              <button 
                type="submit"
                style={{ backgroundColor: '#22c55e', color: '#fff', border: 'none', padding: '14px', borderRadius: '10px', fontWeight: '700', cursor: 'pointer', fontSize: '16px', boxShadow: '0 4px 12px rgba(34, 197, 94, 0.3)' }}
              >
                Kodu Onayla ve İlanı Yayınla
              </button>
              <button 
                type="button"
                onClick={() => setActiveTab('add')}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}
              >
                ← Bilgileri Düzenle / Geri Dön
              </button>
            </form>

          </div>
        )}

        {/* ADMIN PANELİ (Şifre Unuttum Özellikli) */}
        {activeTab === 'admin' && (
          <div style={{ maxWidth: '900px', margin: '0 auto', backgroundColor: '#fff', borderRadius: '20px', padding: '32px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
            
            {!isAdminLoggedIn ? (
              <div style={{ maxWidth: '400px', margin: '40px auto', textAlign: 'center' }}>
                <div style={{ backgroundColor: '#f1f5f9', width: '60px', height: '60px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto' }}>
                  <Lock size={28} color="#1b3a2b" />
                </div>
                <h2 style={{ fontSize: '22px', fontWeight: '800', color: '#0f172a', marginBottom: '8px' }}>Admin Girişi</h2>
                <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '24px' }}>Yönetim paneline erişmek için şifrenizi girin</p>
                
                <form onSubmit={handleAdminLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <input 
                    type="password" 
                    placeholder="Admin Şifresi"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', boxSizing: 'border-box', textAlign: 'center', fontSize: '16px' }}
                  />
                  <button 
                    type="submit"
                    style={{ backgroundColor: '#1b3a2b', color: '#fff', border: 'none', padding: '12px', borderRadius: '10px', fontWeight: '700', cursor: 'pointer' }}
                  >
                    Giriş Yap
                  </button>
                </form>

                {/* Şifremi Unuttum Bağlantısı */}
                <div style={{ marginTop: '16px' }}>
                  <button 
                    type="button"
                    onClick={handleForgotPassword}
                    style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '13px', textDecoration: 'underline' }}
                  >
                    Şifremi Unuttum?
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
                  <div>
                    <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', margin: 0 }}>İlan Yönetim Paneli</h2>
                    <p style={{ color: '#64748b', fontSize: '14px', margin: '4px 0 0 0' }}>Sistemdeki toplam {listings.length} ilan listeleniyor.</p>
                  </div>
                  <button 
                    onClick={() => setIsAdminLoggedIn(false)}
                    style={{ backgroundColor: '#ef4444', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '13px' }}
                  >
                    Çıkış Yap
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {listings.map(item => (
                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <img src={item.image} alt="" style={{ width: '60px', height: '60px', borderRadius: '8px', objectFit: 'cover' }} />
                        <div>
                          <h4 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: '700', color: '#0f172a' }}>{item.title}</h4>
                          <span style={{ fontSize: '13px', color: '#64748b' }}>{item.price.toLocaleString('tr-TR')} TL • {item.location} • Tel: {item.phone || 'Belirtilmemiş'}</span>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleDeleteListing(item.id)}
                        style={{ backgroundColor: '#fee2e2', color: '#dc2626', border: 'none', padding: '8px 12px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        <Trash2 size={16} /> Sil
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}

      </main>

      {/* SAYFA EN ALTI (FOOTER) */}
      <footer style={{ backgroundColor: '#1b3a2b', color: '#94a3b8', padding: '24px 32px', textAlign: 'center', fontSize: '13px', borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: 'auto' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
            <span style={{ color: '#fff', fontWeight: '600' }}>© 2026 PazarTarla - Tüm Hakları Saklıdır.</span>
            <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: '#cbd5e1' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Phone size={14} color="#22c55e" /> 0535 768 1550
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Mail size={14} color="#22c55e" /> gezgiinci@gmail.com
              </span>
            </div>
          </div>

          <button 
            onClick={() => setActiveTab('admin')}
            style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '500' }}
          >
            <Settings size={14} /> Yönetim Paneli (Admin)
          </button>

        </div>
      </footer>

    </div>
  );
}

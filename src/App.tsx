import React, { useState, useEffect } from 'react';
import { 
  Search, SlidersHorizontal, MapPin, Phone, MessageCircle, Plus, 
  Heart, Share2, ShieldCheck, CheckCircle2, ChevronRight, X, 
  Car, Tractor, Wrench, ArrowRight, Bell, User, Filter, AlertCircle, Trash2, Settings, Lock, Check, Mail, Globe, Copy, HelpCircle, Users, Image, Bug, Shield, Package 
} from 'lucide-react';

const INITIAL_LISTINGS = [
  {
    id: 1,
    title: 'John Deere 6130M - Düşük saat, tek elden',
    price: 2450000,
    category: 'Traktör',
    subCategory: 'Traktör',
    mode: 'Satılık',
    location: 'Gönen / Balıkesir',
    city: 'Balıkesir',
    amount: '1200 Çalışma Saati / 130 HP',
    description: 'Kapalı garaj traktörüdür. Tüm bakımları yetkili serviste yapılmıştır. Hiçbir masrafı yoktur.',
    seller: 'Ahmet Yılmaz',
    phone: '0532 555 0192',
    verified: true,
    featured: true,
    image: 'https://images.unsplash.com/photo-1592417817098-8f3d69204052?auto=format&fit=crop&q=80&w=800',
    date: 'Bugün'
  },
  {
    id: 2,
    title: 'Tarladan Doğrudan Taze Chandler Ceviz',
    price: 140,
    category: 'Mahsuller',
    subCategory: 'Ceviz',
    mode: 'Satılık',
    location: 'Gönen / Balıkesir',
    city: 'Balıkesir',
    amount: '1 Ton (Toptan / Perakende)',
    description: 'Kendi bahçemizin ürünü, ilaçsız ve dolgun Chandler ceviz. Toptan veya perakende satışımız vardır.',
    seller: 'Can İnce',
    phone: '0535 768 1550',
    verified: true,
    featured: true,
    image: 'https://images.unsplash.com/photo-1559181567-c3190ca9959b?auto=format&fit=crop&q=80&w=800',
    date: 'Bugün'
  },
  {
    id: 3,
    title: 'Mis Kokulu Gönen Kavunu ve Karpuzu',
    price: 15,
    category: 'Mahsuller',
    subCategory: 'Karpuz / Kavun',
    mode: 'Satılık',
    location: 'Gönen / Balıkesir',
    city: 'Balıkesir',
    amount: '5 Ton Toptan Hasat',
    description: 'Tarladan doğrudan taze kesim kavun ve karpuz. Manavlar ve tüccarlar önceliklidir.',
    seller: 'Hüseyin Çiftçi',
    phone: '0533 111 2233',
    verified: true,
    featured: false,
    image: 'https://images.unsplash.com/photo-1587049352847-4a222e784d38?auto=format&fit=crop&q=80&w=800',
    date: 'Dün'
  },
  {
    id: 4,
    title: 'Bursamızın Meşhur Saplı Tatlı Kirazı',
    price: 90,
    category: 'Mahsuller',
    subCategory: 'Kiraz',
    mode: 'Satılık',
    location: 'Karacabey / Bursa',
    city: 'Bursa',
    amount: '500 kg',
    description: 'İhracat kalitesinde iri cins, taze hasat tatlı kiraz. Soğuk zincir araçlarla sevkiyat yapılır.',
    seller: 'İbrahim Demir',
    phone: '0532 444 5566',
    verified: true,
    featured: true,
    image: 'https://images.unsplash.com/photo-1528821151447-11f211b5e5a7?auto=format&fit=crop&q=80&w=800',
    date: 'Bugün'
  },
  {
    id: 5,
    title: 'Erken Hasat Soğuk Sıkım Sızma Zeytinyağı',
    price: 1250,
    category: 'Mahsuller',
    subCategory: 'Zeytin & Zeytinyağı',
    mode: 'Satılık',
    location: 'Burhaniye / Balıkesir',
    city: 'Balıkesir',
    amount: '100 Teneke (5 Litrelik)',
    description: 'Asit oranı düşük, kendi zeytinliklerimizden üretilen geleneksel soğuk sıkım saf zeytinyağı.',
    seller: 'Hasan Bilir',
    phone: '0532 123 4567',
    verified: true,
    featured: true,
    image: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&q=80&w=800',
    date: 'Bugün'
  },
  {
    id: 6,
    title: 'Damızlık Sağlıklı Koyun ve Kuzu Sürüsü',
    price: 12000,
    category: 'Canlı Hayvanlar',
    subCategory: 'Küçükbaş',
    mode: 'Satılık',
    location: 'Bandırma / Balıkesir',
    city: 'Balıkesir',
    amount: '15 Baş',
    description: 'Veteriner kontrolleri tam, aşılı ve sağlıklı damızlık koyunlar. Toplu ya da tekli görüşülür.',
    seller: 'Mehmet Aksoy',
    phone: '0542 333 4455',
    verified: true,
    featured: true,
    image: 'https://images.unsplash.com/photo-1484557077804-29774de7fc76?auto=format&fit=crop&q=80&w=800',
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
  const [selectedSubCategory, setSelectedSubCategory] = useState('Tümü');
  const [selectedCity, setSelectedCity] = useState('Tüm Türkiye');

  const [form, setForm] = useState({
    title: '',
    price: '',
    category: 'Mahsuller',
    subCategory: 'Ceviz',
    mode: 'Satılık',
    location: 'Gönen / Balıkesir',
    city: 'Balıkesir',
    amount: '',
    description: '',
    seller: '',
    phone: '',
    image: ''
  });

  useEffect(() => {
    localStorage.setItem('pazartarla_listings', JSON.stringify(INITIAL_LISTINGS));
    setListings(INITIAL_LISTINGS);
  }, []);

  const saveListings = (newListings) => {
    setListings(newListings);
    localStorage.setItem('pazartarla_listings', JSON.stringify(newListings));
  };

  const handleFormChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleDirectAdd = (e) => {
    e.preventDefault();
    if (!form.title || !form.price || !form.phone || !form.seller) {
      alert('Lütfen başlık, fiyat, ad Soyad ve telefon numarası alanlarını doldurun.');
      return;
    }

    const finalImage = form.image.trim() !== '' ? form.image : 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&q=80&w=800';

    const newEntry = {
      ...form,
      id: Date.now(),
      price: Number(form.price),
      image: finalImage,
      verified: true,
      featured: false,
      date: 'Bugün'
    };

    const updated = [newEntry, ...listings];
    saveListings(updated);
    setActiveTab('home');
    alert('İlanınız başarıyla yayınlandı!');
  };

  const handleDeleteListing = (id) => {
    if (window.confirm('Bu ilanı yayından kaldırmak/silmek istediğinize emin misiniz?')) {
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

  const categoriesList = [
    'Tüm kategoriler',
    'Mahsuller',
    'Canlı Hayvanlar',
    'Hayvan Yemleri ve Ekipmanları',
    'Arıcılık & Bal',
    'Arıcılık Ekipmanları',
    'Traktör',
    'Biçerdöver',
    'Tarım Ekipmanları',
    'Tarım İşçileri'
  ];

  const subCategoriesMap = {
    'Mahsuller': ['Tümü', 'Kiraz', 'Karpuz / Kavun', 'Ceviz', 'Zeytin & Zeytinyağı', 'Buğday / Arpa', 'Diğer Mahsul'],
    'Canlı Hayvanlar': ['Tümü', 'Büyükbaş', 'Küçükbaş', 'Kanatlı'],
    'Hayvan Yemleri ve Ekipmanları': ['Tümü', 'Yem Çeşitleri', 'Suluk / Yemlik'],
    'Arıcılık & Bal': ['Tümü', 'Süzme Bal', 'Karakovan Balı', 'Petek Bal'],
    'Arıcılık Ekipmanları': ['Tümü', 'Kovan', 'Petek ve Çerçeve', 'Bal Süzme Makinesi'],
    'Traktör': ['Tümü', 'İkinci El Traktör', 'Sıfır Traktör'],
    'Biçerdöver': ['Tümü', 'Biçerdöver'],
    'Tarım Ekipmanları': ['Tümü', 'Römork', 'İlaçlama Makinesi', 'Toprak İşleme'],
    'Tarım İşçileri': ['Tümü', 'Hasat Ekibi', 'Budama Ekibi', 'Çoban / Bakıcı']
  };

  const filteredListings = listings.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.location.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesMode = selectedMode === 'Tümü' || item.mode === selectedMode;
    const matchesCategory = selectedCategory === 'Tüm kategoriler' || item.category === selectedCategory;
    const matchesSubCategory = selectedSubCategory === 'Tümü' || item.subCategory === selectedSubCategory;
    const matchesCity = selectedCity === 'Tüm Türkiye' || item.city === selectedCity;

    return matchesSearch && matchesMode && matchesCategory && matchesSubCategory && matchesCity;
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
            <span style={{ fontSize: '11px', color: '#86efac' }}>Tarım, Hayvancılık ve Arıcılık Pazaryeri</span>
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
            <div style={{ marginBottom: '24px' }}>
              <h2 style={{ fontSize: '32px', fontWeight: '800', color: '#0f172a', margin: '0 0 8px 0', letterSpacing: '-1px' }}>
                İlanları keşfet
              </h2>
              <p style={{ color: '#64748b', fontSize: '16px', margin: 0 }}>
                Traktör, kiraz, karpuz, zeytin, canlı hayvan, yem ve ziraat malzemeleri bul.
              </p>
            </div>

            {/* ANA KATEGORİLER HIZLI SEÇİM LİSTESİ */}
            <div style={{ backgroundColor: '#fff', padding: '16px 20px', borderRadius: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', marginBottom: '16px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Kategoriler</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {categoriesList.map(cat => (
                  <button
                    key={cat}
                    onClick={() => { setSelectedCategory(cat); setSelectedSubCategory('Tümü'); }}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      border: 'none',
                      fontWeight: selectedCategory === cat ? '700' : '500',
                      fontSize: '13px',
                      cursor: 'pointer',
                      backgroundColor: selectedCategory === cat ? '#1b3a2b' : '#f1f5f9',
                      color: selectedCategory === cat ? '#fff' : '#334155',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    {cat} {selectedCategory === cat && <Check size={14} />}
                  </button>
                ))}
              </div>
            </div>

            {/* ALT KATEGORİLER */}
            {selectedCategory !== 'Tüm kategoriler' && subCategoriesMap[selectedCategory] && (
              <div style={{ backgroundColor: '#f1f5f9', padding: '12px 20px', borderRadius: '12px', marginBottom: '20px', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', border: '1px solid #cbd5e1' }}>
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#334155', marginRight: '8px' }}>{selectedCategory} Çeşitleri:</span>
                {subCategoriesMap[selectedCategory].map(sub => (
                  <button
                    key={sub}
                    onClick={() => setSelectedSubCategory(sub)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '6px',
                      border: 'none',
                      fontWeight: selectedSubCategory === sub ? '700' : '500',
                      fontSize: '12px',
                      cursor: 'pointer',
                      backgroundColor: selectedSubCategory === sub ? '#22c55e' : '#fff',
                      color: selectedSubCategory === sub ? '#fff' : '#475569',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                    }}
                  >
                    {sub}
                  </button>
                ))}
              </div>
            )}

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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: '16px', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Search size={20} color="#94a3b8" style={{ position: 'absolute', left: '14px' }} />
                  <input 
                    type="text"
                    placeholder="Kiraz, karpuz, ceviz, zeytinyağı, traktör ara..."
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
                      <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>{item.category} {item.subCategory ? `> ${item.subCategory}` : ''}</span>
                      <h4 style={{ margin: '6px 0 8px 0', fontSize: '16px', fontWeight: '700', color: '#0f172a', lineHeight: '1.4' }}>{item.title}</h4>
                      {item.amount && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#059669', fontWeight: '600', marginBottom: '8px' }}>
                          <Package size={14} /> Miktar / Detay: {item.amount}
                        </div>
                      )}
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
            {selectedListing.amount && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#ecfdf5', color: '#059669', padding: '6px 12px', borderRadius: '8px', fontSize: '14px', fontWeight: '700', marginBottom: '16px', border: '1px solid #a7f3d0' }}>
                <Package size={16} /> Miktar / Kapasite: {selectedListing.amount}
              </div>
            )}
            <div style={{ fontSize: '28px', fontWeight: '800', color: '#1b3a2b', marginBottom: '20px' }}>{selectedListing.price.toLocaleString('tr-TR')} TL</div>
            <p style={{ color: '#475569', lineHeight: '1.6', marginBottom: '24px' }}>{selectedListing.description}</p>
            
            <div style={{ display: 'flex', gap: '16px', borderTop: '1px solid #e2e8f0', paddingTop: '24px' }}>
              <a href={`tel:${selectedListing.phone}`} style={{ flex: 1, backgroundColor: '#1b3a2b', color: '#fff', padding: '14px', borderRadius: '12px', textAlign: 'center', fontWeight: '700', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <Phone size={20} /> {selectedListing.phone} ({selectedListing.seller})
              </a>
            </div>
          </div>
        )}

        {activeTab === 'add' && (
          <div style={{ maxWidth: '700px', margin: '0 auto', backgroundColor: '#fff', borderRadius: '20px', padding: '32px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
            <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', marginBottom: '24px' }}>PazarTarla - Yeni İlan Ver</h2>
            <form onSubmit={handleDirectAdd} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', fontSize: '14px' }}>İlan Başlığı *</label>
                <input type="text" name="title" placeholder="Örn: Kiraz, Karpuz, Zeytinyağı veya Traktör" value={form.title} onChange={handleFormChange} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', fontSize: '14px' }}>Fiyat (TL) *</label>
                  <input type="number" name="price" placeholder="Örn: 90" value={form.price} onChange={handleFormChange} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', fontSize: '14px' }}>Kategori</label>
                  <select name="category" value={form.category} onChange={handleFormChange} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', backgroundColor: '#fff' }}>
                    {categoriesList.filter(c => c !== 'Tüm kategoriler').map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', fontSize: '14px' }}>Alt Ürün / Çeşit</label>
                  <input type="text" name="subCategory" placeholder="Örn: Kiraz, Ceviz, Süt Yemi vb." value={form.subCategory} onChange={handleFormChange} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', fontSize: '14px' }}>Miktar / Kapasite (Kaç ton, kg, dönüm vb.)</label>
                  <input type="text" name="amount" placeholder="Örn: 5 Ton veya 500 kg" value={form.amount} onChange={handleFormChange} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', fontSize: '14px' }}>Satıcı Adı *</label>
                  <input type="text" name="seller" placeholder="Adınız Soyadınız" value={form.seller} onChange={handleFormChange} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', fontSize: '14px' }}>Telefon Numarası *</label>
                  <input type="text" name="phone" placeholder="0532 000 0000" value={form.phone} onChange={handleFormChange} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', fontSize: '14px' }}>Fotoğraf Linki (URL) - İsteğe bağlı</label>
                <input type="text" name="image" placeholder="Örn: https://ornek.com/urun.jpg" value={form.image} onChange={handleFormChange} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', fontSize: '14px' }}>Açıklama</label>
                <textarea name="description" placeholder="Detayları yazın..." value={form.description} onChange={handleFormChange} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', height: '100px', boxSizing: 'border-box' }} />
              </div>
              <button type="submit" style={{ backgroundColor: '#22c55e', color: '#fff', border: 'none', padding: '14px', borderRadius: '12px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 4px 12px rgba(34, 197, 94, 0.3)' }}>
                İlanı Hemen Yayınla
              </button>
            </form>
          </div>
        )}

        {/* ADMIN PANELİ */}
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
                  <input type="password" placeholder="Admin Şifresi" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', boxSizing: 'border-box', textAlign: 'center', fontSize: '16px' }} />
                  <button type="submit" style={{ backgroundColor: '#1b3a2b', color: '#fff', border: 'none', padding: '12px', borderRadius: '10px', fontWeight: '700', cursor: 'pointer' }}>Giriş Yap</button>
                </form>
                <button type="button" onClick={handleForgotPassword} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '13px', textDecoration: 'underline', marginTop: '16px' }}>Şifremi Unuttum?</button>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
                  <div>
                    <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', margin: 0 }}>İlan Denetim Paneli</h2>
                    <p style={{ color: '#64748b', fontSize: '14px', margin: '4px 0 0 0' }}>Sistemdeki toplam {listings.length} ilan denetleniyor.</p>
                  </div>
                  <button onClick={() => setIsAdminLoggedIn(false)} style={{ backgroundColor: '#ef4444', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '13px' }}>Çıkış Yap</button>
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
                      <button onClick={() => handleDeleteListing(item.id)} style={{ backgroundColor: '#fee2e2', color: '#dc2626', border: 'none', padding: '8px 12px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Trash2 size={16} /> Kaldır / Sil
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

      </main>

      <footer style={{ backgroundColor: '#1b3a2b', color: '#94a3b8', padding: '24px 32px', textAlign: 'center', fontSize: '13px', borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: 'auto' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
            <span style={{ color: '#fff', fontWeight: '600' }}>© 2026 PazarTarla - Tüm Hakları Saklıdır.</span>
            <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: '#cbd5e1' }}>
              <span>0535 768 1550</span>
              <span>gezgiinci@gmail.com</span>
            </div>
          </div>
          <button onClick={() => setActiveTab('admin')} style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '500' }}>
            <Settings size={14} /> Yönetim Paneli (Admin)
          </button>
        </div>
      </footer>

    </div>
  );
}

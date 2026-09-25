import React, { useState, useEffect } from 'react';
import { 
  Search, SlidersHorizontal, MapPin, Phone, MessageCircle, Plus, 
  Heart, Share2, ShieldCheck, CheckCircle2, ChevronRight, X, 
  Car, Tractor, Wrench, ArrowRight, Bell, User, Filter, AlertCircle, Trash2, Settings, Lock, Check, Mail, Globe, Copy, HelpCircle, Users, Image, Bug, Shield, Package, ArrowLeft, Menu, ArrowUpDown, LayoutList, Star 
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
    amount: '1 Ton',
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
    amount: '5 Ton',
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
    amount: '100 Teneke (5 Lt)',
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

  const [showViewModal, setShowViewModal] = useState(false);
  const [viewMode, setViewMode] = useState('Liste');

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

  const categoriesWithSubs = {
    'Mahsuller': ['Kiraz', 'Karpuz / Kavun', 'Ceviz', 'Zeytin & Zeytinyağı', 'Buğday / Arpa', 'Diğer Mahsul'],
    'Canlı Hayvanlar': ['Büyükbaş', 'Küçükbaş', 'Kanatlı'],
    'Hayvan Yemleri ve Ekipmanları': ['Yem Çeşitleri', 'Suluk / Yemlik'],
    'Arıcılık & Bal': ['Süzme Bal', 'Karakovan Balı', 'Petek Bal'],
    'Arıcılık Ekipmanları': ['Kovan', 'Petek ve Çerçeve', 'Bal Süzme Makinesi'],
    'Traktör': ['İkinci El Traktör', 'Sıfır Traktör'],
    'Biçerdöver': ['Biçerdöver'],
    'Tarım Ekipmanları': ['Römork', 'İlaçlama Makinesi', 'Toprak İşleme'],
    'Tarım İşçileri': ['Hasat Ekibi', 'Budama Ekibi', 'Çoban / Bakıcı']
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
    <div style={{ minHeight: '100vh', backgroundColor: '#f4f6f8', color: '#1e293b', fontFamily: 'system-ui, -apple-system, sans-serif', display: 'flex', flexDirection: 'column', width: '100%', overflowX: 'hidden', boxSizing: 'border-box' }}>
      
      {/* ÜST HEADER */}
      <header style={{ backgroundColor: '#1b3a2b', color: '#ffffff', padding: '14px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 10px rgba(0,0,0,0.1)', position: 'sticky', top: 0, zIndex: 100, width: '100%', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }} onClick={() => { setActiveTab('home'); setSelectedCategory('Tüm kategoriler'); setSelectedSubCategory('Tümü'); }}>
          <div style={{ backgroundColor: '#22c55e', padding: '8px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Tractor size={24} color="#fff" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '800', letterSpacing: '-0.5px' }}>PazarTarla</h1>
            <span style={{ fontSize: '11px', color: '#86efac', display: 'block' }}>Tarım, Hayvancılık ve Arıcılık Pazaryeri</span>
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

      {/* ANA İÇERİK (BİLGİSAYARDA YAN YANA AĞAÇ MENÜ + İLANLAR, TELEKonda SAHİBİNDEN AKIŞI) */}
      <main style={{ maxWidth: '1280px', width: '100%', margin: '0 auto', padding: '24px 20px', flex: 1, boxSizing: 'border-box' }}>
        
        {activeTab === 'home' && (
          <div>
            <div style={{ marginBottom: '24px' }}>
              <h2 style={{ fontSize: '28px', fontWeight: '800', color: '#0f172a', margin: '0 0 6px 0', letterSpacing: '-1px' }}>
                İlanları Keşfet
              </h2>
              <p style={{ color: '#64748b', fontSize: '15px', margin: 0 }}>
                Traktör, kiraz, karpuz, ceviz, canlı hayvan, yem ve ziraat ekipmanları bul.
              </p>
            </div>

            {/* ARAMA VE MOD ÇUBUĞU */}
            <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', marginBottom: '24px', border: '1px solid #e2e8f0', boxSizing: 'border-box' }}>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '14px', flexWrap: 'wrap' }}>
                {['Tümü', 'Satılık', 'Kiralık', 'Hizmet'].map(mode => (
                  <button
                    key={mode}
                    onClick={() => setSelectedMode(mode)}
                    style={{
                      padding: '8px 18px',
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: '16px', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Search size={18} color="#94a3b8" style={{ position: 'absolute', left: '14px' }} />
                  <input 
                    type="text"
                    placeholder="Ürün, malzeme, traktör ara..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 14px 12px 44px',
                      borderRadius: '10px',
                      border: '1px solid #cbd5e1',
                      fontSize: '14px',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <select 
                  value={selectedCity}
                  onChange={(e) => setSelectedCity(e.target.value)}
                  style={{ padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '14px', backgroundColor: '#fff', outline: 'none', cursor: 'pointer' }}
                >
                  <option value="Tüm Türkiye">Tüm Türkiye</option>
                  <option value="Balıkesir">Balıkesir</option>
                  <option value="Bursa">Bursa</option>
                </select>
              </div>
            </div>

            {/* BİLGİSAYAR İÇİN YAN YANA YAPI (SOL DİKEY AĞAÇ MENÜ + SAĞ İLANLAR) */}
            <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '28px', alignItems: 'start' }}>
              
              {/* SOL DİKEY KATEGORİ AĞACI */}
              <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#1b3a2b', margin: '0 0 16px 0', borderBottom: '2px solid #22c55e', paddingBottom: '8px' }}>
                  Kategoriler
                </h3>

                <div 
                  onClick={() => { setSelectedCategory('Tüm kategoriler'); setSelectedSubCategory('Tümü'); }}
                  style={{ 
                    padding: '8px 12px', 
                    borderRadius: '8px', 
                    cursor: 'pointer', 
                    fontWeight: selectedCategory === 'Tüm kategoriler' ? '800' : '600', 
                    color: selectedCategory === 'Tüm kategoriler' ? '#22c55e' : '#334155',
                    backgroundColor: selectedCategory === 'Tüm kategoriler' ? '#f0fdf4' : 'transparent',
                    marginBottom: '8px',
                    fontSize: '14px'
                  }}
                >
                  Tüm Kategoriler
                </div>

                {Object.keys(categoriesWithSubs).map(cat => {
                  const isCatSelected = selectedCategory === cat;
                  return (
                    <div key={cat} style={{ marginBottom: '8px' }}>
                      <div 
                        onClick={() => { setSelectedCategory(cat); setSelectedSubCategory('Tümü'); }}
                        style={{ 
                          padding: '8px 12px', 
                          borderRadius: '8px', 
                          cursor: 'pointer', 
                          fontWeight: isCatSelected ? '800' : '600', 
                          color: isCatSelected ? '#22c55e' : '#1e293b',
                          backgroundColor: isCatSelected ? '#f0fdf4' : 'transparent',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontSize: '14px'
                        }}
                      >
                        <span>{cat}</span>
                        <ChevronRight size={14} style={{ transform: isCatSelected ? 'rotate(90deg)' : 'none', transition: '0.2s' }} />
                      </div>

                      {isCatSelected && (
                        <div style={{ paddingLeft: '16px', marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px', borderLeft: '2px solid #22c55e', marginLeft: '12px' }}>
                          <div 
                            onClick={() => setSelectedSubCategory('Tümü')}
                            style={{ 
                              padding: '6px 10px', 
                              borderRadius: '6px', 
                              cursor: 'pointer', 
                              fontSize: '13px', 
                              fontWeight: selectedSubCategory === 'Tümü' ? '700' : '500',
                              color: selectedSubCategory === 'Tümü' ? '#22c55e' : '#64748b' 
                            }}
                          >
                            Tümü ({cat})
                          </div>
                          {categoriesWithSubs[cat].map(sub => {
                            const isSubSelected = selectedSubCategory === sub;
                            return (
                              <div 
                                key={sub}
                                onClick={() => setSelectedSubCategory(sub)}
                                style={{ 
                                  padding: '6px 10px', 
                                  borderRadius: '6px', 
                                  cursor: 'pointer', 
                                  fontSize: '13px', 
                                  fontWeight: isSubSelected ? '700' : '500',
                                  color: isSubSelected ? '#22c55e' : '#64748b',
                                  backgroundColor: isSubSelected ? '#f8fafc' : 'transparent'
                                }}
                              >
                                • {sub}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}

                <div style={{ marginTop: '24px', borderTop: '1px solid #e2e8f0', paddingTop: '16px', textAlign: 'center' }}>
                  <button onClick={() => setActiveTab('admin')} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '13px', cursor: 'pointer', textDecoration: 'underline', fontWeight: '600' }}>
                    Yönetim Paneli (Admin)
                  </button>
                </div>
              </div>

              {/* SAĞ TARAF: İLAN LİSTESİ */}
              <div>
                <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#334155', margin: 0 }}>
                    {filteredListings.length} ilan bulundu
                  </h3>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '20px' }}>
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
                      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between' }}>
                        <div>
                          <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>{item.category} {item.subCategory ? `> ${item.subCategory}` : ''}</span>
                          <h4 style={{ margin: '6px 0 8px 0', fontSize: '15px', fontWeight: '700', color: '#0f172a', lineHeight: '1.4' }}>{item.title}</h4>
                          {item.amount && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#059669', fontWeight: '600', marginBottom: '8px' }}>
                              <Package size={13} /> {item.amount}
                            </div>
                          )}
                        </div>
                        <div>
                          <div style={{ fontSize: '18px', fontWeight: '800', color: '#1b3a2b', marginBottom: '10px' }}>
                            {item.price.toLocaleString('tr-TR')} TL
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '10px', fontSize: '12px', color: '#64748b' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><MapPin size={13} /> {item.location}</span>
                            <span>{item.date}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* İLAN DETAY EKRANI */}
        {activeTab === 'detail' && selectedListing && (
          <div style={{ maxWidth: '800px', margin: '0 auto', backgroundColor: '#fff', borderRadius: '20px', padding: '32px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
            <div style={{ marginBottom: '20px' }}>
              <button onClick={() => setActiveTab('home')} style={{ background: 'none', border: 'none', color: '#64748b', fontWeight: '600', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ArrowLeft size={18} /> Geri dön
              </button>
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
            
            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '24px' }}>
              <a href={`tel:${selectedListing.phone}`} style={{ width: '100%', backgroundColor: '#1b3a2b', color: '#fff', padding: '14px', borderRadius: '12px', textAlign: 'center', fontWeight: '700', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '15px', boxSizing: 'border-box' }}>
                <Phone size={20} /> {selectedListing.phone} ({selectedListing.seller})
              </a>
            </div>
          </div>
        )}

        {/* İLAN VER EKRANI */}
        {activeTab === 'add' && (
          <div style={{ maxWidth: '700px', margin: '0 auto', backgroundColor: '#fff', borderRadius: '20px', padding: '32px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <button onClick={() => setActiveTab('home')} style={{ background: 'none', border: 'none', color: '#64748b', fontWeight: '600', cursor: 'pointer', fontSize: '14px' }}>← Vazgeç</button>
              <h2 style={{ fontSize: '22px', fontWeight: '800', color: '#0f172a', margin: 0 }}>Yeni İlan Ver</h2>
            </div>
            <form onSubmit={handleDirectAdd} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '6px', fontSize: '13px' }}>İlan Başlığı *</label>
                <input type="text" name="title" placeholder="Örn: Kiraz, Zeytinyağı, Traktör" value={form.title} onChange={handleFormChange} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '14px' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: '600', marginBottom: '6px', fontSize: '13px' }}>Fiyat (TL) *</label>
                  <input type="number" name="price" placeholder="90" value={form.price} onChange={handleFormChange} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '14px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: '600', marginBottom: '6px', fontSize: '13px' }}>Kategori</label>
                  <select name="category" value={form.category} onChange={handleFormChange} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#fff', fontSize: '14px' }}>
                    {Object.keys(categoriesWithSubs).map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: '600', marginBottom: '6px', fontSize: '13px' }}>Alt Ürün</label>
                  <input type="text" name="subCategory" placeholder="Kiraz, Ceviz" value={form.subCategory} onChange={handleFormChange} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '14px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: '600', marginBottom: '6px', fontSize: '13px' }}>Miktar / Kapasite</label>
                  <input type="text" name="amount" placeholder="5 Ton" value={form.amount} onChange={handleFormChange} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '14px' }} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: '600', marginBottom: '6px', fontSize: '13px' }}>Satıcı Adı *</label>
                  <input type="text" name="seller" placeholder="Adınız" value={form.seller} onChange={handleFormChange} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '14px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: '600', marginBottom: '6px', fontSize: '13px' }}>Telefon *</label>
                  <input type="text" name="phone" placeholder="0532..." value={form.phone} onChange={handleFormChange} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '14px' }} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '6px', fontSize: '13px' }}>Fotoğraf Linki (URL)</label>
                <input type="text" name="image" placeholder="https://..." value={form.image} onChange={handleFormChange} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '14px' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '6px', fontSize: '13px' }}>Açıklama</label>
                <textarea name="description" placeholder="Detaylar..." value={form.description} onChange={handleFormChange} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', height: '100px', boxSizing: 'border-box', fontSize: '14px' }} />
              </div>
              <button type="submit" style={{ backgroundColor: '#22c55e', color: '#fff', border: 'none', padding: '14px', borderRadius: '10px', fontWeight: '700', cursor: 'pointer', fontSize: '15px', boxShadow: '0 4px 12px rgba(34, 197, 94, 0.3)' }}>
                İlanı Hemen Yayınla
              </button>
            </form>
          </div>
        )}

        {/* ADMIN PANELİ */}
        {activeTab === 'admin' && (
          <div style={{ maxWidth: '800px', margin: '0 auto', backgroundColor: '#fff', borderRadius: '20px', padding: '32px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
            {!isAdminLoggedIn ? (
              <div style={{ maxWidth: '350px', margin: '30px auto', textAlign: 'center' }}>
                <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', marginBottom: '10px' }}>Admin Girişi</h2>
                <form onSubmit={handleAdminLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <input type="password" placeholder="Admin Şifresi" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box', textAlign: 'center', fontSize: '15px' }} />
                  <button type="submit" style={{ backgroundColor: '#1b3a2b', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}>Giriş Yap</button>
                </form>
                <button type="button" onClick={handleForgotPassword} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '13px', textDecoration: 'underline', marginTop: '14px' }}>Şifremi Unuttum?</button>
                <div style={{ marginTop: '20px' }}>
                  <button onClick={() => setActiveTab('home')} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '13px', cursor: 'pointer' }}>← Ana Sayfaya Dön</button>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '14px' }}>
                  <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', margin: 0 }}>İlan Denetim Paneli</h2>
                  <button onClick={() => setActiveTab('home')} style={{ backgroundColor: '#1b3a2b', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontWeight: '600' }}>Ana Sayfaya Dön</button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {listings.map(item => (
                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', boxSizing: 'border-box' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <img src={item.image} alt="" style={{ width: '50px', height: '50px', borderRadius: '8px', objectFit: 'cover' }} />
                        <div>
                          <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>{item.title}</h4>
                          <span style={{ fontSize: '12px', color: '#64748b' }}>{item.price.toLocaleString('tr-TR')} TL • {item.location}</span>
                        </div>
                      </div>
                      <button onClick={() => handleDeleteListing(item.id)} style={{ backgroundColor: '#fee2e2', color: '#dc2626', border: 'none', padding: '8px 12px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '12px' }}>
                        Sil
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

      </main>

      <footer style={{ backgroundColor: '#1b3a2b', color: '#94a3b8', padding: '24px', textAlign: 'center', fontSize: '13px', borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: 'auto', boxSizing: 'border-box', width: '100%' }}>
        <span>© 2026 PazarTarla • Gönen / Balıkesir</span>
      </footer>

    </div>
  );
}

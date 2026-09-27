import React, { useState, useEffect } from 'react';
import { 
  Heart, Search, Plus, Trash2, Edit2, Shield, LogOut, 
  ChevronRight, Phone, Mail, MapPin, CheckCircle, FolderPlus, Package, Menu, X 
} from 'lucide-react';

export default function App() {
  // Admin ve Kimlik Doğrulama State'leri
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(() => {
    return localStorage.getItem('pazartarla_admin_logged') === 'true';
  });
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [showAdminLoginModal, setShowAdminLoginModal] = useState(false);

  // Başlangıç Kategorileri
  const initialCategories = [
    { id: 1, name: "Tarım Makineleri", subCategories: ["Traktör", "Biçerdöver", "Pulluk", "Mibzer", "İlaçlama Makinesi"] },
    { id: 2, name: "Konteyner ve Yaşam Alanı", subCategories: ["2x3 Konteyner", "3x7 Prefabrik", "Sandviç Panel Konteyner", "Yük Container", "Wc Konteyner"] },
    { id: 3, name: "Bahçe ve Sulama", subCategories: ["Damlama Sulama", "Su Tankı", "Çapa Makinesi", "Budama Aletleri"] },
    { id: 4, name: "Tarım Girdileri", subCategories: ["Tohum", "Gübre", "Fide", "Zirai İlaç"] },
    { id: 5, name: "Hayvancılık Ekipmanları", subCategories: ["Süt Sağım Makinesi", "Yem Karma", "Suluk ve Yemlik"] }
  ];

  // Başlangıç İlanları (Konteyner ilanları dahil)
  const initialListings = [
    {
      id: 1,
      title: "John Deere 5075E 3lü Damper Çıkışlı",
      category: "Tarım Makineleri",
      subCategory: "Traktör",
      price: 890000,
      city: "Balıkesir",
      district: "Gönen",
      description: "Çok temiz, bakımlı traktör. Kapalı garajda muhafaza edilmiştir.",
      image: "https://images.unsplash.com/photo-1592982537447-7440770cbfc9?auto=format&fit=crop&q=80&w=800",
      phone: "0535 768 1550",
      email: "gezgiinci@gmail.com",
      date: "2026-09-01"
    },
    {
      id: 2,
      title: "Fiat 480 S Kurbağa Göz",
      category: "Tarım Makineleri",
      subCategory: "Traktör",
      price: 295000,
      city: "Bursa",
      district: "Karacabey",
      description: "Orijinal boya, motoru yürüyeni sorunsuz.",
      image: "https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&q=80&w=800",
      phone: "0535 768 1550",
      email: "gezgiinci@gmail.com",
      date: "2026-09-02"
    },
    // Konteyner İlanları
    {
      id: 3,
      title: "3x7 Sandviç Panel Lüks Yaşam Konteyneri",
      category: "Konteyner ve Yaşam Alanı",
      subCategory: "3x7 Prefabrik",
      price: 165000,
      city: "Balıkesir",
      district: "Gönen",
      description: "Isı yalıtımlı sandviç panel, içinde mutfak tezgâhı ve duş-WC bulunmaktadır. Tarla ve bağ evleri için ideal.",
      image: "https://images.unsplash.com/photo-1541888946425-d0fbb18f248e?auto=format&fit=crop&q=80&w=800",
      phone: "0535 768 1550",
      email: "gezgiinci@gmail.com",
      date: "2026-09-25"
    },
    {
      id: 4,
      title: "2x3 Güvenlik ve Bekçi Kabini",
      category: "Konteyner ve Yaşam Alanı",
      subCategory: "2x3 Konteyner",
      price: 45000,
      city: "İzmir",
      district: "Torbalı",
      description: "PVC kapı pencereli, elektrik tesisatlı hazır kabin.",
      image: "https://images.unsplash.com/photo-1590381105924-c72589b9ef3f?auto=format&fit=crop&q=80&w=800",
      phone: "0535 768 1550",
      email: "gezgiinci@gmail.com",
      date: "2026-09-25"
    },
    {
      id: 5,
      title: "40 Feet Yük Container (Modifyeye Uygun)",
      category: "Konteyner ve Yaşam Alanı",
      subCategory: "Yük Container",
      price: 210000,
      city: "İstanbul",
      district: "Büyükçekmece",
      description: "Sağlam yapıda, alt tabanı ahşap, taşınabilir yaşam alanı yapımına uygun deniz konteyneri.",
      image: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&q=80&w=800",
      phone: "0535 768 1550",
      email: "gezgiinci@gmail.com",
      date: "2026-09-25"
    },
    {
      id: 6,
      title: "WC ve Duş Kombine Seyyar Konteyner",
      category: "Konteyner ve Yaşam Alanı",
      subCategory: "Wc Konteyner",
      price: 95000,
      city: "Bursa",
      district: "Nilüfer",
      description: "2 kabinli tuvalet ve 1 duşluklu, gider bağlantıları hazır.",
      image: "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&q=80&w=800",
      phone: "0535 768 1550",
      email: "gezgiinci@gmail.com",
      date: "2026-09-25"
    },
    {
      id: 7,
      title: "3x9 Geniş Yaşam Alanı Prefabrik Konteyner",
      category: "Konteyner ve Yaşam Alanı",
      subCategory: "3x7 Prefabrik",
      price: 195000,
      city: "Balıkesir",
      district: "Gönen",
      description: "2 odalı, salon ve mutfak nişli ferah konteyner yapı.",
      image: "https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&q=80&w=800",
      phone: "0535 768 1550",
      email: "gezgiinci@gmail.com",
      date: "2026-09-25"
    },
    {
      id: 8,
      title: "Demonte Bahçe Konteyneri (İzole)",
      category: "Konteyner ve Yaşam Alanı",
      subCategory: "Sandviç Panel Konteyner",
      price: 130000,
      city: "Manisa",
      district: "Turgutlu",
      description: "Modüler sistem demonte gönderilebilir, kolay kurulum.",
      image: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&q=80&w=800",
      phone: "0535 768 1550",
      email: "gezgiinci@gmail.com",
      date: "2026-09-25"
    },
    {
      id: 9,
      title: "20 Feet High Cube Konteyner",
      category: "Konteyner ve Yaşam Alanı",
      subCategory: "Yük Container",
      price: 150000,
      city: "İzmir",
      district: "Aliağa",
      description: "Standarttan yüksek, temiz ikinci el yük konteyneri.",
      image: "https://images.unsplash.com/photo-1578575437130-527eed3abbec?auto=format&fit=crop&q=80&w=800",
      phone: "0535 768 1550",
      email: "gezgiinci@gmail.com",
      date: "2026-09-25"
    },
    {
      id: 10,
      title: "Ofis Tipi Cam Cepheli Konteyner 3x6",
      category: "Konteyner ve Yaşam Alanı",
      subCategory: "Sandviç Panel Konteyner",
      price: 175000,
      city: "Ankara",
      district: "Yenimahalle",
      description: "Full cam cepheli, şık görünümlü tarla giriş ofisi veya satış bürosu.",
      image: "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=800",
      phone: "0535 768 1550",
      email: "gezgiinci@gmail.com",
      date: "2026-09-25"
    },
    {
      id: 11,
      title: "20 Tonluk Tarımsal Sulama ve Yağmur Hasadı Tankı",
      category: "Bahçe ve Sulama",
      subCategory: "Su Tankı",
      price: 35000,
      city: "Balıkesir",
      district: "Gönen",
      description: "Bahçe sulamaları için uygun, sağlam plastik modüler su deposu.",
      image: "https://images.unsplash.com/photo-1585435557343-3b092031a831?auto=format&fit=crop&q=80&w=800",
      phone: "0535 768 1550",
      email: "gezgiinci@gmail.com",
      date: "2026-09-25"
    }
  ];

  // State Tanımları (LocalStorage Koruma Mantığı ile)
  const [listings, setListings] = useState(() => {
    const saved = localStorage.getItem('pazartarla_listings');
    return saved ? JSON.parse(saved) : initialListings;
  });

  const [categories, setCategories] = useState(() => {
    const saved = localStorage.getItem('pazartarla_categories');
    return saved ? JSON.parse(saved) : initialCategories;
  });

  const [favorites, setFavorites] = useState(() => {
    const saved = localStorage.getItem('pazartarla_favorites');
    return saved ? JSON.parse(saved) : [];
  });

  // Veriler değiştikçe localStorage'a güvenli kaydetme
  useEffect(() => {
    localStorage.setItem('pazartarla_listings', JSON.stringify(listings));
  }, [listings]);

  useEffect(() => {
    localStorage.setItem('pazartarla_categories', JSON.stringify(categories));
  }, [categories]);

  useEffect(() => {
    localStorage.setItem('pazartarla_favorites', JSON.stringify(favorites));
  }, [favorites]);

  // Arayüz State'leri
  const [currentView, setCurrentView] = useState('home'); // 'home', 'detail', 'add', 'admin', 'favorites'
  const [selectedListing, setSelectedListing] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Tümü');
  const [selectedSubCategory, setSelectedSubCategory] = useState('Tümü');

  // Yeni İlan Formu State'i
  const [newListing, setNewListing] = useState({
    title: '', category: categories[0]?.name || '', subCategory: '', price: '', city: '', district: '', description: '', image: '', phone: '', email: ''
  });

  // Kategori Yönetim State'leri
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newSubCategoryName, setNewSubCategoryName] = useState('');

  // Admin Giriş Kontrolü
  const handleAdminLogin = (e) => {
    e.preventDefault();
    if (adminPasswordInput === '123456' || adminPasswordInput === 'admin') {
      setIsAdminLoggedIn(true);
      localStorage.setItem('pazartarla_admin_logged', 'true');
      setShowAdminLoginModal(false);
      setAdminPasswordInput('');
      setCurrentView('admin');
    } else {
      alert('Hatalı şifre!');
    }
  };

  const handleAdminLogout = () => {
    setIsAdminLoggedIn(false);
    localStorage.removeItem('pazartarla_admin_logged');
    setCurrentView('home');
  };

  // İlan Ekleme
  const handleAddListingSubmit = (e) => {
    e.preventDefault();
    const listingToAdd = {
      ...newListing,
      id: Date.now(),
      price: Number(newListing.price),
      date: new Date().toISOString().split('T')[0],
      image: newListing.image || 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&q=80&w=800'
    };
    setListings([listingToAdd, ...listings]);
    alert('İlanınız başarıyla eklendi!');
    setNewListing({ title: '', category: categories[0]?.name || '', subCategory: '', price: '', city: '', district: '', description: '', image: '', phone: '', email: '' });
    setCurrentView('home');
  };

  // İlan Silme
  const handleDeleteListing = (id) => {
    if (window.confirm('Bu ilanı silmek istediğinize emin misiniz?')) {
      setListings(listings.filter(item => item.id !== id));
    }
  };

  // Kategori Ekleme
  const handleAddCategory = (e) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    const subs = newSubCategoryName ? newSubCategoryName.split(',').map(s => s.trim()).filter(Boolean) : [];
    const newCat = {
      id: Date.now(),
      name: newCategoryName.trim(),
      subCategories: subs
    };
    setCategories([...categories, newCat]);
    setNewCategoryName('');
    setNewSubCategoryName('');
    alert('Kategori başarıyla eklendi!');
  };

  // Kategori Silme
  const handleDeleteCategory = (catId) => {
    if (window.confirm('Bu kategoriyi silmek istediğinize emin misiniz?')) {
      setCategories(categories.filter(c => c.id !== catId));
    }
  };

  // Favori Toggle
  const toggleFavorite = (id) => {
    if (favorites.includes(id)) {
      setFavorites(favorites.filter(favId => favId !== id));
    } else {
      setFavorites([...favorites, id]);
    }
  };

  // Filtreleme Mantığı
  const filteredListings = listings.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.city.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'Tümü' || item.category === selectedCategory;
    const matchesSubCategory = selectedSubCategory === 'Tümü' || item.subCategory === selectedSubCategory;
    return matchesSearch && matchesCategory && matchesSubCategory;
  });

  const activeCategoryObj = categories.find(c => c.name === selectedCategory);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f4f6f8', fontFamily: 'sans-serif', color: '#333', display: 'flex', flexDirection: 'column' }}>
      
      {/* ÜST BİLGİ & NAVİGASYON */}
      <header style={{ backgroundColor: '#134e4a', color: '#fff', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div onClick={() => setCurrentView('home')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Package size={28} color="#34d399" />
            <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0, letterSpacing: '0.5px' }}>PazarTarla</h1>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <button onClick={() => setCurrentView('favorites')} style={{ background: 'transparent', border: '1px solid #34d399', color: '#fff', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Heart size={16} color="#f87171" fill={favorites.length > 0 ? "#f87171" : "none"} />
              Favorilerim ({favorites.length})
            </button>

            <button onClick={() => setCurrentView('add')} style={{ backgroundColor: '#059669', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Plus size={18} /> İlan Ver
            </button>

            {isAdminLoggedIn ? (
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => setCurrentView('admin')} style={{ backgroundColor: '#d97706', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                  Yönetim Paneli
                </button>
                <button onClick={handleAdminLogout} style={{ backgroundColor: '#dc2626', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer' }}>
                  <LogOut size={16} />
                </button>
              </div>
            ) : (
              <button onClick={() => setShowAdminLoginModal(true)} style={{ backgroundColor: 'transparent', border: '1px solid #9ca3af', color: '#d1d5db', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>
                Admin Giriş
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ADMIN GİRİŞ MODALI */}
      {showAdminLoginModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#fff', padding: '30px', borderRadius: '10px', width: '350px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
            <h3 style={{ marginTop: 0, color: '#134e4a' }}>Yönetici Girişi</h3>
            <form onSubmit={handleAdminLogin} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input 
                type="password" 
                placeholder="Yönetici Şifresi" 
                value={adminPasswordInput}
                onChange={(e) => setAdminPasswordInput(e.target.value)}
                style={{ padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '14px' }}
                autoFocus
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setShowAdminLoginModal(false)} style={{ padding: '8px 12px', border: '1px solid #d1d5db', background: '#fff', borderRadius: '6px', cursor: 'pointer' }}>İptal</button>
                <button type="submit" style={{ padding: '8px 16px', background: '#059669', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Giriş Yap</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ANA İÇERİK */}
      <main style={{ flex: 1, maxWidth: '1200px', width: '100%', margin: '0 auto', padding: '20px', boxSizing: 'border-box' }}>
        
        {/* 1. ANA SAYFA */}
        {currentView === 'home' && (
          <div>
            {/* Arama Alanı */}
            <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '20px', display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', border: '1px solid #d1d5db', borderRadius: '6px', padding: '0 12px', backgroundColor: '#f9fafb' }}>
                <Search size={20} color="#6b7280" />
                <input 
                  type="text" 
                  placeholder="Traktör, konteyner, ilaç, bölge ara..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{ border: 'none', outline: 'none', padding: '10px', width: '100%', backgroundColor: 'transparent', fontSize: '14px' }}
                />
              </div>
            </div>

            {/* Kategori Barı */}
            <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '10px', marginBottom: '20px' }}>
              <button 
                onClick={() => { setSelectedCategory('Tümü'); setSelectedSubCategory('Tümü'); }}
                style={{ padding: '10px 18px', borderRadius: '20px', border: 'none', backgroundColor: selectedCategory === 'Tümü' ? '#134e4a' : '#e5e7eb', color: selectedCategory === 'Tümü' ? '#fff' : '#374151', cursor: 'pointer', fontWeight: '600', whiteSpace: 'nowrap' }}
              >
                Tüm Kategoriler
              </button>
              {categories.map(cat => (
                <button 
                  key={cat.id}
                  onClick={() => { setSelectedCategory(cat.name); setSelectedSubCategory('Tümü'); }}
                  style={{ padding: '10px 18px', borderRadius: '20px', border: 'none', backgroundColor: selectedCategory === cat.name ? '#134e4a' : '#e5e7eb', color: selectedCategory === cat.name ? '#fff' : '#374151', cursor: 'pointer', fontWeight: '600', whiteSpace: 'nowrap' }}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Alt Kategori Barı (Eğer Kategori Seçiliyse) */}
            {activeCategoryObj && activeCategoryObj.subCategories && activeCategoryObj.subCategories.length > 0 && (
              <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '10px', marginBottom: '25px' }}>
                <button 
                  onClick={() => setSelectedSubCategory('Tümü')}
                  style={{ padding: '6px 14px', borderRadius: '15px', border: '1px solid #134e4a', backgroundColor: selectedSubCategory === 'Tümü' ? '#134e4a' : '#fff', color: selectedSubCategory === 'Tümü' ? '#fff' : '#134e4a', cursor: 'pointer', fontSize: '13px' }}
                >
                  Tümü ({activeCategoryObj.name})
                </button>
                {activeCategoryObj.subCategories.map((sub, idx) => (
                  <button 
                    key={idx}
                    onClick={() => setSelectedSubCategory(sub)}
                    style={{ padding: '6px 14px', borderRadius: '15px', border: '1px solid #134e4a', backgroundColor: selectedSubCategory === sub ? '#134e4a' : '#fff', color: selectedSubCategory === sub ? '#fff' : '#134e4a', cursor: 'pointer', fontSize: '13px' }}
                  >
                    {sub}
                  </button>
                ))}
              </div>
            )}

            {/* İlan Listesi Grid */}
            <h2 style={{ fontSize: '20px', marginBottom: '15px', color: '#1f2937' }}>Aktif İlanlar ({filteredListings.length})</h2>
            
            {filteredListings.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '50px', backgroundColor: '#fff', borderRadius: '10px', color: '#6b7280' }}>
                <p>Aradığınız kriterlere uygun ilan bulunamadı.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '20px' }}>
                {filteredListings.map(item => (
                  <div key={item.id} style={{ backgroundColor: '#fff', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 2px 5px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', position: 'relative', border: '1px solid #e5e7eb' }}>
                    <div style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 2, background: 'rgba(255,255,255,0.8)', borderRadius: '50%', padding: '6px', cursor: 'pointer' }} onClick={() => toggleFavorite(item.id)}>
                      <Heart size={18} color="#f87171" fill={favorites.includes(item.id) ? "#f87171" : "none"} />
                    </div>
                    <div style={{ height: '180px', overflow: 'hidden', backgroundColor: '#f3f4f6', cursor: 'pointer' }} onClick={() => { setSelectedListing(item); setCurrentView('detail'); }}>
                      <img src={item.image} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    <div style={{ padding: '15px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                      <span style={{ fontSize: '11px', color: '#059669', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '4px' }}>{item.category} {item.subCategory ? `> ${item.subCategory}` : ''}</span>
                      <h3 style={{ fontSize: '16px', fontWeight: 'bold', margin: '0 0 10px 0', color: '#111827', cursor: 'pointer', height: '40px', overflow: 'hidden' }} onClick={() => { setSelectedListing(item); setCurrentView('detail'); }}>
                        {item.title}
                      </h3>
                      <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#134e4a', marginBottom: '12px' }}>
                        {item.price.toLocaleString('tr-TR')} TL
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#6b7280', marginTop: 'auto', paddingTop: '10px', borderTop: '1px solid #f3f4f6' }}>
                        <MapPin size={14} /> {item.city} / {item.district}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 2. İLAN DETAY SAYFASI */}
        {currentView === 'detail' && selectedListing && (
          <div style={{ backgroundColor: '#fff', padding: '30px', borderRadius: '10px', boxShadow: '0 2px 6px rgba(0,0,0,0.1)' }}>
            <button onClick={() => setCurrentView('home')} style={{ background: 'none', border: 'none', color: '#059669', cursor: 'pointer', fontWeight: 'bold', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              &larr; İlanlara Geri Dön
            </button>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', flexWrap: 'wrap' }}>
              <div>
                <img src={selectedListing.image} alt={selectedListing.title} style={{ width: '100%', maxHeight: '400px', objectFit: 'cover', borderRadius: '8px' }} />
              </div>
              <div>
                <span style={{ fontSize: '12px', color: '#059669', fontWeight: 'bold', textTransform: 'uppercase' }}>{selectedListing.category}</span>
                <h2 style={{ fontSize: '24px', margin: '10px 0', color: '#111827' }}>{selectedListing.title}</h2>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#134e4a', marginBottom: '20px' }}>{selectedListing.price.toLocaleString('tr-TR')} TL</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#4b5563', marginBottom: '20px' }}>
                  <MapPin size={18} /> {selectedListing.city} / {selectedListing.district}
                </div>
                <div style={{ backgroundColor: '#f9fafb', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #e5e7eb' }}>
                  <h4 style={{ margin: '0 0 10px 0', color: '#374151' }}>İletişim Bilgileri</h4>
                  <p style={{ margin: '5px 0', display: 'flex', alignItems: 'center', gap: '8px' }}><Phone size={16} color="#059669" /> {selectedListing.phone}</p>
                  <p style={{ margin: '5px 0', display: 'flex', alignItems: 'center', gap: '8px' }}><Mail size={16} color="#059669" /> {selectedListing.email}</p>
                </div>
              </div>
            </div>
            <div style={{ marginTop: '30px', borderTop: '1px solid #e5e7eb', paddingTop: '20px' }}>
              <h3 style={{ color: '#111827' }}>İlan Açıklaması</h3>
              <p style={{ lineHeight: '1.6', color: '#4b5563' }}>{selectedListing.description}</p>
            </div>
          </div>
        )}

        {/* 3. İLAN VER SAYFASI */}
        {currentView === 'add' && (
          <div style={{ backgroundColor: '#fff', padding: '30px', borderRadius: '10px', maxWidth: '700px', margin: '0 auto', boxShadow: '0 2px 6px rgba(0,0,0,0.1)' }}>
            <h2 style={{ marginTop: 0, color: '#134e4a' }}>Yeni İlan Oluştur</h2>
            <form onSubmit={handleAddListingSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '5px' }}>İlan Başlığı</label>
                <input 
                  type="text" required placeholder="Örn: 3x7 Sandviç Panel Konteyner"
                  value={newListing.title} onChange={e => setNewListing({...newListing, title: e.target.value})}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '5px' }}>Kategori</label>
                  <select 
                    value={newListing.category} onChange={e => setNewListing({...newListing, category: e.target.value})}
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db', boxSizing: 'border-box' }}
                  >
                    {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '5px' }}>Fiyat (TL)</label>
                  <input 
                    type="number" required placeholder="Örn: 150000"
                    value={newListing.price} onChange={e => setNewListing({...newListing, price: e.target.value})}
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '5px' }}>Şehir</label>
                  <input 
                    type="text" required placeholder="Örn: Balıkesir"
                    value={newListing.city} onChange={e => setNewListing({...newListing, city: e.target.value})}
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '5px' }}>İlçe</label>
                  <input 
                    type="text" required placeholder="Örn: Gönen"
                    value={newListing.district} onChange={e => setNewListing({...newListing, district: e.target.value})}
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '5px' }}>Fotoğraf URL (İsteğe bağlı)</label>
                <input 
                  type="text" placeholder="https://..."
                  value={newListing.image} onChange={e => setNewListing({...newListing, image: e.target.value})}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '5px' }}>Telefon</label>
                  <input 
                    type="text" required placeholder="0535..."
                    value={newListing.phone} onChange={e => setNewListing({...newListing, phone: e.target.value})}
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '5px' }}>E-posta</label>
                  <input 
                    type="email" required placeholder="ornek@mail.com"
                    value={newListing.email} onChange={e => setNewListing({...newListing, email: e.target.value})}
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '5px' }}>Açıklama</label>
                <textarea 
                  rows="4" required placeholder="Ürün detaylarını açıklayın..."
                  value={newListing.description} onChange={e => setNewListing({...newListing, description: e.target.value})}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db', boxSizing: 'border-box' }}
                ></textarea>
              </div>
              <button type="submit" style={{ backgroundColor: '#059669', color: '#fff', border: 'none', padding: '12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px' }}>
                İlanı Yayınla
              </button>
            </form>
          </div>
        )}

        {/* 4. FAVORİLER SAYFASI */}
        {currentView === 'favorites' && (
          <div>
            <h2 style={{ color: '#134e4a', marginBottom: '20px' }}>Favori İlanlarım</h2>
            {favorites.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', background: '#fff', borderRadius: '10px' }}>
                <p style={{ color: '#6b7280' }}>Henüz favorilere ilan eklemediniz.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '20px' }}>
                {listings.filter(i => favorites.includes(i.id)).map(item => (
                  <div key={item.id} style={{ backgroundColor: '#fff', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 2px 5px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', position: 'relative' }}>
                    <div style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 2, background: 'rgba(255,255,255,0.8)', borderRadius: '50%', padding: '6px', cursor: 'pointer' }} onClick={() => toggleFavorite(item.id)}>
                      <Heart size={18} color="#f87171" fill="#f87171" />
                    </div>
                    <div style={{ height: '180px', overflow: 'hidden', cursor: 'pointer' }} onClick={() => { setSelectedListing(item); setCurrentView('detail'); }}>
                      <img src={item.image} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    <div style={{ padding: '15px' }}>
                      <h3 style={{ fontSize: '16px', fontWeight: 'bold', margin: '0 0 10px 0' }}>{item.title}</h3>
                      <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#134e4a' }}>{item.price.toLocaleString('tr-TR')} TL</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 5. YÖNETİM PANELİ */}
        {currentView === 'admin' && isAdminLoggedIn && (
          <div style={{ backgroundColor: '#fff', padding: '30px', borderRadius: '10px', boxShadow: '0 2px 6px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', borderBottom: '1px solid #e5e7eb', paddingBottom: '15px' }}>
              <h2 style={{ margin: 0, color: '#134e4a' }}>Yönetim Paneli</h2>
              <button onClick={() => setCurrentView('home')} style={{ background: '#374151', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer' }}>Siteye Dön</button>
            </div>

            {/* Yeni Kategori Ekleme Alanı */}
            <div style={{ backgroundColor: '#f8fafc', padding: '20px', borderRadius: '8px', marginBottom: '30px', border: '1px solid #e2e8f0' }}>
              <h3 style={{ fontSize: '16px', color: '#1b3a2b', margin: '0 0 15px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FolderPlus size={18} color="#059669" /> Yeni Kategori ve Alt Ürün Ekle
              </h3>
              <form onSubmit={handleAddCategory} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <input 
                  type="text" placeholder="Ana Kategori Adı (Örn: Güneş Enerjisi)" 
                  value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                />
                <input 
                  type="text" placeholder="Alt Ürünler (Virgülle ayırın: Panel, İnverter, Akü)" 
                  value={newSubCategoryName} onChange={e => setNewSubCategoryName(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                />
                <button type="submit" style={{ backgroundColor: '#059669', color: '#fff', border: 'none', padding: '10px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
                  Kategoriyi Ekle
                </button>
              </form>
            </div>

            {/* Mevcut Kategorileri Listeleme ve Silme */}
            <h3 style={{ fontSize: '18px', color: '#1f2937', marginBottom: '15px' }}>Kategori Listesi ve Yönetimi</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '30px' }}>
              {categories.map(cat => (
                <div key={cat.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 15px', backgroundColor: '#f9fafb', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
                  <div>
                    <strong>{cat.name}</strong> 
                    <span style={{ fontSize: '12px', color: '#6b7280', marginLeft: '10px' }}>
                      ({cat.subCategories ? cat.subCategories.join(', ') : 'Alt ürün yok'})
                    </span>
                  </div>
                  <button onClick={() => handleDeleteCategory(cat.id)} style={{ backgroundColor: '#dc2626', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
                    Kategoriyi Sil
                  </button>
                </div>
              ))}
            </div>

            {/* İlan Yönetimi */}
            <h3 style={{ fontSize: '18px', color: '#1f2937', marginBottom: '15px' }}>İlan Yönetimi ({listings.length})</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {listings.map(item => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 15px', backgroundColor: '#f9fafb', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <img src={item.image} alt="" style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px' }} />
                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{item.title}</div>
                      <div style={{ fontSize: '12px', color: '#059669' }}>{item.price.toLocaleString('tr-TR')} TL - {item.city}</div>
                    </div>
                  </div>
                  <button onClick={() => handleDeleteListing(item.id)} style={{ backgroundColor: '#dc2626', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
                    Sil
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>

      {/* ALT BİLGİ */}
      <footer style={{ backgroundColor: '#134e4a', color: '#fff', textAlign: 'center', padding: '20px', marginTop: 'auto', fontSize: '13px' }}>
        <p style={{ margin: 0 }}>E-posta: gezgiinci@gmail.com | Tel: 0535 768 1550</p>
      </footer>
    </div>
  );
}

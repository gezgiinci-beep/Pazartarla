import React, { useState, useEffect } from 'react';
import { Heart, Search, Plus, LogOut, FolderPlus, Package, MapPin, Phone, Mail } from 'lucide-react';

export default function App() {
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(() => {
    return localStorage.getItem('pazartarla_admin_logged') === 'true';
  });
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [showAdminLoginModal, setShowAdminLoginModal] = useState(false);

  const initialCategories = [
    { id: 1, name: "Tarım Makineleri", subCategories: ["Traktör", "Biçerdöver", "Pulluk", "Mibzer", "İlaçlama Makinesi"] },
    { id: 2, name: "Konteyner ve Yaşam Alanı", subCategories: ["2x3 Konteyner", "3x7 Prefabrik", "Sandviç Panel Konteyner", "Yük Container", "Wc Konteyner"] },
    { id: 3, name: "Bahçe ve Sulama", subCategories: ["Damlama Sulama", "Su Tankı", "Çapa Makinesi", "Budama Aletleri"] },
    { id: 4, name: "Tarım Girdileri", subCategories: ["Tohum", "Gübre", "Fide", "Zirai İlaç"] },
    { id: 5, name: "Hayvancılık Ekipmanları", subCategories: ["Süt Sağım Makinesi", "Yem Karma", "Suluk ve Yemlik"] }
  ];

  const initialListings = [
    {
      id: 1,
      title: "Tarladan Doğrudan Taze Chandler Ceviz",
      category: "Tarım Makineleri",
      subCategory: "Traktör",
      price: 140,
      city: "Gönen / Balıkesir",
      description: "Kendi bahçemizin ürünü, ilaçsız ve dolgun Chandler ceviz.",
      image: "https://images.unsplash.com/photo-1559181567-c3190ca9959b?auto=format&fit=crop&q=80&w=800",
      phone: "0535 768 1550",
      email: "gezgiinci@gmail.com"
    }
  ];

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

  useEffect(() => {
    localStorage.setItem('pazartarla_listings', JSON.stringify(listings));
  }, [listings]);

  useEffect(() => {
    localStorage.setItem('pazartarla_categories', JSON.stringify(categories));
  }, [categories]);

  useEffect(() => {
    localStorage.setItem('pazartarla_favorites', JSON.stringify(favorites));
  }, [favorites]);

  const [currentView, setCurrentView] = useState('home');
  const [searchTerm, setSearchTerm] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newSubCategoryName, setNewSubCategoryName] = useState('');

  const handleAdminLogin = (e) => {
    e.preventDefault();
    if (adminPasswordInput === '123456' || adminPasswordInput === 'admin' || adminPasswordInput === 'pazartarla2026') {
      setIsAdminLoggedIn(true);
      localStorage.setItem('pazartarla_admin_logged', 'true');
      setShowAdminLoginModal(false);
      setAdminPasswordInput('');
      setCurrentView('admin');
    } else {
      alert('Hatalı Şifre!');
    }
  };

  const handleAdminLogout = () => {
    setIsAdminLoggedIn(false);
    localStorage.removeItem('pazartarla_admin_logged');
    setCurrentView('home');
  };

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

  const handleDeleteCategory = (catId) => {
    if (window.confirm('Bu kategoriyi silmek istediğinize emin misiniz?')) {
      setCategories(categories.filter(c => c.id !== catId));
    }
  };

  const handleDeleteListing = (id) => {
    if (window.confirm('Bu ilanı silmek istediğinize emin misiniz?')) {
      setListings(listings.filter(item => item.id !== id));
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f4f6f8', fontFamily: 'sans-serif', display: 'flex', flexDirection: 'column' }}>
      
      {/* ÜST MENÜ */}
      <header style={{ backgroundColor: '#134e4a', color: '#fff', padding: '15px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div onClick={() => setCurrentView('home')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Package size={26} color="#34d399" />
          <h1 style={{ fontSize: '22px', margin: 0 }}>PazarTarla</h1>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {isAdminLoggedIn ? (
            <>
              <button onClick={() => setCurrentView('admin')} style={{ backgroundColor: '#d97706', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                Yönetim Paneli
              </button>
              <button onClick={handleAdminLogout} style={{ backgroundColor: '#dc2626', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer' }}>
                <LogOut size={16} />
              </button>
            </>
          ) : (
            <button onClick={() => setShowAdminLoginModal(true)} style={{ backgroundColor: 'transparent', border: '1px solid #9ca3af', color: '#d1d5db', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>
              Admin Giriş
            </button>
          )}
        </div>
      </header>

      {/* ADMIN GİRİŞ MODALI */}
      {showAdminLoginModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#fff', padding: '30px', borderRadius: '10px', width: '350px' }}>
            <h3 style={{ marginTop: 0, color: '#134e4a' }}>Yönetici Girişi</h3>
            <form onSubmit={handleAdminLogin} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input 
                type="password" placeholder="Şifre (örn: 123456)" 
                value={adminPasswordInput} onChange={(e) => setAdminPasswordInput(e.target.value)}
                style={{ padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }}
                autoFocus
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setShowAdminLoginModal(false)} style={{ padding: '6px 12px' }}>İptal</button>
                <button type="submit" style={{ padding: '6px 14px', backgroundColor: '#059669', color: '#fff', border: 'none', borderRadius: '6px' }}>Giriş Yap</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* İÇERİK */}
      <main style={{ flex: 1, maxWidth: '1000px', width: '100%', margin: '20px auto', padding: '20px', boxSizing: 'border-box' }}>
        
        {currentView === 'home' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2>Aktif İlanlar ({listings.length})</h2>
              {!isAdminLoggedIn && (
                <button onClick={() => setShowAdminLoginModal(true)} style={{ backgroundColor: '#134e4a', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                  Kategorileri Yönetmek İçin Giriş Yap
                </button>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '20px' }}>
              {listings.map(item => (
                <div key={item.id} style={{ backgroundColor: '#fff', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 2px 5px rgba(0,0,0,0.08)', padding: '15px' }}>
                  <img src={item.image} alt="" style={{ width: '100%', height: '150px', objectFit: 'cover', borderRadius: '6px' }} />
                  <h3 style={{ margin: '10px 0 5px 0' }}>{item.title}</h3>
                  <div style={{ fontWeight: 'bold', color: '#134e4a' }}>{item.price} TL</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {currentView === 'admin' && isAdminLoggedIn && (
          <div style={{ backgroundColor: '#fff', padding: '30px', borderRadius: '10px', boxShadow: '0 2px 6px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #e5e7eb', paddingBottom: '15px' }}>
              <h2 style={{ margin: 0, color: '#134e4a' }}>Yönetim Paneli</h2>
              <button onClick={() => setCurrentView('home')} style={{ background: '#374151', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer' }}>Siteye Dön</button>
            </div>

            {/* KATEGORİ LİSTESİ VE SİLME */}
            <div style={{ backgroundColor: '#f0fdf4', padding: '20px', borderRadius: '8px', marginBottom: '25px', border: '1px solid #bbf7d0' }}>
              <h3 style={{ fontSize: '18px', color: '#166534', margin: '0 0 15px 0' }}>📁 Kategori Listesi ve Yönetimi ({categories.length})</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '250px', overflowY: 'auto' }}>
                {categories.map(cat => (
                  <div key={cat.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 15px', backgroundColor: '#fff', borderRadius: '6px', border: '1px solid #d1d5db' }}>
                    <div>
                      <strong style={{ color: '#134e4a' }}>{cat.name}</strong> 
                      <span style={{ fontSize: '12px', color: '#6b7280', marginLeft: '10px' }}>
                        ({cat.subCategories ? cat.subCategories.join(', ') : ''})
                      </span>
                    </div>
                    <button onClick={() => handleDeleteCategory(cat.id)} style={{ backgroundColor: '#dc2626', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
                      Sil
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* YENİ KATEGORİ EKLE */}
            <div style={{ backgroundColor: '#f8fafc', padding: '20px', borderRadius: '8px', marginBottom: '30px', border: '1px solid #e2e8f0' }}>
              <h3 style={{ fontSize: '16px', color: '#1b3a2b', margin: '0 0 15px 0' }}>Yeni Kategori Ekle</h3>
              <form onSubmit={handleAddCategory} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <input 
                  type="text" placeholder="Ana Kategori Adı" 
                  value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)}
                  style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
                <input 
                  type="text" placeholder="Alt Ürünler (Virgülle ayırın)" 
                  value={newSubCategoryName} onChange={e => setNewSubCategoryName(e.target.value)}
                  style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
                <button type="submit" style={{ backgroundColor: '#059669', color: '#fff', border: 'none', padding: '10px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
                  Kategoriyi Ekle
                </button>
              </form>
            </div>

            {/* İLANLAR */}
            <h3>İlan Yönetimi</h3>
            {listings.map(item => (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', borderBottom: '1px solid #eee' }}>
                <span>{item.title}</span>
                <button onClick={() => handleDeleteListing(item.id)} style={{ background: '#dc2626', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer' }}>Sil</button>
              </div>
            ))}
          </div>
        )}

      </main>
    </div>
  );
}

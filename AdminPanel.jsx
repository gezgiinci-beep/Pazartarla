import React, { useState, useEffect } from 'react';
import { Trash2, FolderPlus, Package, LogOut } from 'lucide-react';

export function AdminPanel() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('pazartarla_admin_logged') === 'true';
  });
  const [password, setPassword] = useState('');

  // Başlangıç Kategorileri
  const initialCategories = [
    { id: 1, name: "Tarım Makineleri", subCategories: ["Traktör", "Biçerdöver", "Pulluk", "Mibzer", "İlaçlama Makinesi"] },
    { id: 2, name: "Konteyner ve Yaşam Alanı", subCategories: ["2x3 Konteyner", "3x7 Prefabrik", "Sandviç Panel Konteyner", "Yük Container", "Wc Konteyner"] },
    { id: 3, name: "Bahçe ve Sulama", subCategories: ["Damlama Sulama", "Su Tankı", "Çapa Makinesi", "Budama Aletleri"] },
    { id: 4, name: "Tarım Girdileri", subCategories: ["Tohum", "Gübre", "Fide", "Zirai İlaç"] },
    { id: 5, name: "Hayvancılık Ekipmanları", subCategories: ["Süt Sağım Makinesi", "Yem Karma", "Suluk ve Yemlik"] }
  ];

  // Başlangıç İlanları
  const initialListings = [
    {
      id: 1,
      title: "Tarladan Doğrudan Taze Chandler Ceviz",
      category: "Mahsuller",
      subCategory: "Ceviz",
      price: 140,
      city: "Gönen / Balıkesir",
      description: "Kendi bahçemizin ürünü, ilaçsız ve dolgun Chandler ceviz.",
      image: "https://images.unsplash.com/photo-1559181567-c3190ca9959b?auto=format&fit=crop&q=80&w=800",
      phone: "0535 768 1550",
      email: "gezgiinci@gmail.com"
    },
    {
      id: 3,
      title: "3x7 Sandviç Panel Lüks Yaşam Konteyneri",
      category: "Konteyner ve Yaşam Alanı",
      subCategory: "3x7 Prefabrik",
      price: 165000,
      city: "Balıkesir",
      description: "Isı yalıtımlı sandviç panel, içinde mutfak tezgâhı ve duş-WC bulunmaktadır.",
      image: "https://images.unsplash.com/photo-1541888946425-d0fbb18f248e?auto=format&fit=crop&q=80&w=800",
      phone: "0535 768 1550",
      email: "gezgiinci@gmail.com"
    }
  ];

  // State Yönetimi (LocalStorage Korumalı)
  const [listings, setListings] = useState(() => {
    const saved = localStorage.getItem('pazartarla_listings');
    return saved ? JSON.parse(saved) : initialListings;
  });

  const [categories, setCategories] = useState(() => {
    const saved = localStorage.getItem('pazartarla_categories');
    return saved ? JSON.parse(saved) : initialCategories;
  });

  // Veriler değiştikçe localStorage'a kaydet
  useEffect(() => {
    localStorage.setItem('pazartarla_listings', JSON.stringify(listings));
  }, [listings]);

  useEffect(() => {
    localStorage.setItem('pazartarla_categories', JSON.stringify(categories));
  }, [categories]);

  // Yeni Kategori Form State'leri
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newSubCategoryName, setNewSubCategoryName] = useState('');

  const handleLogin = (e) => {
    e.preventDefault();
    if (password === '123456' || password === 'admin' || password === 'pazartarla2026') {
      setIsAuthenticated(true);
      localStorage.setItem('pazartarla_admin_logged', 'true');
    } else {
      alert('Hatalı Şifre!');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('pazartarla_admin_logged');
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

  // İlan Silme
  const handleDeleteListing = (id) => {
    if (window.confirm('Bu ilanı silmek istediğinize emin misiniz?')) {
      setListings(listings.filter(item => item.id !== id));
    }
  };

  // Giriş Yapılmadıysa Şifre Ekranı Göster
  if (!isAuthenticated) {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#f4f6f8' }}>
        <div style={{ backgroundColor: '#fff', padding: '30px', borderRadius: '10px', width: '350px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
          <h2 style={{ color: '#134e4a', marginTop: 0, textAlign: 'center' }}>Yönetim Girişi</h2>
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <input 
              type="password" 
              placeholder="Şifre (örn: 123456)" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)}
              style={{ padding: '12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '14px' }}
              autoFocus
            />
            <button type="submit" style={{ backgroundColor: '#059669', color: '#fff', border: 'none', padding: '12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
              Giriş Yap
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Giriş Yapıldıysa Yönetim Paneli
  return (
    <div style={{ maxWidth: '900px', margin: '30px auto', padding: '25px', backgroundColor: '#fff', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', fontFamily: 'sans-serif' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e5e7eb', paddingBottom: '15px', marginBottom: '25px' }}>
        <h2 style={{ margin: 0, color: '#134e4a', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Package size={24} color="#059669" /> Yönetim Paneli
        </h2>
        <button onClick={handleLogout} style={{ backgroundColor: '#dc2626', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold' }}>
          <LogOut size={16} /> Çıkış Yap
        </button>
      </div>

      {/* 1. KATEGORİ LİSTESİ VE SİLME */}
      <div style={{ backgroundColor: '#f0fdf4', padding: '20px', borderRadius: '8px', marginBottom: '25px', border: '1px solid #bbf7d0' }}>
        <h3 style={{ fontSize: '18px', color: '#166534', margin: '0 0 15px 0' }}>📁 Kategori Listesi ve Yönetimi ({categories.length})</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '250px', overflowY: 'auto' }}>
          {categories.map(cat => (
            <div key={cat.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 15px', backgroundColor: '#fff', borderRadius: '6px', border: '1px solid #d1d5db' }}>
              <div>
                <strong style={{ color: '#134e4a' }}>{cat.name}</strong> 
                <span style={{ fontSize: '12px', color: '#6b7280', marginLeft: '10px' }}>
                  ({cat.subCategories && cat.subCategories.length > 0 ? cat.subCategories.join(', ') : 'Alt ürün yok'})
                </span>
              </div>
              <button onClick={() => handleDeleteCategory(cat.id)} style={{ backgroundColor: '#dc2626', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
                Sil
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 2. YENİ KATEGORİ EKLEME */}
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

      {/* 3. İLAN YÖNETİMİ */}
      <h3 style={{ fontSize: '18px', color: '#1f2937', marginBottom: '15px' }}>İlan Yönetimi ({listings.length})</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '300px', overflowY: 'auto' }}>
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
  );
}

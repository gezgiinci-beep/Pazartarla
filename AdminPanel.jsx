import React, { useState, useEffect } from 'react';
import { Trash2, FolderPlus, Package, LogOut } from 'lucide-react';

export function AdminPanel() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('pazartarla_admin_logged') === 'true';
  });
  const [password, setPassword] = useState('');

  const initialCategories = [
    { id: 1, name: "Tarım Makineleri", subCategories: ["Traktör", "Biçerdöver", "Pulluk"] },
    { id: 2, name: "Konteyner ve Yaşam Alanı", subCategories: ["2x3 Konteyner", "3x7 Prefabrik"] },
    { id: 3, name: "Bahçe ve Sulama", subCategories: ["Damlama Sulama", "Su Tankı"] }
  ];

  const initialListings = [
    {
      id: 1,
      title: "Tarladan Doğrudan Taze Chandler Ceviz",
      category: "Tarım Makineleri",
      price: 140,
      city: "Gönen / Balıkesir",
      description: "Kendi bahçemizin ürünü, ilaçsız ve dolgun Chandler ceviz.",
      seoDescription: "Kendi bahçemizin ürünü, ilaçsız ve dolgun Chandler ceviz.",
      seoKeywords: "bahçemizin ürünü, ilaçsız, dolgun Chandler ceviz",
      image: "https://images.unsplash.com/photo-1559181567-c3190ca9959b?auto=format&fit=crop&q=80&w=800"
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

  useEffect(() => {
    localStorage.setItem('pazartarla_listings', JSON.stringify(listings));
  }, [listings]);

  useEffect(() => {
    localStorage.setItem('pazartarla_categories', JSON.stringify(categories));
  }, [categories]);

  const [newCategoryName, setNewCategoryName] = useState('');
  const [newSubCategoryName, setNewSubCategoryName] = useState('');

  const [newListing, setNewListing] = useState({
    title: '', category: categories[0]?.name || '', price: '', city: 'Gönen / Balıkesir', description: '', seoDescription: '', seoKeywords: ''
  });

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
      setCategories(categories.filter(cat => cat.id !== catId));
    }
  };

  const handleDeleteListing = (id) => {
    if (window.confirm('Bu ilanı silmek istediğinize emin misiniz?')) {
      setListings(listings.filter(item => item.id !== id));
    }
  };

  const handleDescriptionChange = (e) => {
    const text = e.target.value;
    const autoSeoDesc = text.substring(0, 150) + (text.length > 150 ? '...' : '');
    const autoKeywords = text.split(' ').filter(w => w.length > 3).slice(0, 8).join(', ');

    setNewListing({
      ...newListing,
      description: text,
      seoDescription: autoSeoDesc,
      seoKeywords: autoKeywords
    });
  };

  const handleAddListingSubmit = (e) => {
    e.preventDefault();
    const listingToAdd = {
      ...newListing,
      id: Date.now(),
      price: Number(newListing.price),
      image: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&q=80&w=800'
    };
    setListings([listingToAdd, ...listings]);
    alert('İlan başarıyla eklendi!');
    setNewListing({ title: '', category: categories[0]?.name || '', price: '', city: 'Gönen / Balıkesir', description: '', seoDescription: '', seoKeywords: '' });
  };

  if (!isAuthenticated) {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#f4f6f8' }}>
        <div style={{ backgroundColor: '#fff', padding: '30px', borderRadius: '10px', width: '350px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
          <h2 style={{ color: '#134e4a', marginTop: 0, textAlign: 'center' }}>Yönetim Girişi</h2>
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <input 
              type="password" placeholder="Şifre (123456)" 
              value={password} onChange={(e) => setPassword(e.target.value)}
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

      <div style={{ backgroundColor: '#f0fdf4', padding: '20px', borderRadius: '8px', marginBottom: '25px', border: '1px solid #bbf7d0' }}>
        <h3 style={{ fontSize: '18px', color: '#166534', margin: '0 0 15px 0' }}>📁 Kategori Listesi ve Silme ({categories.length})</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '250px', overflowY: 'auto' }}>
          {categories.map(cat => (
            <div key={cat.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 15px', backgroundColor: '#fff', borderRadius: '6px', border: '1px solid #d1d5db' }}>
              <div>
                <strong style={{ color: '#134e4a' }}>{cat.name}</strong> 
                <span style={{ fontSize: '12px', color: '#6b7280', marginLeft: '10px' }}>
                  ({cat.subCategories ? cat.subCategories.join(', ') : 'Alt kategori yok'})
                </span>
              </div>
              <button 
                onClick={() => handleDeleteCategory(cat.id)} 
                style={{ backgroundColor: '#dc2626', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
              >
                Sil
              </button>
            </div>
          ))}
        </div>
      </div>

      <div style={{ backgroundColor: '#f8fafc', padding: '20px', borderRadius: '8px', marginBottom: '30px', border: '1px solid #e2e8f0' }}>
        <h3 style={{ fontSize: '16px', color: '#1b3a2b', margin: '0 0 15px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FolderPlus size={18} color="#059669" /> Yeni Kategori Ekle
        </h3>
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

      <div style={{ backgroundColor: '#fffbeb', padding: '20px', borderRadius: '8px', marginBottom: '30px', border: '1px solid #fde68a' }}>
        <h3 style={{ fontSize: '16px', color: '#92400e', margin: '0 0 15px 0' }}>✨ Yeni İlan Ekle (Otomatik SEO)</h3>
        <form onSubmit={handleAddListingSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input 
            type="text" placeholder="İlan Başlığı" required
            value={newListing.title} onChange={e => setNewListing({...newListing, title: e.target.value})}
            style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <select 
              value={newListing.category} onChange={e => setNewListing({...newListing, category: e.target.value})}
              style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
            >
              {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
            <input 
              type="number" placeholder="Fiyat (TL)" required
              value={newListing.price} onChange={e => setNewListing({...newListing, price: e.target.value})}
              style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
            />
          </div>

          <textarea 
            rows="3" placeholder="İlan Açıklaması yazın..." required
            value={newListing.description} onChange={handleDescriptionChange}
            style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
          ></textarea>

          <div style={{ backgroundColor: '#fff', padding: '12px', borderRadius: '6px', border: '1px dashed #d97706', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#b45309' }}>🔍 Otomatik Üretilen SEO Alanları:</span>
            <input 
              type="text" placeholder="SEO Meta Açıklaması" 
              value={newListing.seoDescription} onChange={e => setNewListing({...newListing, seoDescription: e.target.value})}
              style={{ padding: '8px', fontSize: '12px', borderRadius: '4px', border: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}
            />
            <input 
              type="text" placeholder="SEO Anahtar Kelimeler" 
              value={newListing.seoKeywords} onChange={e => setNewListing({...newListing, seoKeywords: e.target.value})}
              style={{ padding: '8px', fontSize: '12px', borderRadius: '4px', border: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}
            />
          </div>

          <button type="submit" style={{ backgroundColor: '#059669', color: '#fff', border: 'none', padding: '10px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
            İlanı Yayınla
          </button>
        </form>
      </div>

      <h3 style={{ fontSize: '18px', color: '#1f2937', marginBottom: '15px' }}>İlan Yönetimi ({listings.length})</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '300px', overflowY: 'auto' }}>
        {listings.map(item => (
          <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 15px', backgroundColor: '#f9fafb', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
            <div>
              <strong style={{ color: '#111827', display: 'block' }}>{item.title}</strong>
              <span style={{ fontSize: '12px', color: '#6b7280' }}>{item.category} • {item.price} TL</span>
            </div>
            <button onClick={() => handleDeleteListing(item.id)} style={{ background: '#dc2626', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
              Sil
            </button>
          </div>
        ))}
      </div>

    </div>
  );
}

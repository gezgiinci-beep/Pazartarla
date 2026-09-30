import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  Search, SlidersHorizontal, MapPin, Phone, MessageCircle, Plus, 
  Heart, Share2, ShieldCheck, CheckCircle2, ChevronRight, ChevronDown, X, 
  Car, Tractor, Wrench, ArrowRight, Bell, User, Filter, AlertCircle, Trash2, Settings, Lock, Check, Mail, Globe, Copy, HelpCircle, Users, Image as ImageIcon, Bug, Shield, Package, ArrowLeft, Menu, ArrowUpDown, LayoutList, Star, Send, ShieldAlert, FolderPlus, Tag, Edit3, Sparkles, Megaphone, CheckCircle, Bot 
} from 'lucide-react';

// ==========================================
// SUPABASE BAĞLANTI AYARLARI (Canlı Ortak Veritabanı)
// ==========================================
const SUPABASE_URL = 'https://srbarfjzsfkmglsnmbtw.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable__8tUtClK2adq_ORRuL5PQ_oft6c';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
    status: 'approved',
    isFeatured: true
  },
  {
    id: 2,
    title: 'New Holland TD100D Tarım Traktörü',
    price: 1450000,
    category: 'Traktör',
    subCategory: 'İkinci El Traktör',
    mode: 'Satılık',
    location: 'Balıkesir / Gönen',
    amount: '100 HP',
    description: 'Tertemiz, tüm bakımları yetkili serviste yapılmış tarla traktörü.',
    seller: 'Can İnce',
    phone: '0535 768 1550',
    image: 'https://images.unsplash.com/photo-1592841202223-ca33cfd81b6f?auto=format&fit=crop&q=80&w=800',
    seoTags: 'new holland, td100d, gönen traktör',
    status: 'approved',
    isFeatured: true
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
  const [activeTab, setActiveTab] = useState('home'); 
  const editFormRef = useRef(null);
   
  const [listings, setListings] = useState(DEFAULT_START_LISTINGS);
  const [categoriesWithSubs, setCategoriesWithSubs] = useState(FALLBACK_CATEGORIES);

  const [selectedListing, setSelectedListing] = useState(null);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Tüm kategoriler');
  const [selectedSubCategory, setSelectedSubCategory] = useState('Tümü');

  const [form, setForm] = useState({
    title: '',
    price: '',
    category: 'Mahsuller',
    subCategory: 'Ceviz',
    mode: 'Satılık',
    location: 'Türkiye Geneli',
    amount: '',
    description: '',
    seller: 'Can İnce',
    phone: '0535 768 1550',
    image: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&q=80&w=800',
    seoTags: '',
    status: 'pending',
    isFeatured: false
  });

  useEffect(() => {
    if (supabase) {
      supabase.from('listings').select('*').then(({ data, error }) => {
        if (!error && data && data.length > 0) {
          setListings(data);
        }
      });

      const channel = supabase
        .channel('public:listings')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'listings' }, () => {
          supabase.from('listings').select('*').then(({ data }) => {
            if (data) setListings(data);
          });
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, []);

  const changeTab = (tabName) => {
    setActiveTab(tabName);
    window.scrollTo(0, 0);
  };

  const sanitizeInput = (str) => {
    if (typeof str !== 'string') return str;
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  };

  const getSmartAutoImage = (title, category) => {
    const t = (title || '').toLowerCase();
    const c = (category || '').toLowerCase();
    if (t.includes('traktör') || c.includes('traktör')) return 'https://images.unsplash.com/photo-1592841202223-ca33cfd81b6f?auto=format&fit=crop&q=80&w=800';
    if (t.includes('pulluk') || t.includes('çapa') || c.includes('ekipman')) return 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&q=80&w=800';
    return 'https://images.unsplash.com/photo-1559181567-c3190ca9959b?auto=format&fit=crop&q=80&w=800';
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
      ...form,
      title: sanitizeInput(form.title),
      description: sanitizeInput(form.description),
      seller: sanitizeInput(form.seller),
      phone: sanitizeInput(form.phone),
      image: form.image || getSmartAutoImage(form.title, form.category),
      price: Number(form.price),
      status: 'pending',
      isFeatured: false
    };

    if (supabase) {
      const { error } = await supabase.from('listings').insert([newEntry]);
      if (error) {
        alert('İlan eklenirken hata oluştu: ' + error.message);
        return;
      }
    } else {
      setListings([ { ...newEntry, id: Date.now() }, ...listings ]);
    }

    changeTab('home');
    alert('İlanınız başarıyla alındı. Onaylandıktan sonra tüm cihazlarda görünecektir.');
  };

  const approveListing = async (id) => {
    if (!isAdminLoggedIn) return;
    if (supabase) {
      const { error } = await supabase.from('listings').update({ status: 'approved' }).eq('id', id);
      if (!error) {
        setListings(listings.map(item => item.id === id ? { ...item, status: 'approved' } : item));
      }
    } else {
      setListings(listings.map(item => item.id === id ? { ...item, status: 'approved' } : item));
    }
  };

  const makeFeatured = async (id, currentStatus) => {
    if (!isAdminLoggedIn) return;
    const newFeaturedState = !currentStatus;
    if (supabase) {
      const { error } = await supabase.from('listings').update({ isFeatured: newFeaturedState }).eq('id', id);
      if (!error) {
        setListings(listings.map(item => item.id === id ? { ...item, isFeatured: newFeaturedState } : item));
      }
    } else {
      setListings(listings.map(item => item.id === id ? { ...item, isFeatured: newFeaturedState } : item));
    }
  };

  const handleDeleteListing = async (id) => {
    if (!isAdminLoggedIn) return;
    if (window.confirm('Bu ilanı silmek/reddetmek istediğinize emin misiniz?')) {
      if (supabase) {
        const { error } = await supabase.from('listings').delete().eq('id', id);
        if (!error) {
          setListings(listings.filter(item => item.id !== id));
        }
      } else {
        setListings(listings.filter(item => item.id !== id));
      }
    }
  };

  const handleAdminLogin = (e) => {
    e.preventDefault();
    if (adminPassword === '5538') {
      setIsAdminLoggedIn(true);
      setAdminPassword('');
    } else {
      alert('Hatalı şifre!');
      setAdminPassword('');
    }
  };

  const approvedListings = listings.filter(item => item.status === 'approved');
  const featuredListings = approvedListings.filter(item => item.isFeatured);
  const regularApprovedListings = approvedListings.filter(item => !item.isFeatured);

  const filteredListings = (selectedCategory === 'Tüm kategoriler' && selectedSubCategory === 'Tümü')
    ? [...featuredListings, ...regularApprovedListings]
    : approvedListings.filter(item => {
        const matchesCategory = selectedCategory === 'Tüm kategoriler' || item.category === selectedCategory;
        const matchesSubCategory = selectedSubCategory === 'Tümü' || item.subCategory === selectedSubCategory;
        return matchesCategory && matchesSubCategory;
      });

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f4f6f8', color: '#1e293b', fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column', width: '100%', maxWidth: '100vw', boxSizing: 'border-box' }}>
      <header style={{ backgroundColor: '#1b3a2b', color: '#ffffff', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }} onClick={() => { changeTab('home'); setSelectedCategory('Tüm kategoriler'); }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '800', letterSpacing: '0.5px' }}>PazarTarla</h1>
            <span style={{ fontSize: '11px', color: '#86efac' }}>Canlı Ortak Platform</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button onClick={() => changeTab('add')} style={{ backgroundColor: '#22c55e', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: '700', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Plus size={16} /> İlan Ver
          </button>
          <button onClick={() => changeTab('admin-page')} title="Yönetim Paneli" style={{ backgroundColor: '#11221b', color: '#86efac', border: '1px solid #22c55e', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: '700', fontSize: '12px' }}>
            ⚙️ Yönetim
          </button>
        </div>
      </header>

      <main style={{ width: '100%', maxWidth: '600px', margin: '0 auto', padding: '12px', flex: 1, boxSizing: 'border-box' }}>
        {activeTab === 'home' && (
          <div>
            {/* VİTRİN İLANLARI */}
            {featuredListings.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: '800', marginBottom: '8px', color: '#1b3a2b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Star size={15} fill="#f59e0b" color="#f59e0b" /> Vitrin İlanları
                </h3>
                {featuredListings.map(item => (
                  <div key={item.id} onClick={() => { setSelectedListing(item); changeTab('detail'); }} style={{ backgroundColor: '#fffbeb', borderRadius: '10px', overflow: 'hidden', border: '1px solid #fde68a', cursor: 'pointer', display: 'flex', gap: '10px', padding: '10px', marginBottom: '8px' }}>
                    <img src={item.image} alt={item.title} style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '8px' }} />
                    <div style={{ flex: 1 }}>
                      <span style={{ backgroundColor: '#f59e0b', color: '#fff', fontSize: '9px', fontWeight: '700', padding: '2px 6px', borderRadius: '4px' }}>VİTRİN</span>
                      <h4 style={{ margin: '4px 0', fontSize: '13px', fontWeight: '700' }}>{item.title}</h4>
                      <div style={{ fontSize: '14px', fontWeight: '800', color: '#1b3a2b' }}>{item.price.toLocaleString('tr-TR')} TL</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ANA KATEGORİLER VE ALT KATEGORİLER */}
            <div style={{ backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
              <div style={{ backgroundColor: '#1b3a2b', color: '#fff', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Menu size={20} />
                <span style={{ fontSize: '16px', fontWeight: '700' }}>Kategoriler (Canlı)</span>
              </div>

              <div onClick={() => { setSelectedCategory('Tüm kategoriler'); setSelectedSubCategory('Tümü'); changeTab('results'); }} style={{ padding: '14px 16px', borderBottom: '1px solid #edf2f7', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', backgroundColor: '#f8fafc' }}>
                <span style={{ fontWeight: '700', color: '#1b3a2b', fontSize: '15px' }}>Tüm Türkiye Tarım İlanları</span>
                <span style={{ color: '#22c55e', fontWeight: '700' }}>({approvedListings.length})</span>
              </div>

              {Object.entries(categoriesWithSubs).map(([catName, subList]) => (
                <div key={catName} style={{ borderBottom: '1px solid #edf2f7' }}>
                  <div onClick={() => { setSelectedCategory(catName); setSelectedSubCategory('Tümü'); changeTab('results'); }} style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', backgroundColor: '#fff' }}>
                    <span style={{ fontWeight: '600', color: '#334155', fontSize: '14px' }}>{catName}</span>
                    <span style={{ color: '#94a3b8', fontSize: '13px' }}>({approvedListings.filter(i => i.category === catName).length})</span>
                  </div>
                  <div style={{ padding: '0 16px 10px 16px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {subList.map(sub => (
                      <span key={sub} onClick={(e) => { e.stopPropagation(); setSelectedCategory(catName); setSelectedSubCategory(sub); changeTab('results'); }} style={{ backgroundColor: '#f1f5f9', color: '#475569', fontSize: '11px', fontWeight: '600', padding: '4px 8px', borderRadius: '6px', cursor: 'pointer', border: '1px solid #e2e8f0' }}>
                        {sub}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'results' && (
          <div>
            <div style={{ backgroundColor: '#1b3a2b', color: '#fff', borderRadius: '10px', padding: '10px 14px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button onClick={() => changeTab('home')} style={{ background: 'none', border: 'none', color: '#86efac', fontWeight: '700', cursor: 'pointer' }}><ArrowLeft size={16} /> Kategoriler</button>
              <span>{selectedCategory} ({selectedSubCategory}) - {filteredListings.length} sonuç</span>
            </div>

            {filteredListings.map(item => (
              <div key={item.id} onClick={() => { setSelectedListing(item); changeTab('detail'); }} style={{ backgroundColor: '#fff', borderRadius: '10px', overflow: 'hidden', border: '1px solid #e2e8f0', cursor: 'pointer', display: 'flex', gap: '10px', padding: '10px', marginBottom: '10px' }}>
                <img src={item.image} alt={item.title} style={{ width: '90px', height: '90px', objectFit: 'cover', borderRadius: '8px' }} />
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: '10px', color: '#22c55e', fontWeight: '700' }}>{item.category} &gt; {item.subCategory}</span>
                  <h4 style={{ margin: '2px 0 4px 0', fontSize: '13px', fontWeight: '700' }}>{item.title}</h4>
                  <div style={{ fontSize: '15px', fontWeight: '800', color: '#1b3a2b' }}>{item.price.toLocaleString('tr-TR')} TL</div>
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
            <span style={{ fontSize: '12px', color: '#22c55e', fontWeight: '700' }}>{selectedListing.category} / {selectedListing.subCategory}</span>
            <h2 style={{ fontSize: '18px', fontWeight: '800', margin: '4px 0' }}>{selectedListing.title}</h2>
            <div style={{ fontSize: '22px', fontWeight: '800', color: '#1b3a2b', marginBottom: '4px' }}>{selectedListing.price.toLocaleString('tr-TR')} TL</div>
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
               
              <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569' }}>Ana Kategori:</label>
              <select name="category" value={form.category} onChange={handleFormChange} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                {Object.keys(categoriesWithSubs).map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>

              <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569' }}>Alt Kategori:</label>
              <select name="subCategory" value={form.subCategory} onChange={handleFormChange} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                {(categoriesWithSubs[form.category] || ['Genel']).map(sub => <option key={sub} value={sub}>{sub}</option>)}
              </select>

              <input type="text" name="location" placeholder="Konum (Örn: Gönen / Balıkesir)" value={form.location} onChange={handleFormChange} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
              <input type="file" accept="image/*" onChange={handleImageUpload} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
              <textarea name="description" placeholder="Açıklama..." value={form.description} onChange={handleFormChange} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', height: '80px' }} />

              <button type="submit" style={{ backgroundColor: '#22c55e', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}>İlanı Gönder</button>
            </form>
          </div>
        )}

        {activeTab === 'admin-page' && (
          <div ref={editFormRef} style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '16px', border: '1px solid #e2e8f0' }}>
            {!isAdminLoggedIn ? (
              <div style={{ maxWidth: '320px', margin: '30px auto', textAlign: 'center' }}>
                <h2 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '10px' }}>Yönetici Girişi</h2>
                <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '15px' }}>Yönetim paneline erişmek için şifrenizi girin (Şifre: 5538)</p>
                <form onSubmit={handleAdminLogin} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <input type="password" placeholder="Şifre" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', textAlign: 'center' }} />
                  <button type="submit" style={{ backgroundColor: '#1b3a2b', color: '#fff', border: 'none', padding: '10px', borderRadius: '6px', fontWeight: '700', cursor: 'pointer' }}>Giriş Yap</button>
                </form>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h2 style={{ fontSize: '16px', fontWeight: '800', margin: 0 }}>🛡️ Canlı Yönetim Paneli</h2>
                  <button onClick={() => changeTab('home')} style={{ backgroundColor: '#1b3a2b', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>Anasayfaya Dön</button>
                </div>
                 
                <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#d97706' }}>⏳ Onay Bekleyen İlanlar ({listings.filter(i => i.status === 'pending').length})</h3>
                {listings.filter(i => i.status === 'pending').length === 0 ? (
                  <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '20px' }}>Onay bekleyen ilan bulunmuyor.</p>
                ) : (
                  listings.filter(i => i.status === 'pending').map(item => (
                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', backgroundColor: '#fefce8', borderRadius: '6px', marginBottom: '8px' }}>
                      <div style={{ fontSize: '13px' }}>
                        <strong>{item.title}</strong><br />
                        <span style={{ color: '#475569' }}>{item.price} TL - {item.seller}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button onClick={() => approveListing(item.id)} style={{ backgroundColor: '#22c55e', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: '4px', cursor: 'pointer', fontWeight: '700', fontSize: '12px' }}>Onayla</button>
                        <button onClick={() => handleDeleteListing(item.id)} style={{ backgroundColor: '#fee2e2', color: '#dc2626', border: 'none', padding: '6px 10px', borderRadius: '4px', cursor: 'pointer', fontWeight: '700', fontSize: '12px' }}>Reddet</button>
                      </div>
                    </div>
                  ))
                )}

                <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#1b3a2b', marginTop: '20px' }}>🌟 Vitrin Yönetimi</h3>
                {listings.map(item => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', backgroundColor: '#f8fafc', borderRadius: '6px', marginBottom: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '12px' }}>
                      <strong>{item.title}</strong><br />
                      <span style={{ color: '#64748b' }}>{item.category} &gt; {item.subCategory}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button onClick={() => makeFeatured(item.id, item.isFeatured)} style={{ backgroundColor: item.isFeatured ? '#f59e0b' : '#cbd5e1', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: '4px', cursor: 'pointer', fontWeight: '700', fontSize: '12px' }}>
                        {item.isFeatured ? '⭐ Vitrinden Çıkar' : '☆ Vitrine Ekle'}
                      </button>
                      <button onClick={() => handleDeleteListing(item.id)} style={{ backgroundColor: '#fee2e2', color: '#dc2626', border: 'none', padding: '6px 10px', borderRadius: '4px', cursor: 'pointer', fontWeight: '700', fontSize: '12px' }}>Sil</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* İLETİŞİM VE BANNER ALANI */}
      <footer style={{ backgroundColor: '#1b3a2b', color: '#fff', padding: '16px', textAlign: 'center', marginTop: '20px', fontSize: '12px' }}>
        <p style={{ margin: '0 0 6px 0', fontWeight: '700' }}>PazarTarla - Türkiye'nin Güvenilir Tarım ve İlan Platformu</p>
        <p style={{ margin: '0 0 4px 0', color: '#86efac' }}>İletişim / Destek: 0535 768 1550 | destek@pazartarla.com.tr</p>
        <p style={{ margin: 0, color: '#94a3b8' }}>© 2026 Tüm Hakları Saklıdır.</p>
      </footer>
    </div>
  );
}

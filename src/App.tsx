import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, SlidersHorizontal, MapPin, Phone, MessageCircle, Plus, 
  Heart, Share2, ShieldCheck, CheckCircle2, ChevronRight, ChevronDown, X, 
  Car, Tractor, Wrench, ArrowRight, Bell, User, Filter, AlertCircle, Trash2, Settings, Lock, Check, Mail, Globe, Copy, HelpCircle, Users, Image as ImageIcon, Bug, Shield, Package, ArrowLeft, Menu, ArrowUpDown, LayoutList, Star, Send, ShieldAlert, FolderPlus, Tag, Edit3, Sparkles, Megaphone, CheckCircle, Bot 
} from 'lucide-react';

// ==========================================
// SUPABASE REST API BAĞLANTI AYARLARI
// ==========================================
const SUPABASE_URL = 'https://srbarfjzsfkmglsnmbtw.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable__8tUtClK2adq_ORRuL5PQ_oft6c';

const dbHeaders = {
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json'
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
    status: 'approved',
    isFeatured: true
  },
  {
    id: 2,
    title: 'Sahibinden Temiz John Deere 5075E Traktör',
    price: 1250000,
    category: 'Traktör',
    subCategory: 'İkinci El Traktör',
    mode: 'Satılık',
    location: 'Tekirdağ / Süleymanpaşa',
    amount: '75 HP',
    description: 'Kapalı garajda muhafaza edilmiş, bakımlı ve masrafsız tarım traktörü.',
    seller: 'Serkan Öztürk',
    phone: '0531 333 4455',
    image: 'https://images.unsplash.com/photo-1592841202223-ca33cfd81b6f?auto=format&fit=crop&q=80&w=800',
    seoTags: 'john deere, traktör, tekirdağ tarım',
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
  'Uzmanlar': ['Veterinerler', 'Ziraatçiler'],
  'endüstriyel çadırlar': ['Çadır Örtüsü', 'Depo Çadırı'],
  'geçici konutlar': ['konteyner', 'çadır', 'prefabrik']
};

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [activeTab, setActiveTab] = useState('home'); 
  const editFormRef = useRef(null);
   
  const [listings, setListings] = useState(DEFAULT_START_LISTINGS);
  const [categoriesWithSubs, setCategoriesWithSubs] = useState(FALLBACK_CATEGORIES);
  const [announcement, setAnnouncement] = useState('🌾 Türkiye genelinden tarım aletleri, veterinerler ve taze mahsul ilanları PazarTarla’da!');
  const [tempAnnouncement, setTempAnnouncement] = useState(announcement);

  const [favorites, setFavorites] = useState(() => {
    try {
      const savedFavs = localStorage.getItem('pazartarla_favorites');
      return savedFavs ? JSON.parse(savedFavs) : [];
    } catch (e) {
      return [];
    }
  });

  const [selectedListing, setSelectedListing] = useState(null);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Tüm kategoriler');
  const [selectedSubCategory, setSelectedSubCategory] = useState('Tümü');
  const [openCategory, setOpenCategory] = useState('');
   
  const [newCategoryName, setNewCategoryName] = useState('Mahsuller');
  const [newSubCategoryName, setNewSubCategoryName] = useState('');
  const [selectedSubToRemove, setSelectedSubToRemove] = useState('');
  const [editingListing, setEditingListing] = useState(null);
  const [lastAddedListing, setLastAddedListing] = useState(null);

  const [form, setForm] = useState({
    title: '',
    price: '',
    category: 'Mahsuller',
    subCategory: 'Ceviz',
    mode: 'Satılık',
    location: 'Türkiye Geneli',
    city: 'Balıkesir',
    amount: '',
    description: '',
    seller: '',
    phone: '',
    image: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&q=80&w=800',
    seoTags: '',
    status: 'pending',
    isFeatured: false
  });

  // Supabase Verilerini Çekme (REST API)
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
    const timer = setTimeout(() => setShowSplash(false), 3500);
    fetchListings();
    const interval = setInterval(fetchListings, 5000);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    window.history.replaceState({ tab: 'home' }, '');
    const handlePopState = (event) => {
      if (event.state && event.state.tab) {
        setActiveTab(event.state.tab);
      } else {
        setActiveTab('home');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const changeTab = (tabName) => {
    window.history.pushState({ tab: tabName }, '');
    setActiveTab(tabName);
  };

  const saveAnnouncement = (e) => {
    e.preventDefault();
    if (!isAdminLoggedIn) return;
    setAnnouncement(tempAnnouncement);
    alert('Duyuru başarıyla güncellendi!');
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

  const generateAutoSEO = (title, category, subCategory, location) => {
    const cleanTitle = sanitizeInput(title.trim() ? title.trim() : 'Tarım İlanı');
    const cleanLoc = sanitizeInput(location.trim() ? location.trim() : 'Türkiye Geneli');
    return `${cleanTitle}, ${sanitizeInput(category || 'Tarım')}, ${sanitizeInput(subCategory || 'Ürün')}, ${cleanLoc} ilanları, pazar tarla`;
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

  const handleEditFormChange = (e) => {
    const { name, value } = e.target;
    setEditingListing(prev => {
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
      mode: form.mode,
      location: sanitizeInput(form.location),
      amount: sanitizeInput(form.amount),
      description: sanitizeInput(form.description),
      seller: sanitizeInput(form.seller),
      phone: sanitizeInput(form.phone),
      image: form.image || getSmartAutoImage(form.title, form.category),
      seoTags: generateAutoSEO(form.title, form.category, form.subCategory, form.location),
      status: 'pending',
      isFeatured: false
    };

    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/listings`, {
        method: 'POST',
        headers: { ...dbHeaders, 'Prefer': 'return=minimal' },
        body: JSON.stringify(newEntry)
      });

      if (!res.ok) {
        alert('İlan eklenirken hata oluştu.');
        return;
      }
    } catch (err) {
      alert('Bağlantı hatası.');
      return;
    }

    fetchListings();
    setLastAddedListing(newEntry);
    changeTab('success-wa');
  };

  const handleAutoFetchListings = async () => {
    if (!isAdminLoggedIn) return;
    const dynamicPool = {
      title: 'New Holland TD100D Tarım Traktörü',
      price: 1450000,
      category: 'Traktör',
      subCategory: 'İkinci El Traktör',
      mode: 'Satılık',
      location: 'Balıkesir / Gönen',
      amount: '100 HP',
      description: 'Tertemiz, bakımları tam tarla traktörü.',
      seller: 'Can İnce',
      phone: '0535 768 1550',
      image: getSmartAutoImage('New Holland Traktör', 'Traktör'),
      seoTags: 'new holland, traktör, gönen tarım',
      status: 'pending',
      isFeatured: false
    };

    try {
      await fetch(`${SUPABASE_URL}/rest/v1/listings`, {
        method: 'POST',
        headers: { ...dbHeaders, 'Prefer': 'return=minimal' },
        body: JSON.stringify(dynamicPool)
      });
      fetchListings();
      alert('🎉 Otomatik test ilanı kuyruğa eklendi.');
    } catch (e) {
      console.error(e);
    }
  };

  const approveListing = async (id) => {
    if (!isAdminLoggedIn) return;
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/listings?id=eq.${id}`, {
        method: 'PATCH',
        headers: dbHeaders,
        body: JSON.stringify({ status: 'approved' })
      });
      fetchListings();
    } catch (e) {
      console.error(e);
    }
  };

  const approveAllListings = async () => {
    if (!isAdminLoggedIn) return;
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/listings?status=eq.pending`, {
        method: 'PATCH',
        headers: dbHeaders,
        body: JSON.stringify({ status: 'approved' })
      });
      fetchListings();
      alert('Tüm bekleyen ilanlar onaylandı!');
    } catch (e) {
      console.error(e);
    }
  };

  const toggleFeaturedListing = async (id) => {
    if (!isAdminLoggedIn) return;
    const target = listings.find(i => i.id === id);
    if (!target) return;

    try {
      await fetch(`${SUPABASE_URL}/rest/v1/listings?id=eq.${id}`, {
        method: 'PATCH',
        headers: dbHeaders,
        body: JSON.stringify({ isFeatured: !target.isFeatured })
      });
      fetchListings();
    } catch (e) {
      console.error(e);
    }
  };

  const startEditingFromDetail = (item) => {
    if (!isAdminLoggedIn) {
      alert('Önce Yönetici Paneline giriş yapmalısınız.');
      changeTab('admin-page');
      return;
    }
    setEditingListing(item);
    changeTab('admin-page');
    setTimeout(() => {
      if (editFormRef.current) editFormRef.current.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const saveEditedListing = async (e) => {
    e.preventDefault();
    if (!isAdminLoggedIn) return;

    try {
      await fetch(`${SUPABASE_URL}/rest/v1/listings?id=eq.${editingListing.id}`, {
        method: 'PATCH',
        headers: dbHeaders,
        body: JSON.stringify({
          title: sanitizeInput(editingListing.title),
          price: Number(editingListing.price),
          category: editingListing.category,
          subCategory: editingListing.subCategory,
          location: sanitizeInput(editingListing.location),
          description: sanitizeInput(editingListing.description),
          image: editingListing.image,
          status: 'approved'
        })
      });
      fetchListings();
      setEditingListing(null);
      alert('İlan güncellendi!');
      changeTab('home');
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteListing = async (id) => {
    if (!isAdminLoggedIn) return;
    if (window.confirm('Bu ilanı silmek istediğinize emin misiniz?')) {
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/listings?id=eq.${id}`, {
          method: 'DELETE',
          headers: dbHeaders
        });
        fetchListings();
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleAddCategory = (e) => {
    e.preventDefault();
    if (!isAdminLoggedIn) return;
    const catName = newCategoryName;
    const currentSubs = categoriesWithSubs[catName] || [];
    const newSubs = newSubCategoryName ? newSubCategoryName.split(',').map(s => s.trim()).filter(Boolean) : [];
    const combined = Array.from(new Set([...currentSubs, ...newSubs]));
    setCategoriesWithSubs({ ...categoriesWithSubs, [catName]: combined });
    setNewSubCategoryName('');
    alert('Alt seçenekler eklendi!');
  };

  const handleDeleteSubCategory = (catKey, subToDel) => {
    if (!isAdminLoggedIn) return;
    const currentSubs = categoriesWithSubs[catKey] || [];
    const updatedSubs = currentSubs.filter(sub => sub !== subToDel);
    setCategoriesWithSubs({ ...categoriesWithSubs, [catKey]: updatedSubs.length ? updatedSubs : ['Genel'] });
    setSelectedSubToRemove('');
    alert('Seçenek silindi!');
  };

  const handleDeleteCategory = (catKey) => {
    if (!isAdminLoggedIn) return;
    const copy = { ...categoriesWithSubs };
    delete copy[catKey];
    setCategoriesWithSubs(copy);
  };

  const handleAdminLogin = (e) => {
    e.preventDefault();
    const correctCode = '5' + '5' + '3' + '8';
    if (adminPassword === correctCode) {
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

  if (showSplash) {
    return (
      <div style={{ position: 'fixed', inset: 0, backgroundColor: '#0f172a', color: '#f8fafc', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '24px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '32px', fontWeight: '700', margin: 0 }}>Türkiye'nin İlk ve Tek <br /><span style={{ color: '#2add9c' }}>Tarım Platformu</span></h1>
      </div>
    );
  }

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
          <button onClick={() => changeTab('favorites')} style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>
            ❤️ ({favorites.length})
          </button>
          <button onClick={() => changeTab('add')} style={{ backgroundColor: '#22c55e', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: '700', fontSize: '13px' }}>
            <Plus size={16} /> İlan Ver
          </button>
        </div>
      </header>

      <main style={{ width: '100%', maxWidth: '600px', margin: '0 auto', padding: '12px', flex: 1, boxSizing: 'border-box' }}>
        {announcement && (
          <div style={{ backgroundColor: '#fef08a', color: '#713f12', padding: '10px 14px', borderRadius: '10px', marginBottom: '12px', fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #facc15', overflow: 'hidden', whiteSpace: 'nowrap' }}>
            <Megaphone size={16} color="#854d0e" style={{ flexShrink: 0 }} />
            <style>{`
              @keyframes marquee {
                0% { transform: translateX(100%); }
                100% { transform: translateX(-100%); }
              }
              .marquee-text {
                display: inline-block;
                animation: marquee 15s linear infinite;
              }
            `}</style>
            <div style={{ width: '100%', overflow: 'hidden' }}>
              <div className="marquee-text">{announcement}</div>
            </div>
          </div>
        )}

        {activeTab === 'success-wa' && (
          <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '24px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
            <CheckCircle size={36} color="#166534" style={{ margin: '0 auto 12px auto' }} />
            <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#1b3a2b', margin: '0 0 8px 0' }}>İlanınız Başarıyla Alındı!</h2>
            <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '20px' }}>Yönetici onayından sonra tüm cihazlarda görünecektir.</p>
            
            {lastAddedListing && (
              <a 
                href={`https://api.whatsapp.com/send?phone=905357681550&text=${encodeURIComponent(`🔔 *Yeni İlan Onay Bekliyor!*\n\n*Başlık:* ${lastAddedListing.title}\n*Fiyat:*${lastAddedListing.price} TL\n*Kategori:* ${lastAddedListing.category} /${lastAddedListing.subCategory}\n*Satıcı:* ${lastAddedListing.seller} (${lastAddedListing.phone})`)}`}
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

              {Object.keys(categoriesWithSubs).map(cat => {
                const isOpen = openCategory === cat;
                return (
                  <div key={cat}>
                    <div onClick={() => setOpenCategory(isOpen ? '' : cat)} style={{ padding: '14px 16px', borderBottom: '1px solid #edf2f7', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', backgroundColor: isOpen ? '#f0fdf4' : '#fff' }}>
                      <span style={{ fontWeight: '600', color: isOpen ? '#1b3a2b' : '#334155', fontSize: '14px' }}>{cat}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94a3b8', fontSize: '13px' }}>
                        <span>({approvedListings.filter(i => i.category === cat).length})</span>
                        {isOpen ? <ChevronDown size={16} color="#22c55e" /> : <ChevronRight size={16} />}
                      </div>
                    </div>
                    {isOpen && (
                      <div style={{ backgroundColor: '#fafafa', borderBottom: '1px solid #edf2f7' }}>
                        <div onClick={(e) => { e.stopPropagation(); setSelectedCategory(cat); setSelectedSubCategory('Tümü'); changeTab('results'); }} style={{ padding: '10px 16px 10px 28px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', fontSize: '13px', color: '#166534', fontWeight: '600' }}>
                          → Tüm {cat} İlanları
                        </div>
                        {(categoriesWithSubs[cat] || []).map(sub => (
                          <div key={sub} onClick={(e) => { e.stopPropagation(); setSelectedCategory(cat); setSelectedSubCategory(sub); changeTab('results'); }} style={{ padding: '10px 16px 10px 28px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', fontSize: '13px', color: '#64748b' }}>
                            • {sub}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <button onClick={() => changeTab('results')} style={{ background: 'none', border: 'none', color: '#64748b', fontWeight: '600', cursor: 'pointer' }}>← Listeye Dön</button>
              {isAdminLoggedIn && (
                <button onClick={() => startEditingFromDetail(selectedListing)} style={{ backgroundColor: '#e0f2fe', color: '#0284c7', border: 'none', padding: '6px 12px', borderRadius: '6px', fontWeight: '700', fontSize: '12px', cursor: 'pointer' }}>
                  ✏️ Bu İlanı Düzenle
                </button>
              )}
            </div>

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
                <form onSubmit={handleAdminLogin} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <input type="password" placeholder="Yönetici Şifresi" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', textAlign: 'center' }} />
                  <button type="submit" style={{ backgroundColor: '#1b3a2b', color: '#fff', border: 'none', padding: '10px', borderRadius: '6px', fontWeight: '700', cursor: 'pointer' }}>Giriş Yap</button>
                </form>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h2 style={{ fontSize: '16px', fontWeight: '800', margin: 0 }}>🛡️ Tam Kontrol Paneli</h2>
                  <button onClick={() => setIsAdminLoggedIn(false)} style={{ backgroundColor: '#ef4444', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}>Çıkış</button>
                </div>

                <div style={{ backgroundColor: '#ecfdf5', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
                  <button type="button" onClick={handleAutoFetchListings} style={{ width: '100%', backgroundColor: '#059669', color: '#fff', border: 'none', padding: '10px', borderRadius: '6px', fontWeight: '700', cursor: 'pointer' }}>
                    🤖 Otomatik Test İlanı Çek
                  </button>
                </div>

                <div style={{ backgroundColor: '#fef9c3', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#854d0e', margin: '0 0 8px 0' }}>Duyuru Banner Yönetimi</h3>
                  <form onSubmit={saveAnnouncement} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <input type="text" value={tempAnnouncement} onChange={(e) => setTempAnnouncement(e.target.value)} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #facc15' }} />
                    <button type="submit" style={{ backgroundColor: '#ca8a04', color: '#fff', border: 'none', padding: '8px', borderRadius: '6px', fontWeight: '700', cursor: 'pointer' }}>Güncelle</button>
                  </form>
                </div>

                {editingListing && (
                  <div style={{ backgroundColor: '#f0fdf4', padding: '14px', borderRadius: '8px', border: '2px solid #22c55e', marginBottom: '20px' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#166534', margin: '0 0 10px 0' }}>✏️ İlanı Düzenle</h3>
                    <form onSubmit={saveEditedListing} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <input type="text" name="title" value={editingListing.title} onChange={handleEditFormChange} placeholder="Başlık" style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                      <input type="number" name="price" value={editingListing.price} onChange={handleEditFormChange} placeholder="Fiyat" style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                      <input type="text" name="location" value={editingListing.location} onChange={handleEditFormChange} placeholder="Konum" style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                      <textarea name="description" value={editingListing.description} onChange={handleEditFormChange} placeholder="Açıklama" style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', height: '60px' }} />
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button type="submit" style={{ flex: 1, backgroundColor: '#22c55e', color: '#fff', border: 'none', padding: '8px', borderRadius: '6px', fontWeight: '700', cursor: 'pointer' }}>Kaydet</button>
                        <button type="button" onClick={() => setEditingListing(null)} style={{ background: '#e2e8f0', border: 'none', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer' }}>İptal</button>
                      </div>
                    </form>
                  </div>
                )}

                <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#1b3a2b', margin: '0 0 8px 0' }}>Kategori & Alt Seçenek Yönetimi</h3>
                  <form onSubmit={handleAddCategory} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <select value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#fff' }}>
                      {Object.keys(categoriesWithSubs).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                    
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <select value={selectedSubToRemove} onChange={(e) => setSelectedSubToRemove(e.target.value)} style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #ef4444', backgroundColor: '#fef2f2' }}>
                        <option value="">Silinecek seçeneği seç...</option>
                        {(categoriesWithSubs[newCategoryName] || []).map(sub => <option key={sub} value={sub}>{sub}</option>)}
                      </select>
                      <button type="button" onClick={() => handleDeleteSubCategory(newCategoryName, selectedSubToRemove)} style={{ backgroundColor: '#ef4444', color: '#fff', border: 'none', padding: '0 10px', borderRadius: '6px', fontWeight: '700', fontSize: '11px', cursor: 'pointer' }}>Sil</button>
                    </div>

                    <input type="text" placeholder="Yeni alt seçenekler (Virgülle ayırın)" value={newSubCategoryName} onChange={(e) => setNewSubCategoryName(e.target.value)} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                    <button type="submit" style={{ backgroundColor: '#22c55e', color: '#fff', border: 'none', padding: '8px', borderRadius: '6px', fontWeight: '700', cursor: 'pointer' }}>Seçenek Ekle</button>
                  </form>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#d97706' }}>⏳ Onay Bekleyen İlanlar ({listings.filter(i => i.status === 'pending').length})</h3>
                  {listings.filter(i => i.status === 'pending').length > 0 && (
                    <button onClick={approveAllListings} style={{ backgroundColor: '#22c55e', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>Tümünü Onayla</button>
                  )}
                </div>

                {listings.filter(i => i.status === 'pending').map(item => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', backgroundColor: '#fefce8', borderRadius: '6px', marginBottom: '8px' }}>
                    <span>{item.title} ({item.price} TL)</span>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button onClick={() => approveListing(item.id)} style={{ backgroundColor: '#22c55e', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}>Onayla</button>
                      <button onClick={() => handleDeleteListing(item.id)} style={{ backgroundColor: '#fee2e2', color: '#dc2626', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}>Sil</button>
                    </div>
                  </div>
                ))}

                <h3 style={{ fontSize: '14px', fontWeight: '700', marginTop: '20px', marginBottom: '8px' }}>📋 Tüm İlanlar ({listings.length})</h3>
                {listings.map(item => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', backgroundColor: '#f8fafc', borderRadius: '6px', marginBottom: '6px' }}>
                    <span style={{ fontSize: '12px', fontWeight: '600' }}>{item.title}</span>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button onClick={() => toggleFeaturedListing(item.id)} style={{ backgroundColor: item.isFeatured ? '#fef08a' : '#f1f5f9', color: '#854d0e', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>
                        {item.isFeatured ? '⭐ Vitrinde' : '☆ Vitrin Yap'}
                      </button>
                      <button onClick={() => { setEditingListing(item); if (editFormRef.current) editFormRef.current.scrollIntoView({ behavior: 'smooth' }); }} style={{ backgroundColor: '#e0f2fe', color: '#0284c7', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>Düzenle</button>
                      <button onClick={() => handleDeleteListing(item.id)} style={{ backgroundColor: '#fee2e2', color: '#dc2626', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>Sil</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      <button onClick={() => changeTab('admin-page')} title="Yönetim Paneli" style={{ position: 'fixed', bottom: '20px', right: '20px', backgroundColor: '#1b3a2b', color: '#86efac', border: '2px solid #22c55e', borderRadius: '50%', width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 999 }}>
        ⚙️
      </button>
    </div>
  );
}

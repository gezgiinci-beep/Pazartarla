import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, SlidersHorizontal, MapPin, Phone, MessageCircle, Plus, 
  Heart, Share2, ShieldCheck, CheckCircle2, ChevronRight, ChevronDown, X, 
  Car, Tractor, Wrench, ArrowRight, Bell, User, Filter, AlertCircle, Trash2, Settings, Lock, Check, Mail, Globe, Copy, HelpCircle, Users, Image as ImageIcon, Bug, Shield, Package, ArrowLeft, Menu, ArrowUpDown, LayoutList, Star, Send, ShieldAlert, FolderPlus, Tag, Edit3, Sparkles, Megaphone, CheckCircle, Bot 
} from 'lucide-react';

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
  
  const [listings, setListings] = useState(() => {
    try {
      const saved = localStorage.getItem('pazartarla_listings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error("Veri okuma hatası:", e);
    }
    return DEFAULT_START_LISTINGS;
  });

  const [categoriesWithSubs, setCategoriesWithSubs] = useState(() => {
    try {
      const saved = localStorage.getItem('pazartarla_categories');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch (e) {
      console.error("Kategori okuma hatası:", e);
    }
    return FALLBACK_CATEGORIES;
  });

  const [announcement, setAnnouncement] = useState(() => {
    try {
      return localStorage.getItem('pazartarla_announcement') || '🌾 Türkiye genelinden tarım aletleri, veterinerler ve taze mahsul ilanları PazarTarla’da!';
    } catch (e) {
      return '🌾 Türkiye’nin ilk ve tek tarım platformuna hoş geldiniz.';
    }
  });
  const [tempAnnouncement, setTempAnnouncement] = useState(announcement);

  const [favorites, setFavorites] = useState(() => {
    try {
      const savedFavs = localStorage.getItem('pazartarla_favorites');
      if (savedFavs) {
        const parsed = JSON.parse(savedFavs);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error("Favori okuma hatası:", e);
    }
    return [];
  });

  const [selectedListing, setSelectedListing] = useState(null);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Tüm kategoriler');
  const [selectedSubCategory, setSelectedSubCategory] = useState('Tümü');
  const [openCategory, setOpenCategory] = useState('');
  const [adminOpenCategory, setAdminOpenCategory] = useState('');
  
  const [newCategoryName, setNewCategoryName] = useState(() => Object.keys(FALLBACK_CATEGORIES)[0] || 'Mahsuller');
  const [newSubCategoryName, setNewSubCategoryName] = useState('');
  const [selectedSubToRemove, setSelectedSubToRemove] = useState('');
  const [editingListing, setEditingListing] = useState(null);
  const [lastAddedListing, setLastAddedListing] = useState(null);

  const [form, setForm] = useState({
    title: '',
    price: '',
    category: Object.keys(categoriesWithSubs)[0] || 'Mahsuller',
    subCategory: categoriesWithSubs[Object.keys(categoriesWithSubs)[0]]?.[0] || 'Genel',
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

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 3500);
    return () => clearTimeout(timer);
  }, []);

  const changeTab = (tabName) => {
    setActiveTab(tabName);
  };

  const saveListings = (newListings) => {
    try {
      setListings(newListings);
      localStorage.setItem('pazartarla_listings', JSON.stringify(newListings));
    } catch (e) {
      console.error("Kayıt hatası:", e);
    }
  };

  const saveCategories = (newCats) => {
    try {
      setCategoriesWithSubs(newCats);
      localStorage.setItem('pazartarla_categories', JSON.stringify(newCats));
    } catch (e) {
      console.error("Kategori kayıt hatası:", e);
    }
  };

  const saveAnnouncement = (e) => {
    e.preventDefault();
    if (!isAdminLoggedIn) return;
    setAnnouncement(tempAnnouncement);
    try {
      localStorage.setItem('pazartarla_announcement', tempAnnouncement);
      alert('Duyuru başarıyla güncellendi!');
    } catch (err) {
      console.error(err);
    }
  };

  const sanitizeInput = (str) => {
    if (typeof str !== 'string') return str;
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  const getSmartAutoImage = (title, category) => {
    const t = (title || '').toLowerCase();
    const c = (category || '').toLowerCase();

    if (t.includes('traktör') || c.includes('traktör')) {
      return 'https://images.unsplash.com/photo-1592841202223-ca33cfd81b6f?auto=format&fit=crop&q=80&w=800';
    }
    if (t.includes('bal') || t.includes('arı') || c.includes('arıcılık')) {
      return 'https://images.unsplash.com/photo-1587049352847-4a222e784d38?auto=format&fit=crop&q=80&w=800';
    }
    return 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&q=80&w=800';
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
      reader.onloadend = () => {
        setForm(prev => ({ ...prev, image: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleEditImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('Dosya boyutu 2 MB sınırını aşamaz!');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditingListing(prev => ({ ...prev, image: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDirectAdd = (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.price || !form.phone.trim() || !form.seller.trim()) {
      alert('Lütfen zorunlu alanları (Ad Soyad, Telefon, Başlık ve Fiyat) eksiksiz doldurun.');
      return;
    }

    const finalImage = form.image || getSmartAutoImage(form.title, form.category);
    const finalSeoTags = form.seoTags || generateAutoSEO(form.title, form.category, form.subCategory, form.location);
    
    const newEntry = {
      ...form,
      title: sanitizeInput(form.title),
      description: sanitizeInput(form.description),
      seller: sanitizeInput(form.seller),
      phone: sanitizeInput(form.phone),
      image: finalImage,
      id: Date.now(),
      price: Number(form.price),
      seoTags: finalSeoTags,
      status: 'pending',
      isFeatured: false
    };

    const updated = [newEntry, ...listings];
    saveListings(updated);
    setLastAddedListing(newEntry);
    changeTab('success-wa');
  };

  const handleAutoFetchListings = () => {
    if (!isAdminLoggedIn) return;
    
    const randomPool = [
      {
        title: 'John Deere 5075E 4WD Kabinli Traktör',
        price: 1350000,
        category: 'Traktör',
        subCategory: 'İkinci El Traktör',
        mode: 'Satılık',
        location: 'Balıkesir / Gönen',
        amount: '75 HP',
        description: 'Az kullanılmış, bakımlı ve masrafsız tarla traktörü.',
        seller: 'Can İnce',
        phone: '0535 768 1550',
        seoTags: 'john deere, traktör, gönen tarım'
      },
      {
        title: 'Organik Çiçek Yayla Balı',
        price: 480,
        category: 'Arıcılık',
        subCategory: 'Bal',
        mode: 'Satılık',
        location: 'Muğla / Fethiye',
        amount: '2 Kilo',
        description: 'Çam ve çiçek nektarından üretilmiş saf arı balı.',
        seller: 'Ahmet Arıcı',
        phone: '0534 777 2211',
        seoTags: 'organik bal, muğla balı, arıcılık'
      }
    ];

    const randomItem = randomPool[Math.floor(Math.random() * randomPool.length)];
    const newEntry = {
      ...randomItem,
      id: Date.now(),
      image: getSmartAutoImage(randomItem.title, randomItem.category),
      status: 'pending',
      isFeatured: false
    };

    const updated = [newEntry, ...listings];
    saveListings(updated);
    alert(`🎉 "${newEntry.title}" otomatik olarak onay kuyruğuna eklendi.`);
  };

  const approveListing = (id) => {
    if (!isAdminLoggedIn) return;
    const updated = listings.map(item => item.id === id ? { ...item, status: 'approved' } : item);
    saveListings(updated);
  };

  const approveAllListings = () => {
    if (!isAdminLoggedIn) return;
    const updated = listings.map(item => ({ ...item, status: 'approved' }));
    saveListings(updated);
    alert('Bekleyen tüm ilanlar onaylandı ve yayına alındı!');
  };

  const toggleFeaturedListing = (id) => {
    if (!isAdminLoggedIn) return;
    const updated = listings.map(item => item.id === id ? { ...item, isFeatured: !item.isFeatured } : item);
    saveListings(updated);
  };

  const startEditingFromDetail = (item) => {
    if (!isAdminLoggedIn) {
      alert('İlanı düzenlemek için önce Yönetici Paneline giriş yapmalısınız.');
      changeTab('admin-page');
      return;
    }
    setEditingListing(item);
    changeTab('admin-page');
  };

  const saveEditedListing = (e) => {
    e.preventDefault();
    if (!isAdminLoggedIn) return;
    
    const finalImg = editingListing.image || getSmartAutoImage(editingListing.title, editingListing.category);
    const updatedListings = listings.map(item => item.id === editingListing.id ? { 
      ...editingListing, 
      title: sanitizeInput(editingListing.title),
      description: sanitizeInput(editingListing.description),
      price: Number(editingListing.price),
      image: finalImg,
      status: 'approved' 
    } : item);
    
    saveListings(updatedListings);
    setEditingListing(null);
    alert('İlan başarıyla güncellendi ve yayına alındı!');
    changeTab('home');
  };

  const handleDeleteListing = (id) => {
    if (!isAdminLoggedIn) return;
    if (window.confirm('Bu ilanı silmek istediğinize emin misiniz?')) {
      const updated = listings.filter(item => item.id !== id);
      saveListings(updated);
      setFavorites(favorites.filter(item => item.id !== id));
    }
  };

  const handleAddCategory = (e) => {
    e.preventDefault();
    if (!isAdminLoggedIn) return;
    if (!newCategoryName.trim()) return;
    const catName = sanitizeInput(newCategoryName.trim());
    const existingSubs = categoriesWithSubs[catName] || [];
    const newSubsInput = newSubCategoryName.trim() 
      ? newSubCategoryName.split(',').map(s => sanitizeInput(s.trim())).filter(Boolean) 
      : [];
     
    const combinedSubs = Array.from(new Set([...existingSubs, ...newSubsInput]));
    if (combinedSubs.length === 0) combinedSubs.push('Genel');

    const updatedCats = { ...categoriesWithSubs, [catName]: combinedSubs };
    saveCategories(updatedCats);
    setNewSubCategoryName('');
    alert(`"${catName}" kategorisi güncellendi!`);
  };

  const handleDeleteCategory = (catKey) => {
    if (!isAdminLoggedIn) return;
    if (window.confirm(`"${catKey}" kategorisini silmek istediğinize emin misiniz?`)) {
      const updatedCats = { ...categoriesWithSubs };
      delete updatedCats[catKey];
      saveCategories(updatedCats);
    }
  };

  const handleDeleteSubCategory = (catKey, subToDel) => {
    if (!isAdminLoggedIn) return;
    if (!subToDel) return;
    if (window.confirm(`"${subToDel}" seçeneğini silmek istediğinize emin misiniz?`)) {
      const currentSubs = categoriesWithSubs[catKey] || [];
      const updatedSubs = currentSubs.filter(sub => sub !== subToDel);
      if (updatedSubs.length === 0) updatedSubs.push('Genel');
      const updatedCats = { ...categoriesWithSubs, [catKey]: updatedSubs };
      saveCategories(updatedCats);
      setSelectedSubToRemove('');
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

  if (showSplash) {
    return (
      <div style={{ position: 'fixed', inset: 0, backgroundColor: '#0f172a', color: '#f8fafc', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '24px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '32px', fontWeight: '700' }}>Türkiye'nin İlk ve Tek <br /><span style={{ color: '#2add9c' }}>Tarım Platformu</span></h1>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f4f6f8', color: '#1e293b', fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column', width: '100%' }}>
      <header style={{ backgroundColor: '#1b3a2b', color: '#ffffff', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }} onClick={() => { changeTab('home'); setSelectedCategory('Tüm kategoriler'); }}>
          <div style={{ backgroundColor: '#22c55e', padding: '6px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span>🌾</span>
            <Tractor size={18} color="#fff" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '18px', fontWeight: '800' }}>PazarTarla</h1>
            <span style={{ fontSize: '10px', color: '#86efac' }}>Türkiye Tarım & Ekipman Pazarı</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button onClick={() => changeTab('favorites')} style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Heart size={15} color="#ef4444" fill={favorites.length > 0 ? "#ef4444" : "none"} /> 
            <span>({favorites.length})</span>
          </button>
          <button onClick={() => changeTab('add')} style={{ backgroundColor: '#22c55e', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: '700', fontSize: '13px' }}>
            + İlan Ver
          </button>
        </div>
      </header>

      <main style={{ width: '100%', maxWidth: '600px', margin: '0 auto', padding: '12px', flex: 1 }}>
        {announcement && (
          <div style={{ backgroundColor: '#fef08a', color: '#713f12', padding: '10px 14px', borderRadius: '10px', marginBottom: '12px', fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #facc15' }}>
            <Megaphone size={16} color="#854d0e" />
            <span>{announcement}</span>
          </div>
        )}

        {activeTab === 'home' && (
          <div style={{ backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
            <div style={{ backgroundColor: '#1b3a2b', color: '#fff', padding: '14px 16px', fontWeight: '700' }}>Kategori Seçimi (Türkiye Geneli)</div>
            <div onClick={() => { setSelectedCategory('Tüm kategoriler'); setSelectedSubCategory('Tümü'); changeTab('results'); }} style={{ padding: '14px 16px', borderBottom: '1px solid #edf2f7', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', backgroundColor: '#f8fafc' }}>
              <span style={{ fontWeight: '700', color: '#1b3a2b' }}>Tüm Türkiye Tarım İlanları</span>
              <span style={{ color: '#22c55e', fontWeight: '700' }}>({approvedListings.length}) ›</span>
            </div>
            {Object.keys(categoriesWithSubs).map(cat => (
              <div key={cat} onClick={() => { setSelectedCategory(cat); setSelectedSubCategory('Tümü'); changeTab('results'); }} style={{ padding: '14px 16px', borderBottom: '1px solid #edf2f7', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                <span style={{ fontWeight: '600', color: '#334155', fontSize: '14px' }}>{cat}</span>
                <span style={{ color: '#94a3b8', fontSize: '13px' }}>({approvedListings.filter(i => i.category === cat).length}) ›</span>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'results' && (
          <div>
            <button onClick={() => changeTab('home')} style={{ marginBottom: '10px', background: 'none', border: 'none', color: '#166534', fontWeight: '700', cursor: 'pointer' }}>← Kategorilere Dön</button>
            {filteredListings.map(item => (
              <div key={item.id} onClick={() => { setSelectedListing(item); changeTab('detail'); }} style={{ backgroundColor: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0', cursor: 'pointer', display: 'flex', gap: '10px', padding: '10px', marginBottom: '10px' }}>
                <img src={item.image} alt={item.title} style={{ width: '90px', height: '90px', objectFit: 'cover', borderRadius: '8px' }} />
                <div style={{ flex: 1 }}>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '13px', fontWeight: '700' }}>{item.title}</h4>
                  <div style={{ fontSize: '15px', fontWeight: '800', color: '#1b3a2b' }}>{item.price.toLocaleString('tr-TR')} TL</div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>📍 {item.location}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'detail' && selectedListing && (
          <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '16px', border: '1px solid #e2e8f0' }}>
            <button onClick={() => changeTab('results')} style={{ marginBottom: '10px', background: 'none', border: 'none', color: '#64748b', fontWeight: '600', cursor: 'pointer' }}>← Listeye Dön</button>
            <img src={selectedListing.image} alt={selectedListing.title} style={{ width: '100%', height: '220px', objectFit: 'cover', borderRadius: '8px', marginBottom: '10px' }} />
            <h2 style={{ fontSize: '18px', fontWeight: '800', margin: '8px 0' }}>{selectedListing.title}</h2>
            <div style={{ fontSize: '22px', fontWeight: '800', color: '#1b3a2b', marginBottom: '4px' }}>{selectedListing.price.toLocaleString('tr-TR')} TL</div>
            <p style={{ color: '#475569', fontSize: '13px', marginBottom: '16px' }}>{selectedListing.description}</p>
            <a href={`tel:${selectedListing.phone}`} style={{ width: '100%', backgroundColor: '#1b3a2b', color: '#fff', padding: '12px', borderRadius: '8px', textAlign: 'center', fontWeight: '700', textDecoration: 'none', display: 'block' }}>📞 {selectedListing.phone} ({selectedListing.seller})</a>
          </div>
        )}

        {activeTab === 'add' && (
          <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '16px', border: '1px solid #e2e8f0' }}>
            <button onClick={() => changeTab('home')} style={{ marginBottom: '10px', background: 'none', border: 'none', color: '#64748b', fontWeight: '600', cursor: 'pointer' }}>← Vazgeç</button>
            <h2 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '10px' }}>İlan Ver</h2>
            <form onSubmit={handleDirectAdd} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <input type="text" name="seller" placeholder="Adınız Soyadınız *" value={form.seller} onChange={handleFormChange} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
              <input type="text" name="phone" placeholder="Telefon Numaranız *" value={form.phone} onChange={handleFormChange} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
              <input type="text" name="title" placeholder="İlan Başlığı *" value={form.title} onChange={handleFormChange} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
              <input type="number" name="price" placeholder="Fiyat (TL) *" value={form.price} onChange={handleFormChange} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
              <select name="category" value={form.category} onChange={handleFormChange} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                {Object.keys(categoriesWithSubs).map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
              <input type="text" name="location" placeholder="Konum (Şehir / İlçe)" value={form.location} onChange={handleFormChange} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
              <textarea name="description" placeholder="Açıklama" value={form.description} onChange={handleFormChange} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', height: '80px' }} />
              <button type="submit" style={{ backgroundColor: '#22c55e', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}>İlanı Gönder</button>
            </form>
          </div>
        )}

        {activeTab === 'success-wa' && (
          <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '24px', textAlign: 'center' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#1b3a2b', marginBottom: '8px' }}>İlanınız Başarıyla Alındı!</h2>
            <button onClick={() => changeTab('home')} style={{ backgroundColor: '#22c55e', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}>Ana Sayfaya Dön</button>
          </div>
        )}

        {activeTab === 'admin-page' && (
          <div ref={editFormRef} style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '16px', border: '1px solid #e2e8f0' }}>
            {!isAdminLoggedIn ? (
              <div style={{ maxWidth: '320px', margin: '30px auto', textAlign: 'center' }}>
                <h2 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '10px' }}>Yönetici Girişi</h2>
                <form onSubmit={handleAdminLogin} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <input type="password" placeholder="Şifre" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', textAlign: 'center' }} />
                  <button type="submit" style={{ backgroundColor: '#1b3a2b', color: '#fff', border: 'none', padding: '10px', borderRadius: '6px', fontWeight: '700', cursor: 'pointer' }}>Giriş Yap</button>
                </form>
              </div>
            ) : (
              <div>
                <h2 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '12px' }}>🛡️ Yönetim Paneli</h2>
                <button type="button" onClick={handleAutoFetchListings} style={{ backgroundColor: '#059669', color: '#fff', padding: '10px', borderRadius: '6px', fontWeight: '700', width: '100%', border: 'none', marginBottom: '14px', cursor: 'pointer' }}>🤖 Otomatik İlan Çek</button>
                <button onClick={approveAllListings} style={{ backgroundColor: '#22c55e', color: '#fff', border: 'none', padding: '8px', borderRadius: '6px', width: '100%', fontWeight: '700', marginBottom: '14px', cursor: 'pointer' }}>✓ Tüm Bekleyenleri Onayla</button>
                <h3 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '8px' }}>Mevcut İlanlar ({listings.length})</h3>
                {listings.map(item => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', backgroundColor: '#f8fafc', borderRadius: '6px', marginBottom: '6px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '12px', fontWeight: '600' }}>{item.title}</span>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button onClick={() => toggleFeaturedListing(item.id)} style={{ backgroundColor: '#fef08a', border: 'none', padding: '4px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: '700', cursor: 'pointer' }}>⭐ Vitrin</button>
                      <button onClick={() => handleDeleteListing(item.id)} style={{ backgroundColor: '#fee2e2', color: '#dc2626', border: 'none', padding: '4px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: '700', cursor: 'pointer' }}>Sil</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      <button onClick={() => changeTab('admin-page')} style={{ position: 'fixed', bottom: '20px', right: '20px', backgroundColor: '#1b3a2b', color: '#86efac', border: '2px solid #22c55e', borderRadius: '50%', width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 999 }}>⚙️</button>
    </div>
  );
}

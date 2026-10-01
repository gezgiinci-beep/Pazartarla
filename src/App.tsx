import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, SlidersHorizontal, MapPin, Phone, MessageCircle, Plus, 
  Heart, Share2, ShieldCheck, CheckCircle2, ChevronRight, ChevronDown, X, 
  Car, Tractor, Wrench, ArrowRight, Bell, User, Filter, AlertCircle, Trash2, Settings, Lock, Check, Mail, Globe, Copy, HelpCircle, Users, Image as ImageIcon, Bug, Shield, Package, ArrowLeft, Menu, ArrowUpDown, LayoutList, Star, Send, ShieldAlert, FolderPlus, Tag, Edit3, Sparkles, Megaphone, CheckCircle, Bot 
} from 'lucide-react';

// ==========================================
// SUPABASE BAĞLANTI AYARLARI (Vercel Güvenli Okuma)
// ==========================================
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://srbarfjzsfkmglsnmbtw.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable__8tUtClK2adq_ORRuL5PQ_oft6c';

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
  'Endüstriyel Çadırlar': ['Çadır Örtüsü', 'Depo Çadırı'],
  'Geçici Konutlar': ['Konteyner', 'Çadır', 'Prefabrik']
};

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [activeTab, setActiveTab] = useState('home'); 
  const editFormRef = useRef(null);
  
  // Canlı Destek Modülü State'leri
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    { sender: 'bot', text: 'Merhaba! PazarTarla canlı destek hattına hoş geldiniz. Size nasıl yardımcı olabilirim?' }
  ]);
  const [chatInput, setChatInput] = useState('');
   
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

  useEffect(() => {
    try {
      localStorage.setItem('pazartarla_favorites', JSON.stringify(favorites));
    } catch (e) {
      console.error(e);
    }
  }, [favorites]);

  const toggleFavorite = (item, e) => {
    if (e) e.stopPropagation();
    setFavorites(prev => {
      const exists = prev.some(fav => fav.id === item.id);
      if (exists) {
        return prev.filter(fav => fav.id !== item.id);
      } else {
        return [...prev, item];
      }
    });
  };

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

  const [customCategoryInput, setCustomCategoryInput] = useState('');

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

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const userText = chatInput.trim();
    setChatMessages(prev => [...prev, { sender: 'user', text: userText }]);
    setChatInput('');

    setTimeout(() => {
      setChatMessages(prev => [
        ...prev,
        { sender: 'bot', text: 'Mesajınız alındı! Canlı destek ekibimize iletildi veya dilerseniz hemen WhatsApp üzerinden devam edebilirsiniz.' }
      ]);
    }, 1000);
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

  const handleEditImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('Dosya boyutu 2 MB sınırını aşamaz!');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => setEditingListing(prev => ({ ...prev, image: reader.result }));
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
      image: form.image || 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&q=80&w=800',
      seoTags: sanitizeInput(form.seoTags || form.title.toLowerCase().split(' ').join(', ')),
      status: 'pending'
    };

    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/listings`, {
        method: 'POST',
        headers: { ...dbHeaders, 'Prefer': 'return=minimal' },
        body: JSON.stringify(newEntry)
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error('Supabase Ekleme Hatası:', errText);
        alert('İlan eklenirken sunucu reddetti. Lütfen anahtarlarınızı kontrol edin.');
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
      location: 'Balıkesir / Gönen',
      description: 'Tertemiz, bakımları tam tarla traktörü.',
      seller: 'Can İnce',
      phone: '0535 768 1550',
      image: 'https://images.unsplash.com/photo-1592841202223-ca33cfd81b6f?auto=format&fit=crop&q=80&w=800',
      seoTags: 'new holland, traktör, gönen tarım',
      status: 'approved'
    };

    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/listings`, {
        method: 'POST',
        headers: { ...dbHeaders, 'Prefer': 'return=minimal' },
        body: JSON.stringify(dynamicPool)
      });
      if (res.ok) {
        fetchListings();
        alert('🎉 Otomatik test ilanı başarıyla çekildi!');
      } else {
        const errText = await res.text();
        console.error('Supabase Hata:', errText);
        alert('Test ilanı eklenirken sunucu reddetti.');
      }
    } catch (e) {
      console.error(e);
      alert('Bağlantı hatası oluştu.');
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
          seoTags: sanitizeInput(editingListing.seoTags || ''),
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

  const handleAddNewMainCategory = (e) => {
    e.preventDefault();
    if (!isAdminLoggedIn) return;
    if (!customCategoryInput.trim()) return;
    const cat = customCategoryInput.trim();
    if (categoriesWithSubs[cat]) {
      alert('Bu kategori zaten mevcut!');
      return;
    }
    setCategoriesWithSubs({ ...categoriesWithSubs, [cat]: ['Genel'] });
    setCustomCategoryInput('');
    alert(`"${cat}" ana kategorisi başarıyla eklendi!`);
  };

  const handleDeleteMainCategory = (catKey) => {
    if (!isAdminLoggedIn) return;
    if (window.confirm(`"${catKey}" kategorisini ve altındaki tüm seçenekleri silmek istediğinize emin misiniz?`)) {
      const updated = { ...categoriesWithSubs };
      delete updated[catKey];
      setCategoriesWithSubs(updated);
      alert('Kategori silindi!');
    }
  };

  const handleAddSubCategory = (e) => {
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
    <div style={{ minHeight: '100vh', backgroundColor: '#f4f6f8', color: '#1e293b', fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column', width: '100%', maxWidth: '100vw', boxSizing: 'border-box', position: 'relative' }}>
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
          <button onClick={() => changeTab('favorites')} style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Heart size={14} fill={favorites.length > 0 ? '#ef4444' : 'none'} color={favorites.length > 0 ? '#ef4444' : '#fff'} /> ({favorites.length})
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

        {activeTab === 'favorites' && (
          <div>
            <div style={{ backgroundColor: '#1b3a2b', color: '#fff', borderRadius: '10px', padding: '10px 14px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button onClick={() => changeTab('home')} style={{ background: 'none', border: 'none', color: '#86efac', fontWeight: '700', cursor: 'pointer' }}><ArrowLeft size={16} /> Ana Sayfa</button>
              <span>Favori İlanlarım ({favorites.length})</span>
            </div>

            {favorites.length === 0 ? (
              <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '30px', textAlign: 'center', border: '1px solid #e2e8f0', color: '#64748b' }}>
                <Heart size={36} color="#cbd5e1" style={{ margin: '0 auto 10px auto' }} />
                <p style={{ fontWeight: '600', fontSize: '14px' }}>Henüz favorilere ilan eklemediniz.</p>
                <p style={{ fontSize: '12px', marginTop: '4px' }}>İlanlardaki kalp ikonuna tıklayarak favorilerinize ekleyebilirsiniz.</p>
              </div>
            ) : (
              favorites.map(item => (
                <div key={item.id} style={{ backgroundColor: '#fff', borderRadius: '10px', overflow: 'hidden', border: '1px solid #e2e8f0', display: 'flex', gap: '10px', padding: '10px', marginBottom: '10px', position: 'relative' }}>
                  <div onClick={() => { setSelectedListing(item); changeTab('detail'); }} style={{ display: 'flex', gap: '10px', flex: 1, cursor: 'pointer' }}>
                    <img src={item.image} alt={item.title} style={{ width: '90px', height: '90px', objectFit: 'cover', borderRadius: '8px' }} />
                    <div style={{ flex: 1 }}>
                      <h4 style={{ margin: '0 0 4px 0', fontSize: '13px', fontWeight: '700' }}>{item.title}</h4>
                      <div style={{ fontSize: '15px', fontWeight: '800', color: '#1b3a2b' }}>{Number(item.price).toLocaleString('tr-TR')} TL</div>
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>📍 {item.location}</div>
                    </div>
                  </div>
                  <button onClick={(e) => toggleFavorite(item, e)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', alignSelf: 'flex-start' }}>
                    <Heart size={20} fill="#ef4444" color="#ef4444" />
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'success-wa' && (
          <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '24px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
            <CheckCircle size={36} color="#166534" style={{ margin: '0 auto 12px auto' }} />
            <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#1b3a2b', margin: '0 0 8px 0' }}>İlanınız Başarıyla Alındı!</h2>
            <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '20px' }}>Yönetici onayından sonra tüm cihazlarda görünecektir.</p>
             
            {lastAddedListing && (
              <a 
                href={`https://api.whatsapp.com/send?phone=905357681550&text=${encodeURIComponent(`🔔 *Yeni İlan Onay Bekliyor!*\n\n*Başlık:* ${lastAddedListing.title}\n*Fiyat:* ${lastAddedListing.price} TL\n*Kategori:* ${lastAddedListing.category} / ${lastAddedListing.subCategory}\n*Satıcı:* ${lastAddedListing.seller} (${lastAddedListing.phone})`)}`}
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
            {/* REKLAM VER KUTUCUĞU */}
            <div style={{ backgroundColor: '#ecfdf5', border: '1.5px dashed #10b981', borderRadius: '12px', padding: '14px 16px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ backgroundColor: '#d1fae5', padding: '8px', borderRadius: '8px', color: '#059669', flexShrink: 0 }}>
                  <Sparkles size={20} />
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '800', color: '#065f46' }}>Tarım Ürününüzü veya İşletmenizi Tanıtın!</div>
                  <div style={{ fontSize: '11px', color: '#047857', marginTop: '2px' }}>Dilerseniz buraya özel reklam verebilir, binlerce çiftçiye ulaşabilirsiniz.</div>
                </div>
              </div>
              <a 
                href="https://api.whatsapp.com/send?phone=905357681550&text=Merhaba,%20PazarTarla%20ana%20sayfasında%20reklam%20vermek%20istiyorum.%20Bilgi%20alabilir%20miyim?" 
                target="_blank" 
                rel="noopener noreferrer"
                style={{ backgroundColor: '#059669', color: '#fff', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}
              >
                Reklam Ver
              </a>
            </div>

            {/* VİTRİN İLANLARI BÖLÜMÜ */}
            {featuredListings.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', fontWeight: '800', fontSize: '14px', color: '#854d0e' }}>
                  <Star size={16} fill="#eab308" color="#eab308" /> Vitrin İlanları
                </div>
                <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '4px' }}>
                  {featuredListings.map(item => {
                    const isFav = favorites.some(fav => fav.id === item.id);
                    return (
                      <div key={`feat-${item.id}`} onClick={() => { setSelectedListing(item); changeTab('detail'); }} style={{ minWidth: '160px', maxWidth: '160px', backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #fde047', cursor: 'pointer', overflow: 'hidden', flexShrink: '0', padding: '8px', position: 'relative' }}>
                        <button onClick={(e) => toggleFavorite(item, e)} style={{ position: 'absolute', top: '12px', right: '12px', background: 'rgba(255,255,255,0.8)', border: 'none', borderRadius: '50%', width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 2 }}>
                          <Heart size={14} fill={isFav ? '#ef4444' : 'none'} color={isFav ? '#ef4444' : '#64748b'} />
                        </button>
                        <img src={item.image} alt={item.title} style={{ width: '100%', height: '100px', objectFit: 'cover', borderRadius: '6px', marginBottom: '6px' }} />
                        <div style={{ fontSize: '12px', fontWeight: '700', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</div>
                        <div style={{ fontSize: '13px', fontWeight: '800', color: '#1b3a2b', marginTop: '2px' }}>{Number(item.price).toLocaleString('tr-TR')} TL</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

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

            {filteredListings.map(item => {
              const isFav = favorites.some(fav => fav.id === item.id);
              return (
                <div key={item.id} style={{ backgroundColor: '#fff', borderRadius: '10px', overflow: 'hidden', border: '1px solid #e2e8f0', display: 'flex', gap: '10px', padding: '10px', marginBottom: '10px', position: 'relative' }}>
                  <div onClick={() => { setSelectedListing(item); changeTab('detail'); }} style={{ display: 'flex', gap: '10px', flex: 1, cursor: 'pointer' }}>
                    <img src={item.image} alt={item.title} style={{ width: '90px', height: '90px', objectFit: 'cover', borderRadius: '8px' }} />
                    <div style={{ flex: 1 }}>
                      <h4 style={{ margin: '0 0 4px 0', fontSize: '13px', fontWeight: '700' }}>{item.title}</h4>
                      <div style={{ fontSize: '15px', fontWeight: '800', color: '#1b3a2b' }}>{Number(item.price).toLocaleString('tr-TR')} TL</div>
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>📍 {item.location}</div>
                    </div>
                  </div>
                  <button onClick={(e) => toggleFavorite(item, e)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', alignSelf: 'flex-start' }}>
                    <Heart size={20} fill={isFav ? '#ef4444' : 'none'} color={isFav ? '#ef4444' : '#64748b'} />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'detail' && selectedListing && (
          <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '16px', border: '1px solid #e2e8f0', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <button onClick={() => changeTab('results')} style={{ background: 'none', border: 'none', color: '#64748b', fontWeight: '600', cursor: 'pointer' }}>← Listeye Dön</button>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button onClick={(e) => toggleFavorite(selectedListing, e)} style={{ backgroundColor: '#f1f5f9', border: 'none', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: '700', color: '#475569' }}>
                  <Heart size={16} fill={favorites.some(fav => fav.id === selectedListing.id) ? '#ef4444' : 'none'} color={favorites.some(fav => fav.id === selectedListing.id) ? '#ef4444' : '#475569'} /> Favori
                </button>
                {isAdminLoggedIn && (
                  <button onClick={() => startEditingFromDetail(selectedListing)} style={{ backgroundColor: '#e0f2fe', color: '#0284c7', border: 'none', padding: '6px 12px', borderRadius: '6px', fontWeight: '700', fontSize: '12px', cursor: 'pointer' }}>
                    ✏️ Düzenle
                  </button>
                )}
              </div>
            </div>

            <img src={selectedListing.image} alt={selectedListing.title} style={{ width: '100%', height: '220px', objectFit: 'cover', borderRadius: '8px', marginBottom: '10px' }} />
            <h2 style={{ fontSize: '18px', fontWeight: '800', margin: '8px 0' }}>{selectedListing.title}</h2>
            <div style={{ fontSize: '22px', fontWeight: '800', color: '#1b3a2b', marginBottom: '4px' }}>{Number(selectedListing.price).toLocaleString('tr-TR')} TL</div>
            <p style={{ color: '#475569', fontSize: '13px', marginBottom: '12px', lineHeight: '1.5' }}>{selectedListing.description}</p>
            
            {/* SEO ETİKETLERİ BÖLÜMÜ */}
            {selectedListing.seoTags && (
              <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '10px 12px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: '700', color: '#166534', marginBottom: '6px' }}>
                  <Tag size={12} /> Arama & SEO Etiketleri
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {selectedListing.seoTags.split(',').map((tag, idx) => (
                    <span key={idx} style={{ backgroundColor: '#dcfce7', color: '#14532d', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600' }}>
                      #{tag.trim()}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* SOSYAL MEDYA PAYLAŞ BUTONLARI */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '8px' }}>📤 Bu İlanı Paylaş:</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <a 
                  href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`🌾 *PazarTarla İlanı*\n*${selectedListing.title}*\nFiyat: ${Number(selectedListing.price).toLocaleString('tr-TR')} TL\nKonum:${selectedListing.location}\nİncelemek için tıkla!`)}`}
                  target="_blank" 
                  rel="noopener noreferrer" 
                  style={{ flex: 1, backgroundColor: '#22c55e', color: '#fff', padding: '8px 10px', borderRadius: '6px', textAlign: 'center', fontWeight: '700', textDecoration: 'none', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                >
                  <MessageCircle size={14} /> WhatsApp
                </a>

                <a 
                  href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`}
                  target="_blank" 
                  rel="noopener noreferrer" 
                  style={{ flex: 1, backgroundColor: '#1877f2', color: '#fff', padding: '8px 10px', borderRadius: '6px', textAlign: 'center', fontWeight: '700', textDecoration: 'none', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                >
                  <Share2 size={14} /> Facebook
                </a>

                <button 
                  onClick={() => {
                    const shareText = `PazarTarla'da harika bir tarım ilanı: ${selectedListing.title} - ${Number(selectedListing.price).toLocaleString('tr-TR')} TL (${selectedListing.location})`;
                    navigator.clipboard.writeText(shareText);
                    alert('📋 İlan bilgileri panoya kopyalandı! Instagram hikayenizde veya mesajınızda doğrudan yapıştırıp paylaşabilirsiniz.');
                  }}
                  style={{ flex: 1, backgroundColor: '#e1306c', color: '#fff', border: 'none', padding: '8px 10px', borderRadius: '6px', textAlign: 'center', fontWeight: '700', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                >
                  <ImageIcon size={14} /> Instagram
                </button>
              </div>
            </div>

            <a href={`tel:${selectedListing.phone}`} style={{ width: '100%', backgroundColor: '#1b3a2b', color: '#fff', padding: '12px', borderRadius: '8px', textAlign: 'center', fontWeight: '700', textDecoration: 'none', display: 'block', boxSizing: 'border-box' }}>
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
              
              <input type="text" name="seoTags" placeholder="SEO Etiketleri (Virgülle ayırın: ceviz, gönen)" value={form.seoTags} onChange={handleFormChange} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />

              <div style={{ backgroundColor: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569' }}>📷 Fotoğraf Yükle (Dosya Seç veya URL Yapıştır)</label>
                <input type="file" accept="image/*" onChange={handleImageUpload} style={{ width: '100%', fontSize: '12px' }} />
                <input type="text" name="image" placeholder="Veya Görsel URL'si yapıştır (https://...)" value={form.image.startsWith('data:') ? '' : form.image} onChange={handleFormChange} style={{ width: '100%', padding: '8px', fontSize: '12px', borderRadius: '4px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
              </div>

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
                      <input type="text" name="seoTags" value={editingListing.seoTags || ''} onChange={handleEditFormChange} placeholder="SEO Etiketleri (Virgülle ayırın)" style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                      
                      <div style={{ backgroundColor: '#fff', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '11px', fontWeight: '700', color: '#475569' }}>📷 Fotoğrafı Değiştir (Dosya veya URL)</label>
                        <input type="file" accept="image/*" onChange={handleEditImageUpload} style={{ width: '100%', fontSize: '11px' }} />
                        <input type="text" name="image" placeholder="Veya Görsel URL'si yapıştır" value={editingListing.image.startsWith('data:') ? '' : editingListing.image} onChange={handleEditFormChange} style={{ width: '100%', padding: '6px', fontSize: '11px', borderRadius: '4px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
                      </div>

                      <textarea name="description" value={editingListing.description} onChange={handleEditFormChange} placeholder="Açıklama" style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', height: '60px' }} />
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button type="submit" style={{ flex: 1, backgroundColor: '#22c55e', color: '#fff', border: 'none', padding: '8px', borderRadius: '6px', fontWeight: '700', cursor: 'pointer' }}>Kaydet</button>
                        <button type="button" onClick={() => setEditingListing(null)} style={{ background: '#e2e8f0', border: 'none', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer' }}>İptal</button>
                      </div>
                    </form>
                  </div>
                )}

                {/* YENİ ANA KATEGORİ EKLEME & SİLME BÖLÜMÜ */}
                <div style={{ backgroundColor: '#f0fdf4', padding: '12px', borderRadius: '8px', border: '1px solid #bbf7d0', marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#166534', margin: '0 0 8px 0' }}>📁 Ana Kategori Ekle / Sil</h3>
                  <form onSubmit={handleAddNewMainCategory} style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px' }}>
                    <input type="text" placeholder="Yeni Ana Kategori Adı" value={customCategoryInput} onChange={(e) => setCustomCategoryInput(e.target.value)} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                    <button type="submit" style={{ backgroundColor: '#166534', color: '#fff', border: 'none', padding: '8px', borderRadius: '6px', fontWeight: '700', cursor: 'pointer' }}>Ana Kategori Ekle</button>
                  </form>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <select id="mainCatDelSelect" style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #ef4444', backgroundColor: '#fef2f2' }}>
                      {Object.keys(categoriesWithSubs).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                    <button type="button" onClick={() => {
                      const sel = document.getElementById('mainCatDelSelect').value;
                      handleDeleteMainCategory(sel);
                    }} style={{ backgroundColor: '#ef4444', color: '#fff', border: 'none', padding: '0 10px', borderRadius: '6px', fontWeight: '700', fontSize: '11px', cursor: 'pointer' }}>Ana Kategoriyi Sil</button>
                  </div>
                </div>

                <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#1b3a2b', margin: '0 0 8px 0' }}>Alt Seçenek Yönetimi</h3>
                  <form onSubmit={handleAddSubCategory} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
                    <button type="submit" style={{ backgroundColor: '#22c55e', color: '#fff', border: 'none', padding: '8px', borderRadius: '6px', fontWeight: '700', cursor: 'pointer' }}>Alt Seçenek Ekle</button>
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

      <footer style={{ backgroundColor: '#1b3a2b', color: '#94a3b8', padding: '20px 16px', textAlign: 'center', fontSize: '12px', marginTop: 'auto', borderTop: '1px solid #2d5a43' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ color: '#fff', fontWeight: '700', fontSize: '14px' }}>PazarTarla İletişim & Destek</div>
          <div>📞 WhatsApp / Tel: 0535 768 1550</div>
          <div>✉ E-posta: gezgiinci@gmail.com</div>
          <div>📍 Konum: Gönen / Balıkesir</div>
          <div style={{ color: '#86efac', marginTop: '4px' }}>© 2026 PazarTarla • Türkiye'nin İlk ve Tek Tarım Platformu</div>
        </div>
      </footer>

      {/* SAĞ ALT KÖŞE: YÖNETİM PANELİ BUTONU */}
      <button onClick={() => changeTab('admin-page')} title="Yönetim Paneli" style={{ position: 'fixed', bottom: '20px', right: '20px', backgroundColor: '#1b3a2b', color: '#86efac', border: '2px solid #22c55e', borderRadius: '50%', width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 999 }}>
        ⚙️
      </button>

      {/* SAĞ ALT KÖŞE: KULAKLIKLI CANLI DESTEK ASİSTANI */}
      <div style={{ position: 'fixed', bottom: '76px', right: '20px', zIndex: 1000 }}>
        {!isChatOpen ? (
          <div onClick={() => setIsChatOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#ffffff', padding: '6px 12px 6px 6px', borderRadius: '30px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', border: '2px solid #22c55e', cursor: 'pointer' }}>
            <div style={{ position: 'relative', width: '38px', height: '38px', borderRadius: '50%', overflow: 'hidden', border: '2px solid #22c55e', flexShrink: 0 }}>
              <img src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=200" alt="Canlı Destek" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <span style={{ position: 'absolute', bottom: '0', right: '0', width: '10px', height: '10px', backgroundColor: '#22c55e', borderRadius: '50%', border: '2px solid #fff' }}></span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '11px', fontWeight: '800', color: '#1b3a2b', lineHeight: '1.2' }}>Canlı Destek</span>
              <span style={{ fontSize: '9px', color: '#166534', fontWeight: '600' }}>Çevrim içi • Soru Sor</span>
            </div>
          </div>
        ) : (
          <div style={{ width: '300px', backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.2)', border: '1px solid #cbd5e1', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ backgroundColor: '#1b3a2b', color: '#ffffff', padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ position: 'relative', width: '30px', height: '30px', borderRadius: '50%', overflow: 'hidden', border: '1.5px solid #22c55e' }}>
                  <img src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=200" alt="Asistan" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '700' }}>PazarTarla Asistan</div>
                  <div style={{ fontSize: '9px', color: '#86efac' }}>Canlı Destek Ekibi</div>
                </div>
              </div>
              <button onClick={() => setIsChatOpen(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: '4px' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '10px', height: '200px', overflowY: 'auto', backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {chatMessages.map((msg, index) => (
                <div key={index} style={{ alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start', maxWidth: '80%', backgroundColor: msg.sender === 'user' ? '#22c55e' : '#e2e8f0', color: msg.sender === 'user' ? '#fff' : '#1e293b', padding: '8px 10px', borderRadius: '8px', fontSize: '12px', lineHeight: '1.4' }}>
                  {msg.text}
                </div>
              ))}
            </div>

            <a href="https://api.whatsapp.com/send?phone=905357681550&text=Merhaba,%20PazarTarla%20üzerinden%20bilgi%20almak%20istiyorum." target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', backgroundColor: '#22c55e', color: '#fff', padding: '8px', textDecoration: 'none', fontSize: '12px', fontWeight: '700' }}>
              <MessageCircle size={14} /> WhatsApp ile Canlı Bağlan
            </a>

            <form onSubmit={handleSendMessage} style={{ display: 'flex', padding: '6px', borderTop: '1px solid #cbd5e1', backgroundColor: '#fff' }}>
              <input type="text" placeholder="Mesajınızı yazın..." value={chatInput} onChange={(e) => setChatInput(e.target.value)} style={{ flex: 1, padding: '6px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '11px', outline: 'none' }} />
              <button type="submit" style={{ backgroundColor: '#1b3a2b', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: '4px', marginLeft: '4px', cursor: 'pointer', fontSize: '11px' }}>
                <Send size={12} />
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { 
  Search, SlidersHorizontal, MapPin, Phone, MessageCircle, Plus, 
  Heart, Share2, ShieldCheck, CheckCircle2, ChevronRight, ChevronDown, X, 
  Car, Tractor, Wrench, ArrowRight, Bell, User, Filter, AlertCircle, Trash2, Settings, Lock, Check, Mail, Globe, Copy, HelpCircle, Users, Image as ImageIcon, Bug, Shield, Package, ArrowLeft, Menu, ArrowUpDown, LayoutList, Star, Send, ShieldAlert, FolderPlus, Tag 
} from 'lucide-react';

const FALLBACK_LISTINGS = [
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
    seoTags: 'taze ceviz, chandler ceviz, gönen ceviz, tarım ilanı, mahsul'
  },
  // 🚜 İkinci El Traktör Kategorisi İçin 10 Özenle Hazırlanmış İlan
  {
    id: 101,
    title: 'Massey Ferguson 285 S Kaporta Boya Orijinal',
    price: 485000,
    category: 'Traktör',
    subCategory: 'İkinci El Traktör',
    mode: 'Satılık',
    location: 'Gönen / Balıkesir',
    amount: '85 HP',
    description: 'Motoru ve yürüyeni sorunsuz, traktörümüz çiftlik işlerinde kullanılmıştır. Lastikleri %80 durumdadır.',
    seller: 'Ahmet Yılmaz',
    phone: '0532 555 4433',
    image: 'https://images.unsplash.com/photo-1592841202223-ca33cfd81b6f?auto=format&fit=crop&q=80&w=800',
    seoTags: 'massey ferguson 285, ikinci el traktör, gönen traktör, tarım makinaları'
  },
  {
    id: 102,
    title: 'New Holland TD 65D 4x4 Kabinli Klima',
    price: 720000,
    category: 'Traktör',
    subCategory: 'İkinci El Traktör',
    mode: 'Satılık',
    location: 'Bandırma / Balıkesir',
    amount: '65 HP',
    description: 'İlk sahibinden kapalı garaj traktörüdür. Kliması aktif çalışmaktadır, bakımları yetkili serviste yapılmıştır.',
    seller: 'Hüseyin Demir',
    phone: '0533 444 2211',
    image: 'https://images.unsplash.com/photo-1533555776392-4a18d8d44476?auto=format&fit=crop&q=80&w=800',
    seoTags: 'new holland td65d, 4x4 traktör, bandırma traktör, kabinli traktör'
  },
  {
    id: 103,
    title: 'Tümosan 8065 4WD Turbo Intercooler',
    price: 610000,
    category: 'Traktör',
    subCategory: 'İkinci El Traktör',
    mode: 'Satılık',
    location: 'Mustafakemalpaşa / Bursa',
    amount: '75 HP',
    description: 'Ağır iş görmemiş, bahçe ve tarlada temiz kullanılmış güçlü traktör. Fiyatı muadillerine göre uygundur.',
    seller: 'Mustafa Çelik',
    phone: '0542 333 1188',
    image: 'https://images.unsplash.com/photo-1615840287214-7ff58936c4cf?auto=format&fit=crop&q=80&w=800',
    seoTags: 'tümosan 8065, turbo traktör, bursa traktör, satılık ikinci el'
  },
  {
    id: 104,
    title: 'John Deere 5075E 3lü Damper Çıkışlı',
    price: 890000,
    category: 'Traktör',
    subCategory: 'İkinci El Traktör',
    mode: 'Satılık',
    location: 'İnegöl / Bursa',
    amount: '75 HP',
    description: 'Model yükselteceğim için satılıktır. Hiçbir masrafı yoktur, lastikler sıfır ayarındadır.',
    seller: 'İsmail Koç',
    phone: '0530 111 2299',
    image: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&q=80&w=800',
    seoTags: 'john deere 5075e, lüks traktör, inegöl tarım, ikinci el traktör'
  },
  {
    id: 105,
    title: 'Fiat 480 S Kurbağa Göz',
    price: 295000,
    category: 'Traktör',
    subCategory: 'İkinci El Traktör',
    mode: 'Satılık',
    location: 'Susurluk / Balıkesir',
    amount: '48 HP',
    description: 'Efsana kasa Fiat 480. Motor şanzıman kusursuzdur, vites atma ötme kesinlikle yoktur.',
    seller: 'Şakir Korkmaz',
    phone: '0536 777 8844',
    image: 'https://images.unsplash.com/photo-1589923188900-85dae523342b?auto=format&fit=crop&q=80&w=800',
    seoTags: 'fiat 480, kurbağa göz fiat, susurluk tarım, klasik traktör'
  },
  {
    id: 106,
    title: 'Case IH JX 75 C Başakşehir Üretimi',
    price: 840000,
    category: 'Traktör',
    subCategory: 'İkinci El Traktör',
    mode: 'Satılık',
    location: 'Karacabey / Bursa',
    amount: '75 HP',
    description: 'Kabinli, klimalı ve inverter shutle viteslidir. Bahçe işleri için ideal, temiz kullanılmıştır.',
    seller: 'Mehmet Aksoy',
    phone: '0537 222 3355',
    image: 'https://images.unsplash.com/photo-1563514227147-6d2ff665a6a0?auto=format&fit=crop&q=80&w=800',
    seoTags: 'case ih jx75, kabinli traktör, karacabey traktör, satılık case'
  },
  {
    id: 107,
    title: 'Erkunt Haşmet 110 Luxury CRD',
    price: 1150000,
    category: 'Traktör',
    subCategory: 'İkinci El Traktör',
    mode: 'Satılık',
    location: 'Çanakkale Merkez',
    amount: '110 HP',
    description: 'Güçlü motoru ve konforlu kabini ile büyük araziler için birebir. Full servis bakımlıdır.',
    seller: 'Ramazan Güneş',
    phone: '0544 888 9900',
    image: 'https://images.unsplash.com/photo-1592841202223-ca33cfd81b6f?auto=format&fit=crop&q=80&w=800',
    seoTags: 'erkunt haşmet 110, güçlü traktör, çanakkale tarım, lüks traktör'
  },
  {
    id: 108,
    title: 'Başak 2073 4x2 Bahçe Traktörü',
    price: 450000,
    category: 'Traktör',
    subCategory: 'İkinci El Traktör',
    mode: 'Satılık',
    location: 'Edremit / Balıkesir',
    amount: '65 HP',
    description: 'Zeytinlik ve meyve bahçeleri için özel tasarım dar şasi. Hidrolik kolları çok güçlüdür.',
    seller: 'Hasan Bilgin',
    phone: '0538 999 0011',
    image: 'https://images.unsplash.com/photo-1533555776392-4a18d8d44476?auto=format&fit=crop&q=80&w=800',
    seoTags: 'başak traktör, bahçe traktörü, edremit zeytin, ikinci el tarım'
  },
  {
    id: 109,
    title: 'Hema 265 S Çift Çeker',
    price: 520000,
    category: 'Traktör',
    subCategory: 'İkinci El Traktör',
    mode: 'Satılık',
    location: 'Biga / Çanakkale',
    amount: '65 HP',
    description: 'Muayenesi yeni yapılmıştır. Hidrolik sistem ve kuyruk mili sorunsuz çalışmaktadır.',
    seller: 'Ali İhsan Yıldız',
    phone: '0539 123 4567',
    image: 'https://images.unsplash.com/photo-1615840287214-7ff58936c4cf?auto=format&fit=crop&q=80&w=800',
    seoTags: 'hema 265, çift çeker traktör, biga tarım, ikinci el'
  },
  {
    id: 110,
    title: 'Landini Powerfarm 90',
    price: 790000,
    category: 'Traktör',
    subCategory: 'İkinci El Traktör',
    mode: 'Satılık',
    location: 'Gönen / Balıkesir',
    amount: '88 HP',
    description: 'İtalyan mühendisliği, ağır toprak işleme ve mibzer çekme işlerinde üstün performans.',
    seller: 'Necati Acar',
    phone: '0531 654 9870',
    image: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&q=80&w=800',
    seoTags: 'landini powerfarm 90, italyan traktör, gönen ikinci el traktör'
  }
];

const FALLBACK_CATEGORIES = {
  'Mahsuller': ['Kiraz', 'Ceviz', 'Zeytin & Zeytinyağı'],
  'Canlı Hayvanlar': ['Büyükbaş', 'Küçükbaş', 'Kanatlı'],
  'Hayvan Yemleri ve Ekipmanları': ['Yem Çeşitleri', 'Suluk / Yemlik'],
  'Arıcılık': ['Bal', 'Polen', 'Arı Ekmeği', 'Arı Sütü', 'Kovan ve Ekipmanları'],
  'Traktör': ['İkinci El Traktör'],
  'Biçerdöver': ['Biçerdöver'],
  'Tarım Ekipmanları': ['Römork'],
  'Tarım İşçileri': ['Hasat Ekibi'],
  'Uzmanlar': ['Veterinerler', 'Ziraatçiler']
};

export default function App() {
  const [activeTab, setActiveTab] = useState('home'); 
  
  const [listings, setListings] = useState(() => {
    const saved = localStorage.getItem('pazartarla_listings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        console.error(e);
      }
    }
    return FALLBACK_LISTINGS;
  });

  const [categoriesWithSubs, setCategoriesWithSubs] = useState(() => {
    const saved = localStorage.getItem('pazartarla_categories');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') return parsed;
      } catch (e) {
        console.error(e);
      }
    }
    return FALLBACK_CATEGORIES;
  });

  const [favorites, setFavorites] = useState(() => {
    const savedFavs = localStorage.getItem('pazartarla_favorites');
    if (savedFavs) {
      try {
        const parsed = JSON.parse(savedFavs);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        console.error(e);
      }
    }
    return [];
  });

  const [selectedListing, setSelectedListing] = useState(null);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Tüm kategoriler');
  const [selectedSubCategory, setSelectedSubCategory] = useState('Tümü');
  const [openCategory, setOpenCategory] = useState('');
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewMode, setViewMode] = useState('Liste');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newSubCategoryName, setNewSubCategoryName] = useState('');

  const [analytics, setAnalytics] = useState({
    totalVisits: 1,
    mobileVisits: 0,
    desktopVisits: 0,
    activeSessions: 1,
    recentActions: []
  });

  const [form, setForm] = useState({
    title: '',
    price: '',
    category: 'Mahsuller',
    subCategory: 'Kiraz',
    mode: 'Satılık',
    location: 'Gönen / Balıkesir',
    city: 'Balıkesir',
    amount: '',
    description: '',
    seller: 'Can İnce',
    phone: '0535 768 1550',
    image: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&q=80&w=800',
    seoTags: ''
  });

  useEffect(() => {
    const isMobile = /Mobi|Android/i.test(navigator.userAgent);
    const savedData = localStorage.getItem('pazartarla_live_analytics');
     
    let currentStats = savedData ? JSON.parse(savedData) : {
      totalVisits: 120,
      mobileVisits: 75,
      desktopVisits: 45,
      activeSessions: 1,
      recentActions: []
    };

    currentStats.totalVisits += 1;
    if (isMobile) {
      currentStats.mobileVisits += 1;
    } else {
      currentStats.desktopVisits += 1;
    }

    const newAction = `Ziyaretçi bağlandı (${isMobile ? 'Mobil Cihaz' : 'Bilgisayar'}) - ${new Date().toLocaleTimeString('tr-TR')}`;
    currentStats.recentActions = [newAction, ...(currentStats.recentActions || [])].slice(0, 10);

    setAnalytics(currentStats);
    localStorage.setItem('pazartarla_live_analytics', JSON.stringify(currentStats));

    window.history.replaceState({ tab: 'home' }, '');

    const handlePopState = (event) => {
      if (event.state && event.state.tab) {
        setActiveTab(event.state.tab);
        if (event.state.tab === 'home') {
          setSelectedCategory('Tüm kategoriler');
          setSelectedSubCategory('Tümü');
        }
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

  const saveListings = (newListings) => {
    setListings(newListings);
    localStorage.setItem('pazartarla_listings', JSON.stringify(newListings));
  };

  const saveCategories = (newCats) => {
    setCategoriesWithSubs(newCats);
    localStorage.setItem('pazartarla_categories', JSON.stringify(newCats));
  };

  const toggleFavorite = (e, item) => {
    e.stopPropagation();
    let updatedFavs;
    if (favorites.some(fav => fav.id === item.id)) {
      updatedFavs = favorites.filter(fav => fav.id !== item.id);
    } else {
      updatedFavs = [...favorites, item];
    }
    setFavorites(updatedFavs);
    localStorage.setItem('pazartarla_favorites', JSON.stringify(updatedFavs));
  };

  const generateAutoSEO = (title, category, subCategory, location) => {
    const cleanTitle = title.trim() ? title.trim() : 'Tarım İlanı';
    const cleanLoc = location.trim() ? location.trim() : 'Türkiye';
    return `${cleanTitle}, ${category || 'Tarım'}, ${subCategory || 'Ürün'}, ${cleanLoc} ilanları, sahibinden ${cleanTitle.toLowerCase()}, pazar tarla`;
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => {
      const updated = { ...prev, [name]: value };
      if (name === 'category') {
        updated.subCategory = categoriesWithSubs[value]?.[0] || 'Tümü';
      }
      
      updated.seoTags = generateAutoSEO(
        name === 'title' ? value : updated.title,
        name === 'category' ? value : updated.category,
        name === 'subCategory' ? value : updated.subCategory,
        name === 'location' ? value : updated.location
      );

      return updated;
    });
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setForm(prev => ({ ...prev, image: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDirectAdd = (e) => {
    e.preventDefault();
    
    if (!form.title.trim() || !form.price || !form.phone.trim() || !form.seller.trim()) {
      alert('Lütfen başlık, fiyat, satıcı adı ve telefon numarası alanlarını eksiksiz doldurun.');
      return;
    }

    const finalSeoTags = form.seoTags || generateAutoSEO(form.title, form.category, form.subCategory, form.location);

    const newEntry = {
      ...form,
      id: Date.now(),
      price: Number(form.price),
      amount: form.category === 'Uzmanlar' ? '' : form.amount,
      verified: true,
      featured: false,
      date: 'Bugün',
      seoTags: finalSeoTags
    };

    const updated = [newEntry, ...listings];
    saveListings(updated);
    
    setForm({
      title: '',
      price: '',
      category: 'Mahsuller',
      subCategory: categoriesWithSubs['Mahsuller']?.[0] || 'Tümü',
      mode: 'Satılık',
      location: 'Gönen / Balıkesir',
      city: 'Balıkesir',
      amount: '',
      description: '',
      seller: 'Can İnce',
      phone: '0535 768 1550',
      image: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&q=80&w=800',
      seoTags: ''
    });

    changeTab('home');
    alert('İlanınız başarıyla yayınlandı!');
  };

  const handleDeleteListing = (id) => {
    if (window.confirm('Bu ilanı yayından kaldırmak/silmek istediğinize emin misiniz?')) {
      const updated = listings.filter(item => item.id !== id);
      saveListings(updated);
      const updatedFavs = favorites.filter(item => item.id !== id);
      setFavorites(updatedFavs);
      localStorage.setItem('pazartarla_favorites', JSON.stringify(updatedFavs));
    }
  };

  const handleAddCategory = (e) => {
    e.preventDefault();
    if (!newCategoryName.trim()) {
      alert('Lütfen bir kategori adı girin.');
      return;
    }
    const catName = newCategoryName.trim();
    if (categoriesWithSubs[catName]) {
      alert('Bu kategori zaten mevcut!');
      return;
    }
    const subs = newSubCategoryName.trim() 
      ? newSubCategoryName.split(',').map(s => s.trim()).filter(Boolean) 
      : ['Genel'];
     
    const updatedCats = { ...categoriesWithSubs, [catName]: subs };
    saveCategories(updatedCats);
    setNewCategoryName('');
    setNewSubCategoryName('');
    alert(`"${catName}" kategorisi ve alt dalları başarıyla eklendi!`);
  };

  const handleDeleteCategory = (catKey) => {
    if (window.confirm(`"${catKey}" kategorisini ve alt dallarını silmek istediğinize emin misiniz?`)) {
      const updatedCats = { ...categoriesWithSubs };
      delete updatedCats[catKey];
      saveCategories(updatedCats);
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

  const shareOnWhatsApp = (item) => {
    const text = encodeURIComponent(`🌾 PazarTarla İlanı:\n*${item.title}*\nFiyat: ${item.price.toLocaleString('tr-TR')} TL\nKonum: ${item.location}\nİletişim: ${item.phone}`);
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  const shareOnTwitter = (item) => {
    const text = encodeURIComponent(`PazarTarla'da tarım ilanı: ${item.title} - ${item.price.toLocaleString('tr-TR')} TL (${item.location})`);
    window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank');
  };

  const shareOnFacebook = () => {
    const pageUrl = window.location.href;
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pageUrl)}`, '_blank');
  };

  const copyListingLink = (item) => {
    const shareText = `PazarTarla İlanı: ${item.title} - Fiyat: ${item.price.toLocaleString('tr-TR')} TL - Tel: ${item.phone}`;
    navigator.clipboard.writeText(shareText);
    alert('İlan bilgileri panoya kopyalandı! İstediğiniz yere yapıştırabilirsiniz.');
  };

  const filteredListings = listings.filter(item => {
    const matchesCategory = selectedCategory === 'Tüm kategoriler' || item.category === selectedCategory;
    const matchesSubCategory = selectedSubCategory === 'Tümü' || item.subCategory === selectedSubCategory;
    return matchesCategory && matchesSubCategory;
  });

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f4f6f8', color: '#1e293b', fontFamily: 'system-ui, -apple-system, sans-serif', display: 'flex', flexDirection: 'column', width: '100%', maxWidth: '100vw', overflowX: 'hidden', boxSizing: 'border-box', position: 'relative' }}>
       
      <header style={{ backgroundColor: '#1b3a2b', color: '#ffffff', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', position: 'sticky', top: 0, zIndex: 100, width: '100%', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }} onClick={() => { changeTab('home'); setSelectedCategory('Tüm kategoriler'); setSelectedSubCategory('Tümü'); }}>
          <div style={{ backgroundColor: '#22c55e', padding: '6px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Tractor size={20} color="#fff" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '18px', fontWeight: '800', letterSpacing: '-0.5px' }}>PazarTarla</h1>
            <span style={{ fontSize: '10px', color: '#86efac', display: 'block' }}>Tarım Pazaryeri</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button 
            onClick={() => changeTab('favorites')}
            style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <Heart size={15} color="#ef4444" fill={favorites.length > 0 ? "#ef4444" : "none"} /> 
            <span>({favorites.length})</span>
          </button>

          <button 
            onClick={() => changeTab('add')}
            style={{ backgroundColor: '#22c55e', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: '700', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px', boxShadow: '0 2px 8px rgba(34, 197, 94, 0.3)' }}
          >
            <Plus size={16} /> İlan Ver
          </button>
        </div>
      </header>

      <main style={{ width: '100%', maxWidth: '600px', margin: '0 auto', padding: '12px', flex: 1, boxSizing: 'border-box' }}>
         
        {activeTab === 'home' && (
          <div style={{ backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden', border: '1px solid #e2e8f0', width: '100%', boxSizing: 'border-box' }}>
            <div style={{ backgroundColor: '#1b3a2b', color: '#fff', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Menu size={20} />
              <span style={{ fontSize: '16px', fontWeight: '700' }}>Kategori Seçimi</span>
            </div>

            <div 
              onClick={() => { setSelectedCategory('Tüm kategoriler'); setSelectedSubCategory('Tümü'); changeTab('results'); }}
              style={{ padding: '14px 16px', borderBottom: '1px solid #edf2f7', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', backgroundColor: '#f8fafc' }}
            >
              <span style={{ fontWeight: '700', color: '#1b3a2b', fontSize: '15px' }}>Tüm Tarım İlanları</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#22c55e', fontWeight: '700', fontSize: '14px' }}>
                <span>({listings.length})</span>
                <ChevronRight size={18} />
              </div>
            </div>

            {Object.keys(categoriesWithSubs).map(cat => {
              const isOpen = openCategory === cat;
              return (
                <div key={cat}>
                  <div 
                    onClick={() => setOpenCategory(isOpen ? '' : cat)}
                    style={{ padding: '14px 16px', borderBottom: '1px solid #edf2f7', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', backgroundColor: isOpen ? '#f0fdf4' : '#fff' }}
                  >
                    <span style={{ fontWeight: '600', color: isOpen ? '#1b3a2b' : '#334155', fontSize: '14px' }}>{cat}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94a3b8', fontSize: '13px' }}>
                      <span>({listings.filter(i => i.category === cat).length})</span>
                      {isOpen ? <ChevronDown size={16} color="#22c55e" /> : <ChevronRight size={16} />}
                    </div>
                  </div>

                  {isOpen && (
                    <div style={{ backgroundColor: '#fafafa', borderBottom: '1px solid #edf2f7' }}>
                      <div 
                        onClick={() => { setSelectedCategory(cat); setSelectedSubCategory('Tümü'); changeTab('results'); }}
                        style={{ padding: '10px 16px 10px 28px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', backgroundColor: '#f0fdf4' }}
                      >
                        <span style={{ fontSize: '13px', color: '#166534', fontWeight: '600' }}>→ Tüm {cat} İlanları</span>
                        <ChevronRight size={14} color="#166534" />
                      </div>

                      {(categoriesWithSubs[cat] || []).map(sub => (
                        <div 
                          key={sub}
                          onClick={(e) => { e.stopPropagation(); setSelectedCategory(cat); setSelectedSubCategory(sub); changeTab('results'); }}
                          style={{ padding: '10px 16px 10px 28px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                        >
                          <span style={{ fontSize: '13px', color: '#64748b' }}>• {sub}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#94a3b8', fontSize: '12px' }}>
                            <span>({listings.filter(i => i.category === cat && i.subCategory === sub).length})</span>
                            <ChevronRight size={14} color="#cbd5e1" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'favorites' && (
          <div style={{ width: '100%', boxSizing: 'border-box' }}>
            <div style={{ backgroundColor: '#1b3a2b', color: '#fff', borderRadius: '10px', padding: '10px 14px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.1)' }}>
              <button 
                onClick={() => changeTab('home')} 
                style={{ background: 'none', border: 'none', color: '#86efac', fontWeight: '700', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <ArrowLeft size={16} /> Ana Sayfa
              </button>
              <span style={{ fontSize: '14px', fontWeight: '700' }}>Favori İlanlarım</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
              {favorites.length === 0 ? (
                <div style={{ backgroundColor: '#fff', padding: '40px 20px', borderRadius: '10px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                  <Heart size={32} color="#cbd5e1" style={{ margin: '0 auto 10px auto', display: 'block' }} />
                  Henüz favorilere eklediğiniz bir ilan bulunmuyor.
                </div>
              ) : (
                favorites.map(item => (
                  <div 
                    key={item.id} 
                    onClick={() => { setSelectedListing(item); changeTab('detail'); }}
                    style={{ backgroundColor: '#fff', borderRadius: '10px', overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', cursor: 'pointer', display: 'flex', gap: '10px', padding: '10px', boxSizing: 'border-box', width: '100%', position: 'relative' }}
                  >
                    <div style={{ position: 'relative', width: '90px', height: '90px', backgroundColor: '#f1f5f9', borderRadius: '8px', overflow: 'hidden', flexShrink: 0 }}>
                      <img src={item.image} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flex: 1, minWidth: 0 }}>
                      <div>
                        <span style={{ fontSize: '10px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.category}</span>
                        <h4 style={{ margin: '2px 0 4px 0', fontSize: '13px', fontWeight: '700', color: '#0f172a', lineHeight: '1.2' }}>{item.title}</h4>
                        {item.amount && (
                          <div style={{ fontSize: '11px', color: '#059669', fontWeight: '600' }}>
                            {item.amount}
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '4px' }}>
                        <div style={{ fontSize: '15px', fontWeight: '800', color: '#1b3a2b' }}>
                          {item.price.toLocaleString('tr-TR')} TL
                        </div>
                        <button 
                          onClick={(e) => toggleFavorite(e, item)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
                        >
                          <Heart size={18} color="#ef4444" fill="#ef4444" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'results' && (
          <div style={{ width: '100%', boxSizing: 'border-box' }}>
            <div style={{ backgroundColor: '#1b3a2b', color: '#fff', borderRadius: '10px', padding: '10px 14px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.1)' }}>
              <button 
                onClick={() => changeTab('home')} 
                style={{ background: 'none', border: 'none', color: '#86efac', fontWeight: '700', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <ArrowLeft size={16} /> Kategoriler
              </button>
               
              <div style={{ display: 'flex', gap: '12px', fontSize: '12px', fontWeight: '600' }}>
                <span onClick={() => alert('Filtreleme aktif')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}>
                  <Filter size={13} /> Filtrele
                </span>
                <span onClick={() => alert('Sıralama aktif')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}>
                  <ArrowUpDown size={13} /> Sırala
                </span>
                <span onClick={() => setShowViewModal(true)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px', color: '#86efac' }}>
                  <LayoutList size={13} /> Görünüm
                </span>
              </div>
            </div>

            <div style={{ backgroundColor: '#fff', padding: '8px 12px', borderRadius: '8px', marginBottom: '10px', fontSize: '12px', color: '#64748b', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #e2e8f0' }}>
              <span>{selectedSubCategory !== 'Tümü' ? selectedSubCategory : selectedCategory}</span>
              <span style={{ fontWeight: '700', color: '#1b3a2b' }}>{filteredListings.length} sonuç</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
              {filteredListings.length === 0 ? (
                <div style={{ backgroundColor: '#fff', padding: '30px', borderRadius: '10px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                  Bu kategoride henüz ilan bulunmuyor.
                </div>
              ) : (
                filteredListings.map(item => {
                  const isFav = favorites.some(fav => fav.id === item.id);
                  return (
                    <div 
                      key={item.id} 
                      onClick={() => { setSelectedListing(item); changeTab('detail'); }}
                      style={{ backgroundColor: '#fff', borderRadius: '10px', overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', cursor: 'pointer', display: 'flex', gap: '10px', padding: '10px', boxSizing: 'border-box', width: '100%', position: 'relative' }}
                    >
                      <div style={{ position: 'relative', width: viewMode === 'Detaylı Liste' ? '110px' : '90px', height: viewMode === 'Detaylı Liste' ? '110px' : '90px', backgroundColor: '#f1f5f9', borderRadius: '8px', overflow: 'hidden', flexShrink: 0 }}>
                        <img src={item.image} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <span style={{ position: 'absolute', top: '4px', left: '4px', backgroundColor: item.mode === 'Satılık' ? '#22c55e' : '#3b82f6', color: '#fff', padding: '2px 5px', borderRadius: '4px', fontSize: '9px', fontWeight: '700' }}>
                          {item.mode}
                        </span>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flex: 1, minWidth: 0 }}>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <span style={{ fontSize: '10px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.category} {item.subCategory ? `> ${item.subCategory}` : ''}</span>
                            
                            <button 
                              onClick={(e) => toggleFavorite(e, item)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px' }}
                            >
                              <Heart size={18} color="#ef4444" fill={isFav ? "#ef4444" : "none"} />
                            </button>
                          </div>

                          <h4 style={{ margin: '2px 0 4px 0', fontSize: '13px', fontWeight: '700', color: '#0f172a', lineHeight: '1.2' }}>{item.title}</h4>
                          {item.amount && (
                            <div style={{ fontSize: '11px', color: '#059669', fontWeight: '600' }}>
                              {item.amount}
                            </div>
                          )}
                          {viewMode === 'Detaylı Liste' && (
                            <p style={{ fontSize: '11px', color: '#64748b', margin: '4px 0 0 0', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                              {item.description}
                            </p>
                          )}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '4px' }}>
                          <div style={{ fontSize: '15px', fontWeight: '800', color: '#1b3a2b' }}>
                            {item.price.toLocaleString('tr-TR')} TL
                          </div>
                          <div style={{ fontSize: '10px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '2px' }}>
                            <MapPin size={10} /> {item.location}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {showViewModal && (
              <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1000 }}>
                <div style={{ backgroundColor: '#fff', width: '100%', maxWidth: '600px', borderTopLeftRadius: '16px', borderTopRightRadius: '16px', padding: '20px', boxSizing: 'border-box' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', margin: '0 0 16px 0', textAlign: 'center' }}>Görünüm Tercihi</h3>
                   
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                    {['Liste', 'Detaylı Liste'].map(mode => (
                      <label key={mode} onClick={() => setViewMode(mode)} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', fontWeight: '600', color: '#334155', cursor: 'pointer', padding: '8px 0' }}>
                        <input type="radio" name="view" checked={viewMode === mode} readOnly style={{ accentColor: '#1b3a2b', width: '16px', height: '16px' }} />
                        {mode}
                      </label>
                    ))}
                  </div>

                  <button 
                    onClick={() => setShowViewModal(false)}
                    style={{ width: '100%', backgroundColor: '#1b3a2b', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: '700', fontSize: '14px', cursor: 'pointer' }}
                  >
                    Vazgeç / Kapat
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'detail' && selectedListing && (
          <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0', boxSizing: 'border-box', width: '100%' }}>
            <div style={{ marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button onClick={() => changeTab('results')} style={{ background: 'none', border: 'none', color: '#64748b', fontWeight: '600', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <ArrowLeft size={16} /> Listeye Dön
              </button>

              <button 
                onClick={(e) => toggleFavorite(e, selectedListing)}
                style={{ backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '600' }}
              >
                <Heart size={16} color="#ef4444" fill={favorites.some(fav => fav.id === selectedListing.id) ? "#ef4444" : "none"} />
                <span>{favorites.some(fav => fav.id === selectedListing.id) ? 'Favorilerde' : 'Favorilere Ekle'}</span>
              </button>
            </div>

            <div style={{ marginBottom: '14px', backgroundColor: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <span style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '8px' }}>Bu İlanı Sosyal Medyada Paylaş:</span>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button 
                  onClick={() => shareOnWhatsApp(selectedListing)} 
                  style={{ backgroundColor: '#25D366', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  <Send size={13} /> WhatsApp
                </button>
                <button 
                  onClick={() => shareOnTwitter(selectedListing)} 
                  style={{ backgroundColor: '#0f172a', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  X
                </button>
                <button 
                  onClick={shareOnFacebook} 
                  style={{ backgroundColor: '#1877F2', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  Facebook
                </button>
                <button 
                  onClick={() => copyListingLink(selectedListing)} 
                  style={{ backgroundColor: '#64748b', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  <Copy size={13} /> Kopyala
                </button>
              </div>
            </div>

            <div style={{ height: '220px', borderRadius: '8px', overflow: 'hidden', marginBottom: '14px', backgroundColor: '#f1f5f9' }}>
              <img src={selectedListing.image} alt={selectedListing.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', margin: '8px 0' }}>{selectedListing.title}</h2>
            {selectedListing.amount && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', backgroundColor: '#ecfdf5', color: '#059669', padding: '4px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: '700', marginBottom: '12px', border: '1px solid #a7f3d0' }}>
                <Package size={14} /> Miktar / Bilgi: {selectedListing.amount}
              </div>
            )}
            <div style={{ fontSize: '22px', fontWeight: '800', color: '#1b3a2b', marginBottom: '14px' }}>{selectedListing.price.toLocaleString('tr-TR')} TL</div>
            <p style={{ color: '#475569', lineHeight: '1.4', marginBottom: '16px', fontSize: '13px' }}>{selectedListing.description}</p>
            
            {selectedListing.seoTags && (
              <div style={{ backgroundColor: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px dashed #cbd5e1', marginBottom: '16px', fontSize: '11px', color: '#64748b' }}>
                <strong style={{ color: '#1b3a2b', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                  <Tag size={12} color="#166534" /> Otomatik SEO Anahtar Kelimeleri:
                </strong>
                {selectedListing.seoTags}
              </div>
            )}
             
            <div style={{ borderTop: '1px solid #edf2f7', paddingTop: '16px' }}>
              <a href={`tel:${selectedListing.phone}`} style={{ width: '100%', backgroundColor: '#1b3a2b', color: '#fff', padding: '12px', borderRadius: '8px', textAlign: 'center', fontWeight: '700', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '14px', boxSizing: 'border-box' }}>
                <Phone size={18} /> {selectedListing.phone} ({selectedListing.seller})
              </a>
            </div>
          </div>
        )}

        {activeTab === 'add' && (
          <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0', boxSizing: 'border-box', width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <button onClick={() => changeTab('home')} style={{ background: 'none', border: 'none', color: '#64748b', fontWeight: '600', cursor: 'pointer', fontSize: '13px' }}>← Vazgeç</button>
              <h2 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', margin: 0 }}>Yeni İlan Ver</h2>
            </div>
            <form onSubmit={handleDirectAdd} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '4px', fontSize: '12px' }}>İlan Başlığı *</label>
                <input type="text" name="title" placeholder="Örn: Kiraz, Traktör" value={form.title} onChange={handleFormChange} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '13px' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: '600', marginBottom: '4px', fontSize: '12px' }}>Fiyat (TL) *</label>
                  <input type="number" name="price" placeholder="90" value={form.price} onChange={handleFormChange} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '13px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: '600', marginBottom: '4px', fontSize: '12px' }}>Kategori</label>
                  <select name="category" value={form.category} onChange={handleFormChange} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#fff', fontSize: '13px' }}>
                    {Object.keys(categoriesWithSubs).map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: '600', marginBottom: '4px', fontSize: '12px' }}>Alt Ürün / Çeşit</label>
                  <select name="subCategory" value={form.subCategory} onChange={handleFormChange} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#fff', fontSize: '13px' }}>
                    {(categoriesWithSubs[form.category] || []).map(sub => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                  </select>
                </div>
                {form.category !== 'Uzmanlar' && (
                  <div>
                    <label style={{ display: 'block', fontWeight: '600', marginBottom: '4px', fontSize: '12px' }}>Miktar / Kapasite</label>
                    <input type="text" name="amount" placeholder="5 Ton" value={form.amount} onChange={handleFormChange} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '13px' }} />
                  </div>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: '600', marginBottom: '4px', fontSize: '12px' }}>Satıcı Adı *</label>
                  <input type="text" name="seller" placeholder="Adınız" value={form.seller} onChange={handleFormChange} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '13px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: '600', marginBottom: '4px', fontSize: '12px' }}>Telefon *</label>
                  <input type="text" name="phone" placeholder="0532..." value={form.phone} onChange={handleFormChange} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '13px' }} />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '4px', fontSize: '12px' }}>Fotoğraf Yükle (Cihazdan Seç)</label>
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleImageUpload} 
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', fontSize: '12px', cursor: 'pointer' }} 
                />
                {form.image && (
                  <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <img src={form.image} alt="Önizleme" style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                    <span style={{ fontSize: '11px', color: '#166534', fontWeight: '600' }}>✓ Fotoğraf yüklendi ve hazır</span>
                  </div>
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '4px', fontSize: '12px' }}>Açıklama</label>
                <textarea name="description" placeholder="Detaylar..." value={form.description} onChange={handleFormChange} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', height: '80px', boxSizing: 'border-box', fontSize: '13px' }} />
              </div>

              <div style={{ backgroundColor: '#f0fdf4', padding: '10px', borderRadius: '6px', border: '1px solid #bbf7d0', fontSize: '11px', color: '#166534' }}>
                <strong style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                  <Tag size={12} /> Otomatik Üretilen SEO Etiketleri:
                </strong>
                <span>{form.seoTags || 'İlan başlığı yazıldıkça otomatik SEO etiketleri oluşur...'}</span>
              </div>

              <button type="submit" style={{ backgroundColor: '#22c55e', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', fontSize: '14px' }}>
                İlanı Hemen Yayınla
              </button>
            </form>
          </div>
        )}

        {activeTab === 'admin-page' && (
          <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0', boxSizing: 'border-box', width: '100%' }}>
            {!isAdminLoggedIn ? (
              <div style={{ maxWidth: '320px', margin: '30px auto', textAlign: 'center', padding: '20px' }}>
                <div style={{ backgroundColor: '#f0fdf4', width: '50px', height: '50px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px auto' }}>
                  <ShieldAlert size={24} color="#1b3a2b" />
                </div>
                <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', marginBottom: '6px' }}>Yönetici Girişi</h2>
                <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>PazarTarla canlı trafik ve yönetim paneli.</p>
                <form onSubmit={handleAdminLogin} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <input type="password" placeholder="Admin Şifresi" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', textAlign: 'center', fontSize: '14px' }} />
                  <button type="submit" style={{ backgroundColor: '#1b3a2b', color: '#fff', border: 'none', padding: '10px', borderRadius: '6px', fontWeight: '700', cursor: 'pointer', fontSize: '14px' }}>Giriş Yap</button>
                </form>
                <button type="button" onClick={handleForgotPassword} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '12px', textDecoration: 'underline', marginTop: '12px' }}>Şifremi Unuttum?</button>
                <div style={{ marginTop: '20px', borderTop: '1px solid #edf2f7', paddingTop: '12px' }}>
                  <button onClick={() => changeTab('home')} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '12px', cursor: 'pointer', fontWeight: '600' }}>← Ana Sayfaya Dön</button>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #edf2f7', paddingBottom: '10px' }}>
                  <div>
                    <h2 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', margin: 0 }}>Canlı Analitik & Kontrol</h2>
                    <span style={{ fontSize: '11px', color: '#059669', fontWeight: '600' }}>Aktif İlan: {listings.length} | Kategori: {Object.keys(categoriesWithSubs).length}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => setIsAdminLoggedIn(false)} style={{ backgroundColor: '#fee2e2', color: '#dc2626', border: 'none', padding: '6px 10px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', fontWeight: '700' }}>Çıkış</button>
                    <button onClick={() => changeTab('home')} style={{ backgroundColor: '#1b3a2b', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', fontWeight: '700' }}>Siteye Dön</button>
                  </div>
                </div>

                <div style={{ backgroundColor: '#f0fdf4', padding: '14px', borderRadius: '10px', border: '1px solid #bbf7d0', marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#1b3a2b', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Globe size={18} color="#166534" /> Canlı Ziyaretçi Verileri (Gerçek Zamanlı)
                  </h3>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '12px', textAlign: 'center' }}>
                    <div style={{ backgroundColor: '#fff', padding: '8px', borderRadius: '6px', border: '1px solid #d1fae5' }}>
                      <span style={{ fontSize: '10px', color: '#64748b', display: 'block' }}>Toplam Ziyaret</span>
                      <strong style={{ fontSize: '14px', color: '#1b3a2b' }}>{analytics.totalVisits.toLocaleString('tr-TR')}</strong>
                    </div>
                    <div style={{ backgroundColor: '#fff', padding: '8px', borderRadius: '6px', border: '1px solid #d1fae5' }}>
                      <span style={{ fontSize: '10px', color: '#64748b', display: 'block' }}>Mobil Ziyaret</span>
                      <strong style={{ fontSize: '14px', color: '#059669' }}>{analytics.mobileVisits.toLocaleString('tr-TR')}</strong>
                    </div>
                    <div style={{ backgroundColor: '#fff', padding: '8px', borderRadius: '6px', border: '1px solid #d1fae5' }}>
                      <span style={{ fontSize: '10px', color: '#64748b', display: 'block' }}>Bilgisayar</span>
                      <strong style={{ fontSize: '14px', color: '#2563eb' }}>{analytics.desktopVisits.toLocaleString('tr-TR')}</strong>
                    </div>
                  </div>

                  <div style={{ backgroundColor: '#fff', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                    <h4 style={{ fontSize: '12px', fontWeight: '700', color: '#1b3a2b', margin: '0 0 6px 0', borderBottom: '1px solid #f1f5f9', paddingBottom: '4px' }}>⚡ Canlı Oturum Günlüğü</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px', maxHeight: '100px', overflowY: 'auto' }}>
                      {analytics.recentActions.map((action, idx) => (
                        <div key={idx} style={{ color: '#334155', borderBottom: '1px dashed #f1f5f9', paddingBottom: '2px' }}>
                          • {action}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#1b3a2b', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FolderPlus size={16} color="#22c55e" /> Yeni Kategori Ekle
                  </h3>
                  <form onSubmit={handleAddCategory} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <input 
                      type="text" 
                      placeholder="Ana Kategori Adı (Örn: Gübreler)" 
                      value={newCategoryName} 
                      onChange={(e) => setNewCategoryName(e.target.value)} 
                      style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }} 
                    />
                    <input 
                      type="text" 
                      placeholder="Alt Ürünler / Çeşitler (Virgülle ayırın: Kompost, Sıvı Gübre)" 
                      value={newSubCategoryName} 
                      onChange={(e) => setNewSubCategoryName(e.target.value)} 
                      style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }} 
                    />
                    <button type="submit" style={{ backgroundColor: '#22c55e', color: '#fff', border: 'none', padding: '8px', borderRadius: '6px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}>
                      Kategoriyi Ekle
                    </button>
                  </form>
                </div>

                <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', margin: '0 0 8px 0' }}>Mevcut Kategoriler ({Object.keys(categoriesWithSubs).length})</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '20px', maxHeight: '180px', overflowY: 'auto' }}>
                  {Object.keys(categoriesWithSubs).map(catKey => (
                    <div key={catKey} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', backgroundColor: '#fff', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '13px' }}>
                        <strong style={{ color: '#1b3a2b' }}>{catKey}</strong>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>Alt: {(categoriesWithSubs[catKey] || []).join(', ')}</div>
                      </div>
                      <button onClick={() => handleDeleteCategory(catKey)} style={{ backgroundColor: '#fee2e2', color: '#dc2626', border: 'none', padding: '4px 8px', borderRadius: '4px', fontWeight: '600', fontSize: '11px', cursor: 'pointer' }}>
                        Sil
                      </button>
                    </div>
                  ))}
                </div>

                <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', margin: '0 0 8px 0' }}>İlan Denetimi ({listings.length})</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '220px', overflowY: 'auto' }}>
                  {listings.map(item => (
                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', boxSizing: 'border-box' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                        <img src={item.image} alt="" style={{ width: '36px', height: '36px', borderRadius: '6px', objectFit: 'cover', flexShrink: 0 }} />
                        <div style={{ minWidth: 0 }}>
                          <h4 style={{ margin: '0 0 2px 0', fontSize: '12px', fontWeight: '700', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</h4>
                          <span style={{ fontSize: '11px', color: '#64748b' }}>{item.price.toLocaleString('tr-TR')} TL</span>
                        </div>
                      </div>
                      <button onClick={() => handleDeleteListing(item.id)} style={{ backgroundColor: '#fee2e2', color: '#dc2626', border: 'none', padding: '6px 8px', borderRadius: '6px', fontWeight: '700', cursor: 'pointer', fontSize: '11px', flexShrink: 0 }}>
                        İlanı Sil
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

      </main>

      <footer style={{ backgroundColor: '#1b3a2b', color: '#94a3b8', padding: '16px', textAlign: 'center', fontSize: '11px', borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: 'auto', boxSizing: 'border-box', width: '100%', display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '15px', color: '#cbd5e1', fontSize: '12px', fontWeight: '600' }}>
          <span style={{ cursor: 'pointer' }} onClick={() => alert('İletişim E-posta: gezginci@gmail.com | Tel: 0535 768 1550')}>İletişim</span>
          <span>•</span>
          <span style={{ cursor: 'pointer' }} onClick={() => alert('PazarTarla Tarım Pazaryeri Platformu')}>Hakkımızda</span>
          <span>•</span>
          <span style={{ cursor: 'pointer' }} onClick={() => alert('Tüm hakları saklıdır.')}>Güvenli Alışveriş</span>
        </div>
        <div style={{ fontSize: '11px', color: '#86efac', fontWeight: '500' }}>
          E-posta: gezginci@gmail.com | Tel: 0535 768 1550
        </div>
        <span>© 2026 PazarTarla • Gönen / Balıkesir</span>
      </footer>

      <button
        onClick={() => changeTab('admin-page')}
        title="Yönetim Paneli"
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          backgroundColor: '#1b3a2b',
          color: '#86efac',
          border: '2px solid #22c55e',
          borderRadius: '50%',
          width: '44px',
          height: '44px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          zIndex: 999
        }}
      >
        ⚙️
      </button>

    </div>
  );
}

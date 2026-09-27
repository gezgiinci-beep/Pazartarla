import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, SlidersHorizontal, MapPin, Phone, MessageCircle, Plus, 
  Heart, Share2, ShieldCheck, CheckCircle2, ChevronRight, ChevronDown, X, 
  Car, Tractor, Wrench, ArrowRight, Bell, User, Filter, AlertCircle, Trash2, Settings, Lock, Check, Mail, Globe, Copy, HelpCircle, Users, Image as ImageIcon, Bug, Shield, Package, ArrowLeft, Menu, ArrowUpDown, LayoutList, Star, Send, ShieldAlert, FolderPlus, Tag, Edit3 
} from 'lucide-react';

const ALL_INITIAL_LISTINGS = [
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
  // Konteyner İlanları (10 Adet)
  {
    id: 301,
    title: '3x7 Metre Sandviç Panel Lüks Yaşam Konteyneri',
    price: 135000,
    category: 'geçici konutlar',
    subCategory: 'konteyner',
    mode: 'Satılık',
    location: 'Gönen / Balıkesir',
    amount: '21 m²',
    description: 'Tarla ve bağ evleri için ideal, mutfak tezgahı ve duş-wc dahil sandviç panel lüks konteyner.',
    seller: 'Can İnce',
    phone: '0535 768 1550',
    image: 'https://images.unsplash.com/photo-1541888946425-d0fbb18f06f7?auto=format&fit=crop&q=80&w=800',
    seoTags: 'konteyner, yaşam konteyneri, tarla evi, gönen konteyner'
  },
  {
    id: 302,
    title: '2.40x6 Metre Standart Şantiye Konteyneri',
    price: 95000,
    category: 'geçici konutlar',
    subCategory: 'konteyner',
    mode: 'Satılık',
    location: 'Bandırma / Balıkesir',
    amount: '14.4 m²',
    description: 'İçerisinde elektrik tesisatı, pencerelerde demir parmaklık bulunan temiz şantiye konteyneri.',
    seller: 'Mehmet Demir',
    phone: '0532 444 5566',
    image: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&q=80&w=800',
    seoTags: 'şantiye konteyneri, ikinci el konteyner, bandırma'
  },
  {
    id: 303,
    title: 'İki Odalı Wc ve Duşlu Konteyner Ev',
    price: 185000,
    category: 'geçici konutlar',
    subCategory: 'konteyner',
    mode: 'Satılık',
    location: 'Bursa Merkez',
    amount: '28 m²',
    description: '1+1 daire düzeninde, ısı yalıtımlı, hemen oturmaya hazır geniş yaşam konteyneri.',
    seller: 'Serkan Yılmaz',
    phone: '0533 555 6677',
    image: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&q=80&w=800',
    seoTags: 'konteyner ev, 1+1 konteyner, bursa geçici konut'
  },
  {
    id: 304,
    title: 'Yalıtımlı Ofis Konteyneri (Klimalı)',
    price: 110000,
    category: 'geçici konutlar',
    subCategory: 'konteyner',
    mode: 'Satılık',
    location: 'Susurluk / Balıkesir',
    amount: '18 m²',
    description: 'Tarla girişine ofis veya bekçi kulübesi olarak uygun, klimalı ve yalıtımlı.',
    seller: 'Hasan Çelik',
    phone: '0534 666 7788',
    image: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&q=80&w=800',
    seoTags: 'ofis konteyneri, bekçi kulübesi, susurluk'
  },
  {
    id: 305,
    title: 'Ahşap Kaplamalı Verandalı Lüks Konteyner',
    price: 210000,
    category: 'geçici konutlar',
    subCategory: 'konteyner',
    mode: 'Satılık',
    location: 'Edremit / Balıkesir',
    amount: '35 m²',
    description: 'Zeytinlikleriniz için dış cephesi ahşap görünümlü, geniş verandalı tasarım konteyner ev.',
    seller: 'Ali Bilgin',
    phone: '0535 777 8899',
    image: 'https://images.unsplash.com/photo-1448630360421-65e8782a701f?auto=format&fit=crop&q=80&w=800',
    seoTags: 'verandalı konteyner, ahşap kaplama konteyner, zeytinlik evi'
  },
  {
    id: 306,
    title: 'Tekli Duş ve Wc Konteyneri (Mobil Seyyar)',
    price: 65000,
    category: 'geçici konutlar',
    subCategory: 'konteyner',
    mode: 'Satılık',
    location: 'Çanakkale Merkez',
    amount: '4 m²',
    description: 'Bahçeler ve tarlalar için vidanjör bağlantılı hazır duş ve tuvalet ünitesi.',
    seller: 'Ramazan Güneş',
    phone: '0536 888 9900',
    image: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&q=80&w=800',
    seoTags: 'wc konteyner, tuvalet duş ünitesi, seyyar tuvalet'
  },
  {
    id: 307,
    title: 'Yük Konteynerinden Dönüştürülmüş Tiny House',
    price: 260000,
    category: 'geçici konutlar',
    subCategory: 'konteyner',
    mode: 'Satılık',
    location: 'İnegöl / Bursa',
    amount: '30 m²',
    description: 'Deniz yük konteynerinden özel olarak yalıtılmış ve lüks şekilde dizayn edilmiş tiny house.',
    seller: 'Hakan Koç',
    phone: '0537 999 0011',
    image: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&q=80&w=800',
    seoTags: 'load container tiny house, yük konteyneri ev, çelik ev'
  },
  {
    id: 308,
    title: 'Depo Tipi Sac Konteyner (Kilitli Kapı)',
    price: 75000,
    category: 'geçici konutlar',
    subCategory: 'konteyner',
    mode: 'Satılık',
    location: 'Gönen / Balıkesir',
    amount: '15 m²',
    description: 'Tarım aletleri, gübre ve ilaç depolamak için güvenli kilit sistemli depo konteyneri.',
    seller: 'Can İnce',
    phone: '0535 768 1550',
    image: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&q=80&w=800',
    seoTags: 'depo konteyner, tarım alet deposu, gönen'
  },
  {
    id: 309,
    title: '3x9 Metre Mutfaklı ve Salonlu Konteyner Ev',
    price: 160000,
    category: 'geçici konutlar',
    subCategory: 'konteyner',
    mode: 'Satılık',
    location: 'Karacabey / Bursa',
    amount: '27 m²',
    description: 'Geniş oturma alanına sahip, laminat parkeli ve PVC pencereli konforlu konteyner.',
    seller: 'Necati Acar',
    phone: '0538 123 4567',
    image: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&q=80&w=800',
    seoTags: 'mutfaklı konteyner, büyük konteyner ev, karacabey'
  },
  {
    id: 310,
    title: 'İki Katlı Birleştirilmiş Prefabrik Konteyner',
    price: 380000,
    category: 'geçici konutlar',
    subCategory: 'konteyner',
    mode: 'Satılık',
    location: 'Balıkesir Merkez',
    amount: '60 m²',
    description: 'Çift katlı, çelik merdivenli, balkonlu tam teşekküllü çiftlik yönetim binası veya ev.',
    seller: 'İsmail Yıldız',
    phone: '0539 321 6547',
    image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&q=80&w=800',
    seoTags: 'çift katlı konteyner, prefabrik villa konteyner, balıkesir'
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
  'Uzmanlar': ['Veterinerler', 'Ziraatçiler'],
  'endüstriyel çadırlar': ['Çadır Örtüsü', 'Depo Çadırı'],
  'geçici konutlar': ['konteyner', 'çadır', 'prefabrik']
};

export default function App() {
  const [activeTab, setActiveTab] = useState('home'); 
  const editFormRef = useRef(null);
  
  const [listings, setListings] = useState(() => {
    const saved = localStorage.getItem('pazartarla_listings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 5) return parsed;
      } catch (e) {
        console.error(e);
      }
    }
    localStorage.setItem('pazartarla_listings', JSON.stringify(ALL_INITIAL_LISTINGS));
    return ALL_INITIAL_LISTINGS;
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
  const [editingListing, setEditingListing] = useState(null);

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

    const newAction = `Ziyaretçi bağlandı (${isMobile ? 'Mobil' : 'Masaüstü'}) - ${new Date().toLocaleTimeString('tr-TR')}`;
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

  const sanitizeInput = (str) => {
    if (typeof str !== 'string') return str;
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  const generateAutoSEO = (title, category, subCategory, location) => {
    const cleanTitle = sanitizeInput(title.trim() ? title.trim() : 'Tarım İlanı');
    const cleanLoc = sanitizeInput(location.trim() ? location.trim() : 'Türkiye');
    return `${cleanTitle}, ${category || 'Tarım'}, ${subCategory || 'Ürün'}, ${cleanLoc} ilanları, pazar tarla`;
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => {
      const updated = { ...prev, [name]: sanitizeInput(value) };
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
      if (file.size > 2 * 1024 * 1024) {
        alert('Dosya boyutu 2 MB sınırını aşamaz!');
        return;
      }
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
      alert('Lütfen başlık, fiyat, satıcı adı ve telefon numarası alanlarını doldurun.');
      return;
    }

    const finalSeoTags = form.seoTags || generateAutoSEO(form.title, form.category, form.subCategory, form.location);
    const newEntry = {
      ...form,
      title: sanitizeInput(form.title),
      description: sanitizeInput(form.description),
      seller: sanitizeInput(form.seller),
      phone: sanitizeInput(form.phone),
      id: Date.now(),
      price: Number(form.price),
      amount: form.category === 'Uzmanlar' ? '' : sanitizeInput(form.amount),
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

  const startEditing = (item) => {
    if (!isAdminLoggedIn) {
      alert('İlanı düzenlemek için önce Yönetici Paneline giriş yapmalısınız.');
      changeTab('admin-page');
      return;
    }
    setEditingListing(item);
    setTimeout(() => {
      if (editFormRef.current) {
        editFormRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditingListing(prev => ({ ...prev, [name]: sanitizeInput(value) }));
  };

  const handleEditImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('Görsel boyutu 2 MB sınırını aşamaz!');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditingListing(prev => ({ ...prev, image: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const saveEditedListing = (e) => {
    e.preventDefault();
    if (!isAdminLoggedIn) return;
    const updatedListings = listings.map(item => item.id === editingListing.id ? { ...editingListing, price: Number(editingListing.price) } : item);
    saveListings(updatedListings);
    setEditingListing(null);
    alert('İlan başarıyla güncellendi!');
  };

  const handleDeleteListing = (id) => {
    if (!isAdminLoggedIn) {
      alert('İlan silmek için yönetici olmalısınız.');
      changeTab('admin-page');
      return;
    }
    if (window.confirm('Bu ilanı silmek istediğinize emin misiniz?')) {
      const updated = listings.filter(item => item.id !== id);
      saveListings(updated);
      const updatedFavs = favorites.filter(item => item.id !== id);
      setFavorites(updatedFavs);
      localStorage.setItem('pazartarla_favorites', JSON.stringify(updatedFavs));
    }
  };

  const handleAddCategory = (e) => {
    e.preventDefault();
    if (!isAdminLoggedIn) return;
    if (!newCategoryName.trim()) {
      alert('Lütfen bir kategori adı girin.');
      return;
    }
    const catName = sanitizeInput(newCategoryName.trim());
    if (categoriesWithSubs[catName]) {
      alert('Bu kategori zaten mevcut!');
      return;
    }
    const subs = newSubCategoryName.trim() 
      ? newSubCategoryName.split(',').map(s => sanitizeInput(s.trim())).filter(Boolean) 
      : ['Genel'];
     
    const updatedCats = { ...categoriesWithSubs, [catName]: subs };
    saveCategories(updatedCats);
    setNewCategoryName('');
    setNewSubCategoryName('');
    alert(`"${catName}" kategorisi başarıyla eklendi!`);
  };

  const handleDeleteCategory = (catKey) => {
    if (!isAdminLoggedIn) return;
    if (window.confirm(`"${catKey}" kategorisini silmek istediğinize emin misiniz?`)) {
      const updatedCats = { ...categoriesWithSubs };
      delete updatedCats[catKey];
      saveCategories(updatedCats);
    }
  };

  const handleAdminLogin = (e) => {
    e.preventDefault();
    if (adminPassword === '1234' || adminPassword === 'admin') {
      setIsAdminLoggedIn(true);
      setAdminPassword('');
    } else {
      alert('Hatalı şifre!');
    }
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
    alert('İlan bilgileri panoya kopyalandı!');
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
                  <Tag size={12} color="#166534" /> Anahtar Kelimeler:
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
              <h2 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', margin: 0 }}>İlan Ver</h2>
            </div>
            <form onSubmit={handleDirectAdd} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '4px', fontSize: '12px' }}>İlan Başlığı *</label>
                <input type="text" name="title" placeholder="Örn: Konteyner" value={form.title} onChange={handleFormChange} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '13px' }} />
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
                    <input type="text" name="amount" placeholder="21 m²" value={form.amount} onChange={handleFormChange} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '13px' }} />
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
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '4px', fontSize: '12px' }}>Fotoğraf Yükle (Max 2MB)</label>
                <input 
                  type="file" 
                  accept="image/jpeg,image/png,image/webp" 
                  onChange={handleImageUpload} 
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', fontSize: '12px', cursor: 'pointer' }} 
                />
                {form.image && (
                  <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <img src={form.image} alt="Önizleme" style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                    <span style={{ fontSize: '11px', color: '#166534', fontWeight: '600' }}>✓ Fotoğraf yüklendi</span>
                  </div>
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '4px', fontSize: '12px' }}>Açıklama</label>
                <textarea name="description" placeholder="Detaylar..." value={form.description} onChange={handleFormChange} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', height: '80px', boxSizing: 'border-box', fontSize: '13px' }} />
              </div>

              <button type="submit" style={{ backgroundColor: '#22c55e', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', fontSize: '14px' }}>
                İlanı Yayınla
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
                <form onSubmit={handleAdminLogin} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <input type="password" placeholder="Admin Şifresi (1234)" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', textAlign: 'center', fontSize: '14px' }} />
                  <button type="submit" style={{ backgroundColor: '#1b3a2b', color: '#fff', border: 'none', padding: '10px', borderRadius: '6px', fontWeight: '700', cursor: 'pointer', fontSize: '14px' }}>Giriş Yap</button>
                </form>
                <div style={{ marginTop: '20px', borderTop: '1px solid #edf2f7', paddingTop: '12px' }}>
                  <button onClick={() => changeTab('home')} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '12px', cursor: 'pointer', fontWeight: '600' }}>← Ana Sayfaya Dön</button>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #edf2f7', paddingBottom: '10px' }}>
                  <div>
                    <h2 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', margin: 0 }}>🛡️ Yönetim Paneli</h2>
                    <span style={{ fontSize: '11px', color: '#059669', fontWeight: '600' }}>Aktif İlan: {listings.length}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => setIsAdminLoggedIn(false)} style={{ backgroundColor: '#fee2e2', color: '#dc2626', border: 'none', padding: '6px 10px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', fontWeight: '700' }}>Çıkış</button>
                    <button onClick={() => changeTab('home')} style={{ backgroundColor: '#1b3a2b', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', fontWeight: '700' }}>Siteye Dön</button>
                  </div>
                </div>

                <div ref={editFormRef}>
                  {editingListing && (
                    <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '10px', border: '2px solid #22c55e', marginBottom: '20px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#1b3a2b', margin: 0 }}>✏️ İlanı Düzenle</h3>
                        <button onClick={() => setEditingListing(null)} style={{ background: 'none', border: 'none', fontSize: '12px', fontWeight: '700', color: '#dc2626', cursor: 'pointer' }}>İptal</button>
                      </div>

                      <form onSubmit={saveEditedListing} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', marginBottom: '2px' }}>İlan Başlığı</label>
                          <input type="text" name="title" value={editingListing.title} onChange={handleEditChange} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }} />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', marginBottom: '2px' }}>Fiyat (TL)</label>
                            <input type="number" name="price" value={editingListing.price} onChange={handleEditChange} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }} />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', marginBottom: '2px' }}>Konum</label>
                            <input type="text" name="location" value={editingListing.location} onChange={handleEditChange} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }} />
                          </div>
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', marginBottom: '2px' }}>Yeni Fotoğraf (Cihazdan)</label>
                          <input type="file" accept="image/*" onChange={handleEditImageUpload} style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '11px', backgroundColor: '#fff' }} />
                          <div style={{ marginTop: '6px' }}>
                            <img src={editingListing.image} alt="Önizleme" style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                          </div>
                        </div>

                        <button type="submit" style={{ backgroundColor: '#22c55e', color: '#fff', border: 'none', padding: '10px', borderRadius: '6px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}>
                          Değişiklikleri Kaydet
                        </button>
                      </form>
                    </div>
                  )}
                </div>

                <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#1b3a2b', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FolderPlus size={16} color="#22c55e" /> Yeni Kategori Ekle
                  </h3>
                  <form onSubmit={handleAddCategory} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <input 
                      type="text" 
                      placeholder="Ana Kategori Adı" 
                      value={newCategoryName} 
                      onChange={(e) => setNewCategoryName(e.target.value)} 
                      style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }} 
                    />
                    <input 
                      type="text" 
                      placeholder="Alt Ürünler (Virgülle ayırın)" 
                      value={newSubCategoryName} 
                      onChange={(e) => setNewSubCategoryName(e.target.value)} 
                      style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }} 
                    />
                    <button type="submit" style={{ backgroundColor: '#22c55e', color: '#fff', border: 'none', padding: '8px', borderRadius: '6px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}>
                      Kategoriyi Ekle
                    </button>
                  </form>
                </div>

                <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', margin: '0 0 8px 0' }}>İlan Yönetimi ({listings.length})</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '250px', overflowY: 'auto' }}>
                  {listings.map(item => (
                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', boxSizing: 'border-box' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                        <img src={item.image} alt="" style={{ width: '36px', height: '36px', borderRadius: '6px', objectFit: 'cover', flexShrink: 0 }} />
                        <div style={{ minWidth: 0 }}>
                          <h4 style={{ margin: '0 0 2px 0', fontSize: '12px', fontWeight: '700', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</h4>
                          <span style={{ fontSize: '11px', color: '#64748b' }}>{item.price.toLocaleString('tr-TR')} TL</span>
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                        <button onClick={() => startEditing(item)} style={{ backgroundColor: '#e0f2fe', color: '#0284c7', border: 'none', padding: '6px 8px', borderRadius: '6px', fontWeight: '700', fontSize: '11px', cursor: 'pointer' }}>
                          Düzenle
                        </button>
                        <button onClick={() => handleDeleteListing(item.id)} style={{ backgroundColor: '#fee2e2', color: '#dc2626', border: 'none', padding: '6px 8px', borderRadius: '6px', fontWeight: '700', fontSize: '11px', cursor: 'pointer' }}>
                          Sil
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

      </main>

      <footer style={{ backgroundColor: '#1b3a2b', color: '#94a3b8', padding: '16px', textAlign: 'center', fontSize: '11px', borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: 'auto', boxSizing: 'border-box', width: '100%', display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center' }}>
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

import React, { useState, useEffect } from 'react';
import { 
  Search, SlidersHorizontal, MapPin, Phone, MessageCircle, Plus, 
  Heart, Share2, ShieldCheck, CheckCircle2, ChevronRight, X, 
  Car, Tractor, Wrench, ArrowRight, Bell, User, Filter, AlertCircle, Trash2, Settings, Lock, Check, Mail, Globe, Copy, HelpCircle, Users, Image, Bug, Shield, Package, ArrowLeft, Menu, ArrowUpDown, LayoutList, Star 
} from 'lucide-react';

const INITIAL_LISTINGS = [
  // ZİRAİ İLAÇ VE GÜBRELER (TÜM TÜRKİYE GENELİ BAYİLER)
  {
    id: 101,
    title: 'Gönen Güven Zirai İlaç ve Gübre Bayii',
    price: 450,
    category: 'Zirai İlaç ve Gübreler',
    subCategory: 'Fungisit & Mantar İlacı',
    mode: 'Satılık',
    location: 'Gönen / Balıkesir',
    city: 'Balıkesir',
    amount: '1 Litre / Ambalaj',
    description: 'Kurtuluş Mah. Çiftlik Cad. No:12 Gönen/Balıkesir. Ceviz ve meyve bahçeleri için ruhsatlı mantar, küf önleyici zirai ilaçlar ve taban gübreleri.',
    seller: 'Güven Zirai İlaç',
    phone: '0266 762 12 34',
    verified: true,
    featured: true,
    image: 'https://images.unsplash.com/photo-1589927986064-0deb33169d8f?auto=format&fit=crop&q=80&w=800',
    date: 'Bugün'
  },
  {
    id: 102,
    title: 'Alaşehir Zengin Tarım - Zirai İlaç ve Gübre',
    price: 680,
    category: 'Zirai İlaç ve Gübreler',
    subCategory: 'Yaprak Gübresi',
    mode: 'Satılık',
    location: 'Alaşehir / Manisa',
    city: 'Manisa',
    amount: '5 Litre Bidon',
    description: 'Kurtuluş Mah. Zeki Üngör Cad. No:2/A Alaşehir/Manisa. Bağ, meyve ve tarla bitkileri için amino asitli sıvı yaprak gübresi.',
    seller: 'Zengin Tarım Market',
    phone: '0236 653 14 95',
    verified: true,
    featured: true,
    image: 'https://images.unsplash.com/photo-1589927986064-0deb33169d8f?auto=format&fit=crop&q=80&w=800',
    date: 'Bugün'
  },
  {
    id: 103,
    title: 'Söke Toprak Tarım - İlaç ve Tohum Deposu',
    price: 520,
    category: 'Zirai İlaç ve Gübreler',
    subCategory: 'İnsektisit (Böcek İlacı)',
    mode: 'Satılık',
    location: 'Söke / Aydın',
    city: 'Aydın',
    amount: '1 Litre',
    description: 'Yenidoğan Mah. İstiklal Cad. No:254 Söke/Aydın. Zararlı böceklere karşı etkili sistemik tarım ilaçları ve tohumlar.',
    seller: 'Toprak Zirai İlaçlama',
    phone: '0256 518 56 24',
    verified: true,
    featured: false,
    image: 'https://images.unsplash.com/photo-1589927986064-0deb33169d8f?auto=format&fit=crop&q=80&w=800',
    date: 'Bugün'
  },
  {
    id: 104,
    title: 'Bursa Atlantis Tarım Zirai İlaç Bayii',
    price: 750,
    category: 'Zirai İlaç ve Gübreler',
    subCategory: 'Herbisit (Ot İlacı)',
    mode: 'Satılık',
    location: 'Osmangazi / Bursa',
    city: 'Bursa',
    amount: '3 Litre',
    description: 'Küçükbalıklı Mah. Heybe Sk. No:6 Osmangazi/Bursa. Bahçe aralarındaki yabani otlar için seçici herbisit ilaçlar.',
    seller: 'Atlantis Ziraat',
    phone: '0224 215 70 00',
    verified: true,
    featured: false,
    image: 'https://images.unsplash.com/photo-1589927986064-0deb33169d8f?auto=format&fit=crop&q=80&w=800',
    date: 'Bugün'
  },
  {
    id: 105,
    title: 'Adana Çukurova Gübre ve Zirai İlaç Pazarı',
    price: 890,
    category: 'Zirai İlaç ve Gübreler',
    subCategory: 'Yaprak Gübresi',
    mode: 'Satılık',
    location: 'Seyhan / Adana',
    city: 'Adana',
    amount: '10 kg Çuval',
    description: 'Turunçgil ve sebze üretim bölgeleri için yoğunlaştırılmış NPK taban ve üst gübreleri.',
    seller: 'Çukurova Tarım',
    phone: '0322 351 22 33',
    verified: true,
    featured: false,
    image: 'https://images.unsplash.com/photo-1589927986064-0deb33169d8f?auto=format&fit=crop&q=80&w=800',
    date: 'Bugün'
  },
  {
    id: 106,
    title: 'Konya Selçuklu Tarım Market ve İlaçlama',
    price: 600,
    category: 'Zirai İlaç ve Gübreler',
    subCategory: 'Fungisit & Mantar İlacı',
    mode: 'Satılık',
    location: 'Selçuklu / Konya',
    city: 'Konya',
    amount: '5 Litre',
    description: 'Buğday, arpa ve mısır ekim alanları için pas ve mantar hastalıklarına karşı etkili bitki koruma çözümleri.',
    seller: 'Selçuklu Ziraat',
    phone: '0332 235 44 55',
    verified: true,
    featured: false,
    image: 'https://images.unsplash.com/photo-1589927986064-0deb33169d8f?auto=format&fit=crop&q=80&w=800',
    date: 'Bugün'
  },
  {
    id: 107,
    title: 'İzmir Tire Zirai İlaç ve Gübre Deposu',
    price: 540,
    category: 'Zirai İlaç ve Gübreler',
    subCategory: 'Yaprak Gübresi',
    mode: 'Satılık',
    location: 'Tire / İzmir',
    city: 'İzmir',
    amount: '5 Litre',
    description: 'İsmail Çetinkaya Cad. No:45 Tire/İzmir. Meyve bahçeleri ve zeytinlikler için özel besleme ve koruma ürünleri.',
    seller: 'Tire Ziraat Deposu',
    phone: '0232 512 88 99',
    verified: true,
    featured: false,
    image: 'https://images.unsplash.com/photo-1589927986064-0deb33169d8f?auto=format&fit=crop&q=80&w=800',
    date: 'Bugün'
  },
  {
    id: 108,
    title: 'Antalya Aksu Tarım İlaçları ve Gübre',
    price: 720,
    category: 'Zirai İlaç ve Gübreler',
    subCategory: 'İnsektisit (Böcek İlacı)',
    mode: 'Satılık',
    location: 'Aksu / Antalya',
    city: 'Antalya',
    amount: '1 Litre',
    description: 'Seracılık ve örtü altı tarım için özel kırmızı örümcek ve thrips ilaçları, damla sulama gübreleri.',
    seller: 'Aksu Tarım',
    phone: '0242 426 11 22',
    verified: true,
    featured: false,
    image: 'https://images.unsplash.com/photo-1589927986064-0deb33169d8f?auto=format&fit=crop&q=80&w=800',
    date: 'Bugün'
  },
  {
    id: 109,
    title: 'Sakarya Adapazarı Zirai İlaç ve Tohumculuk',
    price: 490,
    category: 'Zirai İlaç ve Gübreler',
    subCategory: 'Fungisit & Mantar İlacı',
    mode: 'Satılık',
    location: 'Adapazarı / Sakarya',
    city: 'Sakarya',
    amount: '2 Litre',
    description: 'Semerciler Mah. Postane Sk. No:8 Adapazarı/Sakarya. Mısır, patates ve fındık tarımı için ilaç ve gübre çeşitleri.',
    seller: 'Sakarya Ziraat',
    phone: '0264 271 33 44',
    verified: true,
    featured: false,
    image: 'https://images.unsplash.com/photo-1589927986064-0deb33169d8f?auto=format&fit=crop&q=80&w=800',
    date: 'Bugün'
  },
  {
    id: 114,
    title: 'Tekirdağ Süleymanpaşa Tarım İlaçları',
    price: 580,
    category: 'Zirai İlaç ve Gübreler',
    subCategory: 'Herbisit (Ot İlacı)',
    mode: 'Satılık',
    location: 'Süleymanpaşa / Tekirdağ',
    city: 'Tekirdağ',
    amount: '3 Litre',
    description: 'Trakya bölgesi ayçiçeği ve buğday ekim alanları için yabancı ot ilaçları ve taban gübreleri.',
    seller: 'Trakya Ziraat',
    phone: '0282 261 55 77',
    verified: true,
    featured: false,
    image: 'https://images.unsplash.com/photo-1589927986064-0deb33169d8f?auto=format&fit=crop&q=80&w=800',
    date: 'Bugün'
  },
  {
    id: 115,
    title: 'Mersin Tarsus Zirai İlaç ve Gübre Deposu',
    price: 640,
    category: 'Zirai İlaç ve Gübreler',
    subCategory: 'Yaprak Gübresi',
    mode: 'Satılık',
    location: 'Tarsus / Mersin',
    city: 'Mersin',
    amount: '5 Litre',
    description: 'Narenciye ve meyve bahçeleri için özel çinko, demir ve iz elementli yaprak gübreleri.',
    seller: 'Tarsus Tarım',
    phone: '0324 613 88 99',
    verified: true,
    featured: false,
    image: 'https://images.unsplash.com/photo-1589927986064-0deb33169d8f?auto=format&fit=crop&q=80&w=800',
    date: 'Bugün'
  },
  {
    id: 116,
    title: 'Çanakkale Merkez Ziraat Market ve İlaç',
    price: 510,
    category: 'Zirai İlaç ve Gübreler',
    subCategory: 'Fungisit & Mantar İlacı',
    mode: 'Satılık',
    location: 'Merkez / Çanakkale',
    city: 'Çanakkale',
    amount: '1 Litre',
    description: 'Ceviz, zeytin ve bağ alanları için koruyucu mantar ilaçları ve damla sulama gübreleri.',
    seller: 'Boğaz Tarım',
    phone: '0286 217 44 11',
    verified: true,
    featured: false,
    image: 'https://images.unsplash.com/photo-1589927986064-0deb33169d8f?auto=format&fit=crop&q=80&w=800',
    date: 'Bugün'
  },

  // VETERİNERLER VE HAYVAN SAĞLIĞI
  {
    id: 110,
    title: 'Gönen Şifa Veteriner Kliniği (7/24)',
    price: 500,
    category: 'Veterinerler ve Hayvan Sağlığı',
    subCategory: 'Klinik & Koruyucu Hekimlik',
    mode: 'Hizmet',
    location: 'Gönen / Balıkesir',
    city: 'Balıkesir',
    amount: 'Yerinde / Klinik Muayene',
    description: 'Kurtuluş Mah. Kızılay Cad. Gönen/Balıkesir. Büyükbaş ve küçükbaş hayvanlar için suni tohumlama, aşılama ve cerrahi.',
    seller: 'Vet. Hekim Mehmet Can',
    phone: '0266 762 19 68',
    verified: true,
    featured: true,
    image: 'https://images.unsplash.com/photo-1584132967334-10e028bd69f7?auto=format&fit=crop&q=80&w=800',
    date: 'Bugün'
  },
  {
    id: 111,
    title: 'Bandırma Öncü Veteriner Deposu & Aşı Merkezi',
    price: 1200,
    category: 'Veterinerler ve Hayvan Sağlığı',
    subCategory: 'Aşı & İlaç Temini',
    mode: 'Satılık',
    location: 'Bandırma / Balıkesir',
    city: 'Balıkesir',
    amount: 'Soğuk Zincir Sevkiyat',
    description: 'Paşabayır Mah. İstasyon Cad. Bandırma. Sürü sağlığı için koruyucu aşılar, vitaminler ve antibiyotik tedariği.',
    seller: 'Öncü Veterinerlik',
    phone: '0266 714 55 66',
    verified: true,
    featured: false,
    image: 'https://images.unsplash.com/photo-1584132967334-10e028bd69f7?auto=format&fit=crop&q=80&w=800',
    date: 'Bugün'
  },
  {
    id: 112,
    title: 'Bursa Karacabey Hayvan Sağlığı ve Veterinerlik',
    price: 800,
    category: 'Veterinerler ve Hayvan Sağlığı',
    subCategory: 'Sürü Sağlığı Yönetimi',
    mode: 'Hizmet',
    location: 'Karacabey / Bursa',
    city: 'Bursa',
    amount: 'Periyodik Kontrol',
    description: 'Göztepe Mah. Bursa Cad. Karacabey/Bursa. Çiftlikler için paraziter mücadele, tırnak bakımı ve sürü danışmanlığı.',
    seller: 'Vet. Hekim Selim Demir',
    phone: '0224 676 33 22',
    verified: true,
    featured: false,
    image: 'https://images.unsplash.com/photo-1584132967334-10e028bd69f7?auto=format&fit=crop&q=80&w=800',
    date: 'Bugün'
  },
  {
    id: 113,
    title: 'İzmir Tire Süt Sığırcılığı Veteriner Kliniği',
    price: 750,
    category: 'Veterinerler ve Hayvan Sağlığı',
    subCategory: 'Klinik & Koruyucu Hekimlik',
    mode: 'Hizmet',
    location: 'Tire / İzmir',
    city: 'İzmir',
    amount: 'Sürü Takibi',
    description: 'Fatih Mah. Dr. Ali Necip Cad. Tire/İzmir. Süt sığırcılığı işletmelerinde mastitis önleme ve koruyucu hekimlik.',
    seller: 'Tire Veteriner Polikliniği',
    phone: '0232 512 44 11',
    verified: true,
    featured: false,
    image: 'https://images.unsplash.com/photo-1584132967334-10e028bd69f7?auto=format&fit=crop&q=80&w=800',
    date: 'Bugün'
  },
  {
    id: 117,
    title: 'Konya Ereğli Büyükbaş Veteriner Polikliniği',
    price: 850,
    category: 'Veterinerler ve Hayvan Sağlığı',
    subCategory: 'Klinik & Koruyucu Hekimlik',
    mode: 'Hizmet',
    location: 'Ereğli / Konya',
    city: 'Konya',
    amount: '7/24 Acil',
    description: 'Et ve süt besiciliği yapan çiftlikler için yerinde muayene, suni tohumlama ve metabolik hastalık tedavisi.',
    seller: 'Ereğli Veterinerlik',
    phone: '0332 713 55 44',
    verified: true,
    featured: false,
    image: 'https://images.unsplash.com/photo-1584132967334-10e028bd69f7?auto=format&fit=crop&q=80&w=800',
    date: 'Bugün'
  },
  {
    id: 118,
    title: 'Balıkesir Merkez Veteriner Deposu',
    price: 950,
    category: 'Veterinerler ve Hayvan Sağlığı',
    subCategory: 'Aşı & İlaç Temini',
    mode: 'Satılık',
    location: 'Karesi / Balıkesir',
    city: 'Balıkesir',
    amount: 'Toptan / Perakende',
    description: 'Yıldırım Mah. Atatürk Cad. Karesi/Balıkesir. Çiftlik hayvanları için vitamin premixleri, aşılar ve dezenfektanlar.',
    seller: 'Karesi Veteriner Depo',
    phone: '0266 241 11 33',
    verified: true,
    featured: false,
    image: 'https://images.unsplash.com/photo-1584132967334-10e028bd69f7?auto=format&fit=crop&q=80&w=800',
    date: 'Bugün'
  },

  // DİĞER KATEGORİLER
  {
    id: 1,
    title: 'Bursamızın Meşhur Saplı Tatlı Kirazı',
    price: 90,
    category: 'Mahsuller',
    subCategory: 'Kiraz',
    mode: 'Satılık',
    location: 'Karacabey / Bursa',
    city: 'Bursa',
    amount: '500 kg',
    description: 'İhracat kalitesinde iri cins, taze hasat tatlı kiraz. Soğuk zincir araçlarla sevkiyat yapılır.',
    seller: 'İbrahim Demir',
    phone: '0532 444 5566',
    verified: true,
    featured: true,
    image: 'https://images.unsplash.com/photo-1528821151447-11f211b5e5a7?auto=format&fit=crop&q=80&w=800',
    date: 'Bugün'
  },
  {
    id: 5,
    title: 'Tarladan Doğrudan Taze Chandler Ceviz',
    price: 140,
    category: 'Mahsuller',
    subCategory: 'Ceviz',
    mode: 'Satılık',
    location: 'Gönen / Balıkesir',
    city: 'Balıkesir',
    amount: '1 Ton',
    description: 'Kendi bahçemizin ürünü, ilaçsız ve dolgun Chandler ceviz. Toptan veya perakende satışımız vardır.',
    seller: 'Can İnce',
    phone: '0535 768 1550',
    verified: true,
    featured: true,
    image: 'https://images.unsplash.com/photo-1559181567-c3190ca9959b?auto=format&fit=crop&q=80&w=800',
    date: 'Bugün'
  },
  {
    id: 7,
    title: 'Erken Hasat Soğuk Sıkım Sızma Zeytinyağı',
    price: 1250,
    category: 'Mahsuller',
    subCategory: 'Zeytin & Zeytinyağı',
    mode: 'Satılık',
    location: 'Burhaniye / Balıkesir',
    city: 'Balıkesir',
    amount: '100 Teneke (5 Lt)',
    description: 'Asit oranı düşük, kendi zeytinliklerimizden üretilen geleneksel soğuk sıkım saf zeytinyağı.',
    seller: 'Hasan Bilir',
    phone: '0532 123 4567',
    verified: true,
    featured: true,
    image: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&q=80&w=800',
    date: 'Bugün'
  },
  {
    id: 11,
    title: 'Holstein Süt İneği ve Buzağısı',
    price: 85000,
    category: 'Canlı Hayvanlar',
    subCategory: 'Büyükbaş',
    mode: 'Satılık',
    location: 'Gönen / Balıkesir',
    city: 'Balıkesir',
    amount: '1 Baş + 1',
    description: 'Günlük 30 litre süt veren, sağlığı yerinde inek.',
    seller: 'Mustafa Çoban',
    phone: '0532 777 8899',
    verified: true,
    featured: true,
    image: 'https://images.unsplash.com/photo-1570042225831-d98fa7577f1e?auto=format&fit=crop&q=80&w=800',
    date: 'Bugün'
  },
  {
    id: 18,
    title: 'Meşe Çiçeği Yayla Süzme Balı (1 Kg)',
    price: 400,
    category: 'Arıcılık & Bal',
    subCategory: 'Süzme Bal',
    mode: 'Satılık',
    location: 'Gönen / Balıkesir',
    city: 'Balıkesir',
    amount: '50 Kavanoz',
    description: 'Meşe ağaçlarıyla çevrili doğal florada üretilmiş saf bal.',
    seller: 'Can İnce',
    phone: '0535 768 1550',
    verified: true,
    featured: true,
    image: 'https://images.unsplash.com/photo-1587049352847-4a222e784d38?auto=format&fit=crop&q=80&w=800',
    date: 'Bugün'
  },
  {
    id: 22,
    title: 'John Deere 6130M - Düşük saat, tek elden',
    price: 2450000,
    category: 'Traktör',
    subCategory: 'İkinci El Traktör',
    mode: 'Satılık',
    location: 'Gönen / Balıkesir',
    city: 'Balıkesir',
    amount: '1200 Çalışma Saati / 130 HP',
    description: 'Kapalı garaj traktörüdür. Tüm bakımları yetkili serviste yapılmıştır. Hiçbir masrafı yoktur.',
    seller: 'Ahmet Yılmaz',
    phone: '0532 555 0192',
    verified: true,
    featured: true,
    image: 'https://images.unsplash.com/photo-1592417817098-8f3d69204052?auto=format&fit=crop&q=80&w=800',
    date: 'Bugün'
  }
];

export default function App() {
  const [activeTab, setActiveTab] = useState('home'); 
  const [listings, setListings] = useState(INITIAL_LISTINGS);
  const [selectedListing, setSelectedListing] = useState(null);
  
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');

  const [selectedCategory, setSelectedCategory] = useState('Tüm kategoriler');
  const [selectedSubCategory, setSelectedSubCategory] = useState('Tümü');
  
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewMode, setViewMode] = useState('Liste');

  const [form, setForm] = useState({
    title: '',
    price: '',
    category: 'Mahsuller',
    subCategory: 'Ceviz',
    mode: 'Satılık',
    location: 'Gönen / Balıkesir',
    city: 'Balıkesir',
    amount: '',
    description: '',
    seller: '',
    phone: '',
    image: ''
  });

  useEffect(() => {
    // Zorla en güncel veriyi yükle ve önbelleği sıfırla
    localStorage.removeItem('pazartarla_listings');
    setListings(INITIAL_LISTINGS);

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
  };

  const handleFormChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleDirectAdd = (e) => {
    e.preventDefault();
    if (!form.title || !form.price || !form.phone || !form.seller) {
      alert('Lütfen başlık, fiyat, ad Soyad ve telefon numarası alanlarını doldurun.');
      return;
    }

    const finalImage = form.image.trim() !== '' ? form.image : 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&q=80&w=800';

    const newEntry = {
      ...form,
      id: Date.now(),
      price: Number(form.price),
      image: finalImage,
      verified: true,
      featured: false,
      date: 'Bugün'
    };

    const updated = [newEntry, ...listings];
    saveListings(updated);
    changeTab('home');
    alert('İlanınız başarıyla yayınlandı!');
  };

  const handleDeleteListing = (id) => {
    if (window.confirm('Bu ilanı yayından kaldırmak/silmek istediğinize emin misiniz?')) {
      const updated = listings.filter(item => item.id !== id);
      saveListings(updated);
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

  const categoriesWithSubs = {
    'Veterinerler ve Hayvan Sağlığı': ['Klinik & Koruyucu Hekimlik', 'Aşı & İlaç Temini', 'Sürü Sağlığı Yönetimi', 'Diğer Veterinerlik'],
    'Zirai İlaç ve Gübreler': ['Fungisit & Mantar İlacı', 'Yaprak Gübresi', 'İnsektisit (Böcek İlacı)', 'Herbisit (Ot İlacı)', 'Diğer Tarım İlacı'],
    'Mahsuller': ['Kiraz', 'Ceviz', 'Zeytin & Zeytinyağı', 'Diğer Mahsul'],
    'Canlı Hayvanlar': ['Büyükbaş', 'Küçükbaş'],
    'Arıcılık & Bal': ['Süzme Bal'],
    'Traktör': ['İkinci El Traktör']
  };

  const filteredListings = listings.filter(item => {
    const matchesCategory = selectedCategory === 'Tüm kategoriler' || item.category === selectedCategory;
    const matchesSubCategory = selectedSubCategory === 'Tümü' || item.subCategory === selectedSubCategory;
    return matchesCategory && matchesSubCategory;
  });

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f4f6f8', color: '#1e293b', fontFamily: 'system-ui, -apple-system, sans-serif', display: 'flex', flexDirection: 'column', width: '100%', maxWidth: '100vw', overflowX: 'hidden', boxSizing: 'border-box' }}>
      
      {/* ÜST HEADER */}
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
            onClick={() => changeTab('add')}
            style={{ backgroundColor: '#22c55e', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: '700', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px', boxShadow: '0 2px 8px rgba(34, 197, 94, 0.3)' }}
          >
            <Plus size={16} /> İlan Ver
          </button>
        </div>
      </header>

      {/* ANA İÇERİK */}
      <main style={{ width: '100%', maxWidth: '600px', margin: '0 auto', padding: '12px', flex: 1, boxSizing: 'border-box' }}>
        
        {/* 1. EKRAN: KATEGORİ SEÇİMİ */}
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

            {Object.keys(categoriesWithSubs).map(cat => (
              <div key={cat}>
                <div 
                  onClick={() => { setSelectedCategory(cat); setSelectedSubCategory('Tümü'); changeTab('results'); }}
                  style={{ padding: '14px 16px', borderBottom: '1px solid #edf2f7', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                >
                  <span style={{ fontWeight: '600', color: '#334155', fontSize: '14px' }}>{cat}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94a3b8', fontSize: '13px' }}>
                    <span>({listings.filter(i => i.category === cat).length})</span>
                    <ChevronRight size={16} />
                  </div>
                </div>

                <div style={{ backgroundColor: '#fafafa', borderBottom: '1px solid #edf2f7' }}>
                  {categoriesWithSubs[cat].map(sub => (
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
              </div>
            ))}

            <div style={{ padding: '16px', textAlign: 'center', backgroundColor: '#f8fafc' }}>
              <button onClick={() => changeTab('admin')} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '12px', cursor: 'pointer', textDecoration: 'underline' }}>
                Yönetim Paneli (Admin)
              </button>
            </div>
          </div>
        )}

        {/* 2. EKRAN: ARAMA SONUÇLARI */}
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
                filteredListings.map(item => (
                  <div 
                    key={item.id} 
                    onClick={() => { setSelectedListing(item); changeTab('detail'); }}
                    style={{ backgroundColor: '#fff', borderRadius: '10px', overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', cursor: 'pointer', display: 'flex', gap: '10px', padding: '10px', boxSizing: 'border-box', width: '100%' }}
                  >
                    <div style={{ position: 'relative', width: viewMode === 'Detaylı Liste' ? '110px' : '90px', height: viewMode === 'Detaylı Liste' ? '110px' : '90px', backgroundColor: '#f1f5f9', borderRadius: '8px', overflow: 'hidden', flexShrink: 0 }}>
                      <img src={item.image} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <span style={{ position: 'absolute', top: '4px', left: '4px', backgroundColor: item.mode === 'Satılık' ? '#22c55e' : item.mode === 'Hizmet' ? '#3b82f6' : '#f59e0b', color: '#fff', padding: '2px 5px', borderRadius: '4px', fontSize: '9px', fontWeight: '700' }}>
                        {item.mode}
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flex: 1, minWidth: 0 }}>
                      <div>
                        <span style={{ fontSize: '10px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.category} {item.subCategory ? `> ${item.subCategory}` : ''}</span>
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
                ))
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

        {/* İLAN DETAY EKRANI */}
        {activeTab === 'detail' && selectedListing && (
          <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0', boxSizing: 'border-box', width: '100%' }}>
            <div style={{ marginBottom: '14px' }}>
              <button onClick={() => changeTab('results')} style={{ background: 'none', border: 'none', color: '#64748b', fontWeight: '600', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <ArrowLeft size={16} /> Listeye Dön
              </button>
            </div>
            <div style={{ height: '220px', borderRadius: '8px', overflow: 'hidden', marginBottom: '14px', backgroundColor: '#f1f5f9' }}>
              <img src={selectedListing.image} alt={selectedListing.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', margin: '8px 0' }}>{selectedListing.title}</h2>
            {selectedListing.amount && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', backgroundColor: '#ecfdf5', color: '#059669', padding: '4px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: '700', marginBottom: '12px', border: '1px solid #a7f3d0' }}>
                <Package size={14} /> Bilgi / Hizmet Şekli: {selectedListing.amount}
              </div>
            )}
            <div style={{ fontSize: '22px', fontWeight: '800', color: '#1b3a2b', marginBottom: '14px' }}>{selectedListing.price.toLocaleString('tr-TR')} TL</div>
            <p style={{ color: '#475569', lineHeight: '1.4', marginBottom: '16px', fontSize: '13px' }}>{selectedListing.description}</p>
            
            <div style={{ borderTop: '1px solid #edf2f7', paddingTop: '16px' }}>
              <a href={`tel:${selectedListing.phone}`} style={{ width: '100%', backgroundColor: '#1b3a2b', color: '#fff', padding: '12px', borderRadius: '8px', textAlign: 'center', fontWeight: '700', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '14px', boxSizing: 'border-box' }}>
                <Phone size={18} /> {selectedListing.phone} ({selectedListing.seller})
              </a>
            </div>
          </div>
        )}

        {/* İLAN VER EKRANI */}
        {activeTab === 'add' && (
          <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0', boxSizing: 'border-box', width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <button onClick={() => changeTab('home')} style={{ background: 'none', border: 'none', color: '#64748b', fontWeight: '600', cursor: 'pointer', fontSize: '13px' }}>← Vazgeç</button>
              <h2 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', margin: 0 }}>Yeni İlan Ver</h2>
            </div>
            <form onSubmit={handleDirectAdd} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '4px', fontSize: '12px' }}>İlan Başlığı *</label>
                <input type="text" name="title" placeholder="Örn: Zirai İlaç, Veteriner Kliniği" value={form.title} onChange={handleFormChange} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '13px' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: '600', marginBottom: '4px', fontSize: '12px' }}>Fiyat / Ücret (TL) *</label>
                  <input type="number" name="price" placeholder="450" value={form.price} onChange={handleFormChange} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '13px' }} />
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
                  <label style={{ display: 'block', fontWeight: '600', marginBottom: '4px', fontSize: '12px' }}>Alt Ürün / Hizmet</label>
                  <input type="text" name="subCategory" placeholder="Fungisit" value={form.subCategory} onChange={handleFormChange} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '13px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: '600', marginBottom: '4px', fontSize: '12px' }}>Bilgi / Miktar</label>
                  <input type="text" name="amount" placeholder="1 Litre" value={form.amount} onChange={handleFormChange} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '13px' }} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: '600', marginBottom: '4px', fontSize: '12px' }}>Satıcı / Klinik Adı *</label>
                  <input type="text" name="seller" placeholder="Bayi / Klinik Adı" value={form.seller} onChange={handleFormChange} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '13px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: '600', marginBottom: '4px', fontSize: '12px' }}>Telefon *</label>
                  <input type="text" name="phone" placeholder="0532..." value={form.phone} onChange={handleFormChange} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '13px' }} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '4px', fontSize: '12px' }}>Fotoğraf Linki (URL)</label>
                <input type="text" name="image" placeholder="https://..." value={form.image} onChange={handleFormChange} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '13px' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '4px', fontSize: '12px' }}>Açıklama</label>
                <textarea name="description" placeholder="Detaylar..." value={form.description} onChange={handleFormChange} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', height: '80px', boxSizing: 'border-box', fontSize: '13px' }} />
              </div>
              <button type="submit" style={{ backgroundColor: '#22c55e', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', fontSize: '14px' }}>
                İlanı Hemen Yayınla
              </button>
            </form>
          </div>
        )}

        {/* ADMIN PANELİ */}
        {activeTab === 'admin' && (
          <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0', boxSizing: 'border-box', width: '100%' }}>
            {!isAdminLoggedIn ? (
              <div style={{ maxWidth: '300px', margin: '20px auto', textAlign: 'center' }}>
                <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', marginBottom: '8px' }}>Admin Girişi</h2>
                <form onSubmit={handleAdminLogin} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <input type="password" placeholder="Admin Şifresi" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', textAlign: 'center', fontSize: '14px' }} />
                  <button type="submit" style={{ backgroundColor: '#1b3a2b', color: '#fff', border: 'none', padding: '10px', borderRadius: '6px', fontWeight: '700', cursor: 'pointer' }}>Giriş Yap</button>
                </form>
                <button type="button" onClick={handleForgotPassword} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '12px', textDecoration: 'underline', marginTop: '12px' }}>Şifremi Unuttum?</button>
                <div style={{ marginTop: '16px' }}>
                  <button onClick={() => changeTab('home')} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '12px', cursor: 'pointer' }}>← Ana Sayfaya Dön</button>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid #edf2f7', paddingBottom: '10px' }}>
                  <h2 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', margin: 0 }}>İlan Denetimi</h2>
                  <button onClick={() => changeTab('home')} style={{ backgroundColor: '#1b3a2b', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>Kategorilere Dön</button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {listings.map(item => (
                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', boxSizing: 'border-box' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <img src={item.image} alt="" style={{ width: '40px', height: '40px', borderRadius: '6px', objectFit: 'cover' }} />
                        <div>
                          <h4 style={{ margin: '0 0 2px 0', fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>{item.title}</h4>
                          <span style={{ fontSize: '11px', color: '#64748b' }}>{item.price.toLocaleString('tr-TR')} TL</span>
                        </div>
                      </div>
                      <button onClick={() => handleDeleteListing(item.id)} style={{ backgroundColor: '#fee2e2', color: '#dc2626', border: 'none', padding: '6px 8px', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', fontSize: '11px' }}>
                        Sil
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

      </main>

      <footer style={{ backgroundColor: '#1b3a2b', color: '#94a3b8', padding: '14px', textAlign: 'center', fontSize: '11px', borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: 'auto', boxSizing: 'border-box', width: '100%' }}>
        <span>© 2026 PazarTarla • Gönen / Balıkesir</span>
      </footer>

    </div>
  );
}

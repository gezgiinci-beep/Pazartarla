import React, { useState, useEffect } from 'react';
import { 
  Search, SlidersHorizontal, MapPin, Phone, MessageCircle, Plus, 
  Heart, Share2, ShieldCheck, CheckCircle2, ChevronRight, X, 
  Car, Tractor, Wrench, ArrowRight, Bell, User, Filter, AlertCircle, Trash2, Settings, Lock, Check, Mail, Globe, Copy, HelpCircle, Users, Image, Bug, Shield, Package, ArrowLeft, Menu, ArrowUpDown, LayoutList, Star 
} from 'lucide-react';

const INITIAL_LISTINGS = [
  // MAHSULLER (3 İlan)
  {
    id: 1,
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
    id: 2,
    title: 'Mis Kokulu Gönen Kavunu ve Karpuzu',
    price: 15,
    category: 'Mahsuller',
    subCategory: 'Karpuz / Kavun',
    mode: 'Satılık',
    location: 'Gönen / Balıkesir',
    city: 'Balıkesir',
    amount: '5 Ton',
    description: 'Tarladan doğrudan taze kesim kavun ve karpuz. Manavlar ve tüccarlar önceliklidir.',
    seller: 'Hüseyin Çiftçi',
    phone: '0533 111 2233',
    verified: true,
    featured: false,
    image: 'https://images.unsplash.com/photo-1587049352847-4a222e784d38?auto=format&fit=crop&q=80&w=800',
    date: 'Dün'
  },
  {
    id: 3,
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

  // CANLI HAYVANLAR (3 İlan)
  {
    id: 4,
    title: 'Damızlık Sağlıklı Koyun ve Kuzu Sürüsü',
    price: 12000,
    category: 'Canlı Hayvanlar',
    subCategory: 'Küçükbaş',
    mode: 'Satılık',
    location: 'Bandırma / Balıkesir',
    city: 'Balıkesir',
    amount: '15 Baş',
    description: 'Veteriner kontrolleri tam, aşılı ve sağlıklı damızlık koyunlar. Toplu ya da tekli görüşülür.',
    seller: 'Mehmet Aksoy',
    phone: '0542 333 4455',
    verified: true,
    featured: true,
    image: 'https://images.unsplash.com/photo-1484557077804-29774de7fc76?auto=format&fit=crop&q=80&w=800',
    date: 'Bugün'
  },
  {
    id: 5,
    title: 'Simental Cinsi Simental Düve ve İnekler',
    price: 85000,
    category: 'Canlı Hayvanlar',
    subCategory: 'Büyükbaş',
    mode: 'Satılık',
    location: 'Biga / Çanakkale',
    city: 'Çanakkale',
    amount: '3 Baş',
    description: 'Yüksek süt verimine sahip, gebe ve besili Simental düveler. Sürü yenileyecekler için kaçırılmayacak fırsat.',
    seller: 'Ali Koç',
    phone: '0532 999 8877',
    verified: true,
    featured: false,
    image: 'https://images.unsplash.com/photo-1570042225831-d98fa7577f1e?auto=format&fit=crop&q=80&w=800',
    date: 'Dün'
  },
  {
    id: 6,
    title: 'Atak-S Yumurtacı Yarka Tavuklar',
    price: 180,
    category: 'Canlı Hayvanlar',
    subCategory: 'Kanatlı',
    mode: 'Satılık',
    location: 'İnegöl / Bursa',
    city: 'Bursa',
    amount: '100 Adet',
    description: '16 haftalık, tüm aşıları eksiksiz yapılmış kılavuz yumurta dönemindeki yarkalar.',
    seller: 'Fatma Şahin',
    phone: '0555 222 3344',
    verified: true,
    featured: false,
    image: 'https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?auto=format&fit=crop&q=80&w=800',
    date: 'Bugün'
  },

  // HAYVAN YEMLERİ VE EKİPMANLARI (3 İlan)
  {
    id: 7,
    title: 'Besi ve Süt Yemi Toptan Çuval',
    price: 450,
    category: 'Hayvan Yemleri ve Ekipmanları',
    subCategory: 'Yem Çeşitleri',
    mode: 'Satılık',
    location: 'Susurluk / Balıkesir',
    city: 'Balıkesir',
    amount: '50 Çuval (50 kg)',
    description: 'Yüksek protein değerli kaliteli fabrika süt ve besi yemi. Nakliye konusunda yardımcı olunur.',
    seller: 'Murat Yemci',
    phone: '0533 444 5566',
    verified: true,
    featured: false,
    image: 'https://images.unsplash.com/photo-1516467508483-a7212febe31a?auto=format&fit=crop&q=80&w=800',
    date: 'Bugün'
  },
  {
    id: 8,
    title: 'Otomatik Büyükbaş Suluk ve Yemlik',
    price: 1250,
    category: 'Hayvan Yemleri ve Ekipmanları',
    subCategory: 'Suluk / Yemlik',
    mode: 'Satılık',
    location: 'Mustafakemalpaşa / Bursa',
    city: 'Bursa',
    amount: '5 Adet',
    description: 'Döküm, paslanmaz çelik maşalı otomatik hayvan suluğu. Ahır içi kullanım için sıfır ayarında.',
    seller: 'Cemal Aydın',
    phone: '0532 777 6655',
    verified: true,
    featured: false,
    image: 'https://images.unsplash.com/photo-1589923188900-85dae523342b?auto=format&fit=crop&q=80&w=800',
    date: 'Dün'
  },
  {
    id: 9,
    title: 'Kaliteli Sıkıştırılmış Yonca Balyası',
    price: 130,
    category: 'Hayvan Yemleri ve Ekipmanları',
    subCategory: 'Yem Çeşitleri',
    mode: 'Satılık',
    location: 'Akhisar / Manisa',
    city: 'Manisa',
    amount: '200 Balyası',
    description: 'Yağmur görmemiş, yapraklı birinci sınıf yonca balyası. Büyükbaş ve küçükbaş için ideal.',
    seller: 'Hakan Korkmaz',
    phone: '0543 888 9900',
    verified: true,
    featured: true,
    image: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&q=80&w=800',
    date: 'Bugün'
  },

  // ARICILIK & BAL (3 İlan)
  {
    id: 10,
    title: 'Meşe Ormanı Çiçek Süzme Balı (Doğal)',
    price: 400,
    category: 'Arıcılık & Bal',
    subCategory: 'Süzme Bal',
    mode: 'Satılık',
    location: 'Gönen / Balıkesir',
    city: 'Balıkesir',
    amount: '5 kg Teneke',
    description: 'Meşe ağaçlarıyla çevrili orman florasında üretilmiş, laboratuvar analizli saf, katkısız süzme çiçek balı.',
    seller: 'Can İnce',
    phone: '0535 768 1550',
    verified: true,
    featured: true,
    image: 'https://images.unsplash.com/photo-1587049352847-4a222e784d38?auto=format&fit=crop&q=80&w=800',
    date: 'Bugün'
  },
  {
    id: 11,
    title: 'Karakovan Doğal Petek Bal',
    price: 600,
    category: 'Arıcılık & Bal',
    subCategory: 'Karakovan Balı',
    mode: 'Satılık',
    location: 'Artvin / Merkez',
    city: 'Artvin',
    amount: '2 kg',
    description: 'Tamamen kara kovan içinde arının kendi ördüğü mumla yaptığı eşsiz lezzette karakovan balı.',
    seller: 'Kenan Balcı',
    phone: '0532 111 4455',
    verified: true,
    featured: false,
    image: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&q=80&w=800',
    date: 'Dün'
  },
  {
    id: 12,
    title: 'Propolis ve Çam Balı Karışımı',
    price: 350,
    category: 'Arıcılık & Bal',
    subCategory: 'Süzme Bal',
    mode: 'Satılık',
    location: 'Marmaris / Muğla',
    city: 'Muğla',
    amount: '1 kg Kavanoz',
    description: 'Muğla çam balı ile zenginleştirilmiş saf sıvı propolis karışımı. Bağışıklık güçlendirici.',
    seller: 'Süleyman Çam',
    phone: '0544 222 3311',
    verified: true,
    featured: false,
    image: 'https://images.unsplash.com/photo-1559181567-c3190ca9959b?auto=format&fit=crop&q=80&w=800',
    date: 'Bugün'
  },

  // ARICILIK EKİPMANLARI (3 İlan)
  {
    id: 13,
    title: '10 Çerçeveli Boyalı Langstroth Arı Kovanı',
    price: 950,
    category: 'Arıcılık Ekipmanları',
    subCategory: 'Kovan',
    mode: 'Satılık',
    location: 'Gönen / Balıkesir',
    city: 'Balıkesir',
    amount: '10 Adet',
    description: 'Fırınlanmış çam ağacından imal edilmiş, tabanı polen tuzaklı ve boyalı sıfır arı kovanı.',
    seller: 'Can İnce',
    phone: '0535 768 1550',
    verified: true,
    featured: false,
    image: 'https://images.unsplash.com/photo-1592417817098-8f3d69204052?auto=format&fit=crop&q=80&w=800',
    date: 'Bugün'
  },
  {
    id: 14,
    title: 'Paslanmaz Çelik 4 Çerçeveli Bal Süzme Makinesi',
    price: 4500,
    category: 'Arıcılık Ekipmanları',
    subCategory: 'Bal Süzme Makinesi',
    mode: 'Satılık',
    location: 'Bursa / Osmangazi',
    city: 'Bursa',
    amount: '1 Adet',
    description: 'Gıda sınıfı paslanmaz çelikten üretilmiş el çevirmeli musluklu bal süzgeci.',
    seller: 'Orhan Arıcı',
    phone: '0533 666 7788',
    verified: true,
    featured: true,
    image: 'https://images.unsplash.com/photo-1589923188900-85dae523342b?auto=format&fit=crop&q=80&w=800',
    date: 'Dün'
  },
  {
    id: 15,
    title: 'Kabartılmış Petek ve Tel Çerçeve Paketi',
    price: 45,
    category: 'Arıcılık Ekipmanları',
    subCategory: 'Petek ve Çerçeve',
    mode: 'Satılık',
    location: 'Balıkesir / Merkez',
    city: 'Balıkesir',
    amount: '50 Adet',
    description: 'Tellenmiş ve kaliteli petek mum çakılmış hazır arı çerçeveleri.',
    seller: 'İsmail Çerçeveci',
    phone: '0541 333 2211',
    verified: true,
    featured: false,
    image: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&q=80&w=800',
    date: 'Bugün'
  },

  // TRAKTÖR (3 İlan)
  {
    id: 16,
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
  },
  {
    id: 17,
    title: 'New Holland T5.115 Başakşehir Sahibinden',
    price: 1850000,
    category: 'Traktör',
    subCategory: 'İkinci El Traktör',
    mode: 'Satılık',
    location: 'Karesi / Balıkesir',
    city: 'Balıkesir',
    amount: '2100 Saat / 115 HP',
    description: 'Klima, 4x4, hidrolik kepçe uyumlu temiz kullanılmış traktör.',
    seller: 'Necmi Çiftçi',
    phone: '0532 333 2211',
    verified: true,
    featured: false,
    image: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&q=80&w=800',
    date: 'Dün'
  },
  {
    id: 18,
    title: 'Massey Ferguson 3065 4x4 Kabinli',
    price: 950000,
    category: 'Traktör',
    subCategory: 'İkinci El Traktör',
    mode: 'Satılık',
    location: 'Keşan / Edirne',
    city: 'Edirne',
    amount: '3800 Saat / 65 HP',
    description: 'Lastikleri yeni değişti, motoru saat gibi. Vizeli ve ruhsatlı.',
    seller: 'Rıza Güler',
    phone: '0542 555 4433',
    verified: true,
    featured: false,
    image: 'https://images.unsplash.com/photo-1592417817098-8f3d69204052?auto=format&fit=crop&q=80&w=800',
    date: 'Bugün'
  },

  // BİÇERDÖVER (3 İlan)
  {
    id: 19,
    title: 'Claas Lexion 670 Sahibinden Temiz Biçerdöver',
    price: 4500000,
    category: 'Biçerdöver',
    subCategory: 'Biçerdöver',
    mode: 'Satılık',
    location: 'Polatlı / Ankara',
    city: 'Ankara',
    amount: '3500 Motor Saati',
    description: 'Buğday ve mısır tablası dahil, bakımları eksiksiz sezona hazırdır.',
    seller: 'Şakir Biçer',
    phone: '0533 999 1122',
    verified: true,
    featured: true,
    image: 'https://images.unsplash.com/photo-1516467508483-a7212febe31a?auto=format&fit=crop&q=80&w=800',
    date: 'Bugün'
  },
  {
    id: 20,
    title: 'New Holland TC 5070 Biçerdöver',
    price: 3200000,
    category: 'Biçerdöver',
    subCategory: 'Biçerdöver',
    mode: 'Satılık',
    location: 'Hayrabolu / Tekirdağ',
    city: 'Tekirdağ',
    amount: '4200 Saat',
    description: 'Klimalı kabin, sarı bıçak tabla, yürüyüş ve batör aksamı kusursuz.',
    seller: 'Ertuğrul Bey',
    phone: '0532 888 7766',
    verified: true,
    featured: false,
    image: 'https://images.unsplash.com/photo-1589923188900-85dae523342b?auto=format&fit=crop&q=80&w=800',
    date: 'Dün'
  },
  {
    id: 21,
    title: 'John Deere W540 HillMaster',
    price: 5100000,
    category: 'Biçerdöver',
    subCategory: 'Biçerdöver',
    mode: 'Satılık',
    location: 'Adana / Yüreğir',
    city: 'Adana',
    amount: '2800 Saat',
    description: 'Eğim dengeleme sistemli, çeltik ve mısır kitli tam donanımlı biçerdöver.',
    seller: 'Halil Akman',
    phone: '0544 123 4567',
    verified: true,
    featured: true,
    image: 'https://images.unsplash.com/photo-1559181567-c3190ca9959b?auto=format&fit=crop&q=80&w=800',
    date: 'Bugün'
  },

  // TARIM EKİPMANLARI (3 İlan)
  {
    id: 22,
    title: '4 Lü 12 İnç Unlu Pulluk',
    price: 45000,
    category: 'Tarım Ekipmanları',
    subCategory: 'Toprak İşleme',
    mode: 'Satılık',
    location: 'Bandırma / Balıkesir',
    city: 'Balıkesir',
    amount: '1 Adet',
    description: 'Hiçbir kırığı kaynağı yoktur, kulaklar orijinal durumdadır.',
    seller: 'Hüseyin Demirci',
    phone: '0535 444 3322',
    verified: true,
    featured: false,
    image: 'https://images.unsplash.com/photo-1528821151447-11f211b5e5a7?auto=format&fit=crop&q=80&w=800',
    date: 'Bugün'
  },
  {
    id: 23,
    title: '6 Tonluk Hafif Tip DAMPERLİ Römork',
    price: 165000,
    category: 'Tarım Ekipmanları',
    subCategory: 'Römork',
    mode: 'Satılık',
    location: 'Gönen / Balıkesir',
    city: 'Balıkesir',
    amount: '1 Adet',
    description: 'Çift dingil, hidrolik frenli, ilaveli tarım römorku.',
    seller: 'Mehmet Römorkçu',
    phone: '0532 777 8899',
    verified: true,
    featured: true,
    image: 'https://images.unsplash.com/photo-1592417817098-8f3d69204052?auto=format&fit=crop&q=80&w=800',
    date: 'Dün'
  },
  {
    id: 24,
    title: '600 Litre Turbo İlaçlama Pompası',
    price: 38000,
    category: 'Tarım Ekipmanları',
    subCategory: 'İlaçlama Makinesi',
    mode: 'Satılık',
    location: 'İznik / Bursa',
    city: 'Bursa',
    amount: '1 Adet',
    description: 'Meyve bahçeleri için fanlı turbo kollu ilaçlama makinesi, membranlı pompa.',
    seller: 'Tarık Bahçeci',
    phone: '0543 999 0011',
    verified: true,
    featured: false,
    image: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&q=80&w=800',
    date: 'Bugün'
  },

  // TARIM İŞÇİLERİ (3 İlan)
  {
    id: 25,
    title: 'Ceviz ve Meyve Hasat Toplama Ekibi',
    price: 1200,
    category: 'Tarım İşçileri',
    subCategory: 'Hasat Ekibi',
    mode: 'Hizmet',
    location: 'Balıkesir / Bursa Bölgesi',
    city: 'Balıkesir',
    amount: '10 Kişilik Ekip (Günlük yevmiye)',
    description: 'Profesyonel ceviz, zeytin ve meyve hasat ekibi. Sırık, çırpma ve toplama makinalarıyla hizmet verilir.',
    seller: 'Dayıbaşı Hasan',
    phone: '0535 123 9876',
    verified: true,
    featured: true,
    image: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&q=80&w=800',
    date: 'Bugün'
  },
  {
    id: 26,
    title: 'Tecrübeli Ceviz ve Meyve Ağacı Budama Ekibi',
    price: 1500,
    category: 'Tarım İşçileri',
    subCategory: 'Budama Ekibi',
    mode: 'Hizmet',
    location: 'Marmara Bölgesi',
    city: 'Bursa',
    amount: 'Günlük Kişi Başı',
    description: 'Chandler ceviz ve zeytin ağaçlarında form budaması ve aşılama yapan uzman ziraat ekibi.',
    seller: 'Ziraatçi Ali',
    phone: '0532 444 1122',
    verified: true,
    featured: false,
    image: 'https://images.unsplash.com/photo-1587049352847-4a222e784d38?auto=format&fit=crop&q=80&w=800',
    date: 'Dün'
  },
  {
    id: 27,
    title: 'Deneyimli Büyükbaş / Küçükbaş Çoban',
    price: 35000,
    category: 'Tarım İşçileri',
    subCategory: 'Çoban / Bakıcı',
    mode: 'Hizmet',
    location: 'Balıkesir / Gönen',
    city: 'Balıkesir',
    amount: 'Aylık Maaş + İcazet',
    description: 'Yatılı kalacak yeri olan, küçükbaş sürü yönetiminde tecrübeli güvenilir çoban arıyoruz.',
    seller: 'Çiftlik Sahibi Ahmet',
    phone: '0543 777 1100',
    verified: true,
    featured: false,
    image: 'https://images.unsplash.com/photo-1484557077804-29774de7fc76?auto=format&fit=crop&q=80&w=800',
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
    location: 'Türkiye Geneli',
    city: 'Balıkesir',
    amount: '',
    description: '',
    seller: '',
    phone: '',
    image: ''
  });

  useEffect(() => {
    localStorage.setItem('pazartarla_listings', JSON.stringify(INITIAL_LISTINGS));
    setListings(INITIAL_LISTINGS);
  }, []);

  const saveListings = (newListings) => {
    setListings(newListings);
    localStorage.setItem('pazartarla_listings', JSON.stringify(newListings));
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
    setActiveTab('home');
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
    'Mahsuller': ['Kiraz', 'Karpuz / Kavun', 'Ceviz', 'Zeytin & Zeytinyağı', 'Buğday / Arpa', 'Diğer Mahsul'],
    'Canlı Hayvanlar': ['Büyükbaş', 'Küçükbaş', 'Kanatlı'],
    'Hayvan Yemleri ve Ekipmanları': ['Yem Çeşitleri', 'Suluk / Yemlik'],
    'Arıcılık & Bal': ['Süzme Bal', 'Karakovan Balı', 'Petek Bal'],
    'Arıcılık Ekipmanları': ['Kovan', 'Petek ve Çerçeve', 'Bal Süzme Makinesi'],
    'Traktör': ['İkinci El Traktör', 'Sıfır Traktör'],
    'Biçerdöver': ['Biçerdöver'],
    'Tarım Ekipmanları': ['Römork', 'İlaçlama Makinesi', 'Toprak İşleme'],
    'Tarım İşçileri': ['Hasat Ekibi', 'Budama Ekibi', 'Çoban / Bakıcı']
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }} onClick={() => { setActiveTab('home'); setSelectedCategory('Tüm kategoriler'); setSelectedSubCategory('Tümü'); }}>
          <div style={{ backgroundColor: '#22c55e', padding: '6px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Tractor size={20} color="#fff" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '18px', fontWeight: '800', letterSpacing: '-0.5px' }}>PazarTarla</h1>
            <span style={{ fontSize: '10px', color: '#86efac', display: 'block' }}>Türkiye Geneli Tarım Pazaryeri</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button 
            onClick={() => setActiveTab('add')}
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
              <span style={{ fontSize: '16px', fontWeight: '700' }}>Kategori Seçimi (Türkiye Geneli)</span>
            </div>

            <div 
              onClick={() => { setSelectedCategory('Tüm kategoriler'); setSelectedSubCategory('Tümü'); setActiveTab('results'); }}
              style={{ padding: '14px 16px', borderBottom: '1px solid #edf2f7', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', backgroundColor: '#f8fafc' }}
            >
              <span style={{ fontWeight: '700', color: '#1b3a2b', fontSize: '15px' }}>Tüm Türkiye Tarım İlanları</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#22c55e', fontWeight: '700', fontSize: '14px' }}>
                <span>({listings.length})</span>
                <ChevronRight size={18} />
              </div>
            </div>

            {Object.keys(categoriesWithSubs).map(cat => (
              <div key={cat}>
                <div 
                  onClick={() => { setSelectedCategory(cat); setSelectedSubCategory('Tümü'); setActiveTab('results'); }}
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
                      onClick={(e) => { e.stopPropagation(); setSelectedCategory(cat); setSelectedSubCategory(sub); setActiveTab('results'); }}
                      style={{ padding: '10px 16px 10px 28px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                    >
                      <span style={{ fontSize: '13px', color: '#64748b' }}>• {sub}</span>
                      <ChevronRight size={14} color="#cbd5e1" />
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div style={{ padding: '16px', textAlign: 'center', backgroundColor: '#f8fafc' }}>
              <button onClick={() => setActiveTab('admin')} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '12px', cursor: 'pointer', textDecoration: 'underline' }}>
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
                onClick={() => setActiveTab('home')} 
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
                  Bu kategoride ilan bulunmuyor.
                </div>
              ) : (
                filteredListings.map(item => (
                  <div 
                    key={item.id} 
                    onClick={() => { setSelectedListing(item); setActiveTab('detail'); }}
                    style={{ backgroundColor: '#fff', borderRadius: '10px', overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', cursor: 'pointer', display: 'flex', gap: '10px', padding: '10px', boxSizing: 'border-box', width: '100%' }}
                  >
                    <div style={{ position: 'relative', width: viewMode === 'Detaylı Liste' ? '110px' : '90px', height: viewMode === 'Detaylı Liste' ? '110px' : '90px', backgroundColor: '#f1f5f9', borderRadius: '8px', overflow: 'hidden', flexShrink: 0 }}>
                      <img src={item.image} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <span style={{ position: 'absolute', top: '4px', left: '4px', backgroundColor: item.mode === 'Satılık' ? '#22c55e' : '#f59e0b', color: '#fff', padding: '2px 5px', borderRadius: '4px', fontSize: '9px', fontWeight: '700' }}>
                        {item.mode}
                      </span>
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

            {/* GÖRÜNÜM TERCİHİ MODALI */}
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
              <button onClick={() => setActiveTab('results')} style={{ background: 'none', border: 'none', color: '#64748b', fontWeight: '600', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <ArrowLeft size={16} /> Listeye Dön
              </button>
            </div>
            <div style={{ height: '220px', borderRadius: '8px', overflow: 'hidden', marginBottom: '14px', backgroundColor: '#f1f5f9' }}>
              <img src={selectedListing.image} alt={selectedListing.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', margin: '8px 0' }}>{selectedListing.title}</h2>
            {selectedListing.amount && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', backgroundColor: '#ecfdf5', color: '#059669', padding: '4px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: '700', marginBottom: '12px', border: '1px solid #a7f3d0' }}>
                <Package size={14} /> Miktar / Kapasite: {selectedListing.amount}
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
              <button onClick={() => setActiveTab('home')} style={{ background: 'none', border: 'none', color: '#64748b', fontWeight: '600', cursor: 'pointer', fontSize: '13px' }}>← Vazgeç</button>
              <h2 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', margin: 0 }}>Yeni İlan Ver</h2>
            </div>
            <form onSubmit={handleDirectAdd} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '4px', fontSize: '12px' }}>İlan Başlığı *</label>
                <input type="text" name="title" placeholder="Örn: Kiraz, Zeytinyağı, Traktör" value={form.title} onChange={handleFormChange} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '13px' }} />
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
                  <label style={{ display: 'block', fontWeight: '600', marginBottom: '4px', fontSize: '12px' }}>Alt Ürün</label>
                  <input type="text" name="subCategory" placeholder="Kiraz, Ceviz" value={form.subCategory} onChange={handleFormChange} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '13px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: '600', marginBottom: '4px', fontSize: '12px' }}>Miktar / Kapasite</label>
                  <input type="text" name="amount" placeholder="5 Ton" value={form.amount} onChange={handleFormChange} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '13px' }} />
                </div>
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
                  <button type="submit" style={{ backgroundColor: '#1b3a2b', color: '#fff', border: 'none', padding: '10px', borderRadius: '6px', fontWeight: '700', cursor: 'pointer' }}>Giriş Yap</phone>
                </form>
                <button type="button" onClick={handleForgotPassword} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '12px', textDecoration: 'underline', marginTop: '12px' }}>Şifremi Unuttum?</button>
                <div style={{ marginTop: '16px' }}>
                  <button onClick={() => setActiveTab('home')} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '12px', cursor: 'pointer' }}>← Ana Sayfaya Dön</button>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid #edf2f7', paddingBottom: '10px' }}>
                  <h2 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', margin: 0 }}>İlan Denetimi</h2>
                  <button onClick={() => setActiveTab('home')} style={{ backgroundColor: '#1b3a2b', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>Kategorilere Dön</button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {listings.map(item => (
                    <div key={id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', boxSizing: 'border-box' }}>
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
        <span>© 2026 PazarTarla • Türkiye Geneli Tarım ve Hayvancılık Pazaryeri</span>
      </footer>

    </div>
  );
}

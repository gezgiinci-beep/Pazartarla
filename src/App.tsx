import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, SlidersHorizontal, MapPin, Phone, MessageCircle, Plus, 
  Heart, Share2, ShieldCheck, CheckCircle2, ChevronRight, ChevronDown, X, 
  Car, Tractor, Wrench, ArrowRight, Bell, User, Filter, AlertCircle, Trash2, Settings, Lock, Check, Mail, Globe, Copy, HelpCircle, Users, Image as ImageIcon, Bug, Shield, Package, ArrowLeft, Menu, ArrowUpDown, LayoutList, Star, Send, ShieldAlert, FolderPlus, Tag, Edit3, Sparkles, Megaphone, CheckCircle, Bot 
} from 'lucide-react';

const DEFAULT_START_LISTINGS = [
  // --- MAHSULLER (7 Adet) ---
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
    title: 'Organik Gemlik Tipi Zeytin ve Soğuk Sıkım Zeytinyağı',
    price: 220,
    category: 'Mahsuller',
    subCategory: 'Zeytin & Zeytinyağı',
    mode: 'Satılık',
    location: 'Edremit / Balıkesir',
    amount: '100 Litre',
    description: 'Edremit körfezinden asit oranı düşük, soğuk sıkım dizem zeytinyağı.',
    seller: 'Körfez Tarım',
    phone: '0532 111 2233',
    image: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&q=80&w=800',
    seoTags: 'edremit zeytinyağı, organik zeytin, soğuk sıkım',
    status: 'approved',
    isFeatured: false
  },
  {
    id: 3,
    title: 'Satışlık Sertifikalı Yerli Buğday Tohumu',
    price: 18,
    category: 'Mahsuller',
    subCategory: 'Buğday',
    mode: 'Satılık',
    location: 'Konya / Karatay',
    amount: '10 Ton',
    description: 'Yüksek verimli, hastalıklara dayanıklı certified makarnalık buğday tohumu.',
    seller: 'Ova Tohumculuk',
    phone: '0533 222 3344',
    image: 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&q=80&w=800',
    seoTags: 'buğday tohumu, konya tarım, tohumluk buğday',
    status: 'approved',
    isFeatured: false
  },
  {
    id: 4,
    title: 'Taze Dalından Salihli Napolyon Kirazı',
    price: 75,
    category: 'Mahsuller',
    subCategory: 'Kiraz',
    mode: 'Satılık',
    location: 'Salihli / Manisa',
    amount: '500 Kg',
    description: 'İri taneli, ihracat kalitesinde taze Napolyon kiraz.',
    seller: 'Manisa Meyvecilik',
    phone: '0534 333 4455',
    image: 'https://images.unsplash.com/photo-1528825871115-3581a5387919?auto=format&fit=crop&q=80&w=800',
    seoTags: 'salihli kirazı, napolyon kiraz, taze meyve',
    status: 'approved',
    isFeatured: false
  },
  {
    id: 5,
    title: 'Doğal Yayla Kuru Fasulyesi (Dermason)',
    price: 90,
    category: 'Mahsuller',
    subCategory: 'Bakliyat',
    mode: 'Satılık',
    location: 'Niğde / Merkez',
    amount: '200 Kg',
    description: 'Aşım yapmayan, çabuk pişen organik niğde dermason fasulyesi.',
    seller: 'Niğde Organik',
    phone: '0535 444 5566',
    image: 'https://images.unsplash.com/photo-1551462147-37885acc36f1?auto=format&fit=crop&q=80&w=800',
    seoTags: 'dermason fasulye, kuru bakliyat, doğal ürün',
    status: 'approved',
    isFeatured: false
  },
  {
    id: 6,
    title: 'Organik Çanakkale Domatesi ve Salçalık Biber',
    price: 25,
    category: 'Mahsuller',
    subCategory: 'Meyve & Sebze',
    mode: 'Satılık',
    location: 'Çanakkale / Biga',
    amount: '2 Ton',
    description: 'Tarla üretimi lezzetli Biga domatesi ve kırmızı kapya biber.',
    seller: 'Biga Çiftliği',
    phone: '0536 555 6677',
    image: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&q=80&w=800',
    seoTags: 'çanakkale domatesi, salçalık biber, taze sebze',
    status: 'approved',
    isFeatured: false
  },
  {
    id: 7,
    title: 'Taş Kırma Balıkesir Ayvalık Erken Hasat Zeytinyağı',
    price: 280,
    category: 'Mahsuller',
    subCategory: 'Zeytin & Zeytinyağı',
    mode: 'Satılık',
    location: 'Ayvalık / Balıkesir',
    amount: '50 Litre',
    description: 'Erken hasat, filtrelenmemiş yüksek polifenollü gurme zeytinyağı.',
    seller: 'Ayvalık Zeytin Evi',
    phone: '0537 666 7788',
    image: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&q=80&w=800',
    seoTags: 'ayvalık zeytinyağı, erken hasat, gurme yağ',
    status: 'approved',
    isFeatured: false
  },

  // --- ARICILIK (2 Adet) ---
  {
    id: 8,
    title: 'Organik Çiçek Balı ve Polen Seti (Yayla Ürünü)',
    price: 450,
    category: 'Arıcılık',
    subCategory: 'Bal',
    mode: 'Satılık',
    location: 'Muğla / Fethiye',
    amount: '2 Kilo',
    description: 'Çam ve çiçek nektarından üretilmiş, laboratuvar analizli saf arı balı.',
    seller: 'Ahmet Arıcı',
    phone: '0534 777 2211',
    image: 'https://images.unsplash.com/photo-1587049352847-4a222e784d38?auto=format&fit=crop&q=80&w=800',
    seoTags: 'organik bal, muğla balı, arıcılık',
    status: 'approved',
    isFeatured: false
  },
  {
    id: 9,
    title: 'Saf Çam Balı ve Taze Arı Sütü Seti',
    price: 520,
    category: 'Arıcılık',
    subCategory: 'Arı Sütü',
    mode: 'Satılık',
    location: 'Marmaris / Muğla',
    amount: '1 Set',
    description: 'Marmaris ormanlarından ham çam balı ve taze kovan arı sütü.',
    seller: 'Ege Arıcılık',
    phone: '0538 888 9900',
    image: 'https://images.unsplash.com/photo-1587049352847-4a222e784d38?auto=format&fit=crop&q=80&w=800',
    seoTags: 'çam balı, arı sütü, marmaris balı',
    status: 'approved',
    isFeatured: false
  },

  // --- TRAKTÖR (14 Adet) ---
  {
    id: 10,
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
  },
  {
    id: 11,
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
  },
  {
    id: 12,
    title: 'Massey Ferguson 240S Klasik Efsane Traktör',
    price: 380000,
    category: 'Traktör',
    subCategory: 'İkinci El Traktör',
    mode: 'Satılık',
    location: 'Manisa / Akhisar',
    amount: '50 HP',
    description: 'Orijinal kırmızı gövde, motor ve şanzıman kusursuz.',
    seller: 'Akhisar Galeri',
    phone: '0539 111 0022',
    image: 'https://images.unsplash.com/photo-1592841202223-ca33cfd81b6f?auto=format&fit=crop&q=80&w=800',
    seoTags: 'massey ferguson, 240s, efsane traktör',
    status: 'approved',
    isFeatured: false
  },
  {
    id: 13,
    title: 'Tümosan 8095 4WD Klimalı Kabinli Traktör',
    price: 1100000,
    category: 'Traktör',
    subCategory: 'İkinci El Traktör',
    mode: 'Satılık',
    location: 'Konya / Ereğli',
    amount: '95 HP',
    description: 'Çift çeker, orijinal kabinli ve klimalı güçlü yerli traktör.',
    seller: 'Ereğli Tarım',
    phone: '0540 222 1133',
    image: 'https://images.unsplash.com/photo-1592841202223-ca33cfd81b6f?auto=format&fit=crop&q=80&w=800',
    seoTags: 'tümosan, 8095, konya traktör',
    status: 'approved',
    isFeatured: false
  },
  {
    id: 14,
    title: 'Hattat T4110 Bahçe ve Tarla Traktörü',
    price: 980000,
    category: 'Traktör',
    subCategory: 'İkinci El Traktör',
    mode: 'Satılık',
    location: 'Bursa / İnegöl',
    amount: '110 HP',
    description: 'Perkins motorlu, düşük çalışma saatli masrafsız traktör.',
    seller: 'İnegöl Otomotiv',
    phone: '0541 333 2244',
    image: 'https://images.unsplash.com/photo-1592841202223-ca33cfd81b6f?auto=format&fit=crop&q=80&w=800',
    seoTags: 'hattat traktör, perkins motor, bursa tarım',
    status: 'approved',
    isFeatured: false
  },
  {
    id: 15,
    title: 'Case IH JX75C Çift Çeker Traktör',
    price: 1180000,
    category: 'Traktör',
    subCategory: 'İkinci El Traktör',
    mode: 'Satılık',
    location: 'Adana / Ceyhan',
    amount: '75 HP',
    description: 'Ceyhan ovasında az kullanılmış, bakımları eksiksiz Case IH.',
    seller: 'Ceyhan Tarım Galeri',
    phone: '0542 444 3355',
    image: 'https://images.unsplash.com/photo-1592841202223-ca33cfd81b6f?auto=format&fit=crop&q=80&w=800',
    seoTags: 'case ih, jx75c, adana traktör',
    status: 'approved',
    isFeatured: false
  },
  {
    id: 16,
    title: 'Erkunt Servet 80.4 Lüks Kabinli Traktör',
    price: 920000,
    category: 'Traktör',
    subCategory: 'İkinci El Traktör',
    mode: 'Satılık',
    location: 'Yozgat / Sorgun',
    amount: '80 HP',
    description: 'Yakıt cimrisi Perkins motor, 4WD lüks kabin.',
    seller: 'Sorgun Tarım',
    phone: '0543 555 4466',
    image: 'https://images.unsplash.com/photo-1592841202223-ca33cfd81b6f?auto=format&fit=crop&q=80&w=800',
    seoTags: 'erkunt traktör, servet 80, yozgat',
    status: 'approved',
    isFeatured: false
  },
  {
    id: 17,
    title: 'Deutz-Fahr 4080E Çift Çeker Traktör',
    price: 1320000,
    category: 'Traktör',
    subCategory: 'İkinci El Traktör',
    mode: 'Satılık',
    location: 'İzmir / Ödemiş',
    amount: '80 HP',
    description: 'Alman mühendisliği, senkronize şanzıman ve yüksek çekiş gücü.',
    seller: 'Ödemiş Ege Tarım',
    phone: '0544 666 5577',
    image: 'https://images.unsplash.com/photo-1592841202223-ca33cfd81b6f?auto=format&fit=crop&q=80&w=800',
    seoTags: 'deutz fahr, 4080e, izmir traktör',
    status: 'approved',
    isFeatured: false
  },
  {
    id: 18,
    title: 'Başak 2080 BB Bahçe Tipi Kompakt Traktör',
    price: 720000,
    category: 'Traktör',
    subCategory: 'İkinci El Traktör',
    mode: 'Satılık',
    location: 'Denizli / Çivril',
    amount: '80 HP',
    description: 'Elma ve meyve bahçeleri için alçak şasili özel seri.',
    seller: 'Çivril Meyveci',
    phone: '0545 777 6688',
    image: 'https://images.unsplash.com/photo-1592841202223-ca33cfd81b6f?auto=format&fit=crop&q=80&w=800',
    seoTags: 'başak traktör, bahçe tipi, denizli',
    status: 'approved',
    isFeatured: false
  },
  {
    id: 19,
    title: 'New Holland T4.70V Dar Bağ Bahçe Traktörü',
    price: 890000,
    category: 'Traktör',
    subCategory: 'İkinci El Traktör',
    mode: 'Satılık',
    location: 'Aydın / Sultanhisar',
    amount: '70 HP',
    description: 'Bağ ve zeytin araları için dar iz genişlikli özel üretim.',
    seller: 'Aydın Bağcılık',
    phone: '0546 888 7799',
    image: 'https://images.unsplash.com/photo-1592841202223-ca33cfd81b6f?auto=format&fit=crop&q=80&w=800',
    seoTags: 'new holland dar iz, bağ traktörü, aydın',
    status: 'approved',
    isFeatured: false
  },
  {
    id: 20,
    title: 'Solis 50 4WD Klimalı Kabinli Traktör',
    price: 650000,
    category: 'Traktör',
    subCategory: 'İkinci El Traktör',
    mode: 'Satılık',
    location: 'Samsun / Bafra',
    amount: '50 HP',
    description: 'Ekonomik fiyatlı, az çalışma saatli çift çeker tarım traktörü.',
    seller: 'Bafra Ova Galeri',
    phone: '0547 999 8800',
    image: 'https://images.unsplash.com/photo-1592841202223-ca33cfd81b6f?auto=format&fit=crop&q=80&w=800',
    seoTags: 'solis 50, bafra traktör, kabinli traktör',
    status: 'approved',
    isFeatured: false
  },
  {
    id: 21,
    title: 'Kubota M7060 Japon Teknolojisi Traktör',
    price: 1400000,
    category: 'Traktör',
    subCategory: 'İkinci El Traktör',
    mode: 'Satılık',
    location: 'Antalya / Elmalı',
    amount: '70 HP',
    description: 'Japon Kubota motor, hidrolik mekik ve yüksek manevra kabiliyeti.',
    seller: 'Elmalı Yayla Tarım',
    phone: '0548 000 1122',
    image: 'https://images.unsplash.com/photo-1592841202223-ca33cfd81b6f?auto=format&fit=crop&q=80&w=800',
    seoTags: 'kubota m7060, japon motor, antalya',
    status: 'approved',
    isFeatured: false
  },
  {
    id: 22,
    title: 'Fiat 640 Klasik Efsane Kırmızı Traktör',
    price: 310000,
    category: 'Traktör',
    subCategory: 'İkinci El Traktör',
    mode: 'Satılık',
    location: 'Edirne / Keşan',
    amount: '64 HP',
    description: 'Koleksiyonluk temizlikte, rektefiyesi yeni yapılmış Fiat 640.',
    seller: 'Keşan Tarım',
    phone: '0549 111 2233',
    image: 'https://images.unsplash.com/photo-1592841202223-ca33cfd81b6f?auto=format&fit=crop&q=80&w=800',
    seoTags: 'fiat 640, keşan traktör, efsane fiat',
    status: 'approved',
    isFeatured: false
  },
  {
    id: 23,
    title: 'Farmtrac 6075 4x4 Tarla Traktörü',
    price: 840000,
    category: 'Traktör',
    subCategory: 'İkinci El Traktör',
    mode: 'Satılık',
    location: 'Şanlıurfa / Siverek',
    amount: '75 HP',
    description: 'Geniş tarlalar için ideal, dayanıklı ve yüksek torklu.',
    seller: 'Siverek Ova Galeri',
    phone: '0550 222 3344',
    image: 'https://images.unsplash.com/photo-1592841202223-ca33cfd81b6f?auto=format&fit=crop&q=80&w=800',
    seoTags: 'farmtrac, urfa traktör, 4x4 traktör',
    status: 'approved',
    isFeatured: false
  },

  // --- TARIM EKİPMANLARI (5 Adet) ---
  {
    id: 24,
    title: '4 Dönerli Hidrolik Otomatik Pulluk',
    price: 65000,
    category: 'Tarım Ekipmanları',
    subCategory: 'Pulluk',
    mode: 'Satılık',
    location: 'Eskişehir / Sivrihisar',
    amount: '1 Adet',
    description: 'Pistonlu dönerli, ağır tip çizel ve pulluk takımı.',
    seller: 'Sivrihisar Makine',
    phone: '0551 333 4455',
    image: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&q=80&w=800',
    seoTags: 'dönerli pulluk, eskişehir tarım, hidrolik pulluk',
    status: 'approved',
    isFeatured: false
  },
  {
    id: 25,
    title: '1000 Litre Damla Sulama ve İlaçlama Makinesi',
    price: 85000,
    category: 'Tarım Ekipmanları',
    subCategory: 'İlaçlama Makinesi',
    mode: 'Satılık',
    location: 'Afyonkarahisar / Sandıklı',
    amount: '1 Adet',
    description: 'İtalyan pompalı, 12 metre hidrolik kollu holder ilaçlama.',
    seller: 'Sandıklı Ekipman',
    phone: '0552 444 5566',
    image: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&q=80&w=800',
    seoTags: 'holder ilaçlama, afyon tarım, 1000 lt tank',
    status: 'approved',
    isFeatured: false
  },
  {
    id: 26,
    title: '5 Tonluk Çift Dingilli Damperli Tarım Römorku',
    price: 1100000,
    category: 'Tarım Ekipmanları',
    subCategory: 'Römork',
    mode: 'Satılık',
    location: 'Aksaray / Merkez',
    amount: '1 Adet',
    description: 'Sıfır ayarında, dönerli ön dingil, ilaveli damperli römork.',
    seller: 'Aksaray Karoser',
    phone: '0553 555 6677',
    image: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&q=80&w=800',
    seoTags: 'damperli römork, aksaray karoser, çift dingil',
    status: 'approved',
    isFeatured: false
  },
  {
    id: 27,
    title: 'Benzinli Motorlu Rotovatör ve Toprak Çapa Makinası',
    price: 35000,
    category: 'Tarım Ekipmanları',
    subCategory: 'Çapa Makinası',
    mode: 'Satılık',
    location: 'Sakarya / Akyazı',
    amount: '1 Adet',
    description: '7 HP Kaan çapa makinesi, çapa bıçakları ve tekerlekleri dahil.',
    seller: 'Akyazı Bahçe',
    phone: '0554 666 7788',
    image: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&q=80&w=800',
    seoTags: 'çapa makinesi, rotovatör, sakarya bahçe',
    status: 'approved',
    isFeatured: false
  },
  {
    id: 28,
    title: 'Pistonlu Ot Toplama ve Balyalama Makinası',
    price: 240000,
    category: 'Tarım Ekipmanları',
    subCategory: 'Kepçe & Yükleyici',
    mode: 'Satılık',
    location: 'Kırklareli / Lüleburgaz',
    amount: '1 Adet',
    description: 'Pöttinger marka sorunsuz çalışan sap ve ot balya makinesi.',
    seller: 'Trakya Balyacılık',
    phone: '0555 777 8899',
    image: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&q=80&w=800',
    seoTags: 'balya makinesi, ot toplama, trakya tarım',
    status: 'approved',
    isFeatured: false
  },

  // --- UZMANLAR (1 Adet) ---
  {
    id: 29,
    title: 'Uzman Ziraat Mühendisinden Tarla Danışmanlığı ve Gübreleme Planı',
    price: 5000,
    category: 'Uzmanlar',
    subCategory: 'Ziraatçiler',
    mode: 'Hizmet',
    location: 'Bursa / Osmangazi',
    amount: '1 Sezon',
    description: 'Toprak analizi, damla sulama otomasyonu ve gübreleme programı hazırlığı.',
    seller: 'Dr. Ziraatçi Selim Kaya',
    phone: '0532 444 3322',
    image: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&q=80&w=800',
    seoTags: 'ziraat mühendisi, tarım danışmanlığı, toprak analizi',
    status: 'approved',
    isFeatured: false
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
      console.error("Güvenli veri okuma hatası:", e);
    }
    try {
      localStorage.setItem('pazartarla_listings', JSON.stringify(DEFAULT_START_LISTINGS));
    } catch (err) {
      console.error(err);
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
      console.error("Güvenli kategori okuma hatası:", e);
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
   
  const [poolIndex, setPoolIndex] = useState(0);

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
    if (t.includes('pulluk') || t.includes('çapa') || t.includes('ekipman') || t.includes('makina') || c.includes('ekipman')) {
      return 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&q=80&w=800';
    }
    if (t.includes('veteriner') || t.includes('danışman') || c.includes('uzman')) {
      return 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&q=80&w=800';
    }
    if (t.includes('bal') || t.includes('arı') || c.includes('arıcılık')) {
      return 'https://images.unsplash.com/photo-1587049352847-4a222e784d38?auto=format&fit=crop&q=80&w=800';
    }
    if (t.includes('meyve') || t.includes('sebze') || t.includes('ceviz') || t.includes('domates') || c.includes('mahsul')) {
      return 'https://images.unsplash.com/photo-1559181567-c3190ca9959b?auto=format&fit=crop&q=80&w=800';
    }
    return 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&q=80&w=800';
  };

  const generateAutoSEO = (title, category, subCategory, location) => {
    const cleanTitle = sanitizeInput(title.trim() ? title.trim() : 'Tarım İlanı');
    const cleanLoc = sanitizeInput(location.trim() ? location.trim() : 'Türkiye Geneli');
    return `${cleanTitle}, ${sanitizeInput(category || 'Tarım')}, ${sanitizeInput(subCategory || 'Ürün')}, ${cleanLoc} ilanları, pazar tarla, türkiye tarım pazarı`;
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => {
      const updated = { ...prev, [name]: value };
      if (name === 'category') {
        const subList = categoriesWithSubs[value] || ['Genel'];
        updated.subCategory = subList[0];
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

  const handleEditFormChange = (e) => {
    const { name, value } = e.target;
    setEditingListing(prev => {
      const updated = { ...prev, [name]: value };
      if (name === 'category') {
        const subList = categoriesWithSubs[value] || ['Genel'];
        updated.subCategory = subList[0];
      }
      updated.seoTags = generateAutoSEO(
        updated.title,
        updated.category,
        updated.subCategory,
        updated.location
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
      amount: form.category === 'Uzmanlar' ? '' : sanitizeInput(form.amount),
      seoTags: finalSeoTags,
      status: 'pending',
      isFeatured: false
    };

    const updated = [newEntry, ...listings];
    saveListings(updated);
    setLastAddedListing(newEntry);
    changeTab('success-wa');

    const defaultCat = Object.keys(categoriesWithSubs)[0] || 'Mahsuller';
    setForm({
      title: '',
      price: '',
      category: defaultCat,
      subCategory: categoriesWithSubs[defaultCat]?.[0] || 'Genel',
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
  };

  const handleAutoFetchListings = () => {
    if (!isAdminLoggedIn) return;
     
    const massivePool = [
      {
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
        seoTags: 'new holland, traktör, gönen tarım'
      },
      {
        title: 'Claas Dominator 130 Biçerdöver',
        price: 3400000,
        category: 'Biçerdöver',
        subCategory: 'Biçerdöver',
        mode: 'Satılık',
        location: 'Adana / Ceyhan',
        amount: '1 Adet',
        description: 'Hasat sezonuna tam hazırlanmış, bıçakları yeni değişti.',
        seller: 'Çukurova Tarım',
        phone: '0533 444 5566',
        seoTags: 'claas, biçerdöver, adana'
      },
      {
        title: 'Damızlık Karacabey Merinosu Koç',
        price: 22000,
        category: 'Canlı Hayvanlar',
        subCategory: 'Küçükbaş',
        mode: 'Satılık',
        location: 'Balıkesir / Gönen',
        amount: '1 Baş',
        description: 'Aşılı, 2 yaşında safkan damızlık koç.',
        seller: 'Hüseyin Çiftçi',
        phone: '0535 999 8877',
        seoTags: 'merinos, koç, gönen'
      }
    ];

    const nextItem = massivePool[poolIndex % massivePool.length];
    setPoolIndex(prev => prev + 1);

    const newEntry = {
      ...nextItem,
      id: Date.now() + Math.floor(Math.random() * 10000),
      image: getSmartAutoImage(nextItem.title, nextItem.category),
      status: 'pending',
      isFeatured: false
    };

    const updated = [newEntry, ...listings];
    saveListings(updated);
    alert(`🎉 "${newEntry.title}" başarıyla onay kuyruğuna eklendi!`);
  };

  const approveListing = (id) => {
    if (!isAdminLoggedIn) return;
    const updated = listings.map(item => item.id === id ? { ...item, status: 'approved' } : item);
    saveListings(updated);
    alert('İlan onaylandı ve canlıya alındı!');
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
    alert('İlanın vitrin durumu güncellendi!');
  };

  const startEditingFromDetail = (item) => {
    if (!isAdminLoggedIn) {
      alert('İlanı düzenlemek için önce Yönetici Paneline giriş yapmalısınız.');
      changeTab('admin-page');
      return;
    }
    setEditingListing(item);
    changeTab('admin-page');
    setTimeout(() => {
      if (editFormRef.current) {
        editFormRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
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
      seoTags: editingListing.seoTags || generateAutoSEO(editingListing.title, editingListing.category, editingListing.subCategory, editingListing.location),
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
    if (!newCategoryName.trim()) {
      alert('Lütfen kategori seçin.');
      return;
    }
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
    alert(`"${catName}" kategorisine alt seçenekler başarıyla eklendi!`);
  };

  const handleDeleteCategory = (catKey) => {
    if (!isAdminLoggedIn) return;
    if (window.confirm(`"${catKey}" kategorisini silmek istediğinize emin misiniz?`)) {
      const updatedCats = { ...categoriesWithSubs };
      delete updatedCats[catKey];
      saveCategories(updatedCats);
      alert('Kategori silindi.');
    }
  };

  const handleDeleteSubCategory = (catKey, subToDel) => {
    if (!isAdminLoggedIn) return;
    if (!subToDel) {
      alert('Lütfen silmek istediğiniz alt seçeneği seçin.');
      return;
    }
    if (window.confirm(`"${catKey}" kategorisinden "${subToDel}" seçeneğini silmek istediğinize emin misiniz?`)) {
      const currentSubs = categoriesWithSubs[catKey] || [];
      const updatedSubs = currentSubs.filter(sub => sub !== subToDel);
      if (updatedSubs.length === 0) updatedSubs.push('Genel');
      const updatedCats = { ...categoriesWithSubs, [catKey]: updatedSubs };
      saveCategories(updatedCats);
      setSelectedSubToRemove('');
      alert(`"${subToDel}" seçeneği başarıyla silindi!`);
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
      <div style={{ position: 'fixed', inset: 0, backgroundColor: '#0f172a', color: '#f8fafc', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '24px', textAlign: 'center', boxSizing: 'border-box' }}>
        <style>{`
          @keyframes fadeIn {
            from { opacity: 0; transform: scale(0.95); }
            to { opacity: 1; transform: scale(1); }
          }
          .splash-content { animation: fadeIn 1s ease-out forwards; }
        `}</style>
        <div className="splash-content" style={{ maxWidth: '500px', width: '100%', padding: '40px 20px' }}>
          <h1 style={{ fontSize: '32px', fontWeight: '700', lineHeight: '1.4', margin: 0, color: '#f8fafc', letterSpacing: '-0.5px' }}>
            Türkiye'nin İlk ve Tek <br />
            <span style={{ color: '#2add9c' }}>Tarım Platformu</span>
          </h1>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f4f6f8', color: '#1e293b', fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column', width: '100%', maxWidth: '100vw', boxSizing: 'border-box' }}>
      <header style={{ backgroundColor: '#1b3a2b', color: '#ffffff', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }} onClick={() => { changeTab('home'); setSelectedCategory('Tüm kategoriler'); }}>
          <div style={{ backgroundColor: '#22c55e', padding: '6px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '14px' }}>🌾</span>
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
          <button onClick={() => changeTab('add')} style={{ backgroundColor: '#22c55e', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: '700', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Plus size={16} /> İlan Ver
          </button>
        </div>
      </header>

      <main style={{ width: '100%', maxWidth: '600px', margin: '0 auto', padding: '12px', flex: 1, boxSizing: 'border-box' }}>
        {announcement && (
          <div style={{ backgroundColor: '#fef08a', color: '#713f12', padding: '10px 14px', borderRadius: '10px', marginBottom: '12px', fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #facc15', overflow: 'hidden', whiteSpace: 'nowrap', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
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
              <div className="marquee-text">
                {announcement}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'success-wa' && (
          <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '24px', textAlign: 'center', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
            <div style={{ backgroundColor: '#dcfce7', width: '60px', height: '60px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto' }}>
              <CheckCircle size={36} color="#166534" />
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#1b3a2b', margin: '0 0 8px 0' }}>İlanınız Başarıyla Alındı!</h2>
            <p style={{ color: '#64748b', fontSize: '13px', lineHeight: '1.5', margin: '0 0 20px 0' }}>
              İlanınız yönetici onayına gönderildi. PazarTarla Ekibi'ne WhatsApp üzerinden anında bilgi vermek için aşağıdaki butona tıklayabilirsiniz:
            </p>

            {lastAddedListing && (
              <a 
                href={`https://api.whatsapp.com/send?phone=905357681550&text=${encodeURIComponent(`🔔 *Yeni İlan Onay Bekliyor!*\n\n*Başlık:* ${lastAddedListing.title}\n*Fiyat:* ${lastAddedListing.price} TL\n*Kategori:* ${lastAddedListing.category} / ${lastAddedListing.subCategory}\n*Satıcı:* ${lastAddedListing.seller} (${lastAddedListing.phone})`)}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', backgroundColor: '#22c55e', color: '#fff', padding: '14px', borderRadius: '10px', fontWeight: '800', textDecoration: 'none', fontSize: '15px', marginBottom: '12px', boxShadow: '0 4px 12px rgba(34,197,94,0.3)' }}
              >
                <MessageCircle size={20} /> WhatsApp ile PazarTarla Ekibi'ne Bildir
              </a>
            )}

            <button 
              onClick={() => changeTab('home')}
              style={{ background: 'none', border: 'none', color: '#64748b', fontWeight: '700', fontSize: '13px', cursor: 'pointer', padding: '8px' }}
            >
              ← Ana Sayfaya Dön
            </button>
          </div>
        )}

        {activeTab === 'promote-listing' && (
          <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '24px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div style={{ backgroundColor: '#fef08a', padding: '10px', borderRadius: '10px' }}>
                <Star size={24} color="#ca8a04" fill="#ca8a04" />
              </div>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#1b3a2b', margin: 0 }}>İlanı Öne Çıkar (Vitrin Dopingi)</h2>
                <span style={{ fontSize: '12px', color: '#64748b' }}>İlanınız anasayfada en üstte ve özel rozetle gösterilsin!</span>
              </div>
            </div>

            <div style={{ backgroundColor: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '20px', fontSize: '13px', lineHeight: '1.6', color: '#334155' }}>
              <p style={{ margin: '0 0 8px 0', fontWeight: '700', color: '#1b3a2b' }}>✨ Öne Çıkan İlan Avantajları:</p>
              <ul style={{ margin: 0, paddingLeft: '18px' }}>
                <li>Anasayfanın en başında ve dikkat çekici vitrin alanında yer alır.</li>
                <li>Alıcılar tarafından çok daha hızlı görüntülenir ve satışı hızlanır.</li>
              </ul>
              <div style={{ marginTop: '12px', padding: '10px', backgroundColor: '#fefce8', borderRadius: '6px', border: '1px solid #fde047', fontWeight: '700', color: '#854d0e', textAlign: 'center' }}>
                Vitrin İlan Ücreti: 150 TL / Hafta
              </div>
            </div>

            <a 
              href={`https://api.whatsapp.com/send?phone=905357681550&text=${encodeURIComponent(`⭐ *Vitrin İlan (Öne Çıkar) Talebi*\n\nMerhaba PazarTarla Ekibi, ilanımı öne çıkarmak istiyorum.`)}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', backgroundColor: '#22c55e', color: '#fff', padding: '12px', borderRadius: '8px', fontWeight: '800', textDecoration: 'none', fontSize: '14px', marginBottom: '10px' }}
            >
              <MessageCircle size={18} /> WhatsApp ile Ödeme Bildir
            </a>

            <button 
              onClick={() => changeTab('home')}
              style={{ width: '100%', background: 'none', border: 'none', color: '#64748b', fontWeight: '700', fontSize: '13px', cursor: 'pointer', padding: '8px' }}
            >
              ← Ana Sayfaya Dön
            </button>
          </div>
        )}

        {activeTab === 'home' && (
          <div style={{ backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden', border: '1px solid #e2e8f0', width: '100%' }}>
            <div style={{ backgroundColor: '#1b3a2b', color: '#fff', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Menu size={20} />
              <span style={{ fontSize: '16px', fontWeight: '700' }}>Kategori Seçimi (Türkiye Geneli)</span>
            </div>

            <div onClick={() => { setSelectedCategory('Tüm kategoriler'); setSelectedSubCategory('Tümü'); changeTab('results'); }} style={{ padding: '14px 16px', borderBottom: '1px solid #edf2f7', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', backgroundColor: '#f8fafc' }}>
              <span style={{ fontWeight: '700', color: '#1b3a2b', fontSize: '15px' }}>Tüm Türkiye Tarım İlanları</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#22c55e', fontWeight: '700', fontSize: '14px' }}>
                <span>({approvedListings.length})</span>
                <ChevronRight size={18} />
              </div>
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
                      <div onClick={() => { setSelectedCategory(cat); setSelectedSubCategory('Tümü'); changeTab('results'); }} style={{ padding: '10px 16px 10px 28px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', backgroundColor: '#f0fdf4' }}>
                        <span style={{ fontSize: '13px', color: '#166534', fontWeight: '600' }}>→ Tüm {cat} İlanları</span>
                        <ChevronRight size={14} color="#166534" />
                      </div>
                      {(categoriesWithSubs[cat] || []).map(sub => (
                        <div key={sub} onClick={(e) => { e.stopPropagation(); setSelectedCategory(cat); setSelectedSubCategory(sub); changeTab('results'); }} style={{ padding: '10px 16px 10px 28px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                          <span style={{ fontSize: '13px', color: '#64748b' }}>• {sub}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#94a3b8', fontSize: '12px' }}>
                            <span>({approvedListings.filter(i => i.category === cat && i.subCategory === sub).length})</span>
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
          <div>
            <div style={{ backgroundColor: '#1b3a2b', color: '#fff', borderRadius: '10px', padding: '10px 14px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button onClick={() => changeTab('home')} style={{ background: 'none', border: 'none', color: '#86efac', fontWeight: '700', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <ArrowLeft size={16} /> Ana Sayfa
              </button>
              <span style={{ fontSize: '14px', fontWeight: '700' }}>Favori İlanlarım</span>
            </div>
            {favorites.length === 0 ? (
              <div style={{ backgroundColor: '#fff', padding: '40px', borderRadius: '10px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                Henüz favorilere eklediğiniz bir ilan bulunmuyor.
              </div>
            ) : (
              favorites.map(item => (
                <div key={item.id} onClick={() => { setSelectedListing(item); changeTab('detail'); }} style={{ backgroundColor: '#fff', borderRadius: '10px', overflow: 'hidden', border: '1px solid #e2e8f0', cursor: 'pointer', display: 'flex', gap: '10px', padding: '10px', marginBottom: '10px' }}>
                  <img src={item.image} alt={item.title} style={{ width: '90px', height: '90px', objectFit: 'cover', borderRadius: '8px' }} />
                  <div style={{ flex: 1 }}>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '13px', fontWeight: '700' }}>{item.title}</h4>
                    <div style={{ fontSize: '15px', fontWeight: '800', color: '#1b3a2b' }}>{item.price.toLocaleString('tr-TR')} TL</div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'results' && (
          <div>
            <div style={{ backgroundColor: '#1b3a2b', color: '#fff', borderRadius: '10px', padding: '10px 14px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button onClick={() => changeTab('home')} style={{ background: 'none', border: 'none', color: '#86efac', fontWeight: '700', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <ArrowLeft size={16} /> Kategoriler
              </button>
              <span style={{ fontSize: '13px' }}>{filteredListings.length} sonuç</span>
            </div>

            {filteredListings.map(item => (
              <div key={item.id} onClick={() => { setSelectedListing(item); changeTab('detail'); }} style={{ backgroundColor: item.isFeatured ? '#fefce8' : '#fff', borderRadius: '10px', overflow: 'hidden', border: item.isFeatured ? '2px solid #eab308' : '1px solid #e2e8f0', cursor: 'pointer', display: 'flex', gap: '10px', padding: '10px', marginBottom: '10px', position: 'relative' }}>
                {item.isFeatured && (
                  <div style={{ position: 'absolute', top: '8px', right: '8px', backgroundColor: '#eab308', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '2px' }}>
                    <Star size={10} fill="#fff" /> VİTRİN
                  </div>
                )}
                <img src={item.image} alt={item.title} style={{ width: '90px', height: '90px', objectFit: 'cover', borderRadius: '8px' }} />
                <div style={{ flex: 1 }}>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '13px', fontWeight: '700' }}>{item.title}</h4>
                  <div style={{ fontSize: '15px', fontWeight: '800', color: '#1b3a2b' }}>{item.price.toLocaleString('tr-TR')} TL</div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>📍 {item.location}</div>
                  {item.seoTags && (
                    <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px', background: '#f8fafc', padding: '2px 6px', borderRadius: '4px', display: 'inline-block' }}>
                      🏷️ {item.seoTags}
                    </div>
                  )}
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
             
            <div style={{ backgroundColor: '#fef9c3', border: '1px solid #facc15', borderRadius: '8px', padding: '12px', marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#854d0e', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Star size={14} color="#ca8a04" fill="#ca8a04" /> Bu İlanı Vitrine Taşıyın
                </span>
                <span style={{ fontSize: '11px', color: '#a16207' }}>Daha hızlı satış için öne çıkarın.</span>
              </div>
              <button 
                onClick={() => changeTab('promote-listing')} 
                style={{ backgroundColor: '#ca8a04', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '6px', fontWeight: '700', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                ⭐ Öne Çıkar
              </button>
            </div>

            <img src={selectedListing.image} alt={selectedListing.title} style={{ width: '100%', height: '220px', objectFit: 'cover', borderRadius: '8px', marginBottom: '10px' }} />
            <h2 style={{ fontSize: '18px', fontWeight: '800', margin: '8px 0' }}>{selectedListing.title}</h2>
            <div style={{ fontSize: '22px', fontWeight: '800', color: '#1b3a2b', marginBottom: '4px' }}>{selectedListing.price.toLocaleString('tr-TR')} TL</div>
            <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '10px' }}>📍 Konum: {selectedListing.location}</div>
            <p style={{ color: '#475569', fontSize: '13px', marginBottom: '16px' }}>{selectedListing.description}</p>
             
            {selectedListing.seoTags && (
              <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px', marginBottom: '16px', fontSize: '11px', color: '#475569' }}>
                <span style={{ fontWeight: '700', display: 'block', marginBottom: '3px', color: '#1b3a2b' }}>🔍 SEO Anahtar Kelimeler & Etiketler:</span>
                <span>{selectedListing.seoTags}</span>
              </div>
            )}

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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: '600', marginBottom: '4px', fontSize: '12px' }}>Adınız Soyadınız *</label>
                  <input type="text" name="seller" placeholder="Örn: Ahmet Yılmaz" value={form.seller} onChange={handleFormChange} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: '600', marginBottom: '4px', fontSize: '12px' }}>Telefon Numaranız *</label>
                  <input type="text" name="phone" placeholder="0532..." value={form.phone} onChange={handleFormChange} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '4px', fontSize: '12px' }}>İlan Başlığı *</label>
                <input type="text" name="title" placeholder="Örn: John Deere Traktör" value={form.title} onChange={handleFormChange} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: '600', marginBottom: '4px', fontSize: '12px' }}>Fiyat (TL) *</label>
                  <input type="number" name="price" placeholder="150000" value={form.price} onChange={handleFormChange} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: '600', marginBottom: '4px', fontSize: '12px' }}>Ana Kategori</label>
                  <select name="category" value={form.category} onChange={handleFormChange} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#fff' }}>
                    {Object.keys(categoriesWithSubs).map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '4px', fontSize: '12px' }}>Alt Ürün / Seçenek</label>
                <select 
                  name="subCategory" 
                  value={form.subCategory} 
                  onChange={handleFormChange} 
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #22c55e', backgroundColor: '#f0fdf4', fontWeight: '600', color: '#166534' }}
                >
                  <option value="">📌 Seçenekleri görmek için tıklayın...</option>
                  {(categoriesWithSubs[form.category] || ['Genel']).map(sub => (
                    <option key={sub} value={sub}>{sub}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '4px', fontSize: '12px' }}>Konum (Şehir / İlçe)</label>
                <input type="text" name="location" placeholder="Örn: Balıkesir / Gönen" value={form.location} onChange={handleFormChange} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '4px', fontSize: '12px' }}>Fotoğraf Yükle (Dosya Seç) veya Link Yapıştır</label>
                <input type="file" accept="image/*" onChange={handleImageUpload} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', marginBottom: '6px' }} />
                <input type="text" name="image" placeholder="Veya resim linki (URL)..." value={form.image} onChange={handleFormChange} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '12px' }} />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '4px', fontSize: '12px' }}>Açıklama</label>
                <textarea name="description" placeholder="Detaylar..." value={form.description} onChange={handleFormChange} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', height: '80px', boxSizing: 'border-box' }} />
              </div>

              <button type="submit" style={{ backgroundColor: '#22c55e', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', fontSize: '14px' }}>
                İlanı Gönder (Yönetici Onayına Sun)
              </button>
            </form>
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #edf2f7', paddingBottom: '10px' }}>
                  <h2 style={{ fontSize: '16px', fontWeight: '800', margin: 0 }}>🛡️ Güvenli Yönetim Paneli</h2>
                  <button onClick={() => setIsAdminLoggedIn(false)} style={{ backgroundColor: '#fee2e2', color: '#dc2626', border: 'none', padding: '6px 10px', borderRadius: '6px', fontWeight: '700', cursor: 'pointer' }}>Çıkış</button>
                </div>

                <div style={{ backgroundColor: '#ecfdf5', padding: '14px', borderRadius: '8px', border: '1px solid #a7f3d0', marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#065f46', margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Bot size={18} color="#059669" /> Akıllı Otomatik İlan Çek
                  </h3>
                  <button 
                    type="button" 
                    onClick={handleAutoFetchListings}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', backgroundColor: '#059669', color: '#fff', padding: '10px 14px', borderRadius: '6px', fontWeight: '700', fontSize: '13px', cursor: 'pointer', width: '100%', border: 'none' }}
                  >
                    <Bot size={16} /> Otomatik İlanları Çek ve Ekle
                  </button>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#d97706', margin: 0 }}>⏳ Onay Bekleyen İlanlar ({listings.filter(i => i.status === 'pending').length})</h3>
                  {listings.filter(i => i.status === 'pending').length > 0 && (
                    <button onClick={approveAllListings} style={{ backgroundColor: '#22c55e', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>
                      ✓ Tümünü Onayla
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                  {listings.filter(i => i.status === 'pending').length === 0 ? (
                    <div style={{ fontSize: '12px', color: '#64748b', padding: '8px', backgroundColor: '#f8fafc', borderRadius: '6px' }}>Onay bekleyen yeni ilan bulunmuyor.</div>
                  ) : (
                    listings.filter(i => i.status === 'pending').map(item => (
                      <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', backgroundColor: '#fefce8', borderRadius: '6px', border: '1px solid #fef08a' }}>
                        <div>
                          <span style={{ fontSize: '12px', fontWeight: '700', display: 'block' }}>{item.title}</span>
                          <span style={{ fontSize: '11px', color: '#713f12' }}>{item.price} TL</span>
                        </div>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button onClick={() => approveListing(item.id)} style={{ backgroundColor: '#22c55e', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>Onayla</button>
                          <button onClick={() => handleDeleteListing(item.id)} style={{ backgroundColor: '#fee2e2', color: '#dc2626', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>Reddet</button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div style={{ backgroundColor: '#fef9c3', padding: '12px', borderRadius: '8px', border: '1px solid #fde047', marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#854d0e', margin: '0 0 8px 0' }}>📢 Duyuru Banner Yönetimi</h3>
                  <form onSubmit={saveAnnouncement} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <input type="text" value={tempAnnouncement} onChange={(e) => setTempAnnouncement(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #facc15', fontSize: '13px', backgroundColor: '#fff' }} />
                    <button type="submit" style={{ backgroundColor: '#ca8a04', color: '#fff', border: 'none', padding: '8px', borderRadius: '6px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}>Güncelle</button>
                  </form>
                </div>

                {editingListing && (
                  <div style={{ backgroundColor: '#f0fdf4', padding: '14px', borderRadius: '8px', border: '2px solid #22c55e', marginBottom: '20px' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#166534', margin: '0 0 10px 0' }}>✏️ İlanı Düzenle</h3>
                    <form onSubmit={saveEditedListing} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <input type="text" name="title" value={editingListing.title} onChange={handleEditFormChange} placeholder="İlan Başlığı" style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }} />
                      <input type="number" name="price" value={editingListing.price} onChange={handleEditFormChange} placeholder="Fiyat" style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }} />
                      <input type="text" name="location" value={editingListing.location} onChange={handleEditFormChange} placeholder="Konum" style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }} />
                      <button type="submit" style={{ backgroundColor: '#22c55e', color: '#fff', border: 'none', padding: '8px', borderRadius: '6px', fontWeight: '700', cursor: 'pointer' }}>Değişiklikleri Kaydet</button>
                    </form>
                  </div>
                )}

                <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#1b3a2b', margin: '0 0 10px 0' }}>📁 Kategoriye Yeni Alt Seçenek Ekle</h3>
                  <form onSubmit={handleAddCategory} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <select value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#fff' }}>
                      {Object.keys(categoriesWithSubs).map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                    <input type="text" placeholder="Yeni seçenekler (virgülle ayırın)" value={newSubCategoryName} onChange={(e) => setNewSubCategoryName(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
                    <button type="submit" style={{ backgroundColor: '#22c55e', color: '#fff', border: 'none', padding: '10px', borderRadius: '6px', fontWeight: '700', cursor: 'pointer' }}>Seçenekleri Ekle</button>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

      </main>

      <footer style={{ backgroundColor: '#1b3a2b', color: '#94a3b8', padding: '20px 16px', textAlign: 'center', fontSize: '12px', marginTop: 'auto', borderTop: '1px solid #2d5a43' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ color: '#fff', fontWeight: '700', fontSize: '14px' }}>PazarTarla İletişim & Destek</div>
          <div>📞 WhatsApp / Tel: 0535 768 1550</div>
          <div>📍 Konum: Gönen / Balıkesir</div>
          <div style={{ color: '#86efac', marginTop: '4px' }}>© 2026 PazarTarla • Türkiye'nin İlk ve Tek Tarım Platformu</div>
        </div>
      </footer>

      <button onClick={() => changeTab('admin-page')} title="Yönetim Paneli" style={{ position: 'fixed', bottom: '20px', right: '20px', backgroundColor: '#1b3a2b', color: '#86efac', border: '2px solid #22c55e', borderRadius: '50%', width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 999 }}>
        ⚙️
      </button>
    </div>
  );
}

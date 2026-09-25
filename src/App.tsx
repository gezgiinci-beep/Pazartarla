import React, { useState, useEffect } from 'react';
import { 
  Search, SlidersHorizontal, MapPin, Phone, MessageCircle, Plus, 
  Heart, Share2, ShieldCheck, CheckCircle2, ChevronRight, X, 
  Car, Tractor, Wrench, ArrowRight, Bell, User, Filter, AlertCircle, Trash2, Settings, Lock, Check, Mail, Globe, Copy, HelpCircle, Users, Image, Bug, Shield, Package, ArrowLeft, Menu, ArrowUpDown, LayoutList, Star 
} from 'lucide-react';

const INITIAL_LISTINGS = [
  // --- MAHSULLER (Her alt kategoriye 3'er ilan) ---
  // 1. Kiraz (3 ilan)
  { id: 101, title: 'Bursamızın Meşhur Saplı Tatlı Kirazı', price: 90, category: 'Mahsuller', subCategory: 'Kiraz', mode: 'Satılık', location: 'Karacabey / Bursa', city: 'Bursa', amount: '500 kg', description: 'İhracat kalitesinde iri cins taze hasat tatlı kiraz.', seller: 'İbrahim Demir', phone: '0532 444 5566', image: 'https://images.unsplash.com/photo-1528821151447-11f211b5e5a7?auto=format&fit=crop&q=80&w=800', date: 'Bugün' },
  { id: 102, title: 'Ulucak Sultani Kirazı Toptan', price: 85, category: 'Mahsuller', subCategory: 'Kiraz', mode: 'Satılık', location: 'Kemalpaşa / İzmir', city: 'İzmir', amount: '2 Ton', description: 'Dalından taze toplama zedelenmemiş sofralık kiraz.', seller: 'Hasan Şen', phone: '0533 222 1100', image: 'https://images.unsplash.com/photo-1528821151447-11f211b5e5a7?auto=format&fit=crop&q=80&w=800', date: 'Bugün' },
  { id: 103, title: 'Organik Napolyon Kirazı', price: 110, category: 'Mahsuller', subCategory: 'Kiraz', mode: 'Satılık', location: 'Alaşehir / Manisa', city: 'Manisa', amount: '750 kg', description: 'İlaçsız yetiştirilmiş iri irilikte Napolyon kiraz.', seller: 'Mehmet Ak', phone: '0544 333 2211', image: 'https://images.unsplash.com/photo-1528821151447-11f211b5e5a7?auto=format&fit=crop&q=80&w=800', date: 'Dün' },

  // 2. Karpuz / Kavun (3 ilan)
  { id: 104, title: 'Mis Kokulu Gönen Kavunu ve Karpuzu', price: 15, category: 'Mahsuller', subCategory: 'Karpuz / Kavun', mode: 'Satılık', location: 'Gönen / Balıkesir', city: 'Balıkesir', amount: '5 Ton', description: 'Tarladan doğrudan taze kesim kavun ve karpuz.', seller: 'Hüseyin Çiftçi', phone: '0533 111 2233', image: 'https://images.unsplash.com/photo-1587049352847-4a222e784d38?auto=format&fit=crop&q=80&w=800', date: 'Bugün' },
  { id: 105, title: 'Diyarbakır Cins Sulu Çekirdeksiz Karpuz', price: 12, category: 'Mahsuller', subCategory: 'Karpuz / Kavun', mode: 'Satılık', location: 'Bismil / Diyarbakır', city: 'Diyarbakır', amount: '10 Ton', description: 'Kıtır kıtır kırmızı Diyarbakır karpuzu.', seller: 'Ramazan Kaya', phone: '0542 555 4433', image: 'https://images.unsplash.com/photo-1587049352847-4a222e784d38?auto=format&fit=crop&q=80&w=800', date: 'Bugün' },
  { id: 106, title: 'Kırkağaç Tatlı Kışlık Kavun', price: 20, category: 'Mahsuller', subCategory: 'Karpuz / Kavun', mode: 'Satılık', location: 'Kırkağaç / Manisa', city: 'Manisa', amount: '3 Ton', description: 'Dayanıklı ve bal gibi tatlı Kırkağaç kavunu.', seller: 'Ahmet Baş', phone: '0535 666 7788', image: 'https://images.unsplash.com/photo-1587049352847-4a222e784d38?auto=format&fit=crop&q=80&w=800', date: 'Dün' },

  // 3. Ceviz (3 ilan)
  { id: 107, title: 'Tarladan Doğrudan Taze Chandler Ceviz', price: 140, category: 'Mahsuller', subCategory: 'Ceviz', mode: 'Satılık', location: 'Gönen / Balıkesir', city: 'Balıkesir', amount: '1 Ton', description: 'Kendi bahçemizin ürünü, ilaçsız ve dolgun Chandler ceviz.', seller: 'Can İnce', phone: '0535 768 1550', image: 'https://images.unsplash.com/photo-1559181567-c3190ca9959b?auto=format&fit=crop&q=80&w=800', date: 'Bugün' },
  { id: 108, title: 'Kabuklu Kaman Cevizi Toptan', price: 130, category: 'Mahsuller', subCategory: 'Ceviz', mode: 'Satılık', location: 'Kaman / Kırşehir', city: 'Kırşehir', amount: '2.5 Ton', description: 'İnce kabuklu, içi beyaz Kaman cevizi.', seller: 'Ekrem Öz', phone: '0532 888 9900', image: 'https://images.unsplash.com/photo-1559181567-c3190ca9959b?auto=format&fit=crop&q=80&w=800', date: 'Bugün' },
  { id: 109, title: 'Pedro Cinsi Ayıklanmış Ceviz İçi', price: 280, category: 'Mahsuller', subCategory: 'Ceviz', mode: 'Satılık', location: 'Inegöl / Bursa', city: 'Bursa', amount: '250 kg', description: 'Birinci sınıf elekten geçmiş tam kelebek ceviz içi.', seller: 'Selim Aydın', phone: '0544 111 2233', image: 'https://images.unsplash.com/photo-1559181567-c3190ca9959b?auto=format&fit=crop&q=80&w=800', date: 'Dün' },

  // 4. Zeytin & Zeytinyağı (3 ilan)
  { id: 110, title: 'Erken Hasat Soğuk Sıkım Sızma Zeytinyağı', price: 1250, category: 'Mahsuller', subCategory: 'Zeytin & Zeytinyağı', mode: 'Satılık', location: 'Burhaniye / Balıkesir', city: 'Balıkesir', amount: '100 Teneke (5 Lt)', description: 'Asit oranı düşük, kendi zeytinliklerimizden saf zeytinyağı.', seller: 'Hasan Bilir', phone: '0532 123 4567', image: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&q=80&w=800', date: 'Bugün' },
  { id: 111, title: 'Gemlik Tipi Sele Zeytin (Az Tuzlu)', price: 160, category: 'Mahsuller', subCategory: 'Zeytin & Zeytinyağı', mode: 'Satılık', location: 'Gemlik / Bursa', city: 'Bursa', amount: '50 kg', description: 'Etli, ince kabuklu geleneksel sele siyah zeytin.', seller: 'İsmail Zeytinci', phone: '0533 444 5566', image: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&q=80&w=800', date: 'Bugün' },
  { id: 112, title: 'Ayvalık Çizcik Yeşil Zeytin', price: 140, category: 'Mahsuller', subCategory: 'Zeytin & Zeytinyağı', mode: 'Satılık', location: 'Ayvalık / Balıkesir', city: 'Balıkesir', amount: '100 kg', description: 'Kırma yeşil zeytin, limonlu ve zeytinyağlı.', seller: 'Fatma Hanım', phone: '0555 777 8899', image: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&q=80&w=800', date: 'Dün' },

  // 5. Buğday / Arpa (3 ilan)
  { id: 113, title: 'Anadolu Sert Ekmeklik Buğday', price: 11, category: 'Mahsuller', subCategory: 'Buğday / Arpa', mode: 'Satılık', location: 'Konya / Karatay', city: 'Konya', amount: '20 Ton', description: 'Protein oranı yüksek mahsul buğday.', seller: 'Mustafa Çiftçi', phone: '0532 999 0011', image: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&q=80&w=800', date: 'Bugün' },
  { id: 114, title: 'Yemlik ve Biraçlık Arpa', price: 9.5, category: 'Mahsuller', subCategory: 'Buğday / Arpa', mode: 'Satılık', location: 'Polatlı / Ankara', city: 'Ankara', amount: '15 Ton', description: 'Elekten geçmiş temiz arpa.', seller: 'Kamil Arpacı', phone: '0533 222 3344', image: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&q=80&w=800', date: 'Bugün' },
  { id: 115, title: 'Makarnalık Durum Buğdayı', price: 12.5, category: 'Mahsuller', subCategory: 'Buğday / Arpa', mode: 'Satılık', location: 'Kızıltepe / Mardin', city: 'Mardin', amount: '30 Ton', description: 'Kehribar renkli kaliteli makarnalık buğday.', seller: 'Şeyhmus Akar', phone: '0544 555 6677', image: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&q=80&w=800', date: 'Dün' },

  // 6. Diğer Mahsul (3 ilan)
  { id: 116, title: 'Organik Kuru Soğan Toptan', price: 10, category: 'Mahsuller', subCategory: 'Diğer Mahsul', mode: 'Satılık', location: 'Amasya / Merkez', city: 'Amasya', amount: '5 Ton', description: 'Depo çıkışı çürüksüz mor ve beyaz soğan.', seller: 'Salih Soğanlı', phone: '0532 111 9988', image: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&q=80&w=800', date: 'Bugün' },
  { id: 117, title: 'Taze Patates (Agria Cins)', price: 12, category: 'Mahsuller', subCategory: 'Diğer Mahsul', mode: 'Satılık', location: 'Ödemiş / İzmir', city: 'İzmir', amount: '8 Ton', description: 'Kızartmalık ve yemeklik birinci sınıf patates.', seller: 'Hüseyin Patates', phone: '0535 444 3322', image: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&q=80&w=800', date: 'Bugün' },
  { id: 118, title: 'Antalya Serası Domates', price: 25, category: 'Mahsuller', subCategory: 'Diğer Mahsul', mode: 'Satılık', location: 'Kumluca / Antalya', city: 'Antalya', amount: '3 Ton', description: 'Salkım domates, günlük toplama.', seller: 'Ali Seracı', phone: '0543 222 1100', image: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&q=80&w=800', date: 'Dün' },

  // --- CANLI HAYVANLAR (Her alt kategoriye 3'er ilan) ---
  // 1. Büyükbaş (3 ilan)
  { id: 201, title: 'Simental Cinsi Simental Düve ve İnekler', price: 85000, category: 'Canlı Hayvanlar', subCategory: 'Büyükbaş', mode: 'Satılık', location: 'Biga / Çanakkale', city: 'Çanakkale', amount: '3 Baş', description: 'Yüksek süt verimine sahip, gebe ve besili Simental düveler.', seller: 'Ali Koç', phone: '0532 999 8877', image: 'https://images.unsplash.com/photo-1570042225831-d98fa7577f1e?auto=format&fit=crop&q=80&w=800', date: 'Dün' },
  { id: 202, title: 'Holştayn Süt İneği (Günlük 30 Lt)', price: 75000, category: 'Canlı Hayvanlar', subCategory: 'Büyükbaş', mode: 'Satılık', location: 'Tire / İzmir', city: 'İzmir', amount: '1 Baş', description: 'İkinci karnında, sağlığı yerinde verimli süt ineği.', seller: 'Veli Sütçü', phone: '0533 333 4455', image: 'https://images.unsplash.com/photo-1570042225831-d98fa7577f1e?auto=format&fit=crop&q=80&w=800', date: 'Bugün' },
  { id: 203, title: 'Kurbanlık Besi Angus Dana', price: 110000, category: 'Canlı Hayvanlar', subCategory: 'Büyükbaş', mode: 'Satılık', location: 'Erzurum / Merkez', city: 'Erzurum', amount: '1 Baş', description: 'Gözü dolgun, arpa ile beslenmiş Angus dana.', seller: 'Dadaş Besi', phone: '0542 111 2233', image: 'https://images.unsplash.com/photo-1570042225831-d98fa7577f1e?auto=format&fit=crop&q=80&w=800', date: 'Bugün' },

  // 2. Küçükbaş (3 ilan)
  { id: 204, title: 'Damızlık Sağlıklı Koyun ve Kuzu Sürüsü', price: 12000, category: 'Canlı Hayvanlar', subCategory: 'Küçükbaş', mode: 'Satılık', location: 'Bandırma / Balıkesir', city: 'Balıkesir', amount: '15 Baş', description: 'Veteriner kontrolleri tam, aşılı ve sağlıklı damızlık koyunlar.', seller: 'Mehmet Aksoy', phone: '0542 333 4455', image: 'https://images.unsplash.com/photo-1484557077804-29774de7fc76?auto=format&fit=crop&q=80&w=800', date: 'Bugün' },
  { id: 205, title: 'Merinos Koç ve Toklular', price: 18000, category: 'Canlı Hayvanlar', subCategory: 'Küçükbaş', mode: 'Satılık', location: 'Karacabey / Bursa', city: 'Bursa', amount: '4 Baş', description: 'Safkan Karacabey Merinosu damızlık koçlar.', seller: 'İsmail Koççu', phone: '0532 777 6655', image: 'https://images.unsplash.com/photo-1484557077804-29774de7fc76?auto=format&fit=crop&q=80&w=800', date: 'Bugün' },
  { id: 206, title: 'Kıvırcık Koyun ve İkiz Kuzuları', price: 15000, category: 'Canlı Hayvanlar', subCategory: 'Küçükbaş', mode: 'Satılık', location: 'Kırklareli / Merkez', city: 'Kırklareli', amount: '10 Baş', description: 'Trakya Kıvırcığı ırkı anne ve altındaki kuzuları.', seller: 'Tamer Kıvırcık', phone: '0535 888 9911', image: 'https://images.unsplash.com/photo-1484557077804-29774de7fc76?auto=format&fit=crop&q=80&w=800', date: 'Dün' },

  // 3. Kanatlı (3 ilan)
  { id: 207, title: 'Atak-S Yumurtacı Yarka Tavuklar', price: 180, category: 'Canlı Hayvanlar', subCategory: 'Kanatlı', mode: 'Satılık', location: 'İnegöl / Bursa', city: 'Bursa', amount: '100 Adet', description: '16 haftalık, tüm aşıları eksiksiz kılavuz tavuklar.', seller: 'Fatma Şahin', phone: '0555 222 3344', image: 'https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?auto=format&fit=crop&q=80&w=800', date: 'Bugün' },
  { id: 208, title: 'Pekin Örneği Damızlık Ördekler', price: 250, category: 'Canlı Hayvanlar', subCategory: 'Kanatlı', mode: 'Satılık', location: 'Sakarya / Adapazarı', city: 'Sakarya', amount: '20 Adet', description: 'Hızlı kilo alan etlik Pekin ördekleri.', seller: 'Kazım Ördekçi', phone: '0532 444 3322', image: 'https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?auto=format&fit=crop&q=80&w=800', date: 'Bugün' },
  { id: 209, title: 'Köy Horozu ve Damızlık Tavuk', price: 200, category: 'Canlı Hayvanlar', subCategory: 'Kanatlı', mode: 'Satılık', location: 'Bolu / Gerede', city: 'Bolu', amount: '15 Adet', description: 'Doğal salma tavukçuluk için yerli ırk.', seller: 'Emine Kümes', phone: '0544 333 2211', image: 'https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?auto=format&fit=crop&q=80&w=800', date: 'Dün' },

  // --- HAYVAN YEMLERİ VE EKİPMANLARI ---
  // 1. Yem Çeşitleri (3 ilan)
  { id: 301, title: 'Besi ve Süt Yemi Toptan Çuval', price: 450, category: 'Hayvan Yemleri ve Ekipmanları', subCategory: 'Yem Çeşitleri', mode: 'Satılık', location: 'Susurluk / Balıkesir', city: 'Balıkesir', amount: '50 Çuval', description: 'Yüksek protein değerli kaliteli fabrika yem.', seller: 'Murat Yemci', phone: '0533 444 5566', image: 'https://images.unsplash.com/photo-1516467508483-a7212febe31a?auto=format&fit=crop&q=80&w=800', date: 'Bugün' },
  { id: 302, title: 'Kaliteli Sıkıştırılmış Yonca Balyası', price: 130, category: 'Hayvan Yemleri ve Ekipmanları', subCategory: 'Yem Çeşitleri', mode: 'Satılık', location: 'Akhisar / Manisa', city: 'Manisa', amount: '200 Balya', description: 'Yağmur görmemiş yapraklı yonca.', seller: 'Hakan Korkmaz', phone: '0543 888 9900', image: 'https://images.unsplash.com/photo-1516467508483-a7212febe31a?auto=format&fit=crop&q=80&w=800', date: 'Bugün' },
  { id: 303, title: 'Mısır Silajı Dökme Tonaj', price: 2.2, category: 'Hayvan Yemleri ve Ekipmanları', subCategory: 'Yem Çeşitleri', mode: 'Satılık', location: 'Torbalı / İzmir', city: 'İzmir', amount: '50 Ton', description: 'Paketlenmiş yüksek kaliteli mısır silajı.', seller: 'Ege Silaj', phone: '0532 555 6677', image: 'https://images.unsplash.com/photo-1516467508483-a7212febe31a?auto=format&fit=crop&q=80&w=800', date: 'Dün' },

  // 2. Suluk / Yemlik (3 ilan)
  { id: 304, title: 'Otomatik Büyükbaş Suluk ve Yemlik', price: 1250, category: 'Hayvan Yemleri ve Ekipmanları', subCategory: 'Suluk / Yemlik', mode: 'Satılık', location: 'Mustafakemalpaşa / Bursa', city: 'Bursa', amount: '5 Adet', description: 'Döküm paslanmaz çelik otomatik suluk.', seller: 'Cemal Aydın', phone: '0532 777 6655', image: 'https://images.unsplash.com/photo-1589923188900-85dae523342b?auto=format&fit=crop&q=80&w=800', date: 'Dün' },
  { id: 305, title: 'Küçükbaş Çevirme Suluk Sistemi', price: 850, category: 'Hayvan Yemleri ve Ekipmanları', subCategory: 'Suluk / Yemlik', mode: 'Satılık', location: 'Gönen / Balıkesir', city: 'Balıkesir', amount: '2 Adet', description: 'Uzun tip koyun kuzu suluğu.', seller: 'Ahmet Ekipman', phone: '0535 222 1100', image: 'https://images.unsplash.com/photo-1589923188900-85dae523342b?auto=format&fit=crop&q=80&w=800', date: 'Bugün' },
  { id: 306, title: 'Plastik Askılı Tavuk Yemliği ve Suluğu', price: 150, category: 'Hayvan Yemleri ve Ekipmanları', subCategory: 'Suluk / Yemlik', mode: 'Satılık', location: 'Pendik / İstanbul', city: 'İstanbul', amount: '10 Set', description: 'Kümes içi 10 litrelik yemlik set.', seller: 'Can Kümes', phone: '0544 999 8877', image: 'https://images.unsplash.com/photo-1589923188900-85dae523342b?auto=format&fit=crop&q=80&w=800', date: 'Bugün' },

  // --- ARICILIK & BAL ---
  // 1. Süzme Bal (3 ilan)
  { id: 401, title: 'Meşe Ormanı Çiçek Süzme Balı', price: 400, category: 'Arıcılık & Bal', subCategory: 'Süzme Bal', mode: 'Satılık', location: 'Gönen / Balıkesir', city: 'Balıkesir', amount: '5 kg', description: 'Laboratuvar analizli saf süzme bal.', seller: 'Can İnce', phone: '0535 768 1550', image: 'https://images.unsplash.com/photo-1587049352847-4a222e784d38?auto=format&fit=crop&q=80&w=800', date: 'Bugün' },
  { id: 402, title: 'Anzer Yaylası Çiçek Balı', price: 1500, category: 'Arıcılık & Bal', subCategory: 'Süzme Bal', mode: 'Satılık', location: 'İkizdere / Rize', city: 'Rize', amount: '1 kg', description: 'Tescilli coğrafi işaretli Anzer balı.', seller: 'Reis Anzer', phone: '0532 111 2233', image: 'https://images.unsplash.com/photo-1587049352847-4a222e784d38?auto=format&fit=crop&q=80&w=800', date: 'Bugün' },
  { id: 403, title: 'Çam Balı (Muğla Datça)', price: 450, category: 'Arıcılık & Bal', subCategory: 'Süzme Bal', mode: 'Satılık', location: 'Datça / Muğla', city: 'Muğla', amount: '3 kg', description: 'Basra böceği salgısından saf çam balı.', seller: 'Datçalı Arıcı', phone: '0543 666 5544', image: 'https://images.unsplash.com/photo-1587049352847-4a222e784d38?auto=format&fit=crop&q=80&w=800', date: 'Dün' },

  // 2. Karakovan Balı (3 ilan)
  { id: 404, title: 'Karakovan Doğal Petek Bal', price: 600, category: 'Arıcılık & Bal', subCategory: 'Karakovan Balı', mode: 'Satılık', location: 'Artvin / Merkez', city: 'Artvin', amount: '2 kg', description: 'Arının kendi ördüğü mumla petek bal.', seller: 'Kenan Balcı', phone: '0532 111 4455', image: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&q=80&w=800', date: 'Dün' },
  { id: 405, title: 'Hakkari Yüksekova Karakovan', price: 750, category: 'Arıcılık & Bal', subCategory: 'Karakovan Balı', mode: 'Satılık', location: 'Yüksekova / Hakkari', city: 'Hakkari', amount: '3 kg', description: 'Çeşitli yayla çiçeklerinden karakovan.', seller: 'Memet Dağ', phone: '0544 222 3344', image: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&q=80&w=800', date: 'Bugün' },
  { id: 406, title: 'Kars Kağızman Karakovan Balı', price: 650, category: 'Arıcılık & Bal', subCategory: 'Karakovan Balı', mode: 'Satılık', location: 'Kağızman / Kars', city: 'Kars', amount: '2.5 kg', description: 'Kütük kovan içinde üretilmiş doğal bal.', seller: 'Serhat Arıcı', phone: '0535 333 4455', image: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&q=80&w=800', date: 'Bugün' },

  // 3. Petek Bal (3 ilan)
  { id: 407, title: 'Karakovan Petek Bal Çerçeveli', price: 500, category: 'Arıcılık & Bal', subCategory: 'Petek Bal', mode: 'Satılık', location: 'Sivas / Zara', city: 'Sivas', amount: '3 kg', description: 'Zara balı petek halinde.', seller: 'Zara Arıcılık', phone: '0532 444 5566', image: 'https://images.unsplash.com/photo-1559181567-c3190ca9959b?auto=format&fit=crop&q=80&w=800', date: 'Bugün' },
  { id: 408, title: 'Çiçek Petek Balı Sıfır Kat', price: 400, category: 'Arıcılık & Bal', subCategory: 'Petek Bal', mode: 'Satılık', location: 'Bursa / Orhaneli', city: 'Bursa', amount: '2 kg', description: 'Karakovan tel çerçeve petek bal.', seller: 'Bursalı Arıcı', phone: '0533 777 8899', image: 'https://images.unsplash.com/photo-1559181567-c3190ca9959b?auto=format&fit=crop&q=80&w=800', date: 'Dün' },
  { id: 409, title: 'Erzincan Tulum ve Petek Bal', price: 450, category: 'Arıcılık & Bal', subCategory: 'Petek Bal', mode: 'Satılık', location: 'Erzincan / Merkez', city: 'Erzincan', amount: '2 kg', description: 'Bölgenin çiçeklerinden süzülmemiş petek.', seller: 'Erzincanlı', phone: '0542 111 0022', image: 'https://images.unsplash.com/photo-1559181567-c3190ca9959b?auto=format&fit=crop&q=80&w=800', date: 'Bugün' },

  // --- ARICILIK EKİPMANLARI ---
  // 1. Kovan (3 ilan)
  { id: 501, title: '10 Çerçeveli Boyalı Langstroth Arı Kovanı', price: 950, category: 'Arıcılık Ekipmanları', subCategory: 'Kovan', mode: 'Satılık', location: 'Gönen / Balıkesir', city: 'Balıkesir', amount: '10 Adet', description: 'Fırınlanmış çam ağacından imal kovan.', seller: 'Can İnce', phone: '0535 768 1550', image: 'https://images.unsplash.com/photo-1592417817098-8f3d69204052?auto=format&fit=crop&q=80&w=800', date: 'Bugün' },
  { id: 502, title: 'Dadant 12 Çerçeveli Arı Kovanı', price: 1150, category: 'Arıcılık Ekipmanları', subCategory: 'Kovan', mode: 'Satılık', location: 'İzmir / Bornova', city: 'İzmir', amount: '5 Adet', description: 'Genişletilmiş profesyonel Dadant kovan.', seller: 'Ege Kovan', phone: '0532 333 2211', image: 'https://images.unsplash.com/photo-1592417817098-8f3d69204052?auto=format&fit=crop&q=80&w=800', date: 'Bugün' },
  { id: 503, title: 'Polyester Ruşet Arı Kovanı (4 Çerçeve)', price: 600, category: 'Arıcılık Ekipmanları', subCategory: 'Kovan', mode: 'Satılık', location: 'Muğla / Menteşe', city: 'Muğla', amount: '8 Adet', description: 'Ana arı üretimi için ruşet kovan.', seller: 'Muğla Arı', phone: '0544 555 4433', image: 'https://images.unsplash.com/photo-1592417817098-8f3d69204052?auto=format&fit=crop&q=80&w=800', date: 'Dün' },

  // 2. Petek ve Çerçeve (3 ilan)
  { id: 504, title: 'Kabartılmış Petek ve Tel Çerçeve Paketi', price: 45, category: 'Arıcılık Ekipmanları', subCategory: 'Petek ve Çerçeve', mode: 'Satılık', location: 'Balıkesir / Merkez', city: 'Balıkesir', amount: '50 Adet', description: 'Tellenmiş hazır çerçeve.', seller: 'İsmail Çerçeveci', phone: '0541 333 2211', image: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&q=80&w=800', date: 'Bugün' },
  { id: 505, title: 'Saf Kafkas Petek Mum (5 kg Paket)', price: 1200, category: 'Arıcılık Ekipmanları', subCategory: 'Petek ve Çerçeve', mode: 'Satılık', location: 'Ankara / Ulus', city: 'Ankara', amount: '1 Paket', description: 'Saf balmumundan petek yaprakları.', seller: 'Ankara Arıcılık', phone: '0533 222 1100', image: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&q=80&w=800', date: 'Bugün' },
  { id: 506, title: 'Boş Çerçeve Çıtası (Demir Tel Dahil)', price: 20, category: 'Arıcılık Ekipmanları', subCategory: 'Petek ve Çerçeve', mode: 'Satılık', location: 'Bursa / Osmangazi', city: 'Bursa', amount: '100 Adet', description: 'Kavak kontrplak çıta.', seller: 'Ahmet Çıta', phone: '0535 666 5544', image: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&q=80&w=800', date: 'Dün' },

  // 3. Bal Süzme Makinesi (3 ilan)
  { id: 507, title: 'Paslanmaz Çelik 4 Çerçeveli Bal Süzme Makinesi', price: 4500, category: 'Arıcılık Ekipmanları', subCategory: 'Bal Süzme Makinesi', mode: 'Satılık', location: 'Bursa / Osmangazi', city: 'Bursa', amount: '1 Adet', description: 'Gıda sınıfı paslanmaz çelik süzgeç.', seller: 'Orhan Arıcı', phone: '0533 666 7788', image: 'https://images.unsplash.com/photo-1589923188900-85dae523342b?auto=format&fit=crop&q=80&w=800', date: 'Dün' },
  { id: 508, title: 'Motorlu 12 Çerçeveli Bal Süzgeci', price: 12500, category: 'Arıcılık Ekipmanları', subCategory: 'Bal Süzme Makinesi', mode: 'Satılık', location: 'İzmir / Konak', city: 'İzmir', amount: '1 Adet', description: 'Elektrikli hız ayarlı profesyonel makine.', seller: 'Ege Bal', phone: '0532 999 1122', image: 'https://images.unsplash.com/photo-1589923188900-85dae523342b?auto=format&fit=crop&q=80&w=800', date: 'Bugün' },
  { id: 509, title: '2 Çerçeveli Ekonomik El Tipi Süzme Makinesi', price: 2800, category: 'Arıcılık Ekipmanları', subCategory: 'Bal Süzme Makinesi', mode: 'Satılık', location: 'Balıkesir / Edremit', city: 'Balıkesir', amount: '1 Adet', description: 'Hobi arıcıları için ideal.', seller: 'Hasan Hobi', phone: '0544 333 2211', image: 'https://images.unsplash.com/photo-1589923188900-85dae523342b?auto=format&fit=crop&q=80&w=800', date: 'Bugün' },

  // --- TRAKTÖR ---
  // 1. İkinci El Traktör (3 ilan)
  { id: 601, title: 'John Deere 6130M - Düşük saat, tek elden', price: 2450000, category: 'Traktör', subCategory: 'İkinci El Traktör', mode: 'Satılık', location: 'Gönen / Balıkesir', city: 'Balıkesir', amount: '1200 Saat / 130 HP', description: 'Kapalı garaj traktörüdür.', seller: 'Ahmet Yılmaz', phone: '0532 555 0192', image: 'https://images.unsplash.com/photo-1592417817098-8f3d69204052?auto=format&fit=crop&q=80&w=800', date: 'Bugün' },
  { id: 602, title: 'New Holland T5.115 Başakşehir', price: 1850000, category: 'Traktör', subCategory: 'İkinci El Traktör', mode: 'Satılık', location: 'Karesi / Balıkesir', city: 'Balıkesir', amount: '2100 Saat / 115 HP', description: 'Klima 4x4 temiz traktör.', seller: 'Necmi Çiftçi', phone: '0532 333 2211', image: 'https://images.unsplash.com/photo-1592417817098-8f3d69204052?auto=format&fit=crop&q=80&w=800', date: 'Dün' },
  { id: 603, title: 'Massey Ferguson 3065 4x4 Kabinli', price: 950000, category: 'Traktör', subCategory: 'İkinci El Traktör', mode: 'Satılık', location: 'Keşan / Edirne', city: 'Edirne', amount: '3800 Saat / 65 HP', description: 'Lastikleri yeni değişti.', seller: 'Rıza Güler', phone: '0542 555 4433', image: 'https://images.unsplash.com/photo-1592417817098-8f3d69204052?auto=format&fit=crop&q=80&w=800', date: 'Bugün' },

  // 2. Sıfır Traktör (3 ilan)
  { id: 604, title: 'Tümosan 8165 Kabinli Klima 4x4 (SIFIR)', price: 1750000, category: 'Traktör', subCategory: 'Sıfır Traktör', mode: 'Satılık', location: 'Konya / Selçuklu', city: 'Konya', amount: '0 Çalışma Saati / 65 HP', description: 'Fabrika çıkışlı 2026 model sıfır traktör.', seller: 'Tümosan Bayi', phone: '0533 111 2233', image: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&q=80&w=800', date: 'Bugün' },
  { id: 605, title: 'Erkunt Haşmet 110 Luxury CRD (SIFIR)', price: 2650000, category: 'Traktör', subCategory: 'Sıfır Traktör', mode: 'Satılık', location: 'Ankara / Sincan', city: 'Ankara', amount: '0 Saat / 110 HP', description: 'Yerli üretim lüks kabin sıfır traktör.', seller: 'Erkunt Yetkili', phone: '0532 444 5566', image: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&q=80&w=800', date: 'Bugün' },
  { id: 606, title: 'Landini Powerfarm 100 (SIFIR)', price: 2300000, category: 'Traktör', subCategory: 'Sıfır Traktör', mode: 'Satılık', location: 'İzmir / Torbalı', city: 'İzmir', amount: '0 Saat / 100 HP', description: 'İtalyan mühendisliği sıfır tarla traktörü.', seller: 'Landini Ege', phone: '0544 777 8899', image: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&q=80&w=800', date: 'Dün' },

  // --- BİÇERDÖVER ---
  // 1. Biçerdöver (3 ilan)
  { id: 701, title: 'Claas Lexion 670 Sahibinden Temiz Biçerdöver', price: 4500000, category: 'Biçerdöver', subCategory: 'Biçerdöver', mode: 'Satılık', location: 'Polatlı / Ankara', city: 'Ankara', amount: '3500 Motor Saati', description: 'Buğday ve mısır tablası dahil.', seller: 'Şakir Biçer', phone: '0533 999 1122', image: 'https://images.unsplash.com/photo-1516467508483-a7212febe31a?auto=format&fit=crop&q=80&w=800', date: 'Bugün' },
  { id: 702, title: 'New Holland TC 5070 Biçerdöver', price: 3200000, category: 'Biçerdöver', subCategory: 'Biçerdöver', mode: 'Satılık', location: 'Hayrabolu / Tekirdağ', city: 'Tekirdağ', amount: '4200 Saat', description: 'Klimalı kabin sarı bıçak.', seller: 'Ertuğrul Bey', phone: '0532 888 7766', image: 'https://images.unsplash.com/photo-1516467508483-a7212febe31a?auto=format&fit=crop&q=80&w=800', date: 'Dün' },
  { id: 703, title: 'John Deere W540 HillMaster', price: 5100000, category: 'Biçerdöver', subCategory: 'Biçerdöver', mode: 'Satılık', location: 'Adana / Yüreğir', city: 'Adana', amount: '2800 Saat', description: 'Eğim dengeleme sistemli.', seller: 'Halil Akman', phone: '0544 123 4567', image: 'https://images.unsplash.com/photo-1516467508483-a7212febe31a?auto=format&fit=crop&q=80&w=800', date: 'Bugün' },

  // --- TARIM EKİPMANLARI ---
  // 1. Römork (3 ilan)
  { id: 801, title: '6 Tonluk Hafif Tip DAMPERLİ Römork', price: 165000, category: 'Tarım Ekipmanları', subCategory: 'Römork', mode: 'Satılık', location: 'Gönen / Balıkesir', city: 'Balıkesir', amount: '1 Adet', description: 'Çift dingil hidrolik frenli.', seller: 'Mehmet Römorkçu', phone: '0532 777 8899', image: 'https://images.unsplash.com/photo-1592417817098-8f3d69204052?auto=format&fit=crop&q=80&w=800', date: 'Dün' },
  { id: 802, title: '10 Tonluk Tandem Dinli Tarım Römorku', price: 280000, category: 'Tarım Ekipmanları', subCategory: 'Römork', mode: 'Satılık', location: 'Edirne / Uzunköprü', city: 'Edirne', amount: '1 Adet', description: 'Geniş hacimli yüksek tonaj taşımaya uygun.', seller: 'Trakya Römork', phone: '0533 444 3322', image: 'https://images.unsplash.com/photo-1592417817098-8f3d69204052?auto=format&fit=crop&q=80&w=800', date: 'Bugün' },
  { id: 803, title: 'Tek Dingil 3 Tonluk Bahçe Römorku', price: 95000, category: 'Tarım Ekipmanları', subCategory: 'Römork', mode: 'Satılık', location: 'Bursa / Mustafakemalpaşa', city: 'Bursa', amount: '1 Adet', description: 'Küçük traktörler için ideal.', seller: 'Hüseyin Usta', phone: '0542 111 2233', image: 'https://images.unsplash.com/photo-1592417817098-8f3d69204052?auto=format&fit=crop&q=80&w=800', date: 'Bugün' },

  // 2. İlaçlama Makinesi (3 ilan)
  { id: 804, title: '600 Litre Turbo İlaçlama Pompası', price: 38000, category: 'Tarım Ekipmanları', subCategory: 'İlaçlama Makinesi', mode: 'Satılık', location: 'İznik / Bursa', city: 'Bursa', amount: '1 Adet', description: 'Meyve bahçeleri için fanlı turbo kollu.', seller: 'Tarık Bahçeci', phone: '0543 999 0011', image: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&q=80&w=800', date: 'Bugün' },
  { id: 805, title: 'Asılır Tip 400 Lt İlaçlama Tankı', price: 22000, category: 'Tarım Ekipmanları', subCategory: 'İlaçlama Makinesi', mode: 'Satılık', location: 'Manisa / Salihli', city: 'Manisa', amount: '1 Adet', description: 'Tarlalar için kollu mekanik ilaçlama.', seller: 'Ege Tarım', phone: '0532 555 4433', image: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&q=80&w=800', date: 'Dün' },
  { id: 806, title: '100 Litre Benzinli Motorlu İlaçlama', price: 14500, category: 'Tarım Ekipmanları', subCategory: 'İlaçlama Makinesi', mode: 'Satılık', location: 'Aydın / Nazilli', city: 'Aydın', amount: '1 Adet', description: 'Tekerlekli seyyar benzinli ilaç atma makinesi.', seller: 'Nazilli Makine', phone: '0535 777 8899', image: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&q=80&w=800', date: 'Bugün' },

  // 3. Toprak İşleme (3 ilan)
  { id: 807, title: '4 Lü 12 İnç Unlu Pulluk', price: 45000, category: 'Tarım Ekipmanları', subCategory: 'Toprak İşleme', mode: 'Satılık', location: 'Bandırma / Balıkesir', city: 'Balıkesir', amount: '1 Adet', description: 'Hiçbir kırığı kaynağı yoktur.', seller: 'Hüseyin Demirci', phone: '0535 444 3322', image: 'https://images.unsplash.com/photo-1528821151447-11f211b5e5a7?auto=format&fit=crop&q=80&w=800', date: 'Bugün' },
  { id: 808, title: '28 Li Hidrolik Katlanabilir Diskaro Tırmık', price: 110000, category: 'Tarım Ekipmanları', subCategory: 'Toprak İşleme', mode: 'Satılık', location: 'Adana / Ceyhan', city: 'Adana', amount: '1 Adet', description: 'Toprak hazırlığı için ağır tip diskli tırmık.', seller: 'Çukurova Ekipman', phone: '0532 222 3344', image: 'https://images.unsplash.com/photo-1528821151447-11f211b5e5a7?auto=format&fit=crop&q=80&w=800', date: 'Bugün' },
  { id: 809, title: 'Rotovatör Toprak Frezesi (2 Metre)', price: 75000, category: 'Tarım Ekipmanları', subCategory: 'Toprak İşleme', mode: 'Satılık', location: 'Antalya / Merkez', city: 'Antalya', amount: '1 Adet', description: 'Sera ve tarla için şanzımanlı freze.', seller: 'Akdeniz Traktör', phone: '0544 888 7766', image: 'https://images.unsplash.com/photo-1528821151447-11f211b5e5a7?auto=format&fit=crop&q=80&w=800', date: 'Dün' },

  // --- TARIM İŞÇİLERİ ---
  // 1. Hasat Ekibi (3 ilan)
  { id: 901, title: 'Ceviz ve Meyve Hasat Toplama Ekibi', price: 1200, category: 'Tarım İşçileri', subCategory: 'Hasat Ekibi', mode: 'Hizmet', location: 'Balıkesir / Bursa Bölgesi', city: 'Balıkesir', amount: '10 Kişilik Ekip (Günlük yevmiye)', description: 'Profesyonel ceviz, zeytin ve meyve hasat ekibi.', seller: 'Dayıbaşı Hasan', phone: '0535 123 9876', image: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&q=80&w=800', date: 'Bugün' },
  { id: 902, title: 'Pamuk ve Mısır Hasat İşçi Ekibi', price: 1400, category: 'Tarım İşçileri', subCategory: 'Hasat Ekibi', mode: 'Hizmet', location: 'Şanlıurfa / Harran', city: 'Şanlıurfa', amount: '15 Kişilik Ekip', description: 'Deneyimli çapa ve hasat ekibi.', seller: 'İbrahim Reis', phone: '0533 111 0022', image: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&q=80&w=800', date: 'Bugün' },
  { id: 903, title: 'Fındık Toplama ve Patoz Ekibi', price: 1350, category: 'Tarım İşçileri', subCategory: 'Hasat Ekibi', mode: 'Hizmet', location: 'Ordu / Fatsa', city: 'Ordu', amount: '8 Kişilik Ekip', description: 'Karadeniz bölgesi fındık hasat timi.', seller: 'Mustafa Çavuş', phone: '0542 333 4455', image: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&q=80&w=800', date: 'Dün' },

  // 2. Budama Ekibi (3 ilan)
  { id: 904, title: 'Tecrübeli Ceviz ve Meyve Ağacı Budama Ekibi', price: 1500, category: 'Tarım İşçileri', subCategory: 'Budama Ekibi', mode: 'Hizmet', location: 'Marmara Bölgesi', city: 'Bursa', amount: 'Günlük Kişi Başı', description: 'Chandler ceviz ve zeytin ağaçlarında form budaması.', seller: 'Ziraatçi Ali', phone: '0532 444 1122', image: 'https://images.unsplash.com/photo-1587049352847-4a222e784d38?auto=format&fit=crop&q=80&w=800', date: 'Dün' },
  { id: 905, title: 'Bağ ve Asma Budama Uzman Ekibi', price: 1300, category: 'Tarım İşçileri', subCategory: 'Budama Ekibi', mode: 'Hizmet', location: 'Manisa / Salihli', city: 'Manisa', amount: 'Günlük', description: 'Üzüm bağları için profesyonel çubuk budama.', seller: 'Bağcı Arif', phone: '0535 999 8877', image: 'https://images.unsplash.com/photo-1587049352847-4a222e784d38?auto=format&fit=crop&q=80&w=800', date: 'Bugün' },
  { id: 906, title: 'Narenciye ve Limon Ağacı Budama Timi', price: 1250, category: 'Tarım İşçileri', subCategory: 'Budama Ekibi', mode: 'Hizmet', location: 'Mersin / Silifke', city: 'Mersin', amount: 'Günlük', description: 'Limon ve portakal bahçeleri bakım budaması.', seller: 'Ahmet Dayı', phone: '0544 222 3344', image: 'https://images.unsplash.com/photo-1587049352847-4a222e784d38?auto=format&fit=crop&q=80&w=800', date: 'Bugün' },

  // 3. Çoban / Bakıcı (3 ilan)
  { id: 907, title: 'Deneyimli Büyükbaş / Küçükbaş Çoban', price: 35000, category: 'Tarım İşçileri', subCategory: 'Çoban / Bakıcı', mode: 'Hizmet', location: 'Balıkesir / Gönen', city: 'Balıkesir', amount: 'Aylık Maaş', description: 'Yatılı kalacak yeri olan güvenilir çoban.', seller: 'Çiftlik Sahibi Ahmet', phone: '0543 777 1100', image: 'https://images.unsplash.com/photo-1484557077804-29774de7fc76?auto=format&fit=crop&q=80&w=800', date: 'Bugün' },
  { id: 908, title: 'Ahır ve Süt Sağım Elemanı Aile', price: 45000, category: 'Tarım İşçileri', subCategory: 'Çoban / Bakıcı', mode: 'Hizmet', location: 'Aksaray / Merkez', city: 'Aksaray', amount: 'Aylık (Lojman dahil)', description: 'Sağım makinesi kullanan karı-koca ahır bakıcısı.', seller: 'Aksaray Besi', phone: '0532 888 9911', image: 'https://images.unsplash.com/photo-1484557077804-29774de7fc76?auto=format&fit=crop&q=80&w=800', date: 'Bugün' },
  { id: 909, title: 'Kümes ve Tavuk Bakım Personeli', price: 30000, category: 'Tarım İşçileri', subCategory: 'Çoban / Bakıcı', mode: 'Hizmet', location: 'Manisa / Turgutlu', city: 'Manisa', amount: 'Aylık', description: 'Yarka ve yumurta çiftliği deneyimli bakım elemanı.', seller: 'Turgutlu Tavukçuluk', phone: '0535 444 3322', image: 'https://images.unsplash.com/photo-1484557077804-29774de7fc76?auto=format&fit=crop&q=80&w=800', date: 'Dün' }
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#cbd5e1', fontSize: '12px' }}>
                        <span>({listings.filter(i => i.category === cat && i.subCategory === sub).length})</span>
                        <ChevronRight size={14} />
                      </div>
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
                  <button type="submit" style={{ backgroundColor: '#1b3a2b', color: '#fff', border: 'none', padding: '10px', borderRadius: '6px', fontWeight: '700', cursor: 'pointer' }}>Giriş Yap</button>
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
        <span>© 2026 PazarTarla • Türkiye Geneli Tarım ve Hayvancılık Pazaryeri</span>
      </footer>

    </div>
  );
}

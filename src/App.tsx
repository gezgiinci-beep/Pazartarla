import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, SlidersHorizontal, MapPin, Phone, MessageCircle, Plus, 
  Heart, Share2, ShieldCheck, CheckCircle2, ChevronRight, ChevronDown, X, 
  Car, Tractor, Wrench, ArrowRight, Bell, User, Filter, AlertCircle, Trash2, Settings, Lock, Check, Mail, Globe, Copy, HelpCircle, Users, Image as ImageIcon, Bug, Shield, Package, ArrowLeft, Menu, ArrowUpDown, LayoutList,
  Edit3, Sparkles, Megaphone, CheckCircle, Bot
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
    location: 'Gönen / Balıkesir',
    description: 'Kendi bahçemizin ürünü, ilaçsız ve dolgun Chandler ceviz.',
    seller: 'Can İnce',
    phone: '0535 768 1550',
    image: 'https://images.unsplash.com/photo-1559181567-c3190ca9959b?auto=format&fit=crop&q=80&w=800',
    status: 'approved',
    isFeatured: true
  },
  {
    id: 2,
    title: 'Sahibinden Temiz John Deere 5075E Traktör',
    price: 1250000,
    category: 'Traktör',
    location: 'Tekirdağ / Süleymanpaşa',
    description: 'Kapalı garajda muhafaza edilmiş, bakımlı ve masrafsız tarım traktörü.',
    seller: 'Serkan Öztürk',
    phone: '0531 333 4455',
    image: 'https://images.unsplash.com/photo-1592841202223-ca33cfd81b6f?auto=format&fit=crop&q=80&w=800',
    status: 'approved',
    isFeatured: true
  }
];

const INITIAL_CATEGORIES = {
  'Mahsuller': ['Kiraz', 'Ceviz', 'Zeytin & Zeytinyağı', 'Buğday', 'Bakliyat', 'Meyve & Sebze'],
  'Canlı Hayvanlar': ['Büyükbaş', 'Küçükbaş', 'Kanatlı'],
  'Hayvan Yemleri ve Ekipmanları': ['Yem Çeşitleri', 'Suluk / Yemlik'],
  'Arıcılık': ['Bal', 'Polen', 'Arı Ekmeği', 'Arı Sütü', 'Kovan ve Ekipmanları'],
  'Traktör': ['İkinci El Traktör', 'Sıfır Traktör', 'Ekipmanlar'],
  'Biçerdöver': ['Biçerdöver'],
  'Tarım Ekipmanları': ['Römork', 'İlaçlama Makinesi', 'Çapa Makinesi', 'Pulluk', 'Kepçe & Yükleyici'],
  'Tarım İşçileri': ['Hasat Ekibi', 'Budama Ekibi'],
  'Uzmanlar': ['Veterinerler', 'Ziraatçılar'],
  'endüstriyel çadırlar': ['Çadır Örtüsü', 'Depo Çadırı']
};

export default function App() {
  const [listings, setListings] = useState<any[]>([]);
  const [filteredListings, setFilteredListings] = useState<any[]>([]);
  const [view, setView] = useState<'home' | 'create' | 'admin-page'>('home');
  const [selectedCategory, setSelectedCategory] = useState('Tümü');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeListing, setActiveListing] = useState<any>(null);

  const [seller, setSeller] = useState('Can İnce');
  const [phone, setPhone] = useState('0535 768 1550');
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('Mahsuller');
  const [location, setLocation] = useState('Gönen / Balıkesir');
  const [image, setImage] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    fetchListings();
  }, []);

  const fetchListings = async () => {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/listings?select=*`, {
        headers: dbHeaders
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          setListings(data);
          setFilteredListings(data);
        } else {
          setListings(DEFAULT_START_LISTINGS);
          setFilteredListings(DEFAULT_START_LISTINGS);
        }
      }
    } catch (e) {
      setListings(DEFAULT_START_LISTINGS);
      setFilteredListings(DEFAULT_START_LISTINGS);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawPrice = price.toString().replace(/[^\d]/g, '');
    const parsedPrice = Number(rawPrice) || 0;
    const finalImage = image.trim() || 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&q=80&w=800';

    const newListing = {
      title: title.trim() || 'Tarım İlanı',
      price: parsedPrice,
      category: category,
      location: location.trim() || 'Gönen / Balıkesir',
      description: description.trim() || 'Detaylı bilgi için arayınız.',
      seller: seller.trim() || 'Can İnce',
      phone: phone.trim() || '0535 768 1550',
      image: finalImage,
      status: 'approved',
      isFeatured: false
    };

    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/listings`, {
        method: 'POST',
        headers: { ...dbHeaders, 'Prefer': 'return=representation' },
        body: JSON.stringify(newListing)
      });

      if (res.ok) {
        alert('🎉 İlanınız başarıyla yayınlandı!');
        setTitle('');
        setPrice('');
        setDescription('');
        setImage('');
        setView('home');
        fetchListings();
      } else {
        alert('İlan eklenirken bir hata oluştu.');
      }
    } catch (err) {
      alert('Bağlantı hatası oluştu.');
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#f8fafc', fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ background: '#1e293b', borderBottom: '1px solid #334155', padding: '15px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ color: '#4ade80', fontSize: '22px', margin: 0, cursor: 'pointer' }} onClick={() => setView('home')}>🌾 PazarTarla</h1>
        <div>
          <button onClick={() => setView('home')} style={{ background: view === 'home' ? '#22c55e' : '#334155', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', marginRight: '10px', cursor: 'pointer' }}>İlanlar</button>
          <button onClick={() => setView('create')} style={{ background: '#22c55e', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>+ İlan Ver</button>
        </div>
      </header>

      <main style={{ maxWidth: '1000px', margin: '30px auto', padding: '0 20px' }}>
        {view === 'home' ? (
          <div>
            <h2>Yayındaki İlanlar</h2>
            {filteredListings.length === 0 ? (
              <p style={{ color: '#94a3b8' }}>Henüz ilan bulunmuyor.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '20px' }}>
                {filteredListings.map((item) => (
                  <div key={item.id} onClick={() => setActiveListing(item)} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', overflow: 'hidden', cursor: 'pointer' }}>
                    <img src={item.image} alt={item.title} style={{ width: '100%', height: '160px', objectFit: 'cover' }} />
                    <div style={{ padding: '15px' }}>
                      <h3 style={{ fontSize: '16px', margin: '0 0 8px 0', color: '#fff' }}>{item.title}</h3>
                      <p style={{ color: '#4ade80', fontSize: '18px', fontWeight: 'bold', margin: '0 0 8px 0' }}>{item.price.toLocaleString()} TL</p>
                      <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0 }}>📍 {item.location}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div style={{ background: '#1e293b', padding: '25px', borderRadius: '12px', border: '1px solid #334155', maxWidth: '600px', margin: '0 auto' }}>
            <h2 style={{ marginTop: 0, color: '#4ade80' }}>Yeni İlan Ver</h2>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input type="text" value={seller} onChange={(e) => setSeller(e.target.value)} placeholder="Ad Soyad" style={{ padding: '10px', background: '#0f172a', color: '#fff', border: '1px solid #475569', borderRadius: '6px' }} />
              <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Telefon" style={{ padding: '10px', background: '#0f172a', color: '#fff', border: '1px solid #475569', borderRadius: '6px' }} />
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="İlan Başlığı *" required style={{ padding: '10px', background: '#0f172a', color: '#fff', border: '1px solid #475569', borderRadius: '6px' }} />
              <input type="text" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Fiyat (TL) *" required style={{ padding: '10px', background: '#0f172a', color: '#fff', border: '1px solid #475569', borderRadius: '6px' }} />
              <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ padding: '10px', background: '#0f172a', color: '#fff', border: '1px solid #475569', borderRadius: '6px' }}>
                {Object.keys(INITIAL_CATEGORIES).map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
              <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Konum" style={{ padding: '10px', background: '#0f172a', color: '#fff', border: '1px solid #475569', borderRadius: '6px' }} />
              <input type="text" value={image} onChange={(e) => setImage(e.target.value)} placeholder="Görsel URL" style={{ padding: '10px', background: '#0f172a', color: '#fff', border: '1px solid #475569', borderRadius: '6px' }} />
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Açıklama" style={{ padding: '10px', background: '#0f172a', color: '#fff', border: '1px solid #475569', borderRadius: '6px', height: '100px' }}></textarea>
              <button type="submit" style={{ padding: '12px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>🚀 İlanı Yayınla</button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}

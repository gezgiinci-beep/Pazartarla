import React, { useState, useEffect } from 'react';
import AdminPanel from './bileşenler/AdminPanel';
import { Shield, Plus, MapPin, Phone, Mail, Tractor, Sprout, Store, ArrowRight, CheckCircle } from 'lucide-react';

interface Listing {
  id: string;
  title: string;
  category: string;
  price: number;
  location: string;
  image: string;
  description: string;
}

export default function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [selectedCategory, setSelectedCategory] = useState<string>('Tümü');
  const [searchQuery, setSearchQuery] = useState('');
  
  // İlan verme modal/form durumu
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('Arazi');
  const [newPrice, setNewPrice] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const [listings, setListings] = useState<Listing[]>([
    {
      id: '1',
      title: '5 Yıllık Chandler Ceviz Bahçesi',
      category: 'Arazi',
      price: 2500000,
      location: 'Balıkesir / Gönen',
      image: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&q=80&w=800',
      description: '8.300 m² alanda kurulu, damla sulama sistemli verimli ceviz bahçesi.'
    },
    {
      id: '2',
      title: 'John Deere Traktör 5075E',
      category: 'Makineler',
      price: 1450000,
      location: 'Bursa / Mustafakemalpaşa',
      image: 'https://images.unsplash.com/photo-1592417817098-8f3d69204b54?auto=format&fit=crop&q=80&w=800',
      description: 'Temiz kullanılmış, bakımları düzenli yapılmış tarla traktörü.'
    },
    {
      id: '3',
      title: 'Solar Güneş Enerjili Dalgıç Pompa Seti',
      category: 'Sulama',
      price: 85000,
      location: 'İzmir / Tire',
      image: 'https://images.unsplash.com/photo-1508514177221-188b1cf16e9d?auto=format&fit=crop&q=80&w=800',
      description: 'Tarla ve bağ sulaması için off-grid güneş paneli ve pompa kiti.'
    }
  ]);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = (path: string, e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    window.history.pushState({}, '', path);
    setCurrentPath(path);
  };

  const handleAddListing = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle || !newPrice) return;
    
    const newItem: Listing = {
      id: Date.now().toString(),
      title: newTitle,
      category: newCategory,
      price: Number(newPrice),
      location: newLocation || 'Belirtilmemiş',
      image: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&q=80&w=800',
      description: newDesc || 'Açıklama girilmedi.'
    };

    setListings([newItem, ...listings]);
    setShowAddModal(false);
    setNewTitle('');
    setNewPrice('');
    setNewLocation('');
    setNewDesc('');
    alert('İlanınız başarıyla eklendi ve yayına alındı!');
  };

  // Eğer adres /admin ise AdminPanel'i göster
  if (currentPath === '/admin') {
    return <AdminPanel />;
  }

  const filteredListings = listings.filter(item => {
    const matchesCategory = selectedCategory === 'Tümü' || item.category === selectedCategory;
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.location.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-emerald-50/30 text-gray-800">
      {/* Üst Bilgi Barı */}
      <div className="bg-emerald-900 text-emerald-100 text-xs py-1.5 px-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <span className="flex items-center"><Phone className="w-3 h-3 mr-1" /> Destek: 0850 000 00 00</span>
            <span className="flex items-center"><Mail className="w-3 h-3 mr-1" /> bilgi@pazartarla.com.tr</span>
          </div>
          <div>
            <a 
              href="/admin" 
              onClick={(e) => navigateTo('/admin', e)}
              className="text-emerald-300 hover:text-white underline font-medium"
            >
              Yönetici Paneli (Admin)
            </a>
          </div>
        </div>
      </div>

      {/* Ana Header */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2 cursor-pointer" onClick={(e) => navigateTo('/', e)}>
            <div className="bg-emerald-600 text-white p-2 rounded-xl shadow-md">
              <Sprout className="w-6 h-6" />
            </div>
            <div>
              <span className="text-2xl font-black tracking-tight text-emerald-900">Pazar<span className="text-emerald-600">Tarla</span></span>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Tarım ve Hayvancılık Pazarı</p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <button 
              onClick={() => setShowAddModal(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-medium shadow-sm transition flex items-center space-x-2"
            >
              <Plus className="w-5 h-5" />
              <span>Ücretsiz İlan Ver</span>
            </button>
          </div>
        </div>
      </header>

      {/* Hero Alanı */}
      <section className="bg-gradient-to-r from-emerald-900 to-emerald-800 text-white py-14 px-4 relative overflow-hidden">
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <h1 className="text-3xl md:text-5xl font-extrabold mb-4 tracking-tight">
            Tarla, Bahçe, Makine ve Ekipmanların Güvenli Pazarı
          </h1>
          <p className="text-emerald-200 text-lg mb-8 max-w-2xl mx-auto">
            Üreticileri ve alıcıları güvenle buluşturan tarım ticaret platformu.
          </p>

          <div className="bg-white p-2 rounded-2xl shadow-xl flex items-center max-w-2xl mx-auto">
            <input 
              type="text" 
              placeholder="İlan adı, şehir veya ekipman arayın..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 px-4 py-3 text-gray-800 focus:outline-none text-sm md:text-base rounded-xl"
            />
            <button className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-xl font-semibold transition">
              Ara
            </button>
          </div>
        </div>
      </section>

      {/* Kategori Filtreleri */}
      <div className="max-w-7xl mx-auto px-4 mt-8">
        <div className="flex space-x-3 overflow-x-auto pb-2">
          {['Tümü', 'Arazi', 'Makineler', 'Sulama', 'Hayvancılık', 'Gübre & İlaç'].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-5 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition shadow-xs ${
                selectedCategory === cat 
                  ? 'bg-emerald-800 text-white' 
                  : 'bg-white text-gray-700 hover:bg-emerald-50 border border-gray-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* İlan Listesi */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center justify-between">
          <span>Güncel İlanlar</span>
          <span className="text-sm font-normal text-gray-500">{filteredListings.length} ilan listeleniyor</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredListings.map((item) => (
            <div key={item.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition">
              <div className="h-48 overflow-hidden relative">
                <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
                <span className="absolute top-3 left-3 bg-emerald-900/80 backdrop-blur-xs text-white text-xs px-3 py-1 rounded-full font-medium">
                  {item.category}
                </span>
              </div>
              <div className="p-5">
                <div className="text-emerald-700 font-bold text-lg mb-1">
                  {item.price.toLocaleString('tr-TR')} ₺
                </div>
                <h3 className="font-bold text-gray-900 text-base mb-2 line-clamp-1">{item.title}</h3>
                <p className="text-gray-600 text-xs mb-4 line-clamp-2">{item.description}</p>
                <div className="flex items-center justify-between pt-4 border-t border-gray-100 text-xs text-gray-500">
                  <span className="flex items-center"><MapPin className="w-3.5 h-3.5 mr-1 text-emerald-600" /> {item.location}</span>
                  <button className="text-emerald-700 font-semibold hover:underline">Detaylar →</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* İlan Ekleme Modalı */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Hemen Ücretsiz İlan Ver</h2>
            <form onSubmit={handleAddListing} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">İlan Başlığı</label>
                <input 
                  type="text" 
                  required
                  placeholder="Örn: 10 Dönüm Zeytinlik"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-emerald-600"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Kategori</label>
                  <select 
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-emerald-600 bg-white"
                  >
                    <option value="Arazi">Arazi</option>
                    <option value="Makineler">Makineler</option>
                    <option value="Sulama">Sulama</option>
                    <option value="Hayvancılık">Hayvancılık</option>
                    <option value="Gübre & İlaç">Gübre & İlaç</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Fiyat (TL)</label>
                  <input 
                    type="number" 
                    required
                    placeholder="Örn: 500000"
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-emerald-600"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Konum (Şehir / İlçe)</label>
                <input 
                  type="text" 
                  placeholder="Örn: Balıkesir / Gönen"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-emerald-600"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Açıklama</label>
                <textarea 
                  rows={3}
                  placeholder="Ürününüz veya araziniz hakkında detaylı bilgi verin..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-emerald-600"
                />
              </div>
              <div className="flex justify-end space-x-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-sm text-gray-600 hover:bg-gray-100 font-medium"
                >
                  İptal
                </button>
                <button 
                  type="submit" 
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-xl text-sm font-semibold shadow-sm transition"
                >
                  İlanı Yayınla
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

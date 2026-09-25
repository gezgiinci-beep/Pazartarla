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
      image: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=800&q=80',
      description: '8.300 m² alanda kurulu, damla sulama sistemli verimli ceviz bahçesi.'
    },
    {
      id: '2',
      title: 'Organik Çiçek Balı (Meşe Çevrili)',
      category: 'Arıcılık',
      price: 650,
      location: 'Balıkesir / Gönen',
      image: 'https://images.unsplash.com/photo-1587049352847-4a222e784d38?auto=format&fit=crop&w=800&q=80',
      description: 'Meşe ormanlarıyla çevrili alandaki kovanlarımızdan saf ve katkısız süzme çiçek balı.'
    },
    {
      id: '3',
      title: 'Güneş Enerjili Sulama ve Karavan Sistemi',
      category: 'Tarım Ekipmanları',
      price: 45000,
      location: 'Balıkesir / Gönen',
      image: 'https://images.unsplash.com/photo-1508514177221-188b1cf16e9d?auto=format&fit=crop&w=800&q=80',
      description: 'Tarla ve bağ evleri için off-grid güneş paneli, invertör ve dalgıç pompa seti.'
    }
  ]);

  const filteredListings = listings.filter(item => {
    const matchesCategory = selectedCategory === 'Tümü' || item.category === selectedCategory;
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.location.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleAddListing = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle || !newPrice) return;

    const listing: Listing = {
      id: Date.now().toString(),
      title: newTitle,
      category: newCategory,
      price: Number(newPrice),
      location: newLocation || 'Balıkesir / Gönen',
      image: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=800&q=80',
      description: newDesc
    };

    setListings([listing, ...listings]);
    setNewTitle('');
    setNewPrice('');
    setNewLocation('');
    setNewDesc('');
    setShowAddModal(false);
  };

  if (currentPath === '/admin') {
    return <AdminPanel />;
  }

  return (
    <div className="min-h-screen bg-stone-50 text-stone-800 font-sans">
      {/* Header */}
      <header className="bg-emerald-800 text-white shadow-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setCurrentPath('/')}>
            <Sprout className="w-8 h-8 text-emerald-300" />
            <span className="text-2xl font-bold tracking-tight">PazarTarla</span>
            <span className="text-xs bg-emerald-700 px-2 py-0.5 rounded text-emerald-200">Gönen / Kalburcu</span>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition shadow-sm"
            >
              <Plus className="w-5 h-5" /> Ücretsiz İlan Ver
            </button>
            <button
              onClick={() => {
                window.history.pushState({}, '', '/admin');
                setCurrentPath('/admin');
              }}
              className="bg-stone-700 hover:bg-stone-600 text-stone-200 px-3 py-2 rounded-lg text-sm flex items-center gap-1 transition"
            >
              <Shield className="w-4 h-4" /> Yönetim
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-emerald-900 text-white py-12 px-4 relative overflow-hidden">
        <div className="max-w-7xl mx-auto text-center relative z-10">
          <h1 className="text-3xl md:text-5xl font-extrabold mb-4">Topraktan Sofraya, Üreticiden Alıcıya</h1>
          <p className="text-emerald-100 max-w-2xl mx-auto mb-8 text-lg">
            Ceviz bahçeleri, arıcılık ürünleri, tarım ekipmanları ve doğal köy yaşamı ilanları PazarTarla'da buluşuyor.
          </p>
          
          {/* Arama Çubuğu */}
          <div className="max-w-xl mx-auto bg-white p-2 rounded-xl shadow-lg flex items-center">
            <input
              type="text"
              placeholder="İlan, bölge veya ürün ara (Örn: Ceviz, Bal, Gönen)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 text-stone-800 focus:outline-none rounded-lg"
            />
          </div>
        </div>
      </section>

      {/* Kategoriler */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {['Tümü', 'Arazi', 'Arıcılık', 'Tarım Ekipmanları', 'Doğal Ürünler'].map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition ${
                selectedCategory === category
                  ? 'bg-emerald-800 text-white shadow'
                  : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* İlan Listesi */}
      <main className="max-w-7xl mx-auto px-4 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredListings.map((item) => (
            <div key={item.id} className="bg-white rounded-xl shadow-sm hover:shadow-md transition border border-stone-200 overflow-hidden flex flex-col">
              <div className="relative h-48 bg-stone-100">
                <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
                <span className="absolute top-3 left-3 bg-emerald-800 text-white text-xs px-3 py-1 rounded-full font-medium">
                  {item.category}
                </span>
              </div>
              <div className="p-5 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="text-xl font-bold text-stone-900 mb-2">{item.title}</h3>
                  <p className="text-stone-600 text-sm mb-4 line-clamp-2">{item.description}</p>
                </div>
                <div>
                  <div className="flex items-center gap-1 text-stone-500 text-xs mb-4">
                    <MapPin className="w-4 h-4 text-emerald-700" />
                    <span>{item.location}</span>
                  </div>
                  <div className="flex items-center justify-between pt-4 border-t border-stone-100">
                    <span className="text-xl font-extrabold text-emerald-800">
                      {item.price.toLocaleString('tr-TR')} ₺
                    </span>
                    <button className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-1">
                      İncele <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* İlan Ekleme Modalı */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl">
            <h2 className="text-2xl font-bold text-stone-900 mb-4">Yeni İlan Ekle</h2>
            <form onSubmit={handleAddListing} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">İlan Başlığı</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Örn: 10 Kovan Organik Bal"
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Kategori</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full border border-stone-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  >
                    <option value="Arazi">Arazi</option>
                    <option value="Arıcılık">Arıcılık</option>
                    <option value="Tarım Ekipmanları">Tarım Ekipmanları</option>
                    <option value="Doğal Ürünler">Doğal Ürünler</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Fiyat (TL)</label>
                  <input
                    type="number"
                    required
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    placeholder="25000"
                    className="w-full border border-stone-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Konum</label>
                <input
                  type="text"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  placeholder="Balıkesir / Gönen"
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Açıklama</label>
                <textarea
                  rows={3}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Ürün veya arazi hakkında detaylı bilgi..."
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-stone-300 text-stone-700 rounded-lg hover:bg-stone-50"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-emerald-800 text-white rounded-lg hover:bg-emerald-700 font-medium"
                >
                  İlanı Yayınla
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-stone-900 text-stone-400 py-8 px-4 text-center text-sm">
        <p>© 2026 PazarTarla - Gönen / Kalburcu Doğal Yaşam ve Tarım Pazarı</p>
      </footer>
    </div>
  );
}

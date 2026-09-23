import React, { useState } from 'react';
import { CheckCircle, XCircle, Trash2, Shield, LayoutDashboard, FileText, Users, AlertCircle } from 'lucide-react';

interface Listing {
  id: string;
  title: string;
  category: string;
  price: number;
  seller: string;
  status: 'pending' | 'approved' | 'rejected';
  date: string;
}

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState<'listings' | 'users' | 'stats'>('listings');
  
  // Örnek başlangıç ilanları
  const [listings, setListings] = useState<Listing[]>([
    { id: '1', title: '5 Yıllık Chandler Ceviz Bahçesi', category: 'Arazi', price: 2500000, seller: 'Ahmet Yılmaz', status: 'pending', date: '2026-09-23' },
    { id: '2', title: 'John Deere Traktör 5075E', category: 'Makineler', price: 1450000, seller: 'Mehmet Demir', status: 'approved', date: '2026-09-22' },
    { id: '3', title: 'Solar Güneş Enerjili D Sulama Sistemi', category: 'Sulama', price: 85000, seller: 'Can Y.', status: 'pending', date: '2026-09-23' },
  ]);

  const handleStatusChange = (id: string, newStatus: 'approved' | 'rejected') => {
    setListings(listings.map(item => item.id === id ? { ...item, status: newStatus } : item));
  };

  const handleDelete = (id: string) => {
    setListings(listings.filter(item => item.id !== id));
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sol Menü */}
      <div className="w-64 bg-emerald-900 text-white flex flex-col">
        <div className="p-5 flex items-center space-x-3 border-b border-emerald-800">
          <Shield className="w-8 h-8 text-emerald-400" />
          <span className="text-xl font-bold">PazarTarla Admin</span>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <button 
            onClick={() => setActiveTab('listings')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition ${activeTab === 'listings' ? 'bg-emerald-800 text-white' : 'text-emerald-200 hover:bg-emerald-800/50'}`}
          >
            <FileText className="w-5 h-5" />
            <span>İlan Yönetimi</span>
          </button>
          <button 
            onClick={() => setActiveTab('users')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition ${activeTab === 'users' ? 'bg-emerald-800 text-white' : 'text-emerald-200 hover:bg-emerald-800/50'}`}
          >
            <Users className="w-5 h-5" />
            <span>Kullanıcılar</span>
          </button>
          <button 
            onClick={() => setActiveTab('stats')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition ${activeTab === 'stats' ? 'bg-emerald-800 text-white' : 'text-emerald-200 hover:bg-emerald-800/50'}`}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span>İstatistikler</span>
          </button>
        </nav>
      </div>

      {/* Ana İçerik Alanı */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white shadow-sm h-16 flex items-center justify-between px-8">
          <h1 className="text-xl font-semibold text-gray-800">
            {activeTab === 'listings' && 'İlan Onay ve Yönetim Paneli'}
            {activeTab === 'users' && 'Kullanıcı Listesi'}
            {activeTab === 'stats' && 'Genel İstatistikler'}
          </h1>
          <span className="text-sm bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full font-medium">Hoş geldin, Yönetici</span>
        </header>

        <main className="flex-1 overflow-x-hidden overflow-y-auto p-8">
          {activeTab === 'listings' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-600 text-sm border-b border-gray-200">
                    <th className="p-4">İlan Başlığı</th>
                    <th className="p-4">Kategori</th>
                    <th className="p-4">Satıcı</th>
                    <th className="p-4">Fiyat</th>
                    <th className="p-4">Durum</th>
                    <th className="p-4 text-right">İşlemler</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 text-sm">
                  {listings.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50/50">
                      <td className="p-4 font-medium text-gray-900">{item.title}</td>
                      <td className="p-4 text-gray-600">{item.category}</td>
                      <td className="p-4 text-gray-600">{item.seller}</td>
                      <td className="p-4 text-emerald-600 font-semibold">{item.price.toLocaleString('tr-TR')} ₺</td>
                      <td className="p-4">
                        {item.status === 'pending' && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                            <AlertCircle className="w-3 h-3 mr-1" /> Onay Bekliyor
                          </span>
                        )}
                        {item.status === 'approved' && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                            <CheckCircle className="w-3 h-3 mr-1" /> Yayında
                          </span>
                        )}
                        {item.status === 'rejected' && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-800">
                            <XCircle className="w-3 h-3 mr-1" /> Reddedildi
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right space-x-2">
                        {item.status === 'pending' && (
                          <>
                            <button 
                              onClick={() => handleStatusChange(item.id, 'approved')}
                              className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs hover:bg-emerald-700 transition"
                            >
                              Onayla
                            </button>
                            <button 
                              onClick={() => handleStatusChange(item.id, 'rejected')}
                              className="bg-amber-500 text-white px-3 py-1.5 rounded-lg text-xs hover:bg-amber-600 transition"
                            >
                              Reddet
                            </button>
                          </>
                        )}
                        <button 
                          onClick={() => handleDelete(item.id)}
                          className="bg-rose-600 text-white p-1.5 rounded-lg text-xs hover:bg-rose-700 transition inline-block"
                          title="Sil"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'users' && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <p className="text-gray-600">Kayıtlı üreticiler ve alıcılar bu alanda listelenecektir.</p>
            </div>
          )}

          {activeTab === 'stats' && (
            <div className="grid grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h3 className="text-gray-500 text-sm font-medium">Toplam İlan</h3>
                <p className="text-3xl font-bold text-gray-900 mt-2">{listings.length}</p>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h3 className="text-gray-500 text-sm font-medium">Onay Bekleyen</h3>
                <p className="text-3xl font-bold text-amber-600 mt-2">
                  {listings.filter(i => i.status === 'pending').length}
                </p>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h3 className="text-gray-500 text-sm font-medium">Aktif Kullanıcı</h3>
                <p className="text-3xl font-bold text-emerald-600 mt-2">12</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

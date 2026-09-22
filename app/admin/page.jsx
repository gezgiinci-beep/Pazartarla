'use client';

import React, { useState, useEffect } from 'react';

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [stats, setStats] = useState({
    totalListings: 0,
    totalUsers: 0,
    pendingApprovals: 0
  });

  const handleLogin = (e) => {
    e.preventDefault();
    if (password === 'pazartarla2026') {
      setIsAuthenticated(true);
    } else {
      alert('Hatalı şifre!');
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <form onSubmit={handleLogin} className="bg-white p-8 rounded-lg shadow-md w-96">
          <h1 className="text-2xl font-bold mb-6 text-center text-gray-800">Admin Girişi</h1>
          <input
            type="password"
            placeholder="Yönetici şifresi"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded mb-4 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <button
            type="submit"
            className="w-full bg-green-600 text-white p-3 rounded font-semibold hover:bg-green-700 transition"
          >
            Giriş Yap
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">PazarTarla Yönetim Paneli</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-gray-500 text-sm font-medium">Toplam İlan</h3>
            <p className="text-3xl font-bold text-gray-800 mt-2">{stats.totalListings}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-gray-500 text-sm font-medium">Toplam Kullanıcı</h3>
            <p className="text-3xl font-bold text-gray-800 mt-2">{stats.totalUsers}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-gray-500 text-sm font-medium">Onay Bekleyenler</h3>
            <p className="text-3xl font-bold text-gray-800 mt-2">{stats.pendingApprovals}</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Sistem Yönetimi</h2>
          <p className="text-gray-600">Admin paneli başarıyla yüklendi ve aktif durumda.</p>
        </div>
      </div>
    </div>
  );
}


'use client';
import React, { useState, useEffect } from 'react';

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [listings, setListings] = useState([]);

  const handleLogin = (e) => {
    e.preventDefault();
    if (password === 'pazartarla2026') {
      setIsAuthenticated(true);
      setError(false);
      fetchListings();
    } else {
      setError(true);
    }
  };

  const fetchListings = () => {
    const savedListings = JSON.parse(localStorage.getItem('pazartarla_listings') || '[]');
    setListings(savedListings);
  };

  const handleDelete = (id) => {
    const updated = listings.filter((item) => item.id !== id);
    setListings(updated);
    localStorage.setItem('pazartarla_listings', JSON.stringify(updated));
  };

  if (!isAuthenticated) {
    return (
      <main style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#f9fafb', fontFamily: 'sans-serif' }}>
        <form onSubmit={handleLogin} style={{ background: 'white', padding: '2rem', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', width: '100%', maxWidth: '400px' }}>
          <h2 style={{ marginBottom: '1.5rem', textAlign: 'center', color: '#166534' }}>PazarTarla Yönetim</h2>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 'bold' }}>Şifre</label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid #d1d5db', boxSizing: 'border-box' }}
              placeholder="Yönetici şifresini girin"
            />
          </div>
          {error && <p style={{ color: '#dc2626', fontSize: '0.875rem', marginBottom: '1rem' }}>Hatalı şifre!</p>}
          <button type="submit" style={{ width: '100%', padding: '0.75rem', backgroundColor: '#166534', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>
            Giriş Yap
          </button>
        </form>
      </main>
    );
  }

  return (
    <main style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ color: '#166534' }}>İlan Yönetim Paneli</h1>
        <button onClick={() => setIsAuthenticated(false)} style={{ padding: '0.5rem 1rem', backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
          Çıkış Yap
        </button>
      </div>
      
      <div style={{ background: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        {listings.length === 0 ? (
          <p style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>Henüz eklenmiş bir ilan bulunmuyor.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: '#f3f4f6', borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ padding: '0.75rem' }}>İlan Başlığı</th>
                <th style={{ padding: '0.75rem' }}>Kategori</th>
                <th style={{ padding: '0.75rem' }}>Fiyat</th>
                <th style={{ padding: '0.75rem' }}>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {listings.map((item) => (
                <tr key={item.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '0.75rem' }}>{item.title}</td>
                  <td style={{ padding: '0.75rem' }}>{item.category}</td>
                  <td style={{ padding: '0.75rem' }}>{item.price} TL</td>
                  <td style={{ padding: '0.75rem' }}>
                    <button 
                      onClick={() => handleDelete(item.id)}
                      style={{ backgroundColor: '#fee2e2', color: '#dc2626', border: 'none', padding: '0.375rem 0.75rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                      Sil
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}

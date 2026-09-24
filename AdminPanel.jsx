import React, { useState } from 'react';

export function AdminPanel() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  
  const [pendingListings, setPendingListings] = useState([
    { id: '1', title: 'Gönen Kalburcu Mah. 5 Dönüm Cevizli Tarla', owner: 'Can Y.', category: 'Tarla', date: '2026-09-24' },
    { id: '2', title: '10 Kovan Petek Bal ve Arıcılık Malzemesi', owner: 'Can Y.', category: 'Arıcılık', date: '2026-09-23' }
  ]);

  const handleLogin = (e) => {
    e.preventDefault();
    if (password === 'pazartarla2026') {
      setIsAuthenticated(true);
    } else {
      alert('Hatalı Şifre!');
    }
  };

  const handleApprove = (id) => {
    setPendingListings(prev => prev.filter(item => item.id !== id));
    alert('İlan onaylandı ve yayına alındı!');
  };

  const handleDelete = (id) => {
    setPendingListings(prev => prev.filter(item => item.id !== id));
    alert('İlan reddedildi / silindi.');
  };

  if (!isAuthenticated) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb', padding: '16px' }}>
        <form onSubmit={handleLogin} style={{ backgroundColor: 'white', padding: '32px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', width: '100%', maxWidth: '380px', border: '1px solid #f3f4f6' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#1f2937', marginBottom: '24px', textAlign: 'center' }}>PazarTarla Admin Girişi</h2>
          <input
            type="password"
            placeholder="Yönetici Şifresi"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: '100%', padding: '12px', border: '1px solid #d1d5db', borderRadius: '8px', marginBottom: '16px', boxSizing: 'border-box' }}
            required
          />
          <button
            type="submit"
            style={{ width: '100%', backgroundColor: '#16a34a', color: 'white', fontWeight: 'bold', padding: '12px', borderRadius: '8px', border: 'none', cursor: 'pointer' }}
          >
            Giriş Yap
          </button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '24px', backgroundColor: 'white', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', borderBottom: '1px solid #e5e7eb', paddingBottom: '16px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f2937' }}>PazarTarla İlan Onay Yönetimi</h1>
        <button 
          onClick={() => setIsAuthenticated(false)}
          style={{ backgroundColor: '#f3f4f6', color: '#374151', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' }}
        >
          Çıkış Yap
        </button>
      </div>

      {pendingListings.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px', backgroundColor: '#f9fafb', borderRadius: '12px', border: '2px dashed #e5e7eb' }}>
          <p style={{ color: '#6b7280', fontSize: '18px' }}>Onay bekleyen ilan bulunmuyor.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {pendingListings.map(item => (
            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
              <div>
                <span style={{ fontSize: '12px', fontWeight: 'bold', backgroundColor: '#dcfce7', color: '#166534', padding: '4px 10px', borderRadius: '9999px' }}>{item.category}</span>
                <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#111827', marginTop: '8px', marginBottom: '4px' }}>{item.title}</h3>
                <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>Ekleyen: {item.owner} • Tarih: {item.date}</p>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => handleApprove(item.id)}
                  style={{ backgroundColor: '#16a34a', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Onayla
                </button>
                <button
                  onClick={() => handleDelete(item.id)}
                  style={{ backgroundColor: '#fee2e2', color: '#dc2626', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Reddet
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

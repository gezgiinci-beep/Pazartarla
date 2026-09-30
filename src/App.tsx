import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, SlidersHorizontal, MapPin, Phone, MessageCircle, Plus, 
  Heart, Share2, ShieldCheck, CheckCircle2, ChevronRight, ChevronDown, X, 
  Car, Tractor, Wrench, ArrowRight, Bell, User, Filter, AlertCircle, Trash2, Settings, Lock, Check, Mail, Globe, Copy, HelpCircle, Users, Image as ImageIcon, Bug, Shield, Package, ArrowLeft, Menu, ArrowUpDown, LayoutList
} from 'lucide-react';

const DEFAULT_START_LISTINGS = [
  {
    id: 1,
    title: 'Tarladan Doğrudan Tase Chandler Ceviz',
    price: 140,
    category: 'Mahsuller',
    subCategory: 'Ceviz',
    mode: 'Satılık',
    location: 'Gönen / Balıkesir',
    amount: '1 Ton',
    description: 'Kendi bahçemizin ürünü, ilaçsız ve dolgun Chandler ceviz.',
    seller: 'Can İnce',
    phone: '0535 768 1550',
    image: 'https://images.unsplash.com/photo-1559181567-c3190a9959b?auto=format&fit=crop&w=800&q=80',
    seoTags: 'taze ceviz, chandler ceviz, gönen ceviz, tarım ilanı, mahsul',
    status: 'approved',
    isFeatured: true
  }
];

export default function App() {
  const [listings, setListings] = useState(DEFAULT_START_LISTINGS);
  const [activeTab, setActiveTab] = useState('browse');

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f4f6f8', fontFamily: 'system-ui, sans-serif' }}>
      {/* ÜST BİLGİ VE ARAMA ALANI */}
      <header style={{ backgroundColor: '#1b3a2b', color: '#fff', padding: '16px 24px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ fontSize: '22px', fontWeight: 'bold', margin: 0 }}>PazarTarla</h1>
          <button 
            onClick={() => setActiveTab('browse')}
            style={{ backgroundColor: '#2e694f', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}
          >
            İlanları İncele
          </button>
        </div>
      </header>

      {/* ANA İÇERİK */}
      <main style={{ maxWidth: '1200px', margin: '24px auto', padding: '0 16px' }}>
        <h2 style={{ fontSize: '20px', color: '#1b3a2b', marginBottom: '16px' }}>Tarım ve Mahsul İlanları</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
          {listings.map(item => (
            <div key={item.id} style={{ backgroundColor: '#fff', borderRadius: '8px', padding: '16px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
              <img src={item.image} alt={item.title} style={{ width: '100%', height: '160px', objectFit: 'cover', borderRadius: '6px', marginBottom: '12px' }} />
              <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '8px', color: '#333' }}>{item.title}</h3>
              <p style={{ color: '#2e694f', fontWeight: 'bold', fontSize: '18px', marginBottom: '8px' }}>{item.price} TL</p>
              <p style={{ color: '#666', fontSize: '14px', marginBottom: '4px' }}><MapPin size={14} style={{ display: 'inline', marginRight: '4px' }} />{item.location}</p>
              <p style={{ color: '#666', fontSize: '14px' }}>{item.description}</p>
            </div>
          ))}
        </div>
      </main>

      {/* ALT BİLGİ */}
      <footer style={{ backgroundColor: '#1b3a2b', color: '#fff', padding: '16px', textAlign: 'center', marginTop: '40px', fontSize: '14px' }}>
        <p style={{ margin: 0 }}>PazarTarla - Türkiye'nin Güvenilir Tarım ve İlan Platformu</p>
        <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#94a3b8' }}>© 2026 Tüm Hakları Saklıdır.</p>
      </footer>
    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import SubmissionAccountPanel from './components/SubmissionAccountPanel';
import ModerationQueue from './components/ModerationQueue';
import MySubmissions from './components/MySubmissions';
import { useSubmissionAccount } from './hooks/useSubmissionAccount';
import { useModerationQueue } from './hooks/useModerationQueue';
import { useSiteSettings } from './hooks/useSiteSettings';
import SiteSettingsStatus from './components/SiteSettingsStatus';

import {
  Search, SlidersHorizontal, MapPin, Phone, MessageCircle, Plus,
  Heart, Share2, ShieldCheck, CheckCircle2, ChevronRight, ChevronDown, X,
  Car, Tractor, Wrench, ArrowRight, Bell, User, Filter, AlertCircle, Trash2, Settings, Lock, Check, Mail, Globe, Copy, HelpCircle, Users, Image as ImageIcon, Bug, Shield, Package, ArrowLeft, Menu, ArrowUpDown, LayoutList, Star, Send, ShieldAlert, FolderPlus, Tag, Edit3, Sparkles, Megaphone, CheckCircle, Bot, RefreshCw
} from 'lucide-react';

// ==========================================
// SUPABASE BAĞLANTI AYARLARI
// ==========================================
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
    const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

    const dbHeaders = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
    'Content-Type': 'application/json'
    };

    const supabaseClient = SUPABASE_URL && SUPABASE_ANON_KEY
      ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
      : null;

    const isCurrentUserAdmin = async () => {
      if (!supabaseClient) return false;
      const { data, error } = await supabaseClient.rpc('is_listing_admin');
      if (error) throw error;
      return data === true;
    };

    const getAdminDbHeaders = async () => {
      if (!supabaseClient) throw new Error('Supabase is not configured');
      const { data, error } = await supabaseClient.auth.getSession();
      if (error || !data.session) throw new Error('An authenticated admin session is required');
      if (!(await isCurrentUserAdmin())) throw new Error('This account is not authorized');
      return { ...dbHeaders, Authorization: 'Bearer ' + data.session.access_token };
    };

    const LISTING_META_MARKER = '\\n__PAZARTARLA_META_V1__:';
    const DEFAULT_LISTING_IMAGE = 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&q=80&w=800';

    const parseListingMetadata = (rawValue, image) => {
    const rawTags = typeof rawValue === 'string' ? rawValue : '';
    const markerIndex = rawTags.lastIndexOf(LISTING_META_MARKER);
    let seoTags = rawTags;
    let metadata = {};

    if (markerIndex >= 0) {
      try {
        metadata = JSON.parse(decodeURIComponent(rawTags.slice(markerIndex + LISTING_META_MARKER.length)));
        seoTags = rawTags.slice(0, markerIndex);
      } catch (error) {
        metadata = {};
      }
    }

    const fallbackImages = image ? [image] : [DEFAULT_LISTING_IMAGE];
    const images = Array.isArray(metadata.images)
      ? metadata.images.filter(value => typeof value === 'string' && value.trim())
      : fallbackImages;

    return {
      seoTags: seoTags.trim(),
      images: images.length ? images : fallbackImages,
      isFeatured: metadata.isFeatured === true
    };
    };

    const normalizeListing = (item) => {
    const metadata = parseListingMetadata(item.seotags, item.image);
    const autoTags = [
      item.title?.toLowerCase().split(' ').join(', ') || '',
      item.category?.toLowerCase() || '',
      item.subCategory?.toLowerCase() || '',
      item.location?.toLowerCase() || '',
      'tarım ilanı',
      'pazartarla'
    ].filter(Boolean).join(', ');

    return {
      ...item,
      images: metadata.images,
      image: metadata.images[0] || item.image || DEFAULT_LISTING_IMAGE,
      status: item.status || 'approved',
      isFeatured: metadata.isFeatured,
      seoTags: metadata.seoTags || autoTags
    };
    };

    const serializeListingTags = (item) => {
    const images = Array.isArray(item.images)
      ? item.images.filter(value => typeof value === 'string' && value.trim())
      : [];
    const savedImages = images.length ? images : (item.image ? [item.image] : []);
    const metadata = encodeURIComponent(JSON.stringify({
      images: savedImages,
      isFeatured: item.isFeatured === true
    }));

    return String(item.seoTags || '') + LISTING_META_MARKER + metadata;
    };


export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [activeTab, setActiveTab] = useState('home');
  const editFormRef = useRef(null);

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    { sender: 'bot', text: 'Merhaba! PazarTarla canlı destek hattına hoş geldiniz. Size nasıl yardımcı olabilirim?' }
  ]);
  const [chatInput, setChatInput] = useState('');

  const [listings, setListings] = useState([]);
  const [listingsLoading, setListingsLoading] = useState(true);
  const [listingsError, setListingsError] = useState('');

  const siteSettings = useSiteSettings(SUPABASE_URL, SUPABASE_ANON_KEY, getAdminDbHeaders);
  const categoriesWithSubs = siteSettings.settings?.categories || {};
  const announcement = siteSettings.settings?.announcement || '';
  const [tempAnnouncement, setTempAnnouncement] = useState('');
  const [announcementDirty, setAnnouncementDirty] = useState(false);
  const [announcementDraftRevision, setAnnouncementDraftRevision] = useState<number | undefined>();

  const [favorites, setFavorites] = useState(() => {
    try {
      const savedFavs = localStorage.getItem('pazartarla_favorites');
      return savedFavs ? JSON.parse(savedFavs) : [];
    } catch (e) {
      return [];
    }
  });


  const [selectedListing, setSelectedListing] = useState(null);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminAuthError, setAdminAuthError] = useState('');
  const [adminAuthLoading, setAdminAuthLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('Tüm kategoriler');
  const [selectedSubCategory, setSelectedSubCategory] = useState('Tümü');
  const [openCategory, setOpenCategory] = useState('');

  const [newCategoryName, setNewCategoryName] = useState('');
  const [mainCategoryToRemove, setMainCategoryToRemove] = useState('');
  const [newSubCategoryName, setNewSubCategoryName] = useState('');
  const [selectedSubToRemove, setSelectedSubToRemove] = useState('');
  const [editingListing, setEditingListing] = useState(null);
  const [lastAddedListing, setLastAddedListing] = useState(null);
  const [customCategoryInput, setCustomCategoryInput] = useState('');
  const [submissionSaving, setSubmissionSaving] = useState(false);
  const [submissionError, setSubmissionError] = useState('');
  const submissionAccount = useSubmissionAccount(supabaseClient, SUPABASE_URL, SUPABASE_ANON_KEY, normalizeListing);
  const moderation = useModerationQueue(isAdminLoggedIn, SUPABASE_URL, getAdminDbHeaders, normalizeListing);

  const [form, setForm] = useState({
    title: '',
    price: '',
    category: 'Mahsuller',
    subCategory: 'Ceviz',
    mode: 'Satılık',
    location: 'Türkiye Geneli',
    description: '',
    seller: '',
    phone: '',
    images: ['https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&q=80&w=800'],
    seoTags: '',
    status: 'pending'
  });

  useEffect(() => {
    if (!announcementDirty) {
      setTempAnnouncement(announcement);
      setAnnouncementDraftRevision(siteSettings.settings?.revision);
    }
  }, [announcement, announcementDirty, siteSettings.settings?.revision]);

  useEffect(() => {
    if (!isAdminLoggedIn) setAnnouncementDirty(false);
  }, [isAdminLoggedIn]);

  useEffect(() => {
    if (!siteSettings.settings) return;
    const categories = siteSettings.settings.categories;
    const first = Object.keys(categories)[0];
    setNewCategoryName(current => Object.hasOwn(categories, current) ? current : first);
    setMainCategoryToRemove(current => Object.hasOwn(categories, current) ? current : first);
    setSelectedSubToRemove(current => (categories[newCategoryName] || []).includes(current) ? current : '');
    if (selectedCategory !== 'Tüm kategoriler' && !Object.hasOwn(categories, selectedCategory)) {
      setSelectedCategory('Tüm kategoriler');
      setSelectedSubCategory('Tümü');
    } else if (selectedSubCategory !== 'Tümü' && !(categories[selectedCategory] || []).includes(selectedSubCategory)) {
      setSelectedSubCategory('Tümü');
    }
    setForm(current => {
      const category = Object.hasOwn(categories, current.category) ? current.category : first;
      const subCategory = categories[category].includes(current.subCategory) ? current.subCategory : categories[category][0];
      return category === current.category && subCategory === current.subCategory ? current : { ...current, category, subCategory };
    });
  }, [siteSettings.settings, newCategoryName, selectedCategory, selectedSubCategory]);

  const fetchListings = async () => {
      setListingsLoading(true);

      if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        setListings([]);
        setListingsError('Sunucu bağlantı ayarları eksik. İlanlar yüklenemedi.');
        setListingsLoading(false);
        return false;
      }

      try {
        const url = SUPABASE_URL + '/rest/v1/listings?select=*&status=eq.approved&order=created_at.desc';
        const response = await fetch(url, { headers: dbHeaders, cache: 'no-store' });
        if (!response.ok) throw new Error('HTTP ' + response.status);

        const data = await response.json();
        if (!Array.isArray(data)) throw new Error('Invalid listings response');

        setListings(data.map(normalizeListing));
        setListingsError('');
        return true;
      } catch (error) {
        console.error('İlanlar sunucudan alınamadı:', error);
        setListings([]);
        setListingsError('İlanlar sunucudan yüklenemedi. Lütfen yeniden deneyin.');
        return false;
      } finally {
        setListingsLoading(false);
      }
    };

  useEffect(() => {
    const splashTimer = window.setTimeout(() => setShowSplash(false), 3500);
    void fetchListings();
    return () => window.clearTimeout(splashTimer);
  }, []);

  useEffect(() => {
    if (!supabaseClient) return;
    let active = true;
    const syncAdminState = async (session) => {
      if (!session) {
        if (active) setIsAdminLoggedIn(false);
        return;
      }
      try {
        const authorized = await isCurrentUserAdmin();
        if (active) setIsAdminLoggedIn(authorized);
      } catch (error) {
        if (active) setIsAdminLoggedIn(false);
      }
    };

    supabaseClient.auth.getSession().then(({ data, error }) => {
      if (error) {
        if (active) setIsAdminLoggedIn(false);
        return;
      }
      void syncAdminState(data.session);
    });
    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      window.setTimeout(() => { void syncAdminState(session); }, 0);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
      const refreshVisibleListings = () => {
        if (document.visibilityState === 'visible') void fetchListings();
      };

      window.addEventListener('focus', refreshVisibleListings);
      document.addEventListener('visibilitychange', refreshVisibleListings);
      const interval = window.setInterval(refreshVisibleListings, 60_000);

      return () => {
        window.removeEventListener('focus', refreshVisibleListings);
        document.removeEventListener('visibilitychange', refreshVisibleListings);
        window.clearInterval(interval);
      };
    }, []);

    const refreshCanonicalListings = async () => {
      if (!isAdminLoggedIn) return;
      const refreshed = await fetchListings();
      alert(refreshed ? 'Sunucudaki ilanlar yenilendi.' : 'İlanlar sunucudan alınamadı. Lütfen tekrar deneyin.');
    };
    
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

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const userText = chatInput.trim();
    setChatMessages(prev => [...prev, { sender: 'user', text: userText }]);
    setChatInput('');
    setTimeout(() => {
      setChatMessages(prev => [
        ...prev,
        { sender: 'bot', text: 'Mesajınız alındı! Canlı destek ekibimize iletildi veya dilerseniz hemen WhatsApp üzerinden devam edebilirsiniz.' }
      ]);
    }, 1000);
  };

  const saveAnnouncement = async (e) => {
    e.preventDefault();
    if (!isAdminLoggedIn) return;
    const saved = await siteSettings.save({ announcement: tempAnnouncement }, 'Duyuru sunucuya kaydedildi.', announcementDraftRevision);
    if (saved) {
      setTempAnnouncement(saved.announcement);
      setAnnouncementDirty(false);
    }
  };

  const sanitizeInput = (str) => {
    if (typeof str !== 'string') return str;
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => {
      const updated = { ...prev, [name]: value };
      if (name === 'category') {
        const subList = categoriesWithSubs[value] || ['Genel'];
        updated.subCategory = subList[0];
      }
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
      return updated;
    });
  };

  const handleMultipleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    const currentCount = form.images.length;
    if (currentCount + files.length > 10) {
      alert('En fazla 10 adet fotoğraf yükleyebilirsiniz!');
      return;
    }
    let loadedCount = 0;
    const newImages = [...form.images];
    files.forEach(file => {
      if (file.size > 2 * 1024 * 1024) {
        alert(`"${file.name}" 2 MB sınırını aştığı için eklenmedi.`);
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        newImages.push(reader.result);
        loadedCount++;
        if (loadedCount === files.length || newImages.length <= 10) {
          setForm(prev => ({ ...prev, images: newImages.slice(0, 10) }));
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeFormImage = (index) => {
    setForm(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  const handleEditMultipleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    const currentCount = (editingListing.images || []).length;
    if (currentCount + files.length > 10) {
      alert('En fazla 10 adet fotoğraf yükleyebilirsiniz!');
      return;
    }
    let loadedCount = 0;
    const newImages = [...(editingListing.images || [])];
    files.forEach(file => {
      if (file.size > 2 * 1024 * 1024) {
        alert(`"${file.name}" 2 MB sınırını aştığı için eklenmedi.`);
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        newImages.push(reader.result);
        loadedCount++;
        if (loadedCount === files.length || newImages.length <= 10) {
          setEditingListing(prev => ({ ...prev, images: newImages.slice(0, 10) }));
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeEditImage = (index) => {
    setEditingListing(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  const handleDirectAdd = async (e) => {
      e.preventDefault();
      if (submissionSaving) return;
      setSubmissionError('');
      if (!siteSettings.settings || siteSettings.loading || siteSettings.loadError) {
        setSubmissionError('Kategori ayarları yüklenemedi. Önce site ayarlarını yeniden yükleyin.');
        return;
      }
      if (!submissionAccount.canSubmit) {
        setSubmissionError('E-posta adresinizi doğrulayın ve ilan kotanızı kontrol edin. 24 saatte en fazla 3 ilan gönderebilirsiniz.');
        return;
      }
      if (!form.title.trim() || !form.price || !form.phone.trim() || !form.seller.trim()) {
        alert('Lütfen zorunlu alanları eksiksiz doldurun.');
        return;
      }
      const generatedSeoTags = form.title.toLowerCase().split(' ').join(', ') + ', ' + form.category.toLowerCase() + ', ' + form.subCategory.toLowerCase() + ', ' + form.location.toLowerCase() + ', tarım ilanı, pazartarla';
      const finalSeoTags = form.seoTags.trim() ? form.seoTags : generatedSeoTags;
      const primaryImage = (form.images && form.images[0]) || DEFAULT_LISTING_IMAGE;

      const newEntry = {
        id: Date.now(),
        title: sanitizeInput(form.title),
        price: Number(form.price),
        category: form.category,
        subCategory: form.subCategory,
        mode: form.mode,
        location: sanitizeInput(form.location),
        description: sanitizeInput(form.description),
        seller: sanitizeInput(form.seller),
        phone: sanitizeInput(form.phone),
        image: primaryImage,
        images: form.images,
        status: 'pending',
        seoTags: finalSeoTags,
        isFeatured: false
      };

      try {
        setSubmissionSaving(true);
        const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();
        if (sessionError || !sessionData.session) throw new Error('LISTING_VERIFIED_ACCOUNT_REQUIRED');
        const response = await fetch(SUPABASE_URL + '/rest/v1/listings', {
          method: 'POST',
          headers: { ...dbHeaders, Authorization: 'Bearer ' + sessionData.session.access_token, 'Prefer': 'return=representation' },
          body: JSON.stringify({
            title: newEntry.title,
            price: newEntry.price,
            category: newEntry.category,
            subCategory: newEntry.subCategory,
            mode: newEntry.mode,
            location: newEntry.location,
            description: newEntry.description,
            seller: newEntry.seller,
            phone: newEntry.phone,
            image: newEntry.image,
            seotags: serializeListingTags(newEntry),
            status: 'pending'
          })
        });
        if (!response.ok) {
          const problem = await response.json().catch(() => ({}));
          throw new Error(problem.message || ('HTTP ' + response.status));
        }
        const rows = await response.json();
        if (!Array.isArray(rows) || !rows[0]) throw new Error('Sunucu ilanı kaydetmedi.');

        const savedListing = normalizeListing(rows[0]);
        setListingsError('');
        setLastAddedListing(savedListing);
        await submissionAccount.refresh();
        if (isAdminLoggedIn) await moderation.refresh();
        setForm(current => ({ ...current, title: '', price: '', description: '', seoTags: '', images: [DEFAULT_LISTING_IMAGE], status: 'pending' }));
        changeTab('success-wa');
      } catch (error) {
        const reason = String(error?.message || '');
        setSubmissionError(reason.includes('LISTING_DAILY_LIMIT_REACHED')
          ? '24 saatlik 3 ilan sınırına ulaştınız. Kotanız yenilendiğinde tekrar gönderebilirsiniz.'
          : reason.includes('LISTING_VERIFIED_ACCOUNT_REQUIRED')
            ? 'İlan göndermek için doğrulanmış e-posta hesabınızla giriş yapın.'
            : 'İlan onaya gönderilemedi. Formunuz korunuyor; bağlantınızı ve kotanızı kontrol edip yeniden deneyin.');
        await submissionAccount.refresh();
      } finally {
        setSubmissionSaving(false);
      }
    };

  const moderateListing = async (id, decision) => {
    if (await moderation.decide(id, decision)) {
      await Promise.all([fetchListings(), submissionAccount.refresh()]);
    }
  };

  const toggleFeaturedListing = async (id) => {
      if (!isAdminLoggedIn) return;
      const target = listings.find(item => item.id === id);
      if (!target) return;

      const updatedListing = { ...target, isFeatured: !target.isFeatured };
      try {
        const response = await fetch(SUPABASE_URL + '/rest/v1/listings?id=eq.' + encodeURIComponent(id), {
          method: 'PATCH',
          headers: { ...(await getAdminDbHeaders()), 'Prefer': 'return=representation' },
          body: JSON.stringify({ seotags: serializeListingTags(updatedListing) })
        });
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const rows = await response.json();
        if (!Array.isArray(rows) || !rows[0]) throw new Error('Sunucu vitrin durumunu kaydetmedi.');

        const savedListing = normalizeListing(rows[0]);
        setListings(currentListings => currentListings.map(item => item.id === id ? savedListing : item));
        setListingsError('');
      } catch (error) {
        console.error('Vitrin durumu kaydedilemedi:', error);
        alert('Vitrin durumu sunucuya kaydedilemedi. Lütfen tekrar deneyin.');
      }
    };

  const startEditingFromDetail = (item) => {
    if (!isAdminLoggedIn) {
      alert('Önce Yönetici Paneline giriş yapmalısınız.');
      changeTab('admin-page');
      return;
    }
    setEditingListing({
      ...item,
      images: item.images || [item.image],
      seoTags: item.seoTags || ''
    });
    changeTab('admin-page');
    setTimeout(() => {
      if (editFormRef.current) editFormRef.current.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const saveEditedListing = async (e) => {
      e.preventDefault();
      if (!isAdminLoggedIn) return;

      const primaryImage = (editingListing.images && editingListing.images[0]) || editingListing.image || DEFAULT_LISTING_IMAGE;
      const updatedListing = {
        ...editingListing,
        title: sanitizeInput(editingListing.title),
        price: Number(editingListing.price),
        category: editingListing.category,
        subCategory: editingListing.subCategory,
        location: sanitizeInput(editingListing.location),
        description: sanitizeInput(editingListing.description),
        image: primaryImage,
        images: editingListing.images && editingListing.images.length ? editingListing.images : [primaryImage],
        seoTags: editingListing.seoTags || ''
      };

      try {
        const response = await fetch(SUPABASE_URL + '/rest/v1/listings?id=eq.' + encodeURIComponent(updatedListing.id), {
          method: 'PATCH',
          headers: { ...(await getAdminDbHeaders()), 'Prefer': 'return=representation' },
          body: JSON.stringify({
            title: updatedListing.title,
            price: updatedListing.price,
            category: updatedListing.category,
            subCategory: updatedListing.subCategory,
            location: updatedListing.location,
            description: updatedListing.description,
            image: updatedListing.image,
            seotags: serializeListingTags(updatedListing)
          })
        });
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const rows = await response.json();
        if (!Array.isArray(rows) || !rows[0]) throw new Error('Sunucu ilanı güncellemedi.');

        const savedListing = normalizeListing(rows[0]);
        setListings(currentListings => currentListings.map(item => item.id === savedListing.id ? savedListing : item));
        setListingsError('');
        setEditingListing(null);
        alert('İlan güncellendi!');
        changeTab('home');
      } catch (error) {
        console.error('İlan güncellenemedi:', error);
        alert('İlan sunucuya kaydedilemedi. Değişiklikler uygulanmadı; lütfen tekrar deneyin.');
      }
    };

  const handleDeleteListing = async (id) => {
      if (!isAdminLoggedIn) return;
      if (!window.confirm('Bu ilanı silmek istediğinize emin misiniz?')) return;

      try {
        const response = await fetch(SUPABASE_URL + '/rest/v1/listings?id=eq.' + encodeURIComponent(id), {
          method: 'DELETE',
          headers: { ...(await getAdminDbHeaders()), 'Prefer': 'return=representation' }
        });
        if (!response.ok) throw new Error('HTTP ' + response.status);
        if (response.status !== 204) {
          const deletedRows = await response.json().catch(() => []);
          if (Array.isArray(deletedRows) && deletedRows.length === 0) throw new Error('Sunucu ilanı silmedi.');
        }

        setListings(currentListings => currentListings.filter(item => item.id !== id));
        setListingsError('');
      } catch (error) {
        console.error('İlan silinemedi:', error);
        alert('İlan sunucudan silinemedi. Liste değiştirilmedi; lütfen tekrar deneyin.');
      }
    };

  const handleAddNewMainCategory = async (e) => {
    e.preventDefault();
    if (!isAdminLoggedIn) return;
    if (!customCategoryInput.trim()) return;
    const cat = customCategoryInput.trim();
    if (Object.hasOwn(categoriesWithSubs, cat)) {
      alert('Bu kategori zaten mevcut!');
      return;
    }
    if (await siteSettings.save({ categories: { ...categoriesWithSubs, [cat]: ['Genel'] } }, `"${cat}" ana kategorisi sunucuya kaydedildi.`)) {
      setCustomCategoryInput('');
    }
  };

  const handleDeleteMainCategory = async (catKey) => {
    if (!isAdminLoggedIn) return;
    if (!Object.hasOwn(categoriesWithSubs, catKey)) return;
    if (Object.keys(categoriesWithSubs).length === 1) {
      alert('İlan verilebilmesi için en az bir ana kategori kalmalı.');
      return;
    }
    if (window.confirm(`"${catKey}" kategorisini ve altındaki tüm seçenekleri silmek istediğinize emin misiniz?`)) {
      const updated = { ...categoriesWithSubs };
      delete updated[catKey];
      await siteSettings.save({ categories: updated }, 'Ana kategori sunucudan silindi.');
    }
  };

  const handleAddSubCategory = async (e) => {
    e.preventDefault();
    if (!isAdminLoggedIn) return;
    const catName = newCategoryName;
    if (!Object.hasOwn(categoriesWithSubs, catName)) return;
    const currentSubs = categoriesWithSubs[catName] || [];
    const newSubs = newSubCategoryName ? newSubCategoryName.split(',').map(s => s.trim()).filter(Boolean) : [];
    if (!newSubs.length) return;
    const combined = Array.from(new Set([...currentSubs, ...newSubs]));
    if (await siteSettings.save({ categories: { ...categoriesWithSubs, [catName]: combined } }, 'Alt seçenekler sunucuya kaydedildi.')) {
      setNewSubCategoryName('');
    }
  };

  const handleDeleteSubCategory = async (catKey, subToDel) => {
    if (!isAdminLoggedIn) return;
    const currentSubs = categoriesWithSubs[catKey] || [];
    if (!currentSubs.includes(subToDel)) return;
    const updatedSubs = currentSubs.filter(sub => sub !== subToDel);
    if (await siteSettings.save({ categories: { ...categoriesWithSubs, [catKey]: updatedSubs.length ? updatedSubs : ['Genel'] } }, 'Alt seçenek sunucudan silindi.')) {
      setSelectedSubToRemove('');
    }
  };

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setAdminAuthError('');
    const email = adminEmail.trim().toLowerCase();
    if (!email || !adminPassword) {
      setAdminAuthError('E-posta ve parola gerekli.');
      return;
    }
    if (!supabaseClient) {
      setAdminAuthError('Giriş hizmeti yapılandırılmamış.');
      return;
    }

    setAdminAuthLoading(true);
    try {
      const { error } = await supabaseClient.auth.signInWithPassword({ email, password: adminPassword });
      if (error) throw error;
      if (!(await isCurrentUserAdmin())) {
        await supabaseClient.auth.signOut();
        throw new Error('Not authorized');
      }
      setIsAdminLoggedIn(true);
    } catch (error) {
      console.error('Yönetici girişi başarısız.');
      setIsAdminLoggedIn(false);
      setAdminAuthError('Giriş başarısız veya bu hesap yönetici olarak yetkilendirilmemiş.');
    } finally {
      setAdminPassword('');
      setAdminAuthLoading(false);
    }
  };

  const handleAdminLogout = async () => {
    if (supabaseClient) await supabaseClient.auth.signOut();
    setIsAdminLoggedIn(false);
    setAdminAuthError('');
  };

  const approvedListings = listings.filter(item => item.status === 'approved');
  const featuredListings = approvedListings.filter(item => item.isFeatured === true);
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
      <div style={{ position: 'fixed', inset: 0, backgroundColor: '#0f172a', color: '#f8fafc', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '24px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '32px', fontWeight: '700', margin: 0 }}>Türkiye'nin İlk ve Tek <br /><span style={{ color: '#2add9c' }}>Tarım Platformu</span></h1>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f4f6f8', color: '#1e293b', fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column', width: '100%', maxWidth: '100vw', boxSizing: 'border-box', position: 'relative' }}>
      <header style={{ backgroundColor: '#1b3a2b', color: '#ffffff', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }} onClick={() => { changeTab('home'); setSelectedCategory('Tüm kategoriler'); }}>
          <div style={{ backgroundColor: '#22c55e', padding: '6px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span>🌾</span>
            <Tractor size={18} color="#fff" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '18px', fontWeight: '800' }}>PazarTarla</h1>
            <span style={{ fontSize: '10px', color: '#86efac' }}>Canlı Ortak Platform</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button onClick={() => changeTab('favorites')} style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>
            ❤ ({favorites.length})
          </button>
          <button onClick={() => changeTab('add')} style={{ backgroundColor: '#22c55e', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: '700', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Plus size={16} /> İlan Ver
          </button>
        </div>
      </header>

      <main style={{ width: '100%', maxWidth: '600px', margin: '0 auto', padding: '12px', flex: 1, boxSizing: 'border-box' }}>
          <SiteSettingsStatus state={siteSettings} />
          {listingsError && (
            <div role="alert" style={{ backgroundColor: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 12px', marginBottom: '12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ flex: 1 }}>{listingsError}</span>
              <button onClick={() => fetchListings()} style={{ border: 'none', borderRadius: '5px', padding: '6px 8px', backgroundColor: '#991b1b', color: '#fff', fontWeight: '700', cursor: 'pointer' }}>Yeniden Dene</button>
            </div>
          )}
          {listingsLoading && listings.length === 0 && (
            <div role="status" style={{ backgroundColor: '#fff', color: '#475569', borderRadius: '8px', padding: '12px', marginBottom: '12px', fontSize: '13px' }}>İlanlar yükleniyor...</div>
          )}
          {announcement && (
          <div style={{ backgroundColor: '#fef08a', color: '#713f12', padding: '10px 14px', borderRadius: '10px', marginBottom: '12px', fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #facc15', overflow: 'hidden', whiteSpace: 'nowrap' }}>
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
              <div className="marquee-text">{announcement}</div>
            </div>
          </div>
        )}

        {activeTab === 'success-wa' && (
          <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '24px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
            <CheckCircle size={36} color="#166534" style={{ margin: '0 auto 12px auto' }} />
            <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#1b3a2b', margin: '0 0 8px 0' }}>İlanınız Onay İçin Alındı</h2>
            <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '20px' }}>İlanınız henüz yayında değil. Yönetici onayından sonra herkes tarafından görülebilecek. Durumunu İlan Ver bölümündeki gönderimlerinizden takip edebilirsiniz.</p>
            {lastAddedListing && (
              <a
                href={`https://api.whatsapp.com/send?phone=905357681550&text=${encodeURIComponent(`PazarTarla ilanım yönetici onayını bekliyor.\n\nBaşlık: ${lastAddedListing.title}\nFiyat: ${lastAddedListing.price} TL\nKategori: ${lastAddedListing.category} / ${lastAddedListing.subCategory}\nSatıcı: ${lastAddedListing.seller} (${lastAddedListing.phone})`)}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', backgroundColor: '#22c55e', color: '#fff', padding: '12px', borderRadius: '8px', fontWeight: '800', textDecoration: 'none', fontSize: '14px', marginBottom: '12px' }}
              >
                <MessageCircle size={18} /> Yöneticiye Haber Ver
              </a>
            )}
            <button onClick={() => changeTab('home')} style={{ background: 'none', border: 'none', color: '#64748b', fontWeight: '700', cursor: 'pointer' }}>← Ana Sayfaya Dön</button>
          </div>
        )}

        {activeTab === 'home' && (
          <div>
            <div style={{ backgroundColor: '#ecfdf5', border: '1.5px dashed #10b981', borderRadius: '12px', padding: '14px 16px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ backgroundColor: '#d1fae5', padding: '8px', borderRadius: '8px', color: '#059669', flexShrink: 0 }}>
                  <Sparkles size={20} />
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '800', color: '#065f46' }}>Tarım Ürününüzü veya İşletmenizi Tanıtın!</div>
                  <div style={{ fontSize: '11px', color: '#047857', marginTop: '2px' }}>Dilerseniz buraya özel reklam verebilir, binlerce çiftçiye ulaşabilirsiniz.</div>
                </div>
              </div>
              <a
                href="https://api.whatsapp.com/send?phone=905357681550&text=Merhaba,%20PazarTarla%20ana%20sayfasında%20reklam%20vermek%20istiyorum.%20Bilgi%20alabilir%20miyim?"
                target="_blank"
                rel="noopener noreferrer"
                style={{ backgroundColor: '#059669', color: '#fff', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}
              >
                Reklam Ver
              </a>
            </div>

            {featuredListings.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', fontWeight: '800', fontSize: '14px', color: '#854d0e' }}>
                  <Star size={16} fill="#eab308" color="#eab308" /> Vitrin İlanları
                </div>
                <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '4px' }}>
                  {featuredListings.map(item => {
                    const displayImg = (item.images && item.images[0]) || item.image || 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&q=80&w=800';
                    return (
                      <div key={`feat-${item.id}`} onClick={() => { setSelectedListing({ ...item, images: item.images || [displayImg] }); changeTab('detail'); }} style={{ minWidth: '160px', maxWidth: '160px', backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #fde047', cursor: 'pointer', overflow: 'hidden', flexShrink: 0, padding: '8px' }}>
                        <img src={displayImg} alt={item.title} style={{ width: '100%', height: '100px', objectFit: 'cover', borderRadius: '6px', marginBottom: '6px' }} />
                        <div style={{ fontSize: '12px', fontWeight: '700', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</div>
                        <div style={{ fontSize: '13px', fontWeight: '800', color: '#1b3a2b', marginTop: '2px' }}>{Number(item.price).toLocaleString('tr-TR')} TL</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div style={{ backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
              <div style={{ backgroundColor: '#1b3a2b', color: '#fff', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Menu size={20} />
                <span style={{ fontSize: '16px', fontWeight: '700' }}>Kategoriler (Canlı)</span>
              </div>
              <div onClick={() => { setSelectedCategory('Tüm kategoriler'); setSelectedSubCategory('Tümü'); changeTab('results'); }} style={{ padding: '14px 16px', borderBottom: '1px solid #edf2f7', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', backgroundColor: '#f8fafc' }}>
                <span style={{ fontWeight: '700', color: '#1b3a2b', fontSize: '15px' }}>Tüm Türkiye Tarım İlanları</span>
                <span style={{ color: '#22c55e', fontWeight: '700' }}>({approvedListings.length})</span>
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
                        <div onClick={(e) => { e.stopPropagation(); setSelectedCategory(cat); setSelectedSubCategory('Tümü'); changeTab('results'); }} style={{ padding: '10px 16px 10px 28px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', fontSize: '13px', color: '#166534', fontWeight: '600' }}>
                          → Tüm {cat} İlanları
                        </div>
                        {(categoriesWithSubs[cat] || []).map(sub => (
                          <div key={sub} onClick={(e) => { e.stopPropagation(); setSelectedCategory(cat); setSelectedSubCategory(sub); changeTab('results'); }} style={{ padding: '10px 16px 10px 28px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', fontSize: '13px', color: '#64748b' }}>
                            • {sub}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'results' && (
          <div>
            <div style={{ backgroundColor: '#1b3a2b', color: '#fff', borderRadius: '10px', padding: '10px 14px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button onClick={() => changeTab('home')} style={{ background: 'none', border: 'none', color: '#86efac', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}><ArrowLeft size={16} /> Kategoriler</button>
              <span>{filteredListings.length} sonuç</span>
            </div>
            {filteredListings.map(item => {
              const displayImg = (item.images && item.images[0]) || item.image || 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&q=80&w=800';
              return (
                <div key={item.id} onClick={() => { setSelectedListing({ ...item, images: item.images || [displayImg] }); changeTab('detail'); }} style={{ backgroundColor: '#fff', borderRadius: '10px', overflow: 'hidden', border: '1px solid #e2e8f0', cursor: 'pointer', display: 'flex', gap: '10px', padding: '10px', marginBottom: '10px' }}>
                  <img src={displayImg} alt={item.title} style={{ width: '90px', height: '90px', objectFit: 'cover', borderRadius: '8px' }} />
                  <div style={{ flex: 1 }}>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '13px', fontWeight: '700' }}>{item.title}</h4>
                    <div style={{ fontSize: '15px', fontWeight: '800', color: '#1b3a2b' }}>{Number(item.price).toLocaleString('tr-TR')} TL</div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>📍 {item.location}</div>
                  </div>
                </div>
              );
            })}
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
            {selectedListing.images && selectedListing.images.length > 0 ? (
              <div>
                <img src={selectedListing.images[0]} alt={selectedListing.title} style={{ width: '100%', height: '220px', objectFit: 'cover', borderRadius: '8px', marginBottom: '8px' }} />
                {selectedListing.images.length > 1 && (
                  <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', marginBottom: '12px', paddingBottom: '4px' }}>
                    {selectedListing.images.map((imgUrl, idx) => (
                      <img
                        key={idx}
                        src={imgUrl}
                        alt={`Galeri ${idx}`}
                        onClick={() => {
                          const updatedImgs = [imgUrl, ...selectedListing.images.filter((_, i) => i !== idx)];
                          setSelectedListing({ ...selectedListing, images: updatedImgs });
                        }}
                        style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '4px', cursor: 'pointer', border: idx === 0 ? '2px solid #22c55e' : '1px solid #cbd5e1', flexShrink: 0 }}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <img src={selectedListing.image || 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&q=80&w=800'} alt={selectedListing.title} style={{ width: '100%', height: '220px', objectFit: 'cover', borderRadius: '8px', marginBottom: '10px' }} />
            )}
            <h2 style={{ fontSize: '18px', fontWeight: '800', margin: '8px 0' }}>{selectedListing.title}</h2>
            <div style={{ fontSize: '22px', fontWeight: '800', color: '#1b3a2b', marginBottom: '4px' }}>{Number(selectedListing.price).toLocaleString('tr-TR')} TL</div>
            <p style={{ color: '#475569', fontSize: '13px', marginBottom: '12px', lineHeight: '1.5' }}>{selectedListing.description}</p>

            <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '10px 12px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: '700', color: '#166534', marginBottom: '6px' }}>
                <Tag size={12} /> Otomatik Arama &amp; SEO Etiketleri
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {(selectedListing.seoTags || `${selectedListing.title?.toLowerCase().split(' ').join(', ') || ''}, ${selectedListing.category?.toLowerCase() || ''}, ${selectedListing.location?.toLowerCase() || ''}`).split(',').map((tag, idx) => (
                  <span key={idx} style={{ backgroundColor: '#dcfce7', color: '#14532d', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600' }}>
                    #{tag.trim()}
                  </span>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '8px' }}>📤 Bu İlanı Paylaş:</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <a
                  href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`🌾 *PazarTarla İlanı*\n*${selectedListing.title}*\nFiyat: ${Number(selectedListing.price).toLocaleString('tr-TR')} TL\nKonum: ${selectedListing.location}\nİncelemek için tıkla`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ flex: 1, backgroundColor: '#22c55e', color: '#fff', padding: '8px 10px', borderRadius: '6px', textAlign: 'center', fontWeight: '700', textDecoration: 'none', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                >
                  <MessageCircle size={14} /> WhatsApp
                </a>
                <a
                  href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ flex: 1, backgroundColor: '#1877f2', color: '#fff', padding: '8px 10px', borderRadius: '6px', textAlign: 'center', fontWeight: '700', textDecoration: 'none', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                >
                  <Share2 size={14} /> Facebook
                </a>
                <button
                  onClick={() => {
                    const shareText = `PazarTarla'da harika bir tarım ilanı: ${selectedListing.title} - ${Number(selectedListing.price).toLocaleString('tr-TR')} TL (${selectedListing.location})`;
                    navigator.clipboard.writeText(shareText);
                    alert('📋 İlan bilgileri panoya kopyalandı! Instagram hikayenizde veya mesajınızda doğrudan yapıştırıp paylaşabilirsiniz.');
                  }}
                  style={{ flex: 1, backgroundColor: '#e1306c', color: '#fff', border: 'none', padding: '8px 10px', borderRadius: '6px', textAlign: 'center', fontWeight: '700', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                >
                  <ImageIcon size={14} /> Instagram
                </button>
              </div>
            </div>

            <a href={`tel:${selectedListing.phone}`} style={{ width: '100%', backgroundColor: '#1b3a2b', color: '#fff', padding: '12px', borderRadius: '8px', textAlign: 'center', fontWeight: '700', textDecoration: 'none', display: 'block', boxSizing: 'border-box' }}>
              📞 {selectedListing.phone} ({selectedListing.seller})
            </a>
          </div>
        )}

        {activeTab === 'add' && (
          <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '16px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <button onClick={() => changeTab(isAdminLoggedIn ? 'admin-page' : 'home')} style={{ background: 'none', border: 'none', color: '#64748b', fontWeight: '600', cursor: 'pointer' }}>{isAdminLoggedIn ? '← Yönetim Paneline Dön' : '← Vazgeç'}</button>
              <h2 style={{ fontSize: '16px', fontWeight: '800', margin: 0 }}>{submissionAccount.quota?.unlimited ? 'Yönetici İlanı Ekle — Sınırsız' : 'İlan Ver (En Fazla 10 Fotoğraf)'}</h2>
            </div>
            <SubmissionAccountPanel session={submissionAccount.session} quota={submissionAccount.quota}
              loading={submissionAccount.loading} busy={submissionAccount.busy} error={submissionAccount.error}
              message={submissionAccount.message} onAuthenticate={submissionAccount.authenticate}
              onResend={submissionAccount.resend} onSignOut={submissionAccount.signOut}
              onRefresh={() => { void submissionAccount.refresh(); }} />
            {submissionAccount.session && <MySubmissions items={submissionAccount.items}
              loading={submissionAccount.loading} error={submissionAccount.error}
              onRefresh={() => { void submissionAccount.refresh(); }} />}
            {submissionAccount.session && submissionAccount.quota?.email_verified && (
            <form onSubmit={handleDirectAdd} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input type="text" name="seller" placeholder="Adınız Soyadınız *" value={form.seller} onChange={handleFormChange} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
              <input type="text" name="phone" placeholder="Telefon Numaranız *" value={form.phone} onChange={handleFormChange} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
              <input type="text" name="title" placeholder="İlan Başlığı * (Otomatik SEO için önemlidir)" value={form.title} onChange={handleFormChange} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
              <input type="number" name="price" placeholder="Fiyat (TL) *" value={form.price} onChange={handleFormChange} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
              <select name="category" value={form.category} onChange={handleFormChange} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                {Object.keys(categoriesWithSubs).map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
              <select name="subCategory" value={form.subCategory} onChange={handleFormChange} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                {(categoriesWithSubs[form.category] || ['Genel']).map(sub => <option key={sub} value={sub}>{sub}</option>)}
              </select>
              <input type="text" name="location" placeholder="Konum (Örn: Gönen / Balıkesir)" value={form.location} onChange={handleFormChange} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
              <input type="text" name="seoTags" placeholder="Özel SEO Etiketleri (Boş bırakırsanız otomatik üretilir)" value={form.seoTags} onChange={handleFormChange} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
              <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569' }}>📷 Fotoğraf Yükle (En Fazla 10 Adet - Seçili: {form.images.length}/10)</label>
                <input type="file" accept="image/*" multiple onChange={handleMultipleImageUpload} style={{ width: '100%', fontSize: '12px' }} />
                {form.images.length > 0 && (
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                    {form.images.map((imgSrc, idx) => (
                      <div key={idx} style={{ position: 'relative', width: '60px', height: '60px' }}>
                        <img src={imgSrc} alt={`Önizleme ${idx}`} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                        <button type="button" onClick={() => removeFormImage(idx)} style={{ position: 'absolute', top: '-4px', right: '-4px', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '50%', width: '18px', height: '18px', fontSize: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <textarea name="description" placeholder="Açıklama..." value={form.description} onChange={handleFormChange} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', height: '80px' }} />
              {submissionError && <div role="alert" style={{ color: '#b91c1c', fontSize: '13px' }}>{submissionError}</div>}
              <button type="submit" disabled={submissionSaving || !submissionAccount.canSubmit || !siteSettings.settings || !!siteSettings.loadError}
                style={{ backgroundColor: '#22c55e', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', opacity: submissionSaving || !submissionAccount.canSubmit || !siteSettings.settings || !!siteSettings.loadError ? 0.6 : 1 }}>
                {submissionSaving ? 'Onaya gönderiliyor…' : 'İlanı Onaya Gönder'}
              </button>
            </form>
            )}
          </div>
        )}

        {activeTab === 'admin-page' && (
          <div ref={editFormRef} style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '16px', border: '1px solid #e2e8f0' }}>
            {!isAdminLoggedIn ? (
              <div style={{ maxWidth: '320px', margin: '30px auto', textAlign: 'center' }}>
                <h2 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '10px' }}>Yönetici Girişi</h2>
                <form onSubmit={handleAdminLogin} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <input type="email" autoComplete="username" placeholder="E-posta adresi" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} required style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                  <input type="password" autoComplete="current-password" placeholder="Supabase parolası" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} required style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', textAlign: 'center' }} />
                  {adminAuthError && <div role="alert" style={{ color: '#b91c1c', fontSize: '12px' }}>{adminAuthError}</div>}
                  <button type="submit" disabled={adminAuthLoading} style={{ backgroundColor: '#1b3a2b', color: '#fff', border: 'none', padding: '10px', borderRadius: '6px', fontWeight: '700', cursor: adminAuthLoading ? 'wait' : 'pointer', opacity: adminAuthLoading ? 0.7 : 1 }}>{adminAuthLoading ? 'Giriş yapılıyor…' : 'Giriş Yap'}</button>
                  <p style={{ margin: 0, color: '#64748b', fontSize: '11px' }}>Yalnızca Supabase’te yetkilendirilmiş hesaplar erişebilir.</p>
                </form>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h2 style={{ fontSize: '16px', fontWeight: '800', margin: 0 }}>🛡️ Tam Kontrol Paneli</h2>
                  <button onClick={handleAdminLogout} style={{ backgroundColor: '#ef4444', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}>Çıkış</button>
                </div>

                <button type="button" onClick={() => changeTab('add')}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', backgroundColor: '#166534', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', marginBottom: '16px' }}>
                  <Plus size={16} /> Sınırsız İlan Ekle
                </button>

                <ModerationQueue items={moderation.items} loading={moderation.loading}
                  error={moderation.error} busyId={moderation.busyId} onDecision={moderateListing}
                  onRefresh={() => { void moderation.refresh(); }} />

                <div style={{ backgroundColor: '#fef08a', padding: '12px', borderRadius: '8px', marginBottom: '16px', border: '1px solid #facc15' }}>
                  <h3 style={{ fontSize: '13px', fontWeight: '800', color: '#713f12', margin: '0 0 6px 0' }}>🔄 Sunucudaki İlanları Yenile</h3>
                  <p style={{ fontSize: '11px', color: '#854d0e', margin: '0 0 8px 0' }}>Bu işlem, güncel ilanları ortak veritabanından yeniden yükler.</p>
                  <button type="button" onClick={refreshCanonicalListings} style={{ width: '100%', backgroundColor: '#ca8a04', color: '#fff', border: 'none', padding: '10px', borderRadius: '6px', fontWeight: '700', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                    <RefreshCw size={14} /> Sunucudaki İlanları Yenile
                  </button>
                </div>

                <div style={{ backgroundColor: '#fef9c3', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#854d0e', margin: '0 0 8px 0' }}>Duyuru Banner Yönetimi</h3>
                  <SiteSettingsStatus state={siteSettings} admin />
                  <fieldset disabled={!siteSettings.editable} style={{ border: 0, padding: 0, margin: 0 }}>
                  <form onSubmit={saveAnnouncement} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <input type="text" aria-label="Site duyurusu" maxLength={1000} value={tempAnnouncement} onChange={(e) => { setTempAnnouncement(e.target.value); setAnnouncementDirty(true); }} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #facc15' }} />
                    <button type="submit" style={{ backgroundColor: '#ca8a04', color: '#fff', border: 'none', padding: '8px', borderRadius: '6px', fontWeight: '700', cursor: 'pointer' }}>Güncelle</button>
                    <button type="button" onClick={() => { setTempAnnouncement(announcement); setAnnouncementDraftRevision(siteSettings.settings?.revision); setAnnouncementDirty(false); }} style={{ padding: '6px', cursor: 'pointer' }}>Sunucudaki duyuruyu al</button>
                  </form>
                  </fieldset>
                </div>

                {editingListing && (
                  <div style={{ backgroundColor: '#f0fdf4', padding: '14px', borderRadius: '8px', border: '2px solid #22c55e', marginBottom: '20px' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#166534', margin: '0 0 10px 0' }}>✏ İlanı Düzenle</h3>
                    <form onSubmit={saveEditedListing} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <input type="text" name="title" value={editingListing.title} onChange={handleEditFormChange} placeholder="Başlık" style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                      <input type="number" name="price" value={editingListing.price} onChange={handleEditFormChange} placeholder="Fiyat" style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                      <input type="text" name="location" value={editingListing.location} onChange={handleEditFormChange} placeholder="Konum" style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                      <input type="text" name="seoTags" value={editingListing.seoTags || ''} onChange={handleEditFormChange} placeholder="SEO Etiketleri (virgülle ayırın)" style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                      <div style={{ backgroundColor: '#fff', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '11px', fontWeight: '700', color: '#475569' }}>📷 Fotoğrafları Yönet (En Fazla 10 Adet)</label>
                        <input type="file" accept="image/*" multiple onChange={handleEditMultipleImageUpload} style={{ width: '100%', fontSize: '11px' }} />
                        {editingListing.images && editingListing.images.length > 0 && (
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                            {editingListing.images.map((imgSrc, idx) => (
                              <div key={idx} style={{ position: 'relative', width: '50px', height: '50px' }}>
                                <img src={imgSrc} alt={`Düzenle Önizleme ${idx}`} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                                <button type="button" onClick={() => removeEditImage(idx)} style={{ position: 'absolute', top: '-4px', right: '-4px', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '50%', width: '16px', height: '16px', fontSize: '9px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <textarea name="description" value={editingListing.description} onChange={handleEditFormChange} placeholder="Açıklama" style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', height: '60px' }} />
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button type="submit" style={{ flex: 1, backgroundColor: '#22c55e', color: '#fff', border: 'none', padding: '8px', borderRadius: '6px', fontWeight: '700', cursor: 'pointer' }}>Kaydet</button>
                        <button type="button" onClick={() => setEditingListing(null)} style={{ background: '#e2e8f0', border: 'none', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer' }}>İptal</button>
                      </div>
                    </form>
                  </div>
                )}

                <div style={{ backgroundColor: '#f0fdf4', padding: '12px', borderRadius: '8px', border: '1px solid #bbf7d0', marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#166634', margin: '0 0 8px 0' }}>📁 Ana Kategori Ekle / Sil</h3>
                  <SiteSettingsStatus state={siteSettings} admin />
                  <fieldset disabled={!siteSettings.editable} style={{ border: 0, padding: 0, margin: 0 }}>
                  <form onSubmit={handleAddNewMainCategory} style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px' }}>
                    <input type="text" required maxLength={100} placeholder="Yeni Ana Kategori Adı" value={customCategoryInput} onChange={(e) => setCustomCategoryInput(e.target.value)} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                    <button type="submit" style={{ backgroundColor: '#166534', color: '#fff', border: 'none', padding: '8px', borderRadius: '6px', fontWeight: '700', cursor: 'pointer' }}>Ana Kategori Ekle</button>
                  </form>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <select aria-label="Silinecek ana kategori" value={mainCategoryToRemove} onChange={(e) => setMainCategoryToRemove(e.target.value)} style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #ef4444', backgroundColor: '#fef2f2' }}>
                      {Object.keys(categoriesWithSubs).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                    <button type="button" onClick={() => handleDeleteMainCategory(mainCategoryToRemove)} style={{ backgroundColor: '#ef4444', color: '#fff', border: 'none', padding: '0 10px', borderRadius: '6px', fontWeight: '700', fontSize: '11px', cursor: 'pointer' }}>Ana Kategoriyi Sil</button>
                  </div>
                  </fieldset>
                </div>

                <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#1b3a2b', margin: '0 0 8px 0' }}>Alt Seçenek Yönetimi</h3>
                  <SiteSettingsStatus state={siteSettings} admin />
                  <fieldset disabled={!siteSettings.editable} style={{ border: 0, padding: 0, margin: 0 }}>
                  <form onSubmit={handleAddSubCategory} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <select value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#fff' }}>
                      {Object.keys(categoriesWithSubs).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <select value={selectedSubToRemove} onChange={(e) => setSelectedSubToRemove(e.target.value)} style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #ef4444', backgroundColor: '#fef2f2' }}>
                        <option value="">Silinecek seçeneği seç...</option>
                        {(categoriesWithSubs[newCategoryName] || []).map(sub => <option key={sub} value={sub}>{sub}</option>)}
                      </select>
                      <button type="button" disabled={!selectedSubToRemove} onClick={() => handleDeleteSubCategory(newCategoryName, selectedSubToRemove)} style={{ backgroundColor: '#ef4444', color: '#fff', border: 'none', padding: '0 10px', borderRadius: '6px', fontWeight: '700', fontSize: '11px', cursor: 'pointer' }}>Sil</button>
                    </div>
                    <input type="text" required placeholder="Yeni alt seçenekler (Virgülle ayırın)" value={newSubCategoryName} onChange={(e) => setNewSubCategoryName(e.target.value)} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                    <button type="submit" style={{ backgroundColor: '#22c55e', color: '#fff', border: 'none', padding: '8px', borderRadius: '6px', fontWeight: '700', cursor: 'pointer' }}>Alt Seçenek Ekle</button>
                  </form>
                  </fieldset>
                </div>

                <h3 style={{ fontSize: '14px', fontWeight: '700', marginTop: '20px', marginBottom: '8px' }}>📋 Tüm İlanlar ({listings.length})</h3>
                {listings.map(item => {
                  const isFeat = item.isFeatured === true;
                  return (
                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', backgroundColor: '#f8fafc', borderRadius: '6px', marginBottom: '6px' }}>
                      <span style={{ fontSize: '12px', fontWeight: '600' }}>{item.title}</span>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button onClick={() => toggleFeaturedListing(item.id)} style={{ backgroundColor: isFeat ? '#fef08a' : '#f1f5f9', color: '#854d0e', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>
                          {isFeat ? '⭐ Vitrinde' : '☆ Vitrin Yap'}
                        </button>
                        <button onClick={() => { setEditingListing(item); if (editFormRef.current) editFormRef.current.scrollIntoView({ behavior: 'smooth' }); }} style={{ backgroundColor: '#e0f2fe', color: '#0284c7', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>Düzenle</button>
                        <button onClick={() => handleDeleteListing(item.id)} style={{ backgroundColor: '#fee2e2', color: '#dc2626', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>Sil</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      <footer style={{ backgroundColor: '#1b3a2b', color: '#94a3b8', padding: '20px 16px', textAlign: 'center', fontSize: '12px', marginTop: 'auto', borderTop: '1px solid #2d5a43' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ color: '#fff', fontWeight: '700', fontSize: '14px' }}>PazarTarla İletişim &amp; Destek</div>
          <div>📞 WhatsApp / Tel: 0535 768 1550</div>
          <div>✉ E-posta: gezgiinci@gmail.com</div>
          <div>📍 Konum: Gönen / Balıkesir</div>
          <div style={{ color: '#86efac', marginTop: '4px' }}>© 2026 PazarTarla • Türkiye'nin İlk ve Tek Tarım Platformu</div>
        </div>
      </footer>

      <button onClick={() => changeTab('admin-page')} title="Yönetim Paneli" style={{ position: 'fixed', bottom: '20px', right: '20px', backgroundColor: '#1b3a2b', color: '#86efac', border: '2px solid #22c55e', borderRadius: '50%', width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 999 }}>
        ⚙️
      </button>

      <div style={{ position: 'fixed', bottom: '76px', right: '20px', zIndex: 1000 }}>
        {!isChatOpen ? (
          <div onClick={() => setIsChatOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#ffffff', padding: '6px 12px 6px 6px', borderRadius: '30px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', border: '2px solid #22c55e', cursor: 'pointer' }}>
            <div style={{ position: 'relative', width: '38px', height: '38px', borderRadius: '50%', overflow: 'hidden', border: '2px solid #22c55e', flexShrink: 0 }}>
              <img src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=200" alt="Canlı Destek" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <span style={{ position: 'absolute', bottom: '0', right: '0', width: '10px', height: '10px', backgroundColor: '#22c55e', borderRadius: '50%', border: '2px solid #fff' }}></span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '11px', fontWeight: '800', color: '#1b3a2b', lineHeight: '1.2' }}>Canlı Destek</span>
              <span style={{ fontSize: '9px', color: '#166534', fontWeight: '600' }}>Çevrim içi • Soru Sor</span>
            </div>
          </div>
        ) : (
          <div style={{ width: '300px', backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.2)', border: '1px solid #cbd5e1', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ backgroundColor: '#1b3a2b', color: '#ffffff', padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ position: 'relative', width: '30px', height: '30px', borderRadius: '50%', overflow: 'hidden', border: '1.5px solid #22c55e' }}>
                  <img src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=200" alt="Asistan" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '700' }}>PazarTarla Asistan</div>
                  <div style={{ fontSize: '9px', color: '#86efac' }}>Canlı Destek Ekibi</div>
                </div>
              </div>
              <button onClick={() => setIsChatOpen(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: '4px' }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: '10px', height: '200px', overflowY: 'auto', backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {chatMessages.map((msg, index) => (
                <div key={index} style={{ alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start', maxWidth: '80%', backgroundColor: msg.sender === 'user' ? '#22c55e' : '#e2e8f0', color: msg.sender === 'user' ? '#fff' : '#1e293b', padding: '8px 10px', borderRadius: '8px', fontSize: '12px', lineHeight: '1.4' }}>
                  {msg.text}
                </div>
              ))}
            </div>
            <a href="https://api.whatsapp.com/send?phone=905357681550&text=Merhaba,%20PazarTarla%20üzerinden%20bilgi%20almak%20istiyorum." target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', backgroundColor: '#22c55e', color: '#fff', padding: '8px', textDecoration: 'none', fontSize: '12px', fontWeight: '700' }}>
              <MessageCircle size={14} /> WhatsApp ile Canlı Bağlan
            </a>
            <form onSubmit={handleSendMessage} style={{ display: 'flex', padding: '6px', borderTop: '1px solid #cbd5e1', backgroundColor: '#fff' }}>
              <input type="text" placeholder="Mesajınızı yazın..." value={chatInput} onChange={(e) => setChatInput(e.target.value)} style={{ flex: 1, padding: '6px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '11px', outline: 'none' }} />
              <button type="submit" style={{ backgroundColor: '#1b3a2b', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: '4px', marginLeft: '4px', cursor: 'pointer', fontSize: '11px' }}>
                <Send size={12} />
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

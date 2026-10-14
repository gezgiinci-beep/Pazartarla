import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { createAdminAccessGate, createListingRefreshGuard } from './lib/adminUiState.mjs';
import SubmissionAccountPanel from './components/SubmissionAccountPanel';
import ModerationQueue from './components/ModerationQueue';
import MySubmissions from './components/MySubmissions';
import RemoteListingImages from './components/RemoteListingImages';
import ListingEditor from './components/ListingEditor';
import {editError} from './lib/listingEditor';
import {setListingFeatured, featuredError} from './lib/listingFeatured.mjs';
import {deleteAdminListing} from './lib/adminListingRequests';
import { useSubmissionAccount } from './hooks/useSubmissionAccount';
import { useModerationQueue } from './hooks/useModerationQueue';
import { useSiteSettings } from './hooks/useSiteSettings';
import { AUTOMATIC_REFRESH_INTERVAL_MS, automaticRefreshDue } from './lib/refreshPolicy.mjs';
import { backoffDelayMs, readCachedValue, readRetryAt, writeCachedValue, writeRetryAt } from './lib/publicReadResilience.mjs';
import { listingSeoMetadataUrl, readPublicListings } from './lib/publicListingRequests.mjs';
import { readListingSeoFromApi, readPublicListingsFromApi } from './lib/tursoListings.mjs';
import SiteSettingsStatus from './components/SiteSettingsStatus';
import { useAdvertisements } from './hooks/useAdvertisements';
import AdvertisementManager from './components/AdvertisementManager';
import AdvertisementPlacement from './components/AdvertisementPlacement';
import SponsorPartners from './components/SponsorPartners';
import PlatformIntroduction from './components/PlatformIntroduction';
import MembershipPage from './components/MembershipPage';
import MembershipAdmin from './components/MembershipAdmin';
import MembershipNotice from './components/MembershipNotice';
import TrialPromotion from './components/TrialPromotion';
import AboutPage from './components/AboutPage';
import Storefront from './components/Storefront';
import {useStoreMembership} from './hooks/useStoreMembership';
import {useOffers} from './hooks/useOffers';
import OfferMarketplace from './components/OfferMarketplace';
import OfferListingControls from './components/OfferListingControls';
import {storeUrl} from './lib/storeMembership';
import {readPublicNavigation} from './lib/publicNavigation.mjs';
import {listingIdFromUrl, listingShareUrl, listingShareText, listingPhotoAddress, findSharedListing} from './lib/listingShare';
import { formatListingDate, isListingArchived } from './lib/listingLifetime';
import { useListingArchive } from './hooks/useListingArchive';
import BrandLogo from './components/BrandLogo';
import HomeMenuDrawer, { type HomeMenuAction } from './components/HomeMenuDrawer';
import DiscoveryBar from './components/DiscoveryBar';
import RegionDialog from './components/RegionDialog';
import { PROVINCES, locationOptions, matchesLocation, matchesSearch, sortListings, type SortKey } from './lib/locationFilter';
import OpeningSplash from './components/OpeningSplash';
import FeaturedOfferNotice from './components/FeaturedOfferNotice';
import FeaturedOfferManager from './components/FeaturedOfferManager';
import TrafficDashboard from './components/TrafficDashboard';
import ContactDepotManager from './components/ContactDepotManager';
import ContactUnsubscribe from './components/ContactUnsubscribe';
import { useContactDepot } from './hooks/useContactDepot';
import { useTrafficReport } from './hooks/useTrafficReport';
import './site-interactions.css';
import { DEFAULT_LISTING_IMAGE, readListingMedia, persistListingImages, persistTursoListingImages, assertSavedMedia, listingFilePreviews } from './lib/listingMedia.mjs';

import {
  Search, SlidersHorizontal, MapPin, Phone, MessageCircle, Plus,
  Heart, Share2, ShieldCheck, CheckCircle2, ChevronRight, ChevronDown, X,
  Car, Wrench, ArrowRight, Bell, User, Filter, AlertCircle, Trash2, Settings, Lock, Check, Mail, Globe, Copy, HelpCircle, Users, Image as ImageIcon, Bug, Shield, Package, ArrowLeft, Menu, ArrowUpDown, LayoutList, Star, Send, ShieldAlert, FolderPlus, Tag, Edit3, Sparkles, Megaphone, CheckCircle, Bot, RefreshCw
} from 'lucide-react';

const PUBLIC_LISTINGS_CACHE_KEY = 'pazartarla-public-listings-v1';
const PUBLIC_LISTINGS_RETRY_KEY = 'pazartarla-public-listings-retry-at-v1';
const PUBLIC_LISTINGS_CACHE_TTL_MS = 6 * 60 * 60_000;

function publicBrowserStorage() {
  try { return window.localStorage; } catch { return null; }
}

function readPublicListingsCache() {
  return readCachedValue(publicBrowserStorage(), PUBLIC_LISTINGS_CACHE_KEY, PUBLIC_LISTINGS_CACHE_TTL_MS,
    value => Array.isArray(value) && value.length <= 2_000 &&
      value.every(item => item && Number.isSafeInteger(Number(item.id)) && typeof item.title === 'string'));
}

function cacheableImage(value: unknown) {
  return typeof value === 'string' && value.length > 0 && !/^(?:data:|blob:)/i.test(value);
}

function savePublicListingsCache(items: any[]) {
  const safeItems = items.map(item => ({
    ...item,
    image: cacheableImage(item.image) ? item.image : DEFAULT_LISTING_IMAGE,
    images: Array.isArray(item.images) ? item.images.filter(cacheableImage) : [],
    ...(Array.isArray(item.gallery_paths)
      ? { gallery_paths: item.gallery_paths.filter(cacheableImage) }
      : typeof item.gallery_paths === 'string' && /^(?:data:|blob:)/i.test(item.gallery_paths)
        ? { gallery_paths: '[]' }
        : {}),
  }));
  writeCachedValue(publicBrowserStorage(), PUBLIC_LISTINGS_CACHE_KEY, safeItems, Date.now(), 2_000_000);
}

// ==========================================
// SUPABASE BAĞLANTI AYARLARI
// ==========================================
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
    const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
    const USE_TURSO_PUBLIC_LISTINGS = import.meta.env.VITE_LISTINGS_BACKEND === 'turso';
    const USE_TURSO_PUBLIC_ADVERTISEMENTS = import.meta.env.VITE_PUBLIC_ADVERTISEMENTS_BACKEND === 'turso';
    const SITE_SETTINGS_BACKEND = import.meta.env.VITE_SETTINGS_BACKEND === 'turso' ? 'turso' : 'supabase';
    const PUBLIC_SETTINGS_READ_BACKEND = import.meta.env.VITE_PUBLIC_SETTINGS_READ_BACKEND === 'turso'
      ? 'turso'
      : SITE_SETTINGS_BACKEND;
    const TURSO_AUTH_ENABLED = import.meta.env.VITE_AUTH_BACKEND === 'turso';
    const API_BASE = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');

    function hasTursoAuthAction() {
      if (!TURSO_AUTH_ENABLED) return false;
      const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      return ['verify', 'reset'].includes(params.get('auth_action') || '') &&
        /^[A-Za-z0-9_-]{43}$/.test(params.get('token') || '');
    }

    const dbHeaders = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
    'Content-Type': 'application/json'
    };

    const supabaseClient = SUPABASE_URL && SUPABASE_ANON_KEY
      ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
      : null;

    const isCurrentUserAdmin = async () => {
      if (TURSO_AUTH_ENABLED) {
        const response = await fetch(`${API_BASE}/api/auth/session`, {
          credentials: 'same-origin',
          cache: 'no-store',
          signal: AbortSignal.timeout(10_000),
        });
        if (!response.ok) throw new Error('Yönetici oturumu doğrulanamadı.');
        const session = await response.json();
        return session?.is_admin === true;
      }
      if (!supabaseClient) return false;
      const { data, error } = await supabaseClient.rpc('is_listing_admin');
      if (error) throw error;
      return data === true;
    };

    const getAdminDbHeaders = async () => {
      if (TURSO_AUTH_ENABLED) {
        if (!(await isCurrentUserAdmin())) throw new Error('Bu hesap yönetici yetkisine sahip değil.');
        return {};
      }
      if (!supabaseClient) throw new Error('Supabase is not configured');
      const { data, error } = await supabaseClient.auth.getSession();
      if (error || !data.session) throw new Error('An authenticated admin session is required');
      if (!(await isCurrentUserAdmin())) throw new Error('This account is not authorized');
      return { ...dbHeaders, Authorization: 'Bearer ' + data.session.access_token };
    };

    const ListingDate = ({ value }) => (
      <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px' }}>
        İlan tarihi: <time dateTime={typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : undefined}>{formatListingDate(value)}</time>
      </div>
    );

    const normalizeListing = (item) => {
    const metadata = readListingMedia(item, SUPABASE_URL);
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


export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [activeTab, setActiveTab] = useState(()=>hasTursoAuthAction()?'add':readPublicNavigation(window.location.href).tab);
  const [linkedListingId,setLinkedListingId]=useState(()=>listingIdFromUrl(window.location.href));
  const [storeId,setStoreId]=useState(()=>readPublicNavigation(window.location.href).storeId);
  const [invalidStoreLink,setInvalidStoreLink]=useState(()=>readPublicNavigation(window.location.href).invalidStoreLink);
  const [membershipPreferredPlan,setMembershipPreferredPlan]=useState('');
  const homeOpeningAnchorRef = useRef<HTMLDivElement | null>(null);
  const editFormRef = useRef(null);

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    { sender: 'bot', text: 'Merhaba! PazarTarla canlı destek hattına hoş geldiniz. Size nasıl yardımcı olabilirim?' }
  ]);
  const [chatInput, setChatInput] = useState('');

  const [listings, setListings] = useState(() => readPublicListingsCache() || []);
  const [listingsLoading, setListingsLoading] = useState(() => !readPublicListingsCache());
  const [listingsError, setListingsError] = useState('');
  const [listingNow, setListingNow] = useState(Date.now);

  const siteSettings = useSiteSettings(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    getAdminDbHeaders,
    PUBLIC_SETTINGS_READ_BACKEND,
    SITE_SETTINGS_BACKEND,
  );
  const categoriesWithSubs = siteSettings.settings?.categories || {};
  const announcement = siteSettings.settings?.announcement || '';
  const requestFeaturedOffer = () => {
    const offer = siteSettings.settings?.featured_offer;
    if (!offer) return;
    const amount = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(offer.monthly_price_try);
    window.open(`https://api.whatsapp.com/send?phone=905357681550&text=${encodeURIComponent(
      `Merhaba, PazarTarla'da 1 aylık vitrin ilanı vermek istiyorum. Güncel ücret ${amount} TL. Bilgi alabilir miyim?`
    )}`, '_blank', 'noopener,noreferrer');
  };
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
  const adminAccess = useRef(createAdminAccessGate());
  const listingRefresh = useRef(createListingRefreshGuard());
  const listingReadInFlight = useRef(false);
  const lastListingReadAt = useRef(0);
  const listingFailureCount = useRef(0);
  const listingRetryAt = useRef(readRetryAt(publicBrowserStorage(), PUBLIC_LISTINGS_RETRY_KEY));
  const listingSeoCache = useRef(new Map());
  const listingSeoAttemptAt = useRef(new Map());
  const listingSeoInFlight = useRef(new Set());
  const [featuredBusyIds, setFeaturedBusyIds] = useState<number[]>([]);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminAuthError, setAdminAuthError] = useState('');
  const [adminAuthLoading, setAdminAuthLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('Tüm kategoriler');
  const [selectedSubCategory, setSelectedSubCategory] = useState('Tümü');
  const [homeSearchQuery, setHomeSearchQuery] = useState('');
  const [regionOpen, setRegionOpen] = useState(false);
  const [province, setProvince] = useState('');
  const [district, setDistrict] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('default');
  const [menuOpen, setMenuOpen] = useState(false);

  const [newCategoryName, setNewCategoryName] = useState('');
  const [mainCategoryToRemove, setMainCategoryToRemove] = useState('');
  const [newSubCategoryName, setNewSubCategoryName] = useState('');
  const [selectedSubToRemove, setSelectedSubToRemove] = useState('');
  const [editingListing, setEditingListing] = useState(null);
  const [ownerEditingId, setOwnerEditingId] = useState(null);
  const [listingEditMessage, setListingEditMessage] = useState('');
  const [ownerArchiveBusyId, setOwnerArchiveBusyId] = useState(null);
  const [gallerySaving, setGallerySaving] = useState(false);
  const [lastAddedListing, setLastAddedListing] = useState(null);
  const [customCategoryInput, setCustomCategoryInput] = useState('');
  const [submissionSaving, setSubmissionSaving] = useState(false);
  const [formImageImporting, setFormImageImporting] = useState(false);
  const [editImageImporting, setEditImageImporting] = useState(false);
  const [submissionError, setSubmissionError] = useState('');
  const [formOfferRequested, setFormOfferRequested] = useState(false);
  const [submissionWarning, setSubmissionWarning] = useState('');
  const postOfferAuthTarget = useRef<number|'offers'|null>(null);
  const submissionAccount = useSubmissionAccount(supabaseClient, SUPABASE_URL, SUPABASE_ANON_KEY, normalizeListing);
  const offers = useOffers(supabaseClient, submissionAccount.session);
  const storeMembership=useStoreMembership(supabaseClient,SUPABASE_URL,SUPABASE_ANON_KEY,submissionAccount.session,isAdminLoggedIn,storeId);
  const moderation = useModerationQueue(isAdminLoggedIn, SUPABASE_URL, getAdminDbHeaders, normalizeListing);
  const advertisements = useAdvertisements(
    supabaseClient, SUPABASE_URL, SUPABASE_ANON_KEY, isAdminLoggedIn, getAdminDbHeaders,
    `${API_BASE}/api/public-listings`, USE_TURSO_PUBLIC_ADVERTISEMENTS
  );
  const listingArchive = useListingArchive(isAdminLoggedIn, SUPABASE_URL, getAdminDbHeaders);
  const trafficReport = useTrafficReport(isAdminLoggedIn && activeTab==='statistics');
  const contactDepot = useContactDepot(isAdminLoggedIn && activeTab==='contacts', SUPABASE_URL, getAdminDbHeaders);
  const unsubscribeToken = new URLSearchParams(window.location.search).get('iletisim_cikis');

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
  const photoTargets = useRef({form, editingListing});
  photoTargets.current = {form, editingListing};
  const appendImportedPhotos = (target: 'form' | 'editingListing', images: string[]) => {
    const current = photoTargets.current[target];
    if (!current || (target === 'editingListing' && current.id !== editingListing?.id)) {
      throw new Error('Düzenleme kapandı. Fotoğrafı açık olan ilanda yeniden ekleyin.');
    }
    const combined = [...(current.images || []), ...images];
    if (combined.length > 10) throw new Error('En fazla 10 fotoğraf ekleyebilirsiniz.');
    photoTargets.current[target] = {...current, images: combined};
    if (target === 'form') setForm(prev => ({...prev, images: combined}));
    else setEditingListing(prev => prev?.id === current.id ? {...prev, images: combined} : prev);
  };

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
      if (listingReadInFlight.current) return false;
      if (Date.now() < listingRetryAt.current) return false;
      const readTicket = listingRefresh.current.startRead();
      if (readTicket === null) return false;
      setListingsLoading(true);

      if (!USE_TURSO_PUBLIC_LISTINGS && (!SUPABASE_URL || !SUPABASE_ANON_KEY)) {
        setListingsError('Sunucu bağlantı ayarları eksik. İlanlar yüklenemedi.');
        listingRetryAt.current = Date.now() + 60 * 60_000;
        writeRetryAt(publicBrowserStorage(), PUBLIC_LISTINGS_RETRY_KEY, listingRetryAt.current);
        setListingsLoading(false);
        return false;
      }

      listingReadInFlight.current = true;
      lastListingReadAt.current = Date.now();
      try {
        const data = USE_TURSO_PUBLIC_LISTINGS
          ? await readPublicListingsFromApi()
          : await readPublicListings(SUPABASE_URL, dbHeaders);

        if (!listingRefresh.current.canApply(readTicket)) return false;
        const normalized = listingRefresh.current.reconcile(data).map(normalizeListing);
        setListings(normalized);
        savePublicListingsCache(normalized);
        listingFailureCount.current = 0;
        listingRetryAt.current = 0;
        try { publicBrowserStorage()?.removeItem(PUBLIC_LISTINGS_RETRY_KEY); } catch { /* Storage is optional. */ }
        setListingsError('');
        return true;
      } catch (error) {
        if (!listingRefresh.current.canApply(readTicket)) return false;
        console.error('İlanlar sunucudan alınamadı:', error);
        const retry = ++listingFailureCount.current;
        const fallbackDelay = backoffDelayMs(retry, 15_000, 15 * 60_000);
        const serverDelay = Number((error as Error & { retryAfterMs?: number })?.retryAfterMs) || 0;
        listingRetryAt.current = Date.now() + Math.min(60 * 60_000, Math.max(fallbackDelay, serverDelay));
        writeRetryAt(publicBrowserStorage(), PUBLIC_LISTINGS_RETRY_KEY, listingRetryAt.current);
        setListingsError('İlanlar geçici olarak güncellenemedi; son alınan veriler korunuyor.');
        return false;
      } finally {
        listingReadInFlight.current = false;
        if (listingRefresh.current.canApply(readTicket)) setListingsLoading(false);
      }
    };

  useEffect(() => {
    const splashTimer = window.setTimeout(() => setShowSplash(false), 1200);
    if (Date.now() < listingRetryAt.current) {
      setListingsLoading(false);
      if (listings.length === 0) setListingsError('İlanlar geçici olarak görüntülenemiyor; otomatik deneme bekleniyor.');
    } else {
      void fetchListings();
    }
    return () => window.clearTimeout(splashTimer);
  }, []);
  useEffect(() => {
    const visible = () => {
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      setListingNow(now);
      if (automaticRefreshDue(lastListingReadAt.current, now)) void fetchListings();
    };
    const timer = window.setInterval(() => setListingNow(Date.now()), 60_000);
    const refreshTimer = window.setInterval(visible, AUTOMATIC_REFRESH_INTERVAL_MS);
    window.addEventListener('focus', visible);
    document.addEventListener('visibilitychange', visible);
    return () => {
      window.clearInterval(timer); window.clearInterval(refreshTimer);
      window.removeEventListener('focus', visible);
      document.removeEventListener('visibilitychange', visible);
    };
  }, []);

  useEffect(() => {
    const selected = selectedListing;
    if (!selected || selected.seotags !== undefined) return;
    const id = Number(selected.id);
    if (!Number.isSafeInteger(id) || id < 1) return;
    if (listingSeoCache.current.has(id)) {
      const seotags = listingSeoCache.current.get(id);
      setSelectedListing(current => current?.id === id && current.seotags === undefined
        ? normalizeListing({ ...current, seotags }) : current);
      return;
    }
    if (listingSeoInFlight.current.has(id) ||
        !automaticRefreshDue(listingSeoAttemptAt.current.get(id) || 0)) return;
    listingSeoInFlight.current.add(id);
    listingSeoAttemptAt.current.set(id, Date.now());
    void (async () => {
      try {
        let seotags;
        if (USE_TURSO_PUBLIC_LISTINGS) {
          seotags = await readListingSeoFromApi(id);
        } else {
          const response = await fetch(listingSeoMetadataUrl(SUPABASE_URL, id), {
            headers: dbHeaders,
            cache: 'no-store',
            signal: AbortSignal.timeout(15_000),
          });
          if (!response.ok) throw new Error('HTTP ' + response.status);
          const rows = await response.json();
          if (!Array.isArray(rows) || rows.length > 1) throw new Error('Invalid listing metadata response');
          seotags = rows[0]?.seotags ?? null;
        }
        listingSeoCache.current.set(id, seotags);
        setSelectedListing(current => current?.id === id
          ? normalizeListing({ ...current, seotags }) : current);
        setListings(current => current.map(item => item.id === id
          ? normalizeListing({ ...item, seotags }) : item));
      } catch {
        // The detail page keeps generated tags if optional legacy metadata cannot load.
      } finally {
        listingSeoInFlight.current.delete(id);
      }
    })();
  }, [selectedListing?.id]);

  useEffect(() => {
    if (TURSO_AUTH_ENABLED) {
      adminAccess.current.clear();
      setIsAdminLoggedIn(false);
      return;
    }
    if (!supabaseClient) return;
    let active = true;
    const syncAdminState = async (session) => {
      if (!adminAccess.current.allows(session)) {
        if (adminAccess.current.granted) adminAccess.current.clear();
        if (active) setIsAdminLoggedIn(false);
        return;
      }
      const ticket = adminAccess.current.generation;
      try {
        const authorized = await isCurrentUserAdmin();
        if (active && ticket === adminAccess.current.generation && adminAccess.current.allows(session)) {
          if (!authorized) adminAccess.current.clear();
          setIsAdminLoggedIn(authorized);
        }
      } catch (error) {
        if (active && ticket === adminAccess.current.generation) {
          adminAccess.current.clear();setIsAdminLoggedIn(false);
        }
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
    if (!TURSO_AUTH_ENABLED || !isAdminLoggedIn) return;
    let active = true;
    const checkAdminSession = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/auth/session`, {
          credentials: 'same-origin',
          cache: 'no-store',
          headers: { Accept: 'application/json' },
        });
        const session = await response.json().catch(() => ({}));
        const reauthAt = Date.parse(session?.admin_reauth_at || '');
        const valid = response.ok && session?.is_admin === true &&
          Number.isFinite(reauthAt) && Date.now() >= reauthAt &&
          Date.now() - reauthAt <= 15 * 60 * 1000;
        if (active && !valid) setIsAdminLoggedIn(false);
      } catch {
        if (active) setIsAdminLoggedIn(false);
      }
    };
    void checkAdminSession();
    const interval = window.setInterval(checkAdminSession, 30_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void checkAdminSession();
    };
    window.addEventListener('focus', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener('focus', onVisible);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [isAdminLoggedIn]);

    const refreshCanonicalListings = async () => {
      if (!isAdminLoggedIn) return;
      const refreshed = await fetchListings();
      alert(refreshed ? 'Sunucudaki ilanlar yenilendi.' : 'İlanlar sunucudan alınamadı. Lütfen tekrar deneyin.');
    };
    
  useEffect(() => {
    window.history.replaceState({ ...window.history.state, tab: readPublicNavigation(window.location.href).tab }, '');
    const handlePopState = (event) => {
      const route=readPublicNavigation(window.location.href,event.state);
      setLinkedListingId(route.listingId);
      setStoreId(route.storeId);
      setInvalidStoreLink(route.invalidStoreLink);
      setSelectedListing(null);
      setActiveTab(route.tab);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const changeTab = (tabName) => {
    const url=new URL(window.location.href);url.searchParams.delete('magaza');url.searchParams.delete('ilan');
    url.searchParams.delete('teklifler');
    url.searchParams.delete('hakkimizda');
    const adminPath = `${API_BASE}/admin` || '/admin';
    const appRootPath = `${API_BASE}/` || '/';
    if (tabName === 'admin-page') url.pathname = adminPath;
    else if (url.pathname.replace(/\/+$/, '') === adminPath) url.pathname = appRootPath;
    if(tabName==='about')url.searchParams.set('hakkimizda','1');
    if(tabName==='offers')url.searchParams.set('teklifler','1');
    window.history.pushState({ tab: tabName }, '',url);
    setLinkedListingId(null);
    setStoreId(null);
    setInvalidStoreLink(false);
    setActiveTab(tabName);
  };
  const openStore=(id:string)=>{
    const url=storeUrl(id,window.location.href,true);
    setLinkedListingId(null);
    setInvalidStoreLink(false);
    window.history.pushState({tab:'store'},'',url);setStoreId(readPublicNavigation(url).storeId);setActiveTab('store');
  };

  const openListing=(row)=>{
    const url=new URL(window.location.href);
    url.searchParams.delete('magaza');url.searchParams.set('ilan',String(row.id));
    url.searchParams.delete('teklifler');
    window.history.pushState({tab:'detail'},'',url);
    setLinkedListingId(null);setStoreId(null);setInvalidStoreLink(false);setSelectedListing(row);setActiveTab('detail');
  };
  const signInForOffers = () => {
    setFormOfferRequested(false);
    postOfferAuthTarget.current = activeTab==='detail' && selectedListing ? selectedListing.id : 'offers';
    changeTab('add');
  };
  const createOfferListing = () => {
    setFormOfferRequested(true);
    changeTab('add');
  };
  useEffect(()=>{
    if(!submissionAccount.session || postOfferAuthTarget.current===null)return;
    const target=postOfferAuthTarget.current;
    postOfferAuthTarget.current=null;
    const row=target!=='offers'&&(selectedListing?.id===target?selectedListing:listings.find(item=>item.id===target));
    if(row)openListing(row);else changeTab('offers');
  },[submissionAccount.session?.user.id]);
  useEffect(()=>{
    if(!linkedListingId||listingsLoading||listingsError)return;
    setSelectedListing(findSharedListing(listings, linkedListingId));
  },[linkedListingId,listings,listingsLoading,listingsError]);
  const copyListingShare=async(text:string,message:string)=>{
    try{await navigator.clipboard.writeText(text);alert(message);}
    catch{alert('Kopyalanamadı. Aşağıda görünen ilan bağlantısını elle kopyalayabilirsiniz.');}
  };
  const copyPhotoAddress=async(address:string|null)=>{
    if(!address)return;
    try{
      if(!navigator.clipboard?.writeText)throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(address);
      alert('Fotoğraf adresi kopyalandı.');
    }catch{
      alert('Fotoğraf adresi kopyalanamadı. Görünen adresi seçip elle kopyalayabilirsiniz.');
    }
  };
  const selectedPhotoAddress=selectedListing?listingPhotoAddress(selectedListing,window.location.href):null;

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

  const handleMultipleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    e.target.value='';
    if(submissionSaving)return;
    if (files.length === 0) return;
    const currentCount = form.images.length;
    if (currentCount + files.length > 10) {
      alert('En fazla 10 adet fotoğraf yükleyebilirsiniz!');
      return;
    }
    try {
      const images=await listingFilePreviews(files);
      setForm(prev=>prev.images.length+images.length<=10?{...prev,images:[...prev.images,...images]}:prev);
    }catch(error){alert(error.message);}
  };

  const removeFormImage = (index) => {
    setForm(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  const handleEditMultipleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    e.target.value='';
    if(gallerySaving)return;
    const editId=editingListing.id;
    if (files.length === 0) return;
    const currentCount = (editingListing.images || []).length;
    if (currentCount + files.length > 10) {
      alert('En fazla 10 adet fotoğraf yükleyebilirsiniz!');
      return;
    }
    try {
      const images=await listingFilePreviews(files);
      setEditingListing(prev=>prev?.id===editId && prev.images.length+images.length<=10
        ?{...prev,images:[...prev.images,...images]}:prev);
    }catch(error){alert(error.message);}
  };

  const removeEditImage = (index) => {
    setEditingListing(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  const handleDirectAdd = async (e) => {
      e.preventDefault();
      if (submissionSaving || formImageImporting) return;
      setSubmissionError('');
      if (!siteSettings.settings || siteSettings.loading || siteSettings.loadError) {
        setSubmissionError('Kategori ayarları yüklenemedi. Önce site ayarlarını yeniden yükleyin.');
        return;
      }
      if (!submissionAccount.canSubmit) {
        setSubmissionError('E-posta adresinizi doğrulayın ve aşağıdaki güncel gönderim/aktif ilan kotanızı kontrol edin.');
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
        let savedListing;
        if (TURSO_AUTH_ENABLED) {
          if (submissionAccount.session?.backend !== 'turso') {
            throw new Error('LISTING_VERIFIED_ACCOUNT_REQUIRED');
          }
          const media = await persistTursoListingImages(newEntry.images, {
            userId: submissionAccount.session.user.id,
            endpoint: `${API_BASE}/api/listing-media`,
          });
          setForm(current => ({...current, images: media.images}));
          const response = await fetch(`${API_BASE}/api/submissions`, {
            method: 'POST',
            credentials: 'same-origin',
            cache: 'no-store',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
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
              images: media.images,
              seoTags: newEntry.seoTags,
              offerRequested: formOfferRequested,
            }),
          });
          const result = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(String(result?.error || 'LISTING_SAVE_FAILED'));
          if (!result?.listing) throw new Error('LISTING_SAVE_FAILED');
          savedListing = normalizeListing(result.listing);
        } else {
          const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();
          if (sessionError || !sessionData.session) throw new Error('LISTING_VERIFIED_ACCOUNT_REQUIRED');
          const media = await persistListingImages(newEntry.images, {
            client: supabaseClient, baseUrl: SUPABASE_URL, userId: sessionData.session.user.id
          });
          setForm(current => ({...current, images: media.images}));
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
              image: media.image,
              gallery_paths: media.gallery_paths,
              is_featured: false,
              seotags: newEntry.seoTags,
              status: 'pending'
            })
          });
          if (!response.ok) {
            const problem = await response.json().catch(() => ({}));
            throw new Error(problem.message || ('HTTP ' + response.status));
          }
          const rows = await response.json();
          if (!Array.isArray(rows) || !rows[0]) throw new Error('Sunucu ilanı kaydetmedi.');
          assertSavedMedia(rows[0],{gallery_paths:media.gallery_paths,image:media.image,is_featured:false,seotags:newEntry.seoTags});
          savedListing = normalizeListing(rows[0]);
        }
        setListingsError('');
        setLastAddedListing(savedListing);
        setSubmissionWarning('');
        if(formOfferRequested && !TURSO_AUTH_ENABLED){
          try {
            const result=await supabaseClient.rpc('set_listing_offer_enabled',{p_listing_id:savedListing.id,p_enabled:true});
            if(result.error || result.data?.ok!==true)throw new Error('OFFER_SETTINGS_FAILED');
            await offers.refresh();
          } catch {
            setSubmissionWarning('İlanınız kaydedildi; teklif alma açılamadı. İlanı tekrar göndermeyin. Gönderimlerim bölümünden bu ilanın teklif ayarını yeniden açabilirsiniz.');
          }
        }
        await submissionAccount.refresh();
        if (isAdminLoggedIn) await moderation.refresh();
        setForm(current => ({ ...current, title: '', price: '', description: '', seoTags: '', images: [DEFAULT_LISTING_IMAGE], status: 'pending' }));
        setFormOfferRequested(false);
        changeTab('success-wa');
      } catch (error) {
        const reason = String(error?.message || '');
        setSubmissionError(reason.includes('LISTING_MEDIA_STORAGE_REQUIRED')
          ? 'Fotoğraf yükleme henüz açılmadı. Vercel fotoğraf deposu bağlandığında tekrar deneyebilirsiniz; formunuz korundu.'
          : reason.includes('LISTING_MEDIA_RETRY_LATER') || reason.includes('LISTING_MEDIA_UNAVAILABLE')
          ? 'Fotoğraf servisi geçici olarak yanıt vermiyor. İstekler azaltıldı; birkaç dakika sonra yeniden deneyin. Formunuz korundu.'
          : reason.includes('LISTING_IMAGE_INVALID') || reason.includes('LISTING_IMAGE_TOO_LARGE')
          ? 'Fotoğraflardan biri geçersiz veya 2 MB sınırını aşıyor. Formunuz korundu.'
          : reason.includes('gallery_paths') || reason.includes('is_featured') || reason.includes('Bucket not found')
          ?'Fotoğraf depolama geçişi sunucuda henüz etkinleştirilmemiş. Formunuz korunuyor; yöneticiyle iletişime geçin.'
          :reason.includes('LISTING_MONTHLY_LIMIT_REACHED')?'Aylık paket ilan kotanız doldu. Yeni dönem için üyelik süresi sonunda ödeme ve yönetici onayı gerekir.':reason.includes('LISTING_ACTIVE_LIMIT_REACHED')?'Paketinizin aktif ilan kapasitesi dolu. Onay bekleyen ilanlar da yer ayırır; mevcut kayıtlarınız korunuyor.':reason.includes('LISTING_DAILY_LIMIT_REACHED')
          ? '24 saatlik 10 ilan sınırına ulaştınız. Kotanız yenilendiğinde tekrar gönderebilirsiniz.'
          : reason.includes('LISTING_VERIFIED_ACCOUNT_REQUIRED')
            ? 'İlan göndermek için doğrulanmış e-posta hesabınızla giriş yapın.'
            : 'İlan onaya gönderilemedi. Formunuz korunuyor; bağlantınızı ve kotanızı kontrol edip yeniden deneyin.');
        await submissionAccount.refresh();
      } finally {
        setSubmissionSaving(false);
      }
    };

  const moderateListing = async (id, decision, token) => {
    if (await moderation.decide(id, decision, token)) {
      await Promise.all([fetchListings(), submissionAccount.refresh()]);
    }
  };

  const toggleFeaturedListing = async (id) => {
      if (!isAdminLoggedIn) return;
      const target = listings.find(item => item.id === id);
      if (!target) return;
      if (!listingRefresh.current.beginWrite(id)) return;
      setListingsLoading(false);
      setFeaturedBusyIds(ids => [...ids, id]);

      try {
        const savedListing = normalizeListing(await setListingFeatured(supabaseClient,id,!target.isFeatured));
        listingRefresh.current.rememberFeatured(id, savedListing.isFeatured);
        setListings(currentListings => savedListing.status==='approved'
          ?currentListings.map(item => item.id === id ? savedListing : item)
          :currentListings.filter(item=>item.id!==id));
        setListingsError('');
      } catch (error) {
        console.error('Vitrin durumu kaydedilemedi:', error);
        alert(featuredError(error));
      } finally {
        listingRefresh.current.endWrite(id);
        setFeaturedBusyIds(ids => ids.filter(value => value !== id));
      }
    };

  const startEditingFromDetail = async (item) => {
    if (!isAdminLoggedIn) {
      alert('Önce Yönetici Paneline giriş yapmalısınız.');
      changeTab('admin-page');
      return;
    }
    try {
      let data;
      if (TURSO_AUTH_ENABLED) {
        const response = await fetch(`${API_BASE}/api/listing-moderation?id=${encodeURIComponent(item.id)}`, {
          credentials: 'same-origin',
          cache: 'no-store',
          headers: { Accept: 'application/json' },
        });
        data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(String(data?.error || 'LISTING_EDIT_FORBIDDEN'));
      } else {
        const result = await supabaseClient.rpc('get_listing_for_edit', { p_listing_id: item.id });
        if (result.error) throw result.error;
        data = result.data;
      }
      if(data?.listing?.id!==item.id || !/^[a-f0-9]{64}$/.test(data.edit_token))throw new Error('Invalid edit snapshot');
      setEditingListing({...normalizeListing(data.listing),_editToken:data.edit_token});
      changeTab('admin-page');
      setTimeout(() => {if (editFormRef.current) editFormRef.current.scrollIntoView({behavior:'smooth'});},100);
    }catch(error){alert(editError(error));}
  };

  const startOwnerEditing = (item) => {
    if (!submissionAccount.session || (!isAdminLoggedIn && item.submitted_by !== submissionAccount.session.user.id)) return;
    setOwnerEditingId(item.id);
    setListingEditMessage('');
    changeTab('edit-listing');
  };
  const changeOwnerListingArchive = async (item) => {
    if (!TURSO_AUTH_ENABLED || !submissionAccount.session || ownerArchiveBusyId !== null) return;
    const action = item.status === 'archived' ? 'restore' : 'archive';
    const confirmation = action === 'archive'
      ? 'İlan canlı listeden kaldırılacak. İlan ve fotoğraflar silinmez; daha sonra geri açarsanız yönetici onayı gerekir. Devam edilsin mi?'
      : 'İlan yeniden yönetici incelemesine gönderilecek ve onaylanana kadar yayında olmayacak. Devam edilsin mi?';
    if (!window.confirm(confirmation)) return;
    setOwnerArchiveBusyId(Number(item.id));
    setListingEditMessage('');
    try {
      const path = `${API_BASE}/api/listing-owner?id=${encodeURIComponent(item.id)}`;
      const snapshotResponse = await fetch(path, {
        credentials: 'same-origin', cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      const snapshot = await snapshotResponse.json().catch(() => ({}));
      if (!snapshotResponse.ok || snapshot?.listing?.submitted_by !== submissionAccount.session.user.id ||
          !/^[a-f0-9]{64}$/.test(snapshot?.edit_token || '')) {
        throw new Error('İlan sahipliği doğrulanamadı. Listeyi yenileyip tekrar deneyin.');
      }
      const response = await fetch(`${API_BASE}/api/listing-owner`, {
        method: 'POST', credentials: 'same-origin', cache: 'no-store',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          action, id: item.id, edit_token: snapshot.edit_token,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || String(result?.listing?.id) !== String(item.id) ||
          result.listing.status !== (action === 'archive' ? 'archived' : 'pending')) {
        throw new Error('İlan durumu sunucudan doğrulanamadı. Listeyi yenileyip tekrar deneyin.');
      }
      setListingEditMessage(action === 'archive'
        ? 'İlan arşive alındı. Kayıt ve fotoğraflar korunuyor.'
        : 'İlan yeniden incelemeye gönderildi. Yayına dönmesi için yönetici onayı gerekir.');
      await Promise.all([submissionAccount.refresh(), offers.refresh(), fetchListings()]);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'İlan durumu güncellenemedi.');
    } finally {
      setOwnerArchiveBusyId(null);
    }
  };
  useEffect(() => {
    setOwnerEditingId(null);
    setListingEditMessage('');
  }, [submissionAccount.session?.user.id]);
  const finishOwnerEdit = async (result) => {
    const saved = normalizeListing(result.listing);
    submissionAccount.applySaved(result.listing);
    setSelectedListing(current => current?.id === saved.id ? saved : current);
    setListings(current => saved.status === 'approved'
      ? current.map(item => item.id === saved.id ? saved : item)
      : current.filter(item => item.id !== saved.id));
    setOwnerEditingId(null);
    setListingEditMessage(!result.changed ? 'Değişiklik yapılmadı; ilanınız aynı kaldı.' :
      result.reapproval_required ? 'İlan güncellendi ve yeniden yönetici onayına gönderildi.' : 'İlan güncellendi.');
    changeTab('add');
    await Promise.all([fetchListings(), submissionAccount.refresh(), moderation.refresh()]);
  };

  const saveEditedListing = async (e) => {
      e.preventDefault();
      if (!isAdminLoggedIn || gallerySaving || editImageImporting) return;

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
        setGallerySaving(true);
        if (TURSO_AUTH_ENABLED) {
          const session = submissionAccount.session;
          if (!session || session.backend !== 'turso') throw new Error('LISTING_EDIT_FORBIDDEN');
          const media = await persistTursoListingImages(updatedListing.images, {
            userId: session.user.id,
            endpoint: `${API_BASE}/api/listing-media`,
          });
          setEditingListing(current=>({...current,images:media.images}));
          const response = await fetch(`${API_BASE}/api/listing-moderation`, {
            method: 'POST',
            credentials: 'same-origin',
            cache: 'no-store',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({
              id: updatedListing.id,
              decision: 'edit_media',
              edit_token: editingListing._editToken,
              changes: {
                image: media.image,
                gallery_paths: media.gallery_paths,
                seotags: updatedListing.seoTags,
              },
            }),
          });
          const data = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(String(data?.error || 'LISTING_MEDIA_UPDATE_FAILED'));
          if(data?.listing?.id!==updatedListing.id)throw new Error('Sunucu galeri değişikliğini doğrulamadı.');
          assertSavedMedia(data.listing,{image:media.image,gallery_paths:media.gallery_paths,seotags:updatedListing.seoTags});
          const savedListing = normalizeListing(data.listing);
          setListings(currentListings => savedListing.status==='approved'
            ?currentListings.map(item => item.id === savedListing.id ? savedListing : item)
            :currentListings.filter(item=>item.id!==savedListing.id));
          setListingsError('');
          setEditingListing(null);
          alert('Galeri / SEO güncellendi. İlan metni ve fiyatı değiştirilmedi.');
          changeTab('home');
          return;
        }
        const {data:sessionData,error:sessionError}=await supabaseClient.auth.getSession();
        if(sessionError || !sessionData.session)throw new Error('LISTING_EDIT_FORBIDDEN');
        const media=await persistListingImages(updatedListing.images,{
          client:supabaseClient,baseUrl:SUPABASE_URL,userId:sessionData.session.user.id
        });
        setEditingListing(current=>({...current,images:media.images}));
        const {data,error} = await supabaseClient.rpc('update_listing_media',{
          p_listing_id:updatedListing.id,p_edit_token:editingListing._editToken,
          p_changes:{image:media.image,gallery_paths:media.gallery_paths,seotags:updatedListing.seoTags}
        });
        if (error) throw error;
        if(data?.listing?.id!==updatedListing.id)throw new Error('Sunucu galeri değişikliğini doğrulamadı.');
        assertSavedMedia(data.listing,{image:media.image,gallery_paths:media.gallery_paths,seotags:updatedListing.seoTags});

        const savedListing = normalizeListing(data.listing);
        setListings(currentListings => savedListing.status==='approved'
          ?currentListings.map(item => item.id === savedListing.id ? savedListing : item)
          :currentListings.filter(item=>item.id!==savedListing.id));
        setListingsError('');
        setEditingListing(null);
        alert('Galeri / SEO güncellendi. İlan metni ve fiyatı değiştirilmedi.');
        changeTab('home');
      } catch (error) {
        console.error('İlan güncellenemedi:', error);
        alert(editError(error));
      } finally {setGallerySaving(false);}
    };

  const handleDeleteListing = async (id) => {
      if (!isAdminLoggedIn) return;
      if (!window.confirm('Bu ilanı silmek istediğinize emin misiniz?')) return;

      try {
        await deleteAdminListing(SUPABASE_URL, await getAdminDbHeaders(), id, TURSO_AUTH_ENABLED);

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
    if (!TURSO_AUTH_ENABLED && !supabaseClient) {
      setAdminAuthError('Giriş hizmeti yapılandırılmamış.');
      return;
    }

    setAdminAuthLoading(true);
    const loginTicket = adminAccess.current.clear();
    setIsAdminLoggedIn(false);
    try {
      if (TURSO_AUTH_ENABLED) {
        const response = await fetch(`${API_BASE}/api/auth/admin-login`, {
          method: 'POST',
          credentials: 'same-origin',
          cache: 'no-store',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ email, password: adminPassword }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || result?.is_admin !== true || result?.admin_login !== true) {
          throw new Error('Not authorized');
        }
        await submissionAccount.refresh();
        setIsAdminLoggedIn(true);
        return;
      }
      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password: adminPassword });
      if (error) throw error;
      if (!(await isCurrentUserAdmin())) {
        await supabaseClient.auth.signOut();
        throw new Error('Not authorized');
      }
      const current = await supabaseClient.auth.getSession();
      if (current.error || current.data.session?.user?.id !== data.user?.id ||
          !adminAccess.current.grant(data.user?.id, loginTicket)) throw new Error('Session changed');
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
    adminAccess.current.clear();
    setIsAdminLoggedIn(false);
    setAdminAuthError('');
    if (TURSO_AUTH_ENABLED) {
      try {
        const response = await fetch(`${API_BASE}/api/auth/logout`, {
          method: 'POST',
          credentials: 'same-origin',
          cache: 'no-store',
        });
        if (!response.ok) throw new Error('LOGOUT_FAILED');
        await submissionAccount.refresh();
      } catch {
        setAdminAuthError('Panel kilitlendi; oturumu sonlandırmak için bağlantınızı kontrol edin.');
      }
    } else if (supabaseClient) {
      try {
        const { error } = await supabaseClient.auth.signOut();
        if (error) throw error;
      }
      catch { setAdminAuthError('Panel kilitlendi; oturumu sonlandırmak için bağlantınızı kontrol edin.'); }
    }
  };

  const approvedListings = listings.filter(item => item.status === 'approved' && !isListingArchived(item, listingNow));
  const featuredListings = approvedListings.filter(item => item.isFeatured === true);
  const regularApprovedListings = approvedListings.filter(item => !item.isFeatured);

  const categoryFilteredListings = (selectedCategory === 'Tüm kategoriler' && selectedSubCategory === 'Tümü')
    ? [...featuredListings, ...regularApprovedListings]
    : approvedListings.filter(item => {
        const matchesCategory = selectedCategory === 'Tüm kategoriler' || item.category === selectedCategory;
        const matchesSubCategory = selectedSubCategory === 'Tümü' || item.subCategory === selectedSubCategory;
        return matchesCategory && matchesSubCategory;
      });
  const filteredListings = sortListings(
    categoryFilteredListings.filter(item =>
      matchesSearch(item, homeSearchQuery) && matchesLocation(item.location, province, district)),
    sortKey,
  );
  const locationChoices = locationOptions(approvedListings, province);
  const homeFeaturedListings = filteredListings.filter(item => item.isFeatured === true);
  const homeRegularListings = filteredListings.filter(item => !item.isFeatured);
  const homeVisibleListings = homeRegularListings.slice(0, 6);
  const isListingDataLoading = listingsLoading && listings.length === 0;
  const hasListingLoadError = Boolean(listingsError) && listings.length === 0;
  const homeListingState = isListingDataLoading ? 'loading'
    : hasListingLoadError ? 'error'
      : homeRegularListings.length ? 'listings'
        : approvedListings.length === 0 ? 'empty' : 'filtered-empty';
  const goSection = (id: string) => {
    if (activeTab !== 'home') changeTab('home');
    window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
  };
  const menuMain: HomeMenuAction[] = [
    { key: 'account', label: 'Üye Ol / Giriş Yap', onSelect: () => changeTab('add') },
    { key: 'nearby', label: 'Bana yakın', onSelect: () => setRegionOpen(true) },
    { key: 'about', label: 'Hakkımızda', onSelect: () => changeTab('about') },
    { key: 'offers', label: 'Teklif Pazarı', onSelect: () => changeTab('offers') },
    { key: 'memberships', label: 'Mağaza Paketleri', onSelect: () => changeTab('memberships') },
    { key: 'store', label: 'Mağazam', onSelect: storeMembership.data?.mine?.store
      ? () => openStore(storeMembership.data!.mine!.store!.id)
      : undefined, note: 'Adınıza kayıtlı bir mağaza bulunamadı.' },
    { key: 'add', label: 'İlan ver', onSelect: () => changeTab('add') },
  ];
  const menuPersonal: HomeMenuAction[] = [
    { key: 'mine', label: 'İlanlarım', onSelect: () => changeTab('add') },
    { key: 'favs', label: 'Favori ilanlarım', onSelect: () => changeTab('favorites') },
    { key: 'my-offers', label: 'Teklifler', onSelect: () => changeTab('offers') },
    { key: 'saved-search', label: 'Favori aramalarım', note: 'Kaydedilmiş arama özelliği henüz kullanılamıyor.' },
    { key: 'messages', label: 'Mesajlar', note: 'Mesajlaşma bölümü henüz kullanılamıyor.' },
    { key: 'add-personal', label: 'İlan ver', onSelect: () => changeTab('add') },
  ];
  const menuSections: HomeMenuAction[] = [
    { key: 'promo-featured', label: 'Ürününüzü daha çok kişiye gösterin', onSelect: () => goSection('promo-featured') },
    { key: 'promo-store', label: 'Mağaza açma', onSelect: () => goSection('promo-store') },
    { key: 'promo-trial', label: '30 Gün Ücretsiz Deneme', onSelect: () => goSection('promo-trial') },
    { key: 'sponsors', label: 'Sponsorlar / Çözüm Ortaklarımız', onSelect: () => goSection('sponsors-section') },
  ];
  const announcementBanner = announcement ? (
    <div data-testid="home-announcement" style={{ backgroundColor: '#fef08a', color: '#713f12', padding: '10px 14px',
      borderRadius: '10px', marginBottom: '12px', fontSize: '13px', fontWeight: '600', display: 'flex',
      alignItems: 'center', gap: '8px', border: '1px solid #facc15', overflow: 'hidden', whiteSpace: 'nowrap' }}>
      <Megaphone size={16} color="#854d0e" style={{ flexShrink: 0 }} />
      <div style={{ width: '100%', overflow: 'hidden' }}><div className="marquee-text">{announcement}</div></div>
      <style>{`@keyframes marquee { 0% { transform: translateX(100%); } 100% { transform: translateX(-100%); } }
        .marquee-text { display: inline-block; animation: marquee 15s linear infinite; }
        @media (prefers-reduced-motion: reduce) { .marquee-text { animation: none; white-space: normal; } }`}</style>
    </div>
  ) : null;

  if (showSplash) {
    return <OpeningSplash />;
  }

  return (
    <div className="pt-site" style={{ minHeight: '100vh', backgroundColor: '#f4f6f8', color: '#1e293b', fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column', width: '100%', maxWidth: '100vw', boxSizing: 'border-box', position: 'relative' }}>
      <header style={{ backgroundColor: '#1b3a2b', color: '#ffffff', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }} onClick={() => { changeTab('home'); setSelectedCategory('Tüm kategoriler'); }}>
          <BrandLogo />
          <div className="pt-header-tagline" style={{ borderLeft: '1px solid rgba(255,255,255,0.2)', paddingLeft: '10px' }}>
            <span style={{ fontSize: '10px', color: '#86efac' }}>Canlı Ortak Platform</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button onClick={() => changeTab('favorites')} style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>
            ❤ ({favorites.length})
          </button>
          <button onClick={() => {setFormOfferRequested(false);changeTab('add');}} style={{ backgroundColor: '#22c55e', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: '700', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Plus size={16} /> İlan Ver
          </button>
        </div>
      </header>

      <main style={{ width: '100%', maxWidth: activeTab==='offers'?'1040px':'600px', margin: '0 auto', padding: '12px', flex: 1, boxSizing: 'border-box' }}>
          {activeTab==='memberships'&&<DemoMarketplace variant="stores"/>}
          {activeTab==='about'&&<AboutPage onBack={()=>changeTab('home')} onPackages={()=>changeTab('memberships')} annualReady={!!storeMembership.data?.plans.some(plan=>plan.id==='package-3')}/>}
          {activeTab==='memberships'&&<MembershipPage key={submissionAccount.session?.user.id||'public'} initialPlanId={membershipPreferredPlan} state={storeMembership} session={submissionAccount.session} onSignIn={()=>changeTab('add')} onStore={openStore} onSubmitted={()=>{void submissionAccount.refresh();}}/>}
          {activeTab==='membership-admin'&&(isAdminLoggedIn?<MembershipAdmin state={storeMembership} session={submissionAccount.session} authorized={isAdminLoggedIn} onBack={()=>changeTab('admin-page')}/>:<p role="alert">Paket yönetimi için yönetici hesabıyla giriş yapın.</p>)}
          {activeTab==='offers'&&<OfferMarketplace key={submissionAccount.session?.user.id||'public'} state={offers}
            listings={listings} ownListings={submissionAccount.items} session={submissionAccount.session}
            onOpenListing={openListing} onSignIn={signInForOffers} onCreateListing={createOfferListing} onBack={()=>changeTab('home')}/>}
          {activeTab==='store'&&<Storefront key={storeId||'none'} invalidLink={invalidStoreLink} state={storeMembership} normalize={normalizeListing} offerIds={offers.error?[]:offers.catalogIds} onBack={()=>changeTab('memberships')} onListing={row=>{
            const owner=submissionAccount.items.find(x=>x.id===row.id)||listings.find(x=>x.id===row.id);
            openListing({...row,submitted_by:owner?.submitted_by});
          }}/>}
          <SiteSettingsStatus state={siteSettings} />
          {listingsError && isAdminLoggedIn && (
            <div role="alert" style={{ backgroundColor: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 12px', marginBottom: '12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ flex: 1 }}>{listingsError}</span>
              <button onClick={() => fetchListings()} style={{ border: 'none', borderRadius: '5px', padding: '6px 8px', backgroundColor: '#991b1b', color: '#fff', fontWeight: '700', cursor: 'pointer' }}>Yeniden Dene</button>
            </div>
          )}
          {listingsError && !isAdminLoggedIn && listings.length === 0 && (
            <div role="status" style={{ backgroundColor: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px', marginBottom: '12px', fontSize: '12px' }}>
              İlanlar şu anda geçici olarak görüntülenemiyor. Otomatik yeniden deneme yapılacak.
            </div>
          )}
          {listingsLoading && listings.length === 0 && (
            <div role="status" style={{ backgroundColor: '#fff', color: '#475569', borderRadius: '8px', padding: '12px', marginBottom: '12px', fontSize: '13px' }}>İlanlar yükleniyor...</div>
          )}
          {activeTab !== 'home' && announcementBanner}

        {activeTab === 'success-wa' && (
          <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '24px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
            <CheckCircle size={36} color="#166534" style={{ margin: '0 auto 12px auto' }} />
            <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#1b3a2b', margin: '0 0 8px 0' }}>İlanınız Onay İçin Alındı</h2>
            <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '20px' }}>İlanınız henüz yayında değil. Yönetici onayından sonra herkes tarafından görülebilecek. Durumunu İlan Ver bölümündeki gönderimlerinizden takip edebilirsiniz.</p>
            {submissionWarning&&<p role="alert" data-testid="status-offer-listing-partial-save" style={{color:'#92400e'}}>{submissionWarning}</p>}
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

        {unsubscribeToken && <ContactUnsubscribe token={unsubscribeToken} url={SUPABASE_URL} publicKey={SUPABASE_ANON_KEY} isTurso={TURSO_AUTH_ENABLED} />}
        {activeTab === 'contacts' && (
          isAdminLoggedIn ? <ContactDepotManager state={contactDepot} onBack={()=>changeTab('admin-page')} /> :
            <div role="alert"><p>Kişi deposu yalnızca yetkili yöneticilere açıktır.</p>
              <button type="button" onClick={()=>changeTab('admin-page')}>Yönetici girişine git</button></div>
        )}
        {activeTab === 'statistics' && (
          <div>
            <button type="button" onClick={()=>changeTab('admin-page')} style={{marginBottom:12}}>← Yönetim Paneline Dön</button>
            {isAdminLoggedIn ? <TrafficDashboard state={trafficReport} /> :
              <p role="alert">İstatistikler yalnızca yetkili yöneticilere açıktır. Yönetim panelinden giriş yapın.</p>}
          </div>
        )}

        {activeTab === 'home' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="rd-strip" ref={homeOpeningAnchorRef} data-testid="home-opening-anchor">
              <HomeMenuDrawer main={menuMain} personal={menuPersonal} sections={menuSections} open={menuOpen}
                onOpen={() => setMenuOpen(true)} onClose={() => setMenuOpen(false)}
                onLogout={() => { void submissionAccount.signOut(); }} signedIn={!!submissionAccount.session} />
              <BrandLogo />
            </div>
            <div style={{ order: 1 }}>
              <DiscoveryBar
                query={homeSearchQuery}
                onQuery={setHomeSearchQuery}
                categories={categoriesWithSubs}
                category={selectedCategory}
                sub={selectedSubCategory}
                onCategory={category => { setSelectedCategory(category); setSelectedSubCategory('Tümü'); }}
                onSub={setSelectedSubCategory}
                province={province}
                district={district}
                onRegion={() => setRegionOpen(true)}
                sort={sortKey}
                onSort={setSortKey}
                countText={listingsLoading && listings.length === 0
                  ? 'İlanlar yükleniyor…'
                  : listingsError && listings.length === 0
                    ? 'İlan sayısı bilinmiyor'
                    : `${filteredListings.length} ilan`}
                onAll={() => changeTab('results')}
              />
            </div>
            <div style={{ order: 4 }}>
            <div className="pt-home-promo-grid" data-testid="home-promo-grid">
              {siteSettings.settings && (
                <div id="promo-featured"><FeaturedOfferNotice offer={siteSettings.settings.featured_offer} expandable onRequest={requestFeaturedOffer} /></div>
              )}
              <div id="promo-store"><MembershipNotice expandable plans={storeMembership.data?.plans} onOpen={()=>changeTab('memberships')}/></div>
              <div id="promo-trial"><TrialPromotion expandable ready={!!storeMembership.data?.plans.some(plan=>plan.id==='trial-30-days')}
                used={!!storeMembership.data?.mine?.trial_used}
                onOpenTrial={()=>{setMembershipPreferredPlan('trial-30-days');changeTab('memberships');}}/></div>
            </div>
            {advertisements.items.some(ad=>ad.is_active&&ad.media_type==='video')&&
              <AdvertisementPlacement state={{...advertisements,items:advertisements.items.filter(ad=>ad.media_type==='video')}} admin={isAdminLoggedIn} onManage={() => changeTab('advertisements')} />}
            <div id="sponsors-section"><SponsorPartners state={advertisements} admin={isAdminLoggedIn} onManage={()=>changeTab('advertisements')} /></div>
            {announcementBanner}
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
                onClick={(event) => { if (isAdminLoggedIn) { event.preventDefault(); changeTab('advertisements'); } }}
                target="_blank"
                rel="noopener noreferrer"
                style={{ backgroundColor: '#059669', color: '#fff', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}
              >
                {isAdminLoggedIn ? 'Reklamları Yönet' : 'Reklam Ver'}
              </a>
            </div>
            </div>

            {homeFeaturedListings.length > 0 && (
                <div style={{ order: 3, marginBottom: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', fontWeight: '800', fontSize: '14px', color: '#854d0e' }}>
                  <Star size={16} fill="#eab308" color="#eab308" /> Vitrin İlanları
                </div>
                <div className="pt-home-listings-grid" data-testid="featured-listings-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gridAutoFlow: 'row', gap: 'var(--pt-card-row-gap, 10px) var(--pt-card-column-gap, 10px)', paddingBottom: '4px' }}>
                  {homeFeaturedListings.map(item => {
                    const displayImg = (item.images && item.images[0]) || item.image || 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&q=80&w=800';
                    return (
                      <button type="button" key={`feat-${item.id}`} onClick={() => openListing({ ...item, images: item.images || [displayImg] })} style={{ minWidth: 0, boxSizing: 'border-box', backgroundColor: '#fff', color: '#1e293b', textAlign: 'left', font: 'inherit', borderRadius: '8px', border: '1px solid #fde047', cursor: 'pointer', overflow: 'hidden', padding: '8px' }}>
                        <img src={displayImg} alt={item.title} style={{ width: '100%', height: '100px', objectFit: 'cover', borderRadius: '6px', marginBottom: '6px' }} />
                        <div style={{ fontSize: '12px', fontWeight: '700', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</div>
                        <div style={{ fontSize: '13px', fontWeight: '800', color: '#1b3a2b', marginTop: '2px' }}>{Number(item.price).toLocaleString('tr-TR')} TL</div>
                        <ListingDate value={item.created_at} />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {(listingsLoading || listingsError || !homeFeaturedListings.length ||
              ((homeSearchQuery.trim() || selectedCategory !== 'Tüm kategoriler' || province || district || sortKey !== 'default') && homeRegularListings.length > 0)) && (
              <section aria-labelledby="home-listings-heading" style={{ order: 2, marginBottom: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 9 }}>
                  <h2 id="home-listings-heading" style={{ margin: 0, color: '#1b3a2b', fontSize: 18, fontWeight: 800 }}>Güncel Tarım İlanları</h2>
                  <span data-testid="home-listings-count" style={{ color: '#64748b', fontSize: 12, whiteSpace: 'nowrap' }}>
                    {listingsLoading && listings.length === 0 ? 'İlanlar yükleniyor…' : listingsError && listings.length === 0 ? 'İlan sayısı bilinmiyor' : `${filteredListings.length} ilan`}
                  </span>
                </div>
                {homeListingState === 'loading' ? (
                  <div role="status" data-testid="home-listings-loading" style={{ padding: 13, border: '1px solid #e2e8f0', borderRadius: 9, background: '#fff', color: '#64748b', fontSize: 12 }}>
                    Yayındaki ilanlar yükleniyor…
                  </div>
                ) : homeListingState === 'error' ? (
                  <div role="status" data-testid="home-listings-error" style={{ padding: 13, border: '1px solid #fed7aa', borderRadius: 9, background: '#fff7ed', color: '#9a3412', fontSize: 12 }}>
                    İlanlar geçici olarak yüklenemedi. Sonradan yeniden deneyin.
                  </div>
                ) : homeListingState === 'listings' ? (
                  <>
                    <div className="pt-home-listings-grid" data-testid="home-listings-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gridAutoFlow: 'row', gap: 'var(--pt-card-row-gap, 10px) var(--pt-card-column-gap, 10px)', paddingBottom: 4 }}>
                      {homeVisibleListings.map(item => {
                        const displayImg = (item.images && item.images[0]) || item.image || DEFAULT_LISTING_IMAGE;
                        return (
                          <button type="button" key={item.id} onClick={() => openListing({ ...item, images: item.images || [displayImg] })}
                            data-testid={`home-listing-${item.id}`}
                            style={{ minWidth: 0, boxSizing: 'border-box', backgroundColor: '#fff', color: '#1e293b', textAlign: 'left', font: 'inherit', borderRadius: 8, border: '1px solid #e2e8f0', cursor: 'pointer', overflow: 'hidden', padding: 8 }}>
                            <img src={displayImg} alt={item.title} loading="lazy" style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 6, marginBottom: 6 }} />
                            <div style={{ fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</div>
                            <div style={{ fontSize: 10, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 3 }}>{item.category}</div>
                            <div style={{ fontSize: 12, color: '#64748b', marginTop: 3, overflowWrap: 'anywhere' }}>{item.location}</div>
                            <div style={{ fontSize: 13, fontWeight: 800, color: '#1b3a2b', marginTop: 3 }}>{Number(item.price).toLocaleString('tr-TR')} TL</div>
                            <ListingDate value={item.created_at} />
                          </button>
                        );
                      })}
                    </div>
                    {homeRegularListings.length > homeVisibleListings.length && (
                      <button type="button" onClick={() => changeTab('results')} data-testid="button-view-all-home-listings"
                        style={{ width: '100%', marginTop: 10, padding: '10px 12px', border: '1px solid #1b3a2b', borderRadius: 8, background: '#1b3a2b', color: '#fff', fontWeight: 750, cursor: 'pointer' }}>
                        Tüm {filteredListings.length} ilanı gör
                      </button>
                    )}
                  </>
                ) : homeListingState === 'empty' ? (
                  <div role="status" data-testid="home-listings-empty" style={{ padding: 13, border: '1px solid #e2e8f0', borderRadius: 9, background: '#fff', color: '#64748b', fontSize: 12 }}>
                    Şu anda yayında ilan yok.
                  </div>
                ) : (
                  <div role="status" data-testid="home-listings-filter-empty" style={{ padding: 13, border: '1px solid #e2e8f0', borderRadius: 9, background: '#fff', color: '#64748b', fontSize: 12 }}>
                    Bu arama, kategori veya bölge için yayında ilan bulunamadı.
                  </div>
                )}
              </section>
            )}
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
                <div key={item.id} onClick={() => openListing({ ...item, images: item.images || [displayImg] })} style={{ backgroundColor: '#fff', borderRadius: '10px', overflow: 'hidden', border: '1px solid #e2e8f0', cursor: 'pointer', display: 'flex', gap: '10px', padding: '10px', marginBottom: '10px' }}>
                  <img src={displayImg} alt={item.title} style={{ width: '90px', height: '90px', objectFit: 'cover', borderRadius: '8px' }} />
                  <div style={{ flex: 1 }}>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '13px', fontWeight: '700' }}>{item.title}</h4>
                    <div style={{ fontSize: '15px', fontWeight: '800', color: '#1b3a2b' }}>{Number(item.price).toLocaleString('tr-TR')} TL</div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>📍 {item.location}</div>
                    <ListingDate value={item.created_at} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'detail' && !selectedListing && (
          <section role="status" style={{background:'#fff',padding:'20px',borderRadius:'10px'}}>
            <h2>{listingsLoading?'İlan yükleniyor…':listingsError?'İlan yüklenemedi':'Paylaşılan ilan bulunamadı'}</h2>
            <p>{listingsError||(!listingsLoading?'Bu ilan kaldırılmış veya artık yayında olmayabilir.':'Bağlantıdaki ilan açılıyor.')}</p>
            {listingsError&&<button type="button" onClick={()=>void fetchListings()}>Yeniden dene</button>}
            <button type="button" onClick={()=>changeTab('home')}>Diğer ilanlara dön</button>
          </section>
        )}
        {activeTab === 'detail' && selectedListing && !isAdminLoggedIn && isListingArchived(selectedListing, listingNow) && (
          <div role="status" style={{ padding: '16px', background: '#fff', borderRadius: '12px' }}>
            Bu ilanın 8 aylık yayın süresi doldu ve ilan arşive alındı.
            <button type="button" onClick={() => changeTab('home')} style={{ display: 'block', marginTop: '12px' }}>Ana sayfaya dön</button>
          </div>
        )}
        {activeTab === 'detail' && selectedListing && (isAdminLoggedIn || !isListingArchived(selectedListing, listingNow)) && (
          <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '16px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <button onClick={() => changeTab('results')} style={{ background: 'none', border: 'none', color: '#64748b', fontWeight: '600', cursor: 'pointer' }}>← Listeye Dön</button>
              {isAdminLoggedIn && (
                <button onClick={() => startOwnerEditing(selectedListing)} style={{ backgroundColor: '#e0f2fe', color: '#0284c7', border: 'none', padding: '6px 12px', borderRadius: '6px', fontWeight: '700', fontSize: '12px', cursor: 'pointer' }}>
                  ✏️ Bu İlanı Düzenle
                </button>
              )}
              {!isAdminLoggedIn && submissionAccount.session && submissionAccount.session.user.id === selectedListing.submitted_by &&
                <button type="button" onClick={()=>startOwnerEditing(selectedListing)}>İlanı Düzenle / Güncelle</button>}
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
            <div style={{ margin: '0 0 12px', padding: '10px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
              <label htmlFor="listing-photo-address" style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '6px' }}>Fotoğraf adresi</label>
              {selectedPhotoAddress ? (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <input id="listing-photo-address" aria-label="Fotoğraf adresi" readOnly value={selectedPhotoAddress} onFocus={event=>event.currentTarget.select()} style={{ flex: '1 1 220px', minWidth: 0, padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px' }} />
                  <button type="button" onClick={()=>void copyPhotoAddress(selectedPhotoAddress)} style={{ padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', background: '#fff', cursor: 'pointer' }}>Fotoğraf adresini kopyala</button>
                </div>
              ) : <p role="status" style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>Bu fotoğrafın kopyalanabilir bir web adresi yok.</p>}
            </div>
            <h2 style={{ fontSize: '18px', fontWeight: '800', margin: '8px 0' }}>{selectedListing.title}</h2>
            <ListingDate value={selectedListing.created_at} />
            {isListingArchived(selectedListing, listingNow) && <p role="status" style={{ color: '#854d0e', fontSize: '12px' }}>Arşivde — yayın süresi {formatListingDate(selectedListing.expires_at)} tarihinde doldu. İlan kaydı ve fotoğrafları korunuyor.</p>}
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
                  href={`https://api.whatsapp.com/send?text=${encodeURIComponent(listingShareText(selectedListing))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ flex: 1, backgroundColor: '#22c55e', color: '#fff', padding: '8px 10px', borderRadius: '6px', textAlign: 'center', fontWeight: '700', textDecoration: 'none', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                >
                  <MessageCircle size={14} /> WhatsApp
                </a>
                <a
                  href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(listingShareUrl(selectedListing.id))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ flex: 1, backgroundColor: '#1877f2', color: '#fff', padding: '8px 10px', borderRadius: '6px', textAlign: 'center', fontWeight: '700', textDecoration: 'none', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                >
                  <Share2 size={14} /> Facebook
                </a>
                <button
                  onClick={() => void copyListingShare(listingShareText(selectedListing), 'İlan bilgileri ve bağlantısı kopyalandı. Instagram hikâyesinde Bağlantı etiketiyle veya mesajda paylaşabilirsiniz. Gönderi açıklamasındaki bağlantılar tıklanamaz.')}
                  style={{ flex: 1, backgroundColor: '#e1306c', color: '#fff', border: 'none', padding: '8px 10px', borderRadius: '6px', textAlign: 'center', fontWeight: '700', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                >
                  <ImageIcon size={14} /> Instagram
                </button>
              </div>
              <div style={{marginTop:'10px',display:'flex',gap:'8px',alignItems:'center',flexWrap:'wrap'}}>
                <a href={listingShareUrl(selectedListing.id)} target="_blank" rel="noopener noreferrer" style={{fontSize:'12px',overflowWrap:'anywhere',flex:'1 1 180px'}}>{listingShareUrl(selectedListing.id)}</a>
                <button type="button" onClick={()=>void copyListingShare(listingShareUrl(selectedListing.id),'İlan bağlantısı kopyalandı.')} style={{padding:'8px',border:'1px solid #cbd5e1',borderRadius:'6px',cursor:'pointer'}}>Bağlantıyı kopyala</button>
              </div>
            </div>

            <a href={`tel:${selectedListing.phone}`} style={{ width: '100%', backgroundColor: '#1b3a2b', color: '#fff', padding: '12px', borderRadius: '8px', textAlign: 'center', fontWeight: '700', textDecoration: 'none', display: 'block', boxSizing: 'border-box' }}>
              📞 {selectedListing.phone} ({selectedListing.seller})
            </a>
            <OfferListingControls key={`${submissionAccount.session?.user.id||'public'}:${selectedListing.id}`} listing={selectedListing}
              state={offers} session={submissionAccount.session} onSignIn={signInForOffers} onViewOffers={()=>changeTab('offers')}/>
          </div>
        )}

        {activeTab === 'edit-listing' && submissionAccount.session && ownerEditingId !== null && (
          <ListingEditor key={`${submissionAccount.session.user.id}:${ownerEditingId}`} client={supabaseClient}
            itemId={ownerEditingId} userId={submissionAccount.session.user.id} isAdmin={isAdminLoggedIn}
            categories={siteSettings.settings?.categories} onSaved={finishOwnerEdit} isTursoAuth={TURSO_AUTH_ENABLED}
            onCancel={()=>{setOwnerEditingId(null);changeTab('add');}} />
        )}
        {activeTab === 'edit-listing' && (!submissionAccount.session || ownerEditingId === null) &&
          <div role="alert">Oturum değişti veya sona erdi. <button onClick={()=>changeTab('add')}>Hesabınıza dönün</button></div>}
        {activeTab === 'add' && (
          <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '16px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <button onClick={() => changeTab(isAdminLoggedIn ? 'admin-page' : 'home')} style={{ background: 'none', border: 'none', color: '#64748b', fontWeight: '600', cursor: 'pointer' }}>{isAdminLoggedIn ? '← Yönetim Paneline Dön' : '← Vazgeç'}</button>
              <h2 style={{ fontSize: '16px', fontWeight: '800', margin: 0 }}>{submissionAccount.quota?.unlimited ? 'Yönetici İlanı Ekle — Sınırsız' : 'İlan Ver (En Fazla 10 Fotoğraf)'}</h2>
            </div>
            {siteSettings.settings && (
              <FeaturedOfferNotice offer={siteSettings.settings.featured_offer} onRequest={requestFeaturedOffer} />
            )}
            <MembershipNotice compact plans={storeMembership.data?.plans} onOpen={()=>changeTab('memberships')}/>
            <SubmissionAccountPanel session={submissionAccount.session} quota={submissionAccount.quota}
              loading={submissionAccount.loading} busy={submissionAccount.busy} error={submissionAccount.error}
              message={submissionAccount.message} onAuthenticate={submissionAccount.authenticate}
              onResend={submissionAccount.resend} isTursoAuth={TURSO_AUTH_ENABLED}
              passwordResetToken={submissionAccount.passwordResetToken}
              onRequestPasswordReset={submissionAccount.requestPasswordReset}
              onResetPassword={submissionAccount.resetPassword}
              onCancelPasswordReset={submissionAccount.cancelPasswordReset}
              onSignOut={submissionAccount.signOut}
              onRefresh={() => { void submissionAccount.refresh(); }} />
            {listingEditMessage && <p role="status">{listingEditMessage}</p>}
            {submissionAccount.session && <MySubmissions items={submissionAccount.items}
              loading={submissionAccount.loading} error={submissionAccount.error}
              offers={offers} onViewOffers={()=>changeTab('offers')}
              onRefresh={() => { void submissionAccount.refresh();void offers.refresh(); }}
              onEdit={startOwnerEditing}
              onArchive={TURSO_AUTH_ENABLED && !isAdminLoggedIn ? changeOwnerListingArchive : undefined}
              archiveBusyId={ownerArchiveBusyId} />}
            {submissionAccount.session && submissionAccount.quota?.email_verified && (
            <form onSubmit={handleDirectAdd} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <label style={{display:'flex',alignItems:'center',gap:8,padding:12,background:'#fff8e5',borderRadius:8}}>
                <input type="checkbox" checked={formOfferRequested} disabled={submissionSaving||(!formOfferRequested&&(offers.loading||!!offers.error))}
                  onChange={event=>setFormOfferRequested(event.target.checked)} data-testid="switch-create-offer-listing"/>
                Teklife açık ilan oluştur
              </label>
              {formOfferRequested&&<p style={{fontSize:12}}>İlan onaylandığında Teklif Pazarı'nda da görünür. Teklif alma seçeneğini daha sonra yalnız bu ilan için kapatabilirsiniz.</p>}
              {formOfferRequested&&offers.error&&<p role="alert">{offers.error} İlanınızı normal ilan olarak göndermek için teklif seçeneğini kaldırın.</p>}
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
                <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple disabled={submissionSaving || formImageImporting} onChange={handleMultipleImageUpload} style={{ width: '100%', fontSize: '12px' }} />
                <RemoteListingImages disabled={submissionSaving} count={form.images.length} onBusyChange={setFormImageImporting}
                  onAdd={images => appendImportedPhotos('form', images)} />
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
              <p style={{fontSize:11,color:'#475569'}}>
                İlanın satıcı adı ve telefonu ile bilinen doğrulanmış hesap e-postası, yalnızca yöneticiye açık
                iletişim deposunda kaydedilir. İlan vermek toplu mesaj izni değildir; mesaj izinleri ayrıca kayıt altına alınır.
              </p>
              <button type="submit" disabled={submissionSaving || formImageImporting || (formOfferRequested && (offers.loading||!!offers.error)) || !submissionAccount.canSubmit || !siteSettings.settings || !!siteSettings.loadError}
                style={{ backgroundColor: '#22c55e', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', opacity: submissionSaving || !submissionAccount.canSubmit || !siteSettings.settings || !!siteSettings.loadError ? 0.6 : 1 }}>
                {submissionSaving ? 'Onaya gönderiliyor…' : 'İlanı Onaya Gönder'}
              </button>
            </form>
            )}
          </div>
        )}

        {activeTab === 'advertisements' && (
          isAdminLoggedIn ? <AdvertisementManager state={advertisements} onBack={() => changeTab('admin-page')} /> :
          <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <h2>Reklam yönetimi</h2>
            <p>Reklam yüklemek için yetkili yönetici hesabınızla giriş yapın.</p>
            <button type="button" onClick={() => changeTab('admin-page')}>Yönetici girişine git</button>
          </div>
        )}

        {activeTab === 'admin-page' && (
          <div ref={editFormRef} style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '16px', border: '1px solid #e2e8f0' }}>
            {!isAdminLoggedIn ? (
              <div style={{ maxWidth: '320px', margin: '30px auto', textAlign: 'center' }}>
                <h2 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '10px' }}>Yönetici Girişi</h2>
                <form onSubmit={handleAdminLogin} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <input type="email" autoComplete="username" placeholder="E-posta adresi" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} required style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                  <input type="password" autoComplete="current-password" placeholder="Yönetici parolası" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} required style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', textAlign: 'center' }} />
                  {adminAuthError && <div role="alert" style={{ color: '#b91c1c', fontSize: '12px' }}>{adminAuthError}</div>}
                  <button type="submit" disabled={adminAuthLoading} style={{ backgroundColor: '#1b3a2b', color: '#fff', border: 'none', padding: '10px', borderRadius: '6px', fontWeight: '700', cursor: adminAuthLoading ? 'wait' : 'pointer', opacity: adminAuthLoading ? 0.7 : 1 }}>{adminAuthLoading ? 'Giriş yapılıyor…' : 'Giriş Yap'}</button>
                  <p style={{ margin: 0, color: '#64748b', fontSize: '11px' }}>Yalnızca yetkili yönetici hesapları erişebilir.</p>
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
                <button type="button" onClick={() => changeTab('advertisements')} data-testid="button-admin-advertisements"
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', backgroundColor: '#ecfdf5', color: '#166534', border: '1px solid #86efac', padding: '12px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', marginBottom: '16px' }}>
                  <Megaphone size={16} /> Sponsor / Reklam Yönetimi — Görsel / Video Yükle
                </button>

                <ModerationQueue items={moderation.items.filter(item => !isListingArchived(item, listingNow))} loading={moderation.loading}
                  error={moderation.error} busyId={moderation.busyId} onDecision={moderateListing}
                  onRefresh={() => { void moderation.refresh(); }} />

                <FeaturedOfferManager state={siteSettings} />
                <button type="button" onClick={()=>changeTab('membership-admin')} data-testid="button-admin-memberships" style={{width:'100%',padding:14,margin:'16px 0',border:'1px solid #86efac',borderRadius:8,background:'#ecfdf5',color:'#166534',fontWeight:700,cursor:'pointer'}}>Mağaza Paketleri — Havale/EFT Onayları</button>
                <button type="button" onClick={()=>changeTab('contacts')} data-testid="button-admin-contacts"
                  style={{width:'100%',padding:14,margin:'16px 0',border:'1px solid #86efac',borderRadius:8,background:'#ecfdf5',color:'#166534',fontWeight:700,cursor:'pointer'}}>
                  Kişi ve İletişim Deposu — SMS / E-posta / WhatsApp
                </button>
                <button type="button" onClick={()=>changeTab('statistics')} data-testid="button-admin-statistics"
                  style={{width:'100%',padding:14,margin:'16px 0',border:'1px solid #86efac',borderRadius:8,background:'#ecfdf5',color:'#166534',fontWeight:700,cursor:'pointer'}}>
                  Ziyaret İstatistikleri — Bölge, Süre ve Sıklık
                </button>

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
                      <p>Galeri / SEO: {editingListing.title}. Metin ve fiyat için ayrı “Düzenle” düğmesini kullanın.</p>
                      <input type="text" name="seoTags" value={editingListing.seoTags || ''} onChange={handleEditFormChange} placeholder="SEO Etiketleri (virgülle ayırın)" style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                      <div style={{ backgroundColor: '#fff', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '11px', fontWeight: '700', color: '#475569' }}>📷 Fotoğrafları Yönet (En Fazla 10 Adet)</label>
                        <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple disabled={gallerySaving || editImageImporting} onChange={handleEditMultipleImageUpload} style={{ width: '100%', fontSize: '11px' }} />
                        <RemoteListingImages key={editingListing.id} disabled={gallerySaving} count={(editingListing.images || []).length} onBusyChange={setEditImageImporting}
                          onAdd={images => appendImportedPhotos('editingListing', images)} />
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
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button type="submit" disabled={gallerySaving || editImageImporting} style={{ flex: 1, backgroundColor: '#22c55e', color: '#fff', border: 'none', padding: '8px', borderRadius: '6px', fontWeight: '700', cursor: 'pointer' }}>{gallerySaving?'Kaydediliyor…':'Galeri / SEO Kaydet'}</button>
                        <button type="button" disabled={gallerySaving || editImageImporting} onClick={() => setEditingListing(null)} style={{ background: '#e2e8f0', border: 'none', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer' }}>İptal</button>
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

                <h3 style={{ fontSize: '14px', fontWeight: '700', marginTop: '20px', marginBottom: '8px' }}>📋 Yayındaki İlanlar ({approvedListings.length})</h3>
                {approvedListings.map(item => {
                  const isFeat = item.isFeatured === true;
                  return (
                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', backgroundColor: '#f8fafc', borderRadius: '6px', marginBottom: '6px' }}>
                      <div><span style={{ fontSize: '12px', fontWeight: '600' }}>{item.title}</span><ListingDate value={item.created_at} /></div>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button type="button" disabled={featuredBusyIds.includes(item.id)} aria-busy={featuredBusyIds.includes(item.id)} onClick={() => toggleFeaturedListing(item.id)} style={{ backgroundColor: isFeat ? '#fef08a' : '#f1f5f9', color: '#854d0e', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>
                          {featuredBusyIds.includes(item.id) ? 'Kaydediliyor…' : isFeat ? '⭐ Vitrinde' : '☆ Vitrin Yap'}
                        </button>
                        <button onClick={() => startOwnerEditing(item)} style={{ backgroundColor: '#e0f2fe', color: '#0284c7', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>Düzenle</button>
                        <button onClick={() => startEditingFromDetail(item)} type="button">Galeri / SEO</button>
                        <button onClick={() => handleDeleteListing(item.id)} style={{ backgroundColor: '#fee2e2', color: '#dc2626', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>Sil</button>
                      </div>
                    </div>
                  );
                })}
                <section aria-labelledby="listing-archive-heading" style={{ marginTop: '20px', padding: '12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                  <h3 id="listing-archive-heading" style={{ margin: '0 0 8px', fontSize: '14px' }}>İlan Arşivi</h3>
                  <p style={{ fontSize: '12px', color: '#64748b' }}>İlanlar veriliş tarihinden 12 takvim ayı sonra otomatik olarak yayından kalkar. Kayıtları ve fotoğrafları silinmez. Düzenlemek veya onaylamak bu süreyi yenilemez.</p>
                  <button type="button" onClick={() => { void listingArchive.refresh(); }} disabled={listingArchive.loading || listingArchive.busyId !== null}>Arşivi yenile</button>
                  {listingArchive.loading && <p role="status">Arşiv yükleniyor…</p>}
                  {listingArchive.error && <p role="alert" style={{ color: '#b91c1c' }}>{listingArchive.error}</p>}
                  {!listingArchive.loading && !listingArchive.error && listingArchive.items.length === 0 && <p style={{ fontSize: '12px' }}>Henüz arşive alınmış ilan yok.</p>}
                  {listingArchive.items.map(item => (
                    <div key={item.id} style={{ padding: '10px 0', borderBottom: '1px solid #e2e8f0' }}>
                      <strong style={{ fontSize: '12px' }}>{item.title}</strong>
                      <ListingDate value={item.created_at} />
                      <div style={{ fontSize: '11px', color: '#854d0e', margin: '4px 0' }}>Arşive alınma tarihi: {formatListingDate(item.expires_at)}</div>
                      <button type="button" disabled={listingArchive.busyId !== null || listingArchive.loading} onClick={async () => {
                        const row = await listingArchive.view(item.id);
                        if (row) { openListing(normalizeListing(row)); }
                      }}>{listingArchive.busyId === item.id ? 'Açılıyor…' : 'İlanı görüntüle'}</button>
                    </div>
                  ))}
                  {listingArchive.hasMore && <button type="button" disabled={listingArchive.loading || listingArchive.busyId !== null} onClick={() => { void listingArchive.loadMore(); }}>Daha eski ilanları yükle</button>}
                </section>
              </div>
            )}
          </div>
        )}
      </main>

      <RegionDialog
        open={regionOpen}
        onClose={() => setRegionOpen(false)}
        provinces={PROVINCES}
        districts={locationChoices.districts}
        province={province}
        district={district}
        onProvince={value => { setProvince(value); setDistrict(''); }}
        onDistrict={setDistrict}
        onAll={() => {}}
      />

      {activeTab === 'home' && <PlatformIntroduction />}
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

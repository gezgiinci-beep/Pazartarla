import {useCallback, useEffect, useRef, useState} from 'react';
import type {Session, SupabaseClient} from '@supabase/supabase-js';

export type Offer = {
  id: string;
  listing_id: number;
  title: string;
  role: 'buyer' | 'seller';
  status: 'pending' | 'countered' | 'accepted' | 'declined';
  amount: number;
  counter_amount: number | null;
  quantity: string;
  note: string;
  buyer_phone: string | null;
  seller_phone: string | null;
  created_at: string;
  updated_at: string;
};
export type OfferMessage = {
  id: string;
  offer_id: string;
  actor: 'buyer' | 'seller';
  body: string;
  created_at: string;
};
export type OffersState = {
  catalogIds: number[];
  ownerIds: number[];
  settings: Record<number, boolean>;
  offers: Offer[];
  messages: OfferMessage[];
  loading: boolean;
  busy: boolean;
  error: string;
  actionError: string;
  refresh: () => Promise<void>;
  toggle: (listingId: number, enabled: boolean) => Promise<boolean>;
  submit: (listingId: number, data: {amount: number; quantity: string; note: string; phone: string}) => Promise<boolean>;
  respond: (offerId: string, action: 'accept' | 'decline' | 'counter' | 'buyer_accept' | 'buyer_decline', amount?: number) => Promise<boolean>;
  sendMessage: (offerId: string, body: string) => Promise<boolean>;
};

const backendUnavailable = (error: unknown) => {
  const value = error as {code?: string; message?: string};
  return value?.code === 'PGRST202' || value?.code === '42883' || /could not find the function/i.test(value?.message || '');
};
const offerError = (error: unknown) => {
  if (backendUnavailable(error)) return 'Teklif altyapısı henüz kurulmadı. Yönetici kurulumu tamamlayana kadar teklif verilemez.';
  const value = error as {message?: string};
  const messages: Record<string, string> = {
    OFFER_LOGIN_REQUIRED: 'Teklif için doğrulanmış hesabınızla giriş yapın.',
    OFFER_NOT_AVAILABLE: 'İlan şu anda teklif almıyor. Güncel ilanı kontrol edin.',
    OFFER_NOT_OWNER: 'Teklif ayarını yalnız ilan sahibi değiştirebilir.',
    OFFER_INVALID: 'Teklif tutarını, miktarı, mesajı ve telefonu kontrol edin.',
    OFFER_CONFLICT: 'Teklif başka bir oturumda değişti. Güncel durumu yükleyin.',
    OFFER_LIMIT: 'Çok fazla teklif gönderildi. Bir süre sonra yeniden deneyin.',
    OFFER_MESSAGE_LIMIT: 'Mesaj sınırına ulaşıldı. Bir süre sonra yeniden deneyin.',
  };
  return messages[value?.message || ''] || 'Teklif işlemi tamamlanamadı. Bağlantınızı kontrol edip yeniden deneyin.';
};
const validOffer = (row: any): row is Offer =>
  row && typeof row.id === 'string' && Number.isSafeInteger(row.listing_id) &&
  typeof row.title === 'string' && ['buyer', 'seller'].includes(row.role) &&
  ['pending', 'countered', 'accepted', 'declined'].includes(row.status) &&
  typeof row.amount === 'number' && (row.counter_amount === null || typeof row.counter_amount === 'number') &&
  typeof row.quantity === 'string' && typeof row.note === 'string' &&
  (row.buyer_phone === null || typeof row.buyer_phone === 'string') &&
  (row.seller_phone === null || typeof row.seller_phone === 'string') &&
  typeof row.created_at === 'string' && typeof row.updated_at === 'string';
const validMessage = (row: any): row is OfferMessage =>
  row && typeof row.id === 'string' && typeof row.offer_id === 'string' &&
  ['buyer', 'seller'].includes(row.actor) && typeof row.body === 'string' && typeof row.created_at === 'string';

export function useOffers(client: SupabaseClient | null, session: Session | null): OffersState {
  const [catalogIds, setCatalogIds] = useState<number[]>([]);
  const [ownerIds, setOwnerIds] = useState<number[]>([]);
  const [settings, setSettings] = useState<Record<number, boolean>>({});
  const [offers, setOffers] = useState<Offer[]>([]);
  const [messages, setMessages] = useState<OfferMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const generation = useRef(0);
  const sequence = useRef(0);
  const locked = useRef(false);
  const identity = useRef(session?.user.id);
  const dataIdentity = useRef<string | undefined>(session?.user.id);
  identity.current = session?.user.id;

  const refresh = useCallback(async () => {
    const userId = session?.user.id;
    const current = generation.current;
    const read = ++sequence.current;
    setLoading(true);
    if (!client) {
      if (current === generation.current) {
        setError('Teklif bağlantısı yapılandırılmamış.');
        setLoading(false);
      }
      return;
    }
    try {
      const auth = await client.auth.getSession();
      if (auth.error || auth.data.session?.user.id !== userId) throw new Error('OFFER_LOGIN_REQUIRED');
      const [catalog, privateData] = await Promise.all([
        client.rpc('get_offer_catalog'),
        userId ? client.rpc('get_my_offer_data') : Promise.resolve({data: {
          owner_ids: [], settings: [], offers: [], messages: [],
        }, error: null}),
      ]);
      if (catalog.error) throw catalog.error;
      if (privateData.error) throw privateData.error;
      const data: any = privateData.data;
      if (!Array.isArray(catalog.data) || !catalog.data.every(id => Number.isSafeInteger(id) && id > 0) ||
        !data || !Array.isArray(data.owner_ids) || !data.owner_ids.every((id: unknown) => Number.isSafeInteger(id) && (id as number) > 0) ||
        !Array.isArray(data.settings) || !data.settings.every((row: any) => Number.isSafeInteger(row?.listing_id) && typeof row?.enabled === 'boolean') ||
        !Array.isArray(data.offers) || !data.offers.every(validOffer) ||
        !Array.isArray(data.messages) || !data.messages.every(validMessage)) {
        throw new Error('INVALID_OFFER_RESPONSE');
      }
      if (current !== generation.current || read !== sequence.current || identity.current !== userId) return;
      dataIdentity.current = userId;
      setCatalogIds(catalog.data);
      setOwnerIds(data.owner_ids);
      setSettings(Object.fromEntries(data.settings.map((row: any) => [row.listing_id, row.enabled])));
      setOffers(data.offers);
      setMessages(data.messages);
      setError('');
    } catch (problem) {
      if (current === generation.current && read === sequence.current && identity.current === userId)
        setError(offerError(problem));
    } finally {
      if (current === generation.current && read === sequence.current && identity.current === userId) setLoading(false);
    }
  }, [client, session?.user.id, session?.access_token]);

  useEffect(() => {
    ++generation.current;
    ++sequence.current;
    setCatalogIds([]);
    setOwnerIds([]);
    setSettings({});
    setOffers([]);
    setMessages([]);
    setError('');
    setActionError('');
    setBusy(false);
    void refresh();
    const onFocus = () => { if (document.visibilityState === 'visible' && !locked.current) void refresh(); };
    const timer = window.setInterval(onFocus, 60_000);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      ++generation.current;
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [refresh]);

  const action = async (name: string, args: Record<string, unknown>): Promise<boolean> => {
    if (locked.current || !client || error) return false;
    locked.current = true;
    const current = generation.current;
    const userId = identity.current;
    setBusy(true);
    setActionError('');
    try {
      const {data: auth, error: authError} = await client.auth.getSession();
      if (authError || !auth.session || auth.session.user.id !== userId) throw new Error('OFFER_LOGIN_REQUIRED');
      const {data, error: failure} = await client.rpc(name, args);
      if (failure) throw failure;
      if (!data || data.ok !== true) throw new Error('INVALID_OFFER_RESPONSE');
      if (current === generation.current && identity.current === userId) await refresh();
      return current === generation.current && identity.current === userId;
    } catch (problem) {
      if (current === generation.current && identity.current === userId) setActionError(offerError(problem));
      return false;
    } finally {
      locked.current = false;
      if (current === generation.current && identity.current === userId) setBusy(false);
    }
  };

  return {
    catalogIds,
    ownerIds: dataIdentity.current === session?.user.id ? ownerIds : [],
    settings: dataIdentity.current === session?.user.id ? settings : {},
    offers: dataIdentity.current === session?.user.id ? offers : [],
    messages: dataIdentity.current === session?.user.id ? messages : [],
    loading, busy, error, actionError, refresh,
    toggle: (listingId, enabled) =>
      action('set_listing_offer_enabled', {p_listing_id: listingId, p_enabled: enabled}),
    submit: (listingId, values) =>
      action('create_listing_offer', {p_listing_id: listingId, p_amount: values.amount,
        p_quantity: values.quantity, p_note: values.note, p_buyer_phone: values.phone}),
    respond: (offerId, response, amount) =>
      action('respond_to_listing_offer', {p_offer_id: offerId, p_action: response,
        p_amount: amount ?? null}),
    sendMessage: (offerId, body) =>
      action('send_listing_offer_message', {p_offer_id: offerId, p_body: body}),
  };
}

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Session, SupabaseClient } from '@supabase/supabase-js';

export type SubmissionQuota = {
  email_verified: boolean;
  unlimited: boolean;
  limit: number | null;
  used: number;
  remaining: number | null;
  next_available_at: string | null;
};

export function useSubmissionAccount(client: SupabaseClient | null, url: string, key: string, normalize: (row: any) => any) {
  const [session, setSession] = useState<Session | null>(null);
  const [quota, setQuota] = useState<SubmissionQuota | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const identity = useRef<string | undefined>();
  identity.current = session?.user.id;

  useEffect(() => {
    if (!client) return;
    let active = true;
    client.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      if (sessionError) setError('Oturum yüklenemedi. Lütfen tekrar giriş yapın.');
      setSession(data.session);
    });
    // Never perform async Auth/RPC work inside the Auth callback's lock.
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, nextSession) => {
      if (active) setSession(nextSession);
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, [client]);

  const refresh = useCallback(async () => {
    const userId = session?.user.id;
    if (!client || !session || !userId) {
      setQuota(null);
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [quotaResult, response] = await Promise.all([
        client.rpc('get_listing_submission_quota'),
        fetch(`${url}/rest/v1/listings?select=*&submitted_by=eq.${encodeURIComponent(userId)}&order=created_at.desc&limit=50`, {
          headers: { apikey: key, Authorization: `Bearer ${session.access_token}` },
          cache: 'no-store',
        }),
      ]);
      if (quotaResult.error) throw quotaResult.error;
      if (!response.ok) throw new Error('SUBMISSIONS_LOAD_FAILED');
      const rows = await response.json();
      if (!Array.isArray(rows)) throw new Error('SUBMISSIONS_LOAD_FAILED');
      if (identity.current !== userId) return;
      setQuota(quotaResult.data);
      setItems(rows.map(normalize));
    } catch {
      if (identity.current === userId) {
        setQuota(null);
        setError('İlan kotanız veya gönderimleriniz yüklenemedi. Yeniden deneyin.');
      }
    } finally {
      if (identity.current === userId) setLoading(false);
    }
  }, [client, session?.user.id, session?.access_token, url, key, normalize]);

  useEffect(() => {
    setQuota(null);
    setItems([]);
    void refresh();
    if (!session) return;
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh(); };
    const interval = window.setInterval(onVisible, 60_000);
    window.addEventListener('focus', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', onVisible);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  const authenticate = async (mode: 'login' | 'signup', email: string, password: string) => {
    if (!client) { setError('Sunucu bağlantısı yapılandırılmamış.'); return; }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = mode === 'signup'
        ? await client.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: window.location.origin + '/' } })
        : await client.auth.signInWithPassword({ email: email.trim(), password });
      if (result.error) throw result.error;
      if (mode === 'signup' && !result.data.session) {
        setMessage('Doğrulama bağlantısı e-posta adresinize gönderildi. E-postanızı doğrulayıp bu sayfaya dönerek giriş yapın.');
      } else {
        setSession(result.data.session);
        setMessage('Giriş başarılı. İlanlarınız yönetici onayına gönderilecektir.');
      }
    } catch (authError: any) {
      const details = String(authError?.message || '');
      setError(/email.*not.*confirmed/i.test(details)
        ? 'İlan göndermeden önce e-posta adresinizi doğrulayın.'
        : /rate|too many|seconds/i.test(details)
          ? 'Çok fazla deneme yapıldı. Biraz bekleyip tekrar deneyin.'
          : mode === 'signup'
            ? 'Üyelik oluşturulamadı veya doğrulama e-postası gönderilemedi. Bilgilerinizi kontrol edip yeniden deneyin.'
            : 'Giriş yapılamadı. E-posta ve parolanızı kontrol edin.');
    } finally { setBusy(false); }
  };

  const resend = async (email: string) => {
    if (!client || !email.trim()) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const { error: resendError } = await client.auth.resend({
        type: 'signup', email: email.trim(), options: { emailRedirectTo: window.location.origin + '/' },
      });
      if (resendError) throw resendError;
      setMessage('Doğrulama e-postası yeniden istendi. Gelen kutunuzu ve spam klasörünü kontrol edin.');
    } catch { setError('Doğrulama e-postası gönderilemedi. Biraz bekleyip tekrar deneyin.'); }
    finally { setBusy(false); }
  };

  const signOut = async () => {
    if (!client) return;
    setBusy(true); setError('');
    const { error: signOutError } = await client.auth.signOut();
    if (signOutError) setError('Çıkış yapılamadı. Yeniden deneyin.');
    else { setSession(null); setQuota(null); setItems([]); setMessage(''); }
    setBusy(false);
  };

  return {
    session, quota, items, loading, busy, error, message, refresh, authenticate, resend, signOut,
    applySaved: (row: any) => {
      if (row.submitted_by !== identity.current) return;
      setItems(current => current.map(item => item.id === row.id ? normalize(row) : item));
    },
    canSubmit: Boolean(session && quota?.email_verified && (quota.unlimited === true || (quota.remaining ?? 0) > 0) && !loading),
  };
}
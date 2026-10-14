import { useCallback, useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AUTOMATIC_REFRESH_INTERVAL_MS, automaticRefreshDue } from '../lib/refreshPolicy.mjs';
import { isTursoAccountSession, type AccountSession, type TursoAccountSession } from '../lib/accountSession';

const TURSO_AUTH_ENABLED = import.meta.env.VITE_AUTH_BACKEND === 'turso';

function authApiPath(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

function readActionFragment(): { action: 'verify' | 'reset'; token: string } | null {
  if (!TURSO_AUTH_ENABLED) return null;
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const action = params.get('auth_action');
  const token = params.get('token');
  if ((action !== 'verify' && action !== 'reset') ||
      !token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  return { action, token };
}

function clearActionFragment(): void {
  const cleanUrl = `${window.location.pathname}${window.location.search}`;
  window.history.replaceState(window.history.state, '', cleanUrl);
}

function tursoSession(data: any): TursoAccountSession | null {
  const user = data?.user;
  if (!user || typeof user.id !== 'string' || typeof user.email !== 'string' ||
      typeof user.email_confirmed_at !== 'string') return null;
  return {
    backend: 'turso',
    user: {
      id: user.id,
      email: user.email,
      email_confirmed_at: user.email_confirmed_at,
      is_anonymous: false,
    },
    expires_at: typeof data.expires_at === 'string' ? data.expires_at : null,
    is_admin: data.is_admin === true,
  };
}

async function postTursoAuth(path: string, body: Record<string, unknown> = {}): Promise<any> {
  const response = await fetch(authApiPath(path), {
    method: 'POST',
    credentials: 'include',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code = String(result?.error || '');
    const messages: Record<string, string> = {
      email_verification_required: 'İlan göndermeden önce e-posta adresinizi doğrulayın.',
      too_many_attempts: 'Çok fazla deneme yapıldı. Biraz bekleyip tekrar deneyin.',
      auth_too_many_attempts: 'Çok fazla deneme yapıldı. Biraz bekleyip tekrar deneyin.',
      email_not_configured: 'Kayıt e-postası henüz yapılandırılmadı; işlem güvenle durduruldu.',
      auth_unavailable: 'Hesap hizmeti şu anda kapalı. Bu test ortamında hiçbir kayıt değiştirilmedi.',
      auth_action_token_invalid: 'Bağlantının süresi dolmuş ya da daha önce kullanılmış. Yeni bağlantı isteyin.',
      auth_invalid_password_reset: 'Yeni parolanız en az 8 karakter olmalı ve 72 baytı aşmamalı.',
    };
    throw new Error(messages[code] || 'İşlem tamamlanamadı. E-posta ve parolanızı kontrol edip yeniden deneyin.');
  }
  return result;
}

export type SubmissionQuota = {
  email_verified: boolean;
  unlimited: boolean;
  limit: number | null;
  used: number;
  remaining: number | null;
  next_available_at: string | null;
  can_submit?: boolean;
  period?:'rolling_day'|'membership_month'|'membership_year'|'membership_trial';
  monthly_remaining?:number|null;active_limit?:number|null;active_used?:number;pending_reserved?:number;plan_name?:string;membership_ends_at?:string;
};

export function useSubmissionAccount(client: SupabaseClient | null, url: string, key: string, normalize: (row: any) => any) {
  const [session, setSession] = useState<AccountSession | null>(null);
  const [quota, setQuota] = useState<SubmissionQuota | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [passwordResetToken, setPasswordResetToken] = useState<string | null>(null);
  const identity = useRef<string | undefined>();
  const lastRefreshAt = useRef(0);
  identity.current = session?.user.id;

  useEffect(() => {
    if (TURSO_AUTH_ENABLED) {
      let active = true;
      const readSession = async () => {
        const response = await fetch(authApiPath('/api/auth/session'), {
          credentials: 'include',
          cache: 'no-store',
        });
        if (!response.ok) throw new Error('SESSION_UNAVAILABLE');
        const data = await response.json();
        return tursoSession(data);
      };
      const action = readActionFragment();
      if (action?.action === 'reset') setPasswordResetToken(action.token);
      const restore = async () => {
        try {
          const restored = await readSession();
          if (active) setSession(restored);
        } catch {
          if (active) setError('Turso hesap hizmeti henüz test için etkin değil.');
        }
        if (!action) return;
        if (action.action === 'reset') {
          if (active) setMessage('Parola yenileme bağlantısı açıldı. Yeni parolanızı belirleyin.');
          return;
        }
        if (active) setBusy(true);
        try {
          await postTursoAuth('/api/auth/verify-email', { token: action.token });
          if (active) {
            setMessage('E-posta adresiniz doğrulandı. Şimdi giriş yapabilirsiniz.');
            setError('');
          }
        } catch (verifyError) {
          if (active) setError(verifyError instanceof Error ? verifyError.message : 'E-posta doğrulanamadı.');
        } finally {
          clearActionFragment();
          if (active) setBusy(false);
        }
      };
      void restore();
      return () => { active = false; };
    }
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
    if (isTursoAccountSession(session)) {
      setLoading(true);
      setError('');
      try {
        const response = await fetch(authApiPath('/api/submissions'), {
          credentials: 'include',
          cache: 'no-store',
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data?.quota || !Array.isArray(data.items)) {
          throw new Error('SUBMISSIONS_LOAD_FAILED');
        }
        const quotaData = data.quota as SubmissionQuota;
        if (typeof quotaData.email_verified !== 'boolean' ||
            typeof quotaData.unlimited !== 'boolean' ||
            !Number.isSafeInteger(quotaData.used) || quotaData.used < 0 ||
            !(quotaData.limit === null || Number.isSafeInteger(quotaData.limit) && quotaData.limit >= 0) ||
            !(quotaData.remaining === null || Number.isSafeInteger(quotaData.remaining) && quotaData.remaining >= 0) ||
            !(quotaData.next_available_at === null ||
              typeof quotaData.next_available_at === 'string' && Number.isFinite(Date.parse(quotaData.next_available_at))) ||
            !(quotaData.can_submit === undefined || typeof quotaData.can_submit === 'boolean')) {
          throw new Error('SUBMISSIONS_LOAD_FAILED');
        }
        if (identity.current !== userId) return;
        setQuota(quotaData);
        setItems(data.items.map(normalize));
      } catch {
        if (identity.current === userId) {
          setQuota(null);
          setItems([]);
          setError('İlan kotanız veya gönderimleriniz yüklenemedi. Yeniden deneyin.');
        }
      } finally {
        if (identity.current === userId) setLoading(false);
      }
      return;
    }
    if (!client || !session || !userId) {
      setQuota(null);
      setItems([]);
      setLoading(false);
      return;
    }
    lastRefreshAt.current = Date.now();
    setLoading(true);
    setError('');
    try {
      const [quotaResult, response] = await Promise.all([
        client.rpc('get_listing_submission_quota'),
        fetch(`${url}/rest/v1/listings?select=id,title,category,status,created_at,expires_at,submitted_by&submitted_by=eq.${encodeURIComponent(userId)}&order=created_at.desc&limit=50`, {
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
    lastRefreshAt.current = 0;
    void refresh();
    if (!session) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible' && automaticRefreshDue(lastRefreshAt.current)) void refresh();
    };
    const interval = window.setInterval(onVisible, AUTOMATIC_REFRESH_INTERVAL_MS);
    window.addEventListener('focus', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', onVisible);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  const authenticate = async (mode: 'login' | 'signup', email: string, password: string) => {
    if (TURSO_AUTH_ENABLED) {
      setBusy(true);
      setError('');
      setMessage('');
      try {
        if (mode === 'signup') {
          const result = await postTursoAuth('/api/auth/signup', { email: email.trim(), password });
          setMessage(result.message || 'İşlem alındı. E-posta adresinizi kontrol edin.');
          return;
        }
        await postTursoAuth('/api/auth/login', { email: email.trim(), password });
        const response = await fetch(authApiPath('/api/auth/session'), {
          credentials: 'include',
          cache: 'no-store',
        });
        if (!response.ok) throw new Error('Oturum açılamadı. Yeniden deneyin.');
        const restored = tursoSession(await response.json());
        if (!restored) throw new Error('Oturum açılamadı. Yeniden deneyin.');
        setSession(restored);
        setMessage('Giriş başarılı. İlan ve kota bilgileriniz yükleniyor.');
      } catch (authError) {
        setError(authError instanceof Error ? authError.message : 'Giriş yapılamadı. E-posta ve parolanızı kontrol edin.');
      } finally {
        setBusy(false);
      }
      return;
    }
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
    if (TURSO_AUTH_ENABLED) {
      setBusy(true); setError(''); setMessage('');
      try {
        const result = await postTursoAuth('/api/auth/resend-verification', { email: email.trim() });
        setMessage(result.message || 'İşlem alındı. Hesap uygunsa e-posta gönderilecektir.');
      } catch (resendError) {
        setError(resendError instanceof Error ? resendError.message : 'Doğrulama e-postası istenemedi.');
      } finally { setBusy(false); }
      return;
    }
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

  const requestPasswordReset = async (email: string) => {
    if (!TURSO_AUTH_ENABLED) {
      setError('Parola yenileme şu anda kullanılamıyor.');
      return;
    }
    setBusy(true); setError(''); setMessage('');
    try {
      const result = await postTursoAuth('/api/auth/request-password-reset', { email: email.trim() });
      setMessage(result.message || 'İşlem alındı. Hesabınız uygunsa e-posta gönderilecektir.');
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : 'Parola yenileme isteği alınamadı.');
    } finally { setBusy(false); }
  };

  const resetPassword = async (password: string) => {
    if (!TURSO_AUTH_ENABLED || !passwordResetToken) {
      setError('Parola yenileme bağlantısı geçersiz. Yeni bağlantı isteyin.');
      return;
    }
    setBusy(true); setError(''); setMessage('');
    try {
      await postTursoAuth('/api/auth/reset-password', {
        token: passwordResetToken,
        password,
      });
      setPasswordResetToken(null);
      clearActionFragment();
      setSession(null);
      setQuota(null);
      setItems([]);
      setMessage('Parolanız yenilendi. Güvenlik için yeniden giriş yapın.');
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : 'Parola yenilenemedi.');
    } finally { setBusy(false); }
  };

  const cancelPasswordReset = () => {
    setPasswordResetToken(null);
    setError('');
    setMessage('');
    clearActionFragment();
  };

  const signOut = async () => {
    if (TURSO_AUTH_ENABLED) {
      setBusy(true); setError('');
      try {
        const response = await fetch(authApiPath('/api/auth/logout'), {
          method: 'POST',
          credentials: 'include',
          cache: 'no-store',
        });
        if (!response.ok) throw new Error('LOGOUT_FAILED');
        setSession(null); setQuota(null); setItems([]); setMessage('');
      } catch {
        setError('Çıkış yapılamadı. Yeniden deneyin.');
      } finally { setBusy(false); }
      return;
    }
    if (!client) return;
    setBusy(true); setError('');
    const { error: signOutError } = await client.auth.signOut();
    if (signOutError) setError('Çıkış yapılamadı. Yeniden deneyin.');
    else { setSession(null); setQuota(null); setItems([]); setMessage(''); }
    setBusy(false);
  };

  return {
    session, quota, items, loading, busy, error, message, refresh, authenticate, resend, signOut,
    requestPasswordReset, resetPassword, passwordResetToken,
    cancelPasswordReset,
    applySaved: (row: any) => {
      if (row.submitted_by !== identity.current) return;
      setItems(current => current.map(item => item.id === row.id ? normalize(row) : item));
    },
    canSubmit: Boolean(session && quota?.email_verified &&
      (quota.can_submit === undefined
        ? quota.unlimited === true || (quota.remaining ?? 0) > 0
        : quota.can_submit) && !loading),
  };
}
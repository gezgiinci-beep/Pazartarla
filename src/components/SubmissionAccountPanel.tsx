import { useState, type CSSProperties, type FormEvent } from "react";

export type SubmissionAccountPanelProps = {
  session: any | null;
  quota: {
    email_verified: boolean;
    unlimited: boolean;
    limit: number | null;
    used: number;
    remaining: number | null;
    next_available_at: string | null;
  } | null;
  loading: boolean;
  busy: boolean;
  error: string;
  message: string;
  onAuthenticate: (mode: "login" | "signup", email: string, password: string) => Promise<void>;
  onResend: (email: string) => Promise<void>;
  onSignOut: () => Promise<void>;
  onRefresh: () => void;
};

const palette = {
  ink: "#26392e",
  muted: "#64756a",
  line: "#dce5dc",
  canvas: "#f7f8f2",
  green: "#315e43",
  pale: "#edf4eb",
  amber: "#fff4d9",
  amberInk: "#795d20",
  red: "#9e3d35",
};

const buttonStyle = (primary = false): CSSProperties => ({
  border: primary ? "1px solid #315e43" : `1px solid ${palette.line}`,
  borderRadius: 8,
  padding: "10px 14px",
  background: primary ? palette.green : "#fff",
  color: primary ? "#fff" : palette.ink,
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
});

const inputStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: `1px solid ${palette.line}`,
  borderRadius: 8,
  background: "#fff",
  padding: "11px 12px",
  fontSize: 14,
  color: palette.ink,
};

function sessionEmail(session: any | null): string {
  const value = session?.user?.email ?? session?.email;
  return typeof value === "string" ? value : "";
}

function dateTime(value: string | null | undefined): string {
  if (!value) return "Henüz hesaplanmadı";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function SubmissionAccountPanel({
  session,
  quota,
  loading,
  busy,
  error,
  message,
  onAuthenticate,
  onResend,
  onSignOut,
  onRefresh,
}: SubmissionAccountPanelProps) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState("");
  const [actionError, setActionError] = useState("");
  const [resending, setResending] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const signedInEmail = sessionEmail(session);
  const verificationEmail = email.trim() || signedInEmail;
  const isVerified = quota?.email_verified === true;

  const submitAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLocalError("");
    setActionError("");
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setLocalError("E-posta adresinizi girin.");
      return;
    }
    if (!password) {
      setLocalError("Parolanızı girin.");
      return;
    }
    if (mode === "signup" && password.length < 8) {
      setLocalError("Yeni hesap parolası en az 8 karakter olmalı.");
      return;
    }
    try {
      await onAuthenticate(mode, cleanEmail, password);
      setPassword("");
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "İşlem tamamlanamadı. Lütfen yeniden deneyin.");
    }
  };

  const resendVerification = async () => {
    setLocalError("");
    setActionError("");
    if (!verificationEmail) {
      setLocalError("Doğrulama bağlantısı için önce e-posta adresinizi girin.");
      return;
    }
    setResending(true);
    try {
      await onResend(verificationEmail);
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Doğrulama e-postası gönderilemedi. Yeniden deneyin.");
    } finally {
      setResending(false);
    }
  };

  const signOut = async () => {
    setActionError("");
    setSigningOut(true);
    try {
      await onSignOut();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Oturum kapatılamadı. Yeniden deneyin.");
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <section
      aria-labelledby="submission-account-title"
      data-testid="panel-submission-account"
      style={{
        boxSizing: "border-box",
        width: "100%",
        padding: 18,
        border: `1px solid ${palette.line}`,
        borderRadius: 12,
        background: palette.canvas,
        color: palette.ink,
        fontFamily: "inherit",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div>
          <div style={{ color: palette.green, fontSize: 11, fontWeight: 800, letterSpacing: ".11em", textTransform: "uppercase" }}>
            Hesap ve ilan kotası
          </div>
          <h2 id="submission-account-title" style={{ margin: "5px 0 0", fontSize: 19, lineHeight: 1.25 }}>PazarTarla hesabınız</h2>
        </div>
        <button type="button" onClick={onRefresh} disabled={loading || busy} data-testid="button-refresh-account" style={{ ...buttonStyle(), opacity: loading || busy ? 0.6 : 1 }}>
          {loading ? "Yenileniyor…" : "Bilgileri yenile"}
        </button>
      </div>

      {loading && !session && (
        <div role="status" data-testid="status-account-loading" style={{ marginTop: 16, padding: 13, borderRadius: 8, background: "#edf0e9", color: palette.muted }}>
          Hesap ve kota bilgileri yükleniyor…
        </div>
      )}

      {session ? (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
            <div>
              <div style={{ color: palette.muted, fontSize: 12, marginBottom: 3 }}>Oturum açık</div>
              <strong data-testid="text-account-email" style={{ overflowWrap: "anywhere" }}>{signedInEmail || "E-posta bilgisi bulunamadı"}</strong>
            </div>
            <button type="button" onClick={signOut} disabled={busy || signingOut} data-testid="button-sign-out" style={{ ...buttonStyle(), opacity: busy || signingOut ? 0.6 : 1 }}>
              {signingOut ? "Çıkış yapılıyor…" : "Çıkış yap"}
            </button>
          </div>

          <div
            role={isVerified ? "status" : "alert"}
            data-testid="status-email-verification"
            style={{
              marginTop: 14,
              padding: "12px 13px",
              borderRadius: 8,
              background: isVerified ? palette.pale : palette.amber,
              color: isVerified ? palette.green : palette.amberInk,
              fontSize: 13,
              lineHeight: 1.5,
            }}
          >
            <strong>{isVerified ? "E-posta doğrulandı" : "E-posta doğrulaması gerekli"}</strong>
            <div>{isVerified ? "İlan göndermek için hesabınız hazır." : "Yeni katkıda bulunanlar ilan göndermeden önce e-posta adresini doğrulamalı."}</div>
            {!isVerified && (
              <button type="button" onClick={resendVerification} disabled={busy || resending} data-testid="button-resend-verification" style={{ ...buttonStyle(), marginTop: 10, padding: "8px 11px", opacity: busy || resending ? 0.6 : 1 }}>
                {resending ? "Gönderiliyor…" : "Doğrulama e-postasını yeniden gönder"}
              </button>
            )}
          </div>

          <div style={{ marginTop: 14, border: `1px solid ${palette.line}`, borderRadius: 9, padding: 13, background: "#fff" }}>
            {quota ? (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
                  <strong data-testid="text-quota-remaining" style={{ fontSize: 15 }}>
                    {quota.unlimited ? 'Yönetici hesabı: Sınırsız ilan' : `${Math.max(0, quota.remaining ?? 0)} / ${Math.max(0, quota.limit ?? 0)} gönderim hakkı kaldı`}
                  </strong>
                  <span style={{ fontSize: 12, color: palette.muted }}>Son 24 saat: {quota.used} gönderim</span>
                </div>
                {!quota.unlimited && <div style={{ height: 6, background: "#e8eee6", borderRadius: 99, marginTop: 10, overflow: "hidden" }}>
                  <div style={{ width: `${Math.min(100, Math.max(0, quota.limit ? (quota.used / quota.limit) * 100 : 0))}%`, height: "100%", background: palette.green, borderRadius: 99 }} />
                </div>}
                {!quota.unlimited && (quota.remaining ?? 0) <= 0 && (
                  <p data-testid="text-quota-reset" style={{ margin: "9px 0 0", color: palette.muted, fontSize: 12 }}>
                    Yeni gönderim hakkınızın açılacağı zaman: <strong>{dateTime(quota.next_available_at)}</strong>
                  </p>
                )}
              </>
            ) : (
              <div role="status" data-testid="status-quota-unavailable" style={{ color: palette.muted, fontSize: 13 }}>
                Kota bilgisi şu anda kullanılamıyor. Yenile düğmesiyle tekrar deneyin.
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 15 }}>
          <p style={{ margin: "0 0 12px", color: palette.muted, fontSize: 13, lineHeight: 1.55 }}>
            İlan göndermek ve gönderimlerinizi takip etmek için giriş yapın ya da hesap oluşturun. Yeni hesaplarda e-posta doğrulaması gerekir.
          </p>
          <div role="tablist" aria-label="Hesap işlemi" style={{ display: "flex", gap: 6, padding: 4, borderRadius: 9, background: "#eaf0e8", width: "fit-content", maxWidth: "100%" }}>
            {(["login", "signup"] as const).map((choice) => (
              <button
                type="button"
                role="tab"
                aria-selected={mode === choice}
                key={choice}
                onClick={() => { setMode(choice); setLocalError(""); setActionError(""); }}
                data-testid={`tab-auth-${choice}`}
                style={{
                  ...buttonStyle(mode === choice),
                  padding: "8px 12px",
                  whiteSpace: "nowrap",
                }}
              >
                {choice === "login" ? "Giriş yap" : "Hesap oluştur"}
              </button>
            ))}
          </div>
          <form onSubmit={submitAuth} style={{ display: "grid", gap: 10, marginTop: 12 }}>
            <label style={{ display: "grid", gap: 5, color: palette.muted, fontSize: 12, fontWeight: 700 }}>
              E-posta adresi
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="ornek@eposta.com"
                required
                data-testid="input-account-email"
                style={inputStyle}
              />
            </label>
            <label style={{ display: "grid", gap: 5, color: palette.muted, fontSize: 12, fontWeight: 700 }}>
              Parola
              <input
                type="password"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={mode === "signup" ? 8 : undefined}
                required
                data-testid="input-account-password"
                style={inputStyle}
              />
            </label>
            {mode === "signup" && <div style={{ color: palette.muted, fontSize: 11 }}>Parolanız en az 8 karakter olmalı.</div>}
            <button type="submit" disabled={busy} data-testid="button-auth-submit" style={{ ...buttonStyle(true), justifySelf: "start", opacity: busy ? 0.65 : 1 }}>
              {busy ? "İşleniyor…" : mode === "login" ? "Hesabınıza giriş yapın" : "Hesap oluşturun"}
            </button>
          </form>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
            <span style={{ color: palette.muted, fontSize: 12 }}>Doğrulama e-postasını yeniden mi göndermek istiyorsunuz?</span>
            <button type="button" onClick={resendVerification} disabled={busy || resending} data-testid="button-resend-verification" style={{ ...buttonStyle(), padding: "7px 10px", fontSize: 12, opacity: busy || resending ? 0.6 : 1 }}>
              {resending ? "Gönderiliyor…" : "E-postayı yeniden gönder"}
            </button>
          </div>
        </div>
      )}

      {(error || localError || actionError) && (
        <div role="alert" data-testid="status-account-error" style={{ marginTop: 13, padding: 11, borderRadius: 8, background: "#fff0ee", color: palette.red, fontSize: 13, lineHeight: 1.45 }}>
          {actionError || localError || error}
        </div>
      )}
      {message && !error && !actionError && (
        <div role="status" data-testid="status-account-message" style={{ marginTop: 13, padding: 11, borderRadius: 8, background: palette.pale, color: palette.green, fontSize: 13, lineHeight: 1.45 }}>
          {message}
        </div>
      )}

      <div data-testid="text-submission-policy" style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${palette.line}`, color: palette.muted, fontSize: 12, lineHeight: 1.55 }}>
        {quota?.unlimited
          ? 'Yönetici hesabınızda günlük ilan sınırı yoktur. Yeni ilanları yönetim panelinden onaylayabilirsiniz.'
          : 'Normal üyeler son 24 saat içinde en fazla 3 gönderim yapabilir. Onaylanmış, reddedilmiş veya silinmiş tüm gönderimler bu kayan kotaya sayılır. Her ilan, herkese görünmeden önce yönetici onayı bekler.'}
      </div>
    </section>
  );
}
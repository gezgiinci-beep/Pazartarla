import type { CSSProperties } from "react";

export type MySubmissionsProps = {
  items: any[];
  loading: boolean;
  error: string;
  onRefresh: () => void;
};

const statusPresentation: Record<string, { label: string; background: string; color: string }> = {
  pending: { label: "Onay bekliyor", background: "#fff4d9", color: "#795d20" },
  approved: { label: "Yayında", background: "#edf4eb", color: "#315e43" },
  rejected: { label: "Reddedildi", background: "#fff0ee", color: "#9e3d35" },
};

const buttonStyle: CSSProperties = {
  padding: "9px 12px",
  border: "1px solid #dce5dc",
  background: "#fff",
  color: "#26392e",
  borderRadius: 7,
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
};

function formatDate(value: unknown): string {
  if (!value) return "";
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime())
    ? String(value)
    : new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium" }).format(parsed);
}

function statusFor(value: unknown) {
  const key = String(value ?? "pending").toLowerCase();
  return statusPresentation[key] ?? { label: String(value ?? "Durum bilinmiyor"), background: "#edf0e9", color: "#526256" };
}

export default function MySubmissions({ items, loading, error, onRefresh }: MySubmissionsProps) {
  return (
    <section aria-labelledby="my-submissions-title" data-testid="panel-my-submissions" style={{ width: "100%", boxSizing: "border-box", padding: 18, border: "1px solid #dce5dc", borderRadius: 12, background: "#f7f8f2", color: "#26392e", fontFamily: "inherit" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ color: "#315e43", fontSize: 11, fontWeight: 800, letterSpacing: ".11em", textTransform: "uppercase" }}>Katkılarınız</div>
          <h2 id="my-submissions-title" style={{ margin: "5px 0 0", fontSize: 19 }}>Gönderimlerim</h2>
          <p style={{ margin: "6px 0 0", color: "#64756a", fontSize: 12, lineHeight: 1.5 }}>İlanlarınızın inceleme ve yayın durumunu buradan takip edin.</p>
        </div>
        <button type="button" onClick={onRefresh} disabled={loading} data-testid="button-refresh-my-submissions" style={{ ...buttonStyle, opacity: loading ? 0.6 : 1 }}>
          {loading ? "Yenileniyor…" : "Gönderimleri yenile"}
        </button>
      </div>

      {error && (
        <div role="alert" data-testid="status-my-submissions-error" style={{ marginTop: 14, padding: 12, borderRadius: 8, background: "#fff0ee", color: "#9e3d35", fontSize: 13, lineHeight: 1.45 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div role="status" data-testid="status-my-submissions-loading" style={{ display: "grid", gap: 8, marginTop: 15 }}>
          {[0, 1, 2].map((key) => <div key={key} style={{ height: 60, borderRadius: 8, background: "#e9eee6" }} />)}
          <span style={{ color: "#64756a", fontSize: 12 }}>Gönderimler yükleniyor…</span>
        </div>
      ) : items.length === 0 ? (
        <div data-testid="status-my-submissions-empty" style={{ marginTop: 15, padding: "22px 16px", border: "1px dashed #dce5dc", borderRadius: 9, background: "#fff", textAlign: "center" }}>
          <strong style={{ display: "block", fontSize: 14 }}>Henüz gönderiminiz yok</strong>
          <span style={{ display: "block", marginTop: 5, color: "#64756a", fontSize: 12, lineHeight: 1.5 }}>
            İlk ilanınızı gönderdiğinizde inceleme durumunu burada görebilirsiniz.
          </span>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 8, marginTop: 15 }}>
          {items.map((item, index) => {
            const status = statusFor(item.status);
            return (
              <article key={item.id ?? index} data-testid={`row-my-submission-${item.id ?? index}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "12px 13px", border: "1px solid #dce5dc", borderRadius: 8, background: "#fff" }}>
                <div style={{ minWidth: 0, flex: "1 1 180px" }}>
                  <strong data-testid={`text-my-submission-title-${item.id ?? index}`} style={{ display: "block", fontSize: 14, lineHeight: 1.4, overflowWrap: "anywhere" }}>{item.title || "Başlıksız ilan"}</strong>
                  <span style={{ display: "block", marginTop: 4, color: "#64756a", fontSize: 11 }}>
                    {item.category || "Kategori belirtilmemiş"}{item.created_at ? ` · ${formatDate(item.created_at)}` : ""}
                  </span>
                </div>
                <span data-testid={`status-my-submission-${item.id ?? index}`} style={{ flex: "0 0 auto", padding: "6px 9px", borderRadius: 99, background: status.background, color: status.color, fontSize: 11, fontWeight: 800 }}>
                  {status.label}
                </span>
              </article>
            );
          })}
        </div>
      )}

      <div data-testid="text-my-submissions-policy" style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #dce5dc", color: "#64756a", fontSize: 12, lineHeight: 1.55 }}>
        Her ilan, herkese görünmeden önce yönetici onayı almalıdır. Onaylanmış, reddedilmiş veya silinmiş tüm gönderimler kayan 24 saatlik gönderim kotasına dahildir.
      </div>
    </section>
  );
}
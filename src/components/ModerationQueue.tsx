import { useState, type CSSProperties } from "react";

export type ModerationQueueProps = {
  items: any[];
  loading: boolean;
  error: string;
  busyId: number | null;
  onDecision: (id: number, decision: "approved" | "rejected", token: string) => Promise<void>;
  onRefresh: () => void;
};

const colors = {
  ink: "#26392e",
  muted: "#64756a",
  line: "#dce5dc",
  canvas: "#f7f8f2",
  green: "#315e43",
  pale: "#edf4eb",
  red: "#9e3d35",
};

const softButton: CSSProperties = {
  padding: "9px 12px",
  border: `1px solid ${colors.line}`,
  background: "#fff",
  color: colors.ink,
  borderRadius: 7,
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
};

function formatPrice(value: unknown): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return typeof value === "string" && value ? value : "Fiyat belirtilmemiş";
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(amount);
}

function formatDate(value: unknown): string {
  if (!value) return "Tarih belirtilmemiş";
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime())
    ? String(value)
    : new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(parsed);
}

function sellerName(value: any): string {
  if (typeof value === "string") return value || "Satıcı adı belirtilmemiş";
  return value?.name ?? value?.full_name ?? value?.email ?? "Satıcı adı belirtilmemiş";
}

function imageUrls(item: any): string[] {
  const all = [item.image, ...(Array.isArray(item.images) ? item.images : [])];
  return Array.from(new Set(all.map((image) => {
    if (typeof image === "string") return image;
    return image?.url ?? image?.src ?? image?.image_url ?? "";
  }).filter((url): url is string => typeof url === "string" && url.trim().length > 0)));
}

export default function ModerationQueue({ items, loading, error, busyId, onDecision, onRefresh }: ModerationQueueProps) {
  const [decisionError, setDecisionError] = useState("");

  const decide = async (id: number, decision: "approved" | "rejected", token: string) => {
    setDecisionError("");
    try {
      await onDecision(id, decision, token);
    } catch (caught) {
      setDecisionError(caught instanceof Error ? caught.message : "Karar kaydedilemedi. Lütfen yeniden deneyin.");
    }
  };

  return (
    <section aria-labelledby="moderation-queue-title" data-testid="panel-moderation-queue" style={{ width: "100%", boxSizing: "border-box", padding: 18, border: `1px solid ${colors.line}`, borderRadius: 12, background: colors.canvas, color: colors.ink, fontFamily: "inherit" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ color: colors.green, fontSize: 11, fontWeight: 800, letterSpacing: ".11em", textTransform: "uppercase" }}>Yönetici araçları</div>
          <h2 id="moderation-queue-title" style={{ margin: "5px 0 0", fontSize: 19 }}>İlan inceleme sırası</h2>
          <p style={{ margin: "6px 0 0", color: colors.muted, fontSize: 12, lineHeight: 1.5 }}>Gönderilen içerik ve satıcı bilgilerini inceleyin. Onay, ilanı herkese açık hale getirir.</p>
        </div>
        <button type="button" onClick={onRefresh} disabled={loading || busyId !== null} data-testid="button-refresh-moderation" style={{ ...softButton, opacity: loading || busyId !== null ? 0.6 : 1 }}>
          {loading ? "Yenileniyor…" : "Sırayı yenile"}
        </button>
      </div>

      {(error || decisionError) && (
        <div role="alert" data-testid="status-moderation-error" style={{ marginTop: 14, padding: 12, borderRadius: 8, background: "#fff0ee", color: colors.red, fontSize: 13, lineHeight: 1.45 }}>
          {decisionError || error}
        </div>
      )}

      {loading ? (
        <div role="status" data-testid="status-moderation-loading" style={{ display: "grid", gap: 10, marginTop: 16 }}>
          {[0, 1].map((key) => <div key={key} style={{ height: 102, borderRadius: 9, background: "#e9eee6", animation: "none" }} />)}
          <span style={{ color: colors.muted, fontSize: 12 }}>İlanlar yükleniyor…</span>
        </div>
      ) : items.length === 0 ? (
        <div data-testid="status-moderation-empty" style={{ marginTop: 16, padding: "22px 16px", border: `1px dashed ${colors.line}`, borderRadius: 9, background: "#fff", textAlign: "center" }}>
          <strong style={{ display: "block", fontSize: 14 }}>İncelenmeyi bekleyen ilan yok</strong>
          <span style={{ display: "block", marginTop: 5, color: colors.muted, fontSize: 12 }}>Yeni gönderimler bu sırada görünecek.</span>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 13, marginTop: 16 }}>
          {items.map((item, index) => {
            const id = Number(item.id);
            const images = imageUrls(item);
            const title = item.title || "Başlıksız ilan";
            const seller = sellerName(item.seller);
            const busy = busyId === id;
            return (
              <article key={item.id ?? index} data-testid={`card-moderation-listing-${item.id ?? index}`} style={{ overflow: "hidden", border: `1px solid ${colors.line}`, borderRadius: 10, background: "#fff" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap", padding: "14px 15px 12px" }}>
                  <div style={{ minWidth: 0, flex: "1 1 220px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <h3 data-testid={`text-moderation-title-${id}`} style={{ margin: 0, fontSize: 16, lineHeight: 1.35, overflowWrap: "anywhere" }}>{title}</h3>
                      <span style={{ padding: "4px 7px", borderRadius: 99, background: "#fff4d9", color: "#795d20", fontSize: 10, fontWeight: 800 }}>İNCELEMEDE</span>
                    </div>
                    <div style={{ display: "flex", gap: "5px 12px", flexWrap: "wrap", marginTop: 8, color: colors.muted, fontSize: 12 }}>
                      <strong style={{ color: colors.green, fontSize: 14 }}>{formatPrice(item.price)}</strong>
                      <span>{item.category || "Kategori belirtilmemiş"}</span>
                      <span>{item.location || "Konum belirtilmemiş"}</span>
                      <span>Gönderildi: {formatDate(item.created_at)}</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                    <button type="button" onClick={() => decide(id, "approved", item._editToken)} disabled={!Number.isFinite(id) || busyId !== null} data-testid={`button-approve-listing-${id}`} style={{ ...softButton, borderColor: colors.green, background: colors.green, color: "#fff", opacity: busyId !== null ? 0.6 : 1 }}>
                      {busy ? "Kaydediliyor…" : "Onayla"}
                    </button>
                    <button type="button" onClick={() => decide(id, "rejected", item._editToken)} disabled={!Number.isFinite(id) || busyId !== null} data-testid={`button-reject-listing-${id}`} style={{ ...softButton, borderColor: "#e6c6c1", color: colors.red, opacity: busyId !== null ? 0.6 : 1 }}>
                      Reddet
                    </button>
                  </div>
                </div>
                {images.length > 0 && (
                  <div aria-label="İlan fotoğrafları" data-testid={`gallery-moderation-${id}`} style={{ display: "flex", gap: 8, overflowX: "auto", padding: "0 15px 12px" }}>
                    {images.map((url, photoIndex) => (
                      <img
                        key={`${url}-${photoIndex}`}
                        src={url}
                        alt={`${title} fotoğrafı ${photoIndex + 1}`}
                        data-testid={`img-moderation-${id}-${photoIndex}`}
                        loading="lazy"
                        onError={(event) => { event.currentTarget.style.display = "none"; }}
                        style={{ flex: "0 0 auto", width: 112, height: 84, objectFit: "cover", borderRadius: 7, border: `1px solid ${colors.line}`, background: colors.canvas }}
                      />
                    ))}
                  </div>
                )}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: 12, borderTop: `1px solid ${colors.line}`, padding: 15 }}>
                  <div>
                    <div style={{ color: colors.muted, fontSize: 10, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase" }}>Satıcı</div>
                    <strong data-testid={`text-moderation-seller-${id}`} style={{ display: "block", marginTop: 4, fontSize: 13, overflowWrap: "anywhere" }}>{seller}</strong>
                    {item.phone ? (
                      <a data-testid={`link-moderation-phone-${id}`} href={`tel:${String(item.phone).replace(/[^\d+]/g, "")}`} style={{ display: "inline-block", marginTop: 4, color: colors.green, fontSize: 12, fontWeight: 700, textDecoration: "underline", overflowWrap: "anywhere" }}>
                        {item.phone}
                      </a>
                    ) : <span style={{ display: "block", marginTop: 4, color: colors.muted, fontSize: 12 }}>Telefon belirtilmemiş</span>}
                  </div>
                  <div>
                    <div style={{ color: colors.muted, fontSize: 10, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase" }}>Açıklama</div>
                    <p data-testid={`text-moderation-description-${id}`} style={{ margin: "4px 0 0", fontSize: 13, lineHeight: 1.55, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                      {item.description || "Açıklama eklenmemiş."}
                    </p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
      <div data-testid="text-moderation-policy" style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${colors.line}`, color: colors.muted, fontSize: 12, lineHeight: 1.5 }}>
        Her gönderim yönetici kararı bekler; onaylanana kadar herkese açık değildir. Reddedilen gönderimler de sahibinin kayan 24 saatlik kotasına sayılır.
      </div>
    </section>
  );
}
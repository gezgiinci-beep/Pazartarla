import { useMemo, useRef, useState, type ChangeEvent, type DragEvent, type ReactNode } from "react";
import "./bulk-listing-prep.css";

export type PhotoAsset = {
  id: string;
  path: string;
  fileName: string;
  signedUrl: string;
  created_at: string;
  draft_id: string | null;
};

export type DraftListing = {
  id: string;
  title: string;
  price: string | number;
  category: string;
  subCategory: string;
  mode: string;
  location: string;
  description: string;
  seller: string;
  phone: string;
  offer_requested: boolean;
  updated_at: string;
  submitted_listing_id: string | number | null;
  submitted_status: string | null;
  photos: PhotoAsset[];
};

export type BulkListingPrepProps = {
  drafts: DraftListing[];
  categoriesByName: Record<string, string[]>;
  quota: { unlimited: boolean; remaining: number | null; limit: number | null; used: number; loading: boolean };
  loading: boolean;
  savingIds: string[];
  uploadBusy: boolean;
  submitting: boolean;
  error: string;
  notice: string;
  onAddDraft: (defaults: { seller: string; phone: string }) => void;
  onChangeDraft: (id: string, patch: Partial<DraftListing>) => void;
  onApplyContactsToAll: (seller: string, phone: string) => void;
  onDeleteDraft: (id: string) => void;
  onUploadPhotos: (files: File[]) => Promise<void>;
  onAssignPhoto: (photoId: string, draftId: string | null) => void;
  onRemovePhoto: (photoId: string) => void;
  onSubmitSelected: (ids: string[]) => void;
  onRefresh: () => void;
  onPreview: (draft: DraftListing) => void;
};

const fieldNames: Record<string, string> = {
  "İlan başlığı": "title",
  "Kategori": "category",
  "Alt kategori": "subCategory",
  "Fiyat": "price",
  "Konum": "location",
  "Satıcı adı": "seller",
  "Telefon": "phone",
};

function statusLabel(status: string | null): string {
  const key = (status ?? "pending").toLowerCase();
  const labels: Record<string, string> = {
    pending: "İncelemede",
    approved: "Yayında",
    rejected: "Reddedildi",
    active: "Yayında",
    published: "Yayında",
  };
  return labels[key] ?? status ?? "Durum bekleniyor";
}

function Icon({ kind }: { kind: "field" | "plus" | "refresh" | "upload" | "trash" | "eye" }) {
  const common = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true as const };
  if (kind === "plus") return <svg {...common}><path d="M12 5v14M5 12h14" /></svg>;
  if (kind === "refresh") return <svg {...common}><path d="M20 7v5h-5M4 17v-5h5" /><path d="M5.6 9a7 7 0 0 1 11.7-2L20 12M4 12l2.7 5a7 7 0 0 0 11.7-2" /></svg>;
  if (kind === "upload") return <svg {...common}><path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5" /><path d="M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" /></svg>;
  if (kind === "trash") return <svg {...common}><path d="M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>;
  if (kind === "eye") return <svg {...common}><path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.5" /></svg>;
  return <svg {...common}><path d="M12 3v18M3 12h18" /><path d="M5 5l14 14" /></svg>;
}

function isComplete(draft: DraftListing): boolean {
  return Boolean(
    draft.title.trim() &&
    draft.category.trim() &&
    draft.subCategory.trim() &&
    String(draft.price).trim() &&
    draft.location.trim() &&
    draft.seller.trim() &&
    draft.phone.trim() &&
    draft.photos.length > 0
  );
}

export default function BulkListingPrep({
  drafts, categoriesByName, quota, loading, savingIds, uploadBusy, submitting, error, notice,
  onAddDraft, onChangeDraft, onApplyContactsToAll, onDeleteDraft, onUploadPhotos,
  onAssignPhoto, onRemovePhoto, onSubmitSelected, onRefresh, onPreview,
}: BulkListingPrepProps) {
  const [seller, setSeller] = useState("");
  const [phone, setPhone] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [draggingFiles, setDraggingFiles] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadedPhotos = useMemo(() => drafts.flatMap((draft) => draft.photos), [drafts]);
  const unassigned = uploadedPhotos.filter((photo) => !photo.draft_id);
  const submitted = (draft: DraftListing) => draft.submitted_listing_id !== null && draft.submitted_listing_id !== undefined;
  const completed = drafts.filter((draft) => !submitted(draft) && isComplete(draft));
  const quotaCap = quota.unlimited ? Number.POSITIVE_INFINITY : Math.max(0, quota.remaining ?? 0);
  const selectedEligible = selected.filter((id) => completed.some((draft) => draft.id === id));
  const canSubmitCount = Math.min(selectedEligible.length, Number.isFinite(quotaCap) ? quotaCap : selectedEligible.length);
  const quotaText = quota.loading
    ? "Gönderim hakkı yükleniyor…"
    : quota.unlimited
      ? "Gönderim hakkı: Sınırsız"
      : `${Math.max(0, quota.remaining ?? 0)} gönderim hakkı kaldı`;
  const canAddSelection = quota.unlimited || selectedEligible.length < quotaCap;

  const uploadFiles = async (files: File[]) => {
    if (!files.length || uploadBusy) return;
    setUploadError("");
    try {
      await onUploadPhotos(files);
    } catch (caught) {
      setUploadError(caught instanceof Error ? caught.message : "Fotoğraflar yüklenemedi. Yeniden deneyin.");
    }
  };

  const fileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    void uploadFiles(files);
  };
  const handleFileDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDraggingFiles(false);
    void uploadFiles(Array.from(event.dataTransfer.files));
  };
  const assignDroppedPhoto = (event: DragEvent<HTMLElement>, draftId: string) => {
    event.preventDefault();
    event.currentTarget.classList.remove("is-drop-target");
    const photoId = event.dataTransfer.getData("text/plain");
    if (photoId) onAssignPhoto(photoId, draftId);
  };
  const toggleSelected = (draft: DraftListing, checked: boolean) => {
    setSelected((current) => {
      if (!checked) return current.filter((id) => id !== draft.id);
      if (!canAddSelection || current.includes(draft.id)) return current;
      return [...current, draft.id];
    });
  };
  const applyPatch = (draft: DraftListing, key: keyof DraftListing, value: string | number | boolean) => {
    if (key === "category") {
      const category = String(value);
      const subs = categoriesByName[category] ?? [];
      onChangeDraft(draft.id, { category, subCategory: subs[0] ?? "" });
      return;
    }
    onChangeDraft(draft.id, { [key]: value } as Partial<DraftListing>);
  };

  return (
    <section className="pt-bulk" aria-labelledby="pt-bulk-title" data-testid="panel-bulk-listing-prep">
      <div className="pt-bulk-shell">
        <header className="pt-bulk-top">
          <div className="pt-bulk-topline">
            <div className="pt-bulk-heading">
              <span className="pt-bulk-mark"><Icon kind="field" /></span>
              <div>
                <p className="pt-bulk-kicker">İlan hazırlama alanı</p>
                <h2 className="pt-bulk-title" id="pt-bulk-title">Birden fazla ilanı birlikte hazırlayın</h2>
                <p className="pt-bulk-intro">Bilgileri ve fotoğrafları ilanlara dağıtın. Taslaklarınız çalışma boyunca korunur; göndermeden önce her birini gözden geçirebilirsiniz.</p>
              </div>
            </div>
            <div className="pt-bulk-toolbar">
              <button type="button" className="pt-bulk-button" onClick={onRefresh} disabled={loading} data-testid="button-refresh-bulk-drafts">
                <Icon kind="refresh" />{loading ? "Yenileniyor…" : "Yenile"}
              </button>
              <button type="button" className="pt-bulk-button pt-bulk-button-primary" onClick={() => onAddDraft({ seller, phone })} data-testid="button-add-bulk-draft">
                <Icon kind="plus" />İlan ekle
              </button>
            </div>
          </div>
        </header>

        {error && <div className="pt-bulk-feedback pt-bulk-feedback-error" role="alert" data-testid="status-bulk-error">{error}</div>}
        {uploadError && <div className="pt-bulk-feedback pt-bulk-feedback-error" role="alert" data-testid="status-bulk-upload-error">{uploadError}</div>}
        {notice && !error && <div className="pt-bulk-feedback pt-bulk-feedback-notice" role="status" data-testid="status-bulk-notice">{notice}</div>}

        <div className="pt-bulk-main">
          <aside className="pt-bulk-side" aria-label="Ortak bilgiler ve fotoğraflar">
            <section className="pt-bulk-panel" aria-labelledby="pt-bulk-defaults-heading">
              <h3 className="pt-bulk-panel-title" id="pt-bulk-defaults-heading">Ortak satıcı bilgileri</h3>
              <p className="pt-bulk-panel-copy">Yeni ilanlara varsayılan olarak ekleyin; isterseniz mevcut taslaklara da uygulayın.</p>
              <div className="pt-bulk-contact-grid">
                <label className="pt-bulk-field">Satıcı adı
                  <input className="pt-bulk-input" type="text" value={seller} onChange={(event) => setSeller(event.target.value)} placeholder="Satıcı adı" data-testid="input-bulk-default-seller" />
                </label>
                <label className="pt-bulk-field">Telefon
                  <input className="pt-bulk-input" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Telefon numarası" data-testid="input-bulk-default-phone" />
                </label>
                <button type="button" className="pt-bulk-button" onClick={() => onApplyContactsToAll(seller, phone)} disabled={!drafts.some((draft) => !submitted(draft))} data-testid="button-apply-bulk-contacts">Tüm taslaklara uygula</button>
              </div>
            </section>

            <section className="pt-bulk-panel pt-bulk-photo-panel" aria-labelledby="pt-bulk-photos-heading">
              <div className="pt-bulk-photo-head" style={{ justifyContent: "space-between", gap: 8 }}>
                <h3 className="pt-bulk-panel-title" id="pt-bulk-photos-heading">Fotoğraf havuzu</h3>
                <span className="pt-bulk-count" data-testid="text-bulk-unassigned-count">{unassigned.length} atanmamış</span>
              </div>
              <p className="pt-bulk-panel-copy">Birden fazla fotoğraf seçin, ardından sürükleyip bir ilana bırakın veya seçim menüsünü kullanın.</p>
              <label
                className={`pt-bulk-upload${draggingFiles ? " is-dragging" : ""}`}
                onDragOver={(event) => { event.preventDefault(); setDraggingFiles(true); }}
                onDragLeave={() => setDraggingFiles(false)}
                onDrop={handleFileDrop}
                data-testid="dropzone-bulk-photos"
              >
                <span className="pt-bulk-upload-symbol"><Icon kind="upload" /></span>
                <strong>{uploadBusy ? "Fotoğraflar yükleniyor…" : "Fotoğrafları buraya bırakın"}</strong>
                <span>veya göz atıp cihazınızdan birden fazla fotoğraf seçin</span>
              </label>
              <input ref={fileInputRef} className="pt-bulk-file-input" type="file" accept="image/*" multiple disabled={uploadBusy} onChange={fileChange} aria-label="Yüklenecek fotoğrafları seçin" data-testid="input-bulk-photos" />
              <button type="button" className="pt-bulk-button pt-bulk-button-small" style={{ width: "100%", marginTop: 7 }} onClick={() => fileInputRef.current?.click()} disabled={uploadBusy} data-testid="button-choose-bulk-photos">
                <Icon kind="upload" />Cihazdan fotoğraf seç
              </button>
              <div className="pt-bulk-photo-list" data-testid="list-bulk-unassigned-photos">
                {unassigned.length === 0 ? (
                  <div className="pt-bulk-photos-empty" data-testid="status-bulk-unassigned-empty">Atanmamış fotoğraf yok. Yeni fotoğraf eklemek için yukarıdaki alana bırakın.</div>
                ) : unassigned.map((photo) => (
                  <PhotoItem key={photo.id} photo={photo} drafts={drafts.filter((draft) => !submitted(draft))} onAssign={onAssignPhoto} onRemove={onRemovePhoto} />
                ))}
              </div>
            </section>
          </aside>

          <section aria-labelledby="pt-bulk-drafts-heading">
            <div className="pt-bulk-list-head">
              <div>
                <h3 className="pt-bulk-panel-title" id="pt-bulk-drafts-heading">Hazırlanan ilanlar</h3>
                <p>Gerekli alanları tamamlayıp her ilana en az bir fotoğraf ekleyin.</p>
              </div>
              <span className="pt-bulk-count" data-testid="text-bulk-draft-count">{drafts.length} taslak</span>
            </div>
            {loading && drafts.length === 0 ? (
              <div role="status" aria-label="Taslaklar yükleniyor" data-testid="status-bulk-loading">
                <div className="pt-bulk-skeleton" /><div className="pt-bulk-skeleton" />
                <p className="pt-bulk-help">Taslaklarınız yükleniyor…</p>
              </div>
            ) : drafts.length === 0 ? (
              <div className="pt-bulk-empty" data-testid="status-bulk-empty">
                <strong>Henüz taslak eklenmedi</strong>
                <span>İlan ekleyerek başlayın. Bilgilerinizi girdikçe çalışma otomatik olarak taslaklarınızda tutulur.</span>
                <button type="button" className="pt-bulk-button pt-bulk-button-primary" onClick={() => onAddDraft({ seller, phone })} data-testid="button-add-first-bulk-draft">
                  <Icon kind="plus" />İlk ilanı ekle
                </button>
              </div>
            ) : (
              <div className="pt-bulk-drafts" data-testid="list-bulk-drafts">
                {drafts.map((draft, index) => (
                  <DraftCard
                    key={draft.id}
                    draft={draft}
                    allDrafts={drafts.filter((item) => !submitted(item))}
                    index={index}
                    categoriesByName={categoriesByName}
                    saving={savingIds.includes(draft.id)}
                    isSubmitted={submitted(draft)}
                    selected={selected.includes(draft.id)}
                    selectionAllowed={canAddSelection || selected.includes(draft.id)}
                    confirmingDelete={deleteConfirmId === draft.id}
                    onPatch={applyPatch}
                    onDropPhoto={assignDroppedPhoto}
                    onAssign={onAssignPhoto}
                    onRemovePhoto={onRemovePhoto}
                    onPreview={onPreview}
                    onSelect={toggleSelected}
                    onRequestDelete={() => setDeleteConfirmId(deleteConfirmId === draft.id ? null : draft.id)}
                    onConfirmDelete={() => { onDeleteDraft(draft.id); setDeleteConfirmId(null); setSelected((items) => items.filter((id) => id !== draft.id)); }}
                    onCancelDelete={() => setDeleteConfirmId(null)}
                  />
                ))}
              </div>
            )}
          </section>
        </div>

        <footer className="pt-bulk-footer">
          <div className="pt-bulk-quota" data-testid="text-bulk-quota">
            <strong>{quotaText}</strong>
            {!quota.loading && !quota.unlimited && quota.limit !== null && <span> · {quota.used} / {quota.limit} kullanım</span>}
            <div className="pt-bulk-footer-note">Yalnızca seçili ve gerekli alanları tamamlanmış ilanlar gönderilebilir.</div>
          </div>
          <div className="pt-bulk-footer-action">
            <span className="pt-bulk-footer-note" data-testid="text-bulk-selection-count">{canSubmitCount} ilan seçildi</span>
            <button
              type="button"
              className="pt-bulk-button pt-bulk-button-primary"
              disabled={submitting || quota.loading || canSubmitCount === 0}
              onClick={() => onSubmitSelected(selectedEligible.slice(0, canSubmitCount))}
              data-testid="button-submit-selected-drafts"
            >
              {submitting ? "Gönderiliyor…" : `Seçilen ${canSubmitCount} ilanı gönder`}
            </button>
          </div>
        </footer>
        <p className="pt-bulk-policy">Gönderim hakkınız aşılamaz. Hakkınızdan fazla taslak seçilmişse yalnızca mevcut gönderim hakkı kadar, tamamlanmış ilan gönderilir.</p>
      </div>
    </section>
  );
}

function PhotoItem({ photo, drafts, onAssign, onRemove }: {
  photo: PhotoAsset;
  drafts: DraftListing[];
  onAssign: (photoId: string, draftId: string | null) => void;
  onRemove: (photoId: string) => void;
}) {
  return (
    <article
      className="pt-bulk-photo-item"
      draggable
      onDragStart={(event) => { event.dataTransfer.setData("text/plain", photo.id); event.dataTransfer.effectAllowed = "move"; }}
      data-testid={`card-bulk-photo-${photo.id}`}
    >
      <span className="pt-bulk-photo-thumb">{photo.signedUrl ? <img src={photo.signedUrl} alt={photo.fileName} /> : "Fotoğraf"}</span>
      <span className="pt-bulk-photo-info">
        <span className="pt-bulk-photo-name" title={photo.fileName}>{photo.fileName || "Adsız fotoğraf"}</span>
        <span className="pt-bulk-photo-caption">Atanmamış · sürükleyerek de taşıyabilirsiniz</span>
        <span className="pt-bulk-photo-controls">
          <label className="pt-bulk-field">
            <span className="sr-only">Fotoğrafı ilana ata: {photo.fileName}</span>
            <select className="pt-bulk-select" value="" onChange={(event) => { if (event.target.value) onAssign(photo.id, event.target.value); }} data-testid={`select-assign-photo-${photo.id}`}>
              <option value="">İlana ata…</option>
              {drafts.map((draft) => <option key={draft.id} value={draft.id}>{draft.title.trim() || "Başlıksız ilan"}</option>)}
            </select>
          </label>
          <button type="button" className="pt-bulk-icon-button" aria-label={`${photo.fileName} fotoğrafını kaldır`} onClick={() => onRemove(photo.id)} data-testid={`button-remove-photo-${photo.id}`}><Icon kind="trash" /></button>
        </span>
      </span>
    </article>
  );
}

function DraftCard({
  draft, allDrafts, index, categoriesByName, saving, isSubmitted, selected, selectionAllowed, confirmingDelete,
  onPatch, onDropPhoto, onAssign, onRemovePhoto, onPreview, onSelect, onRequestDelete, onConfirmDelete, onCancelDelete,
}: {
  draft: DraftListing;
  allDrafts: DraftListing[];
  index: number;
  categoriesByName: Record<string, string[]>;
  saving: boolean;
  isSubmitted: boolean;
  selected: boolean;
  selectionAllowed: boolean;
  confirmingDelete: boolean;
  onPatch: (draft: DraftListing, key: keyof DraftListing, value: string | number | boolean) => void;
  onDropPhoto: (event: DragEvent<HTMLElement>, draftId: string) => void;
  onAssign: (photoId: string, draftId: string | null) => void;
  onRemovePhoto: (photoId: string) => void;
  onPreview: (draft: DraftListing) => void;
  onSelect: (draft: DraftListing, checked: boolean) => void;
  onRequestDelete: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
}) {
  const complete = isComplete(draft);
  const missing = [
    ...Object.entries(fieldNames).filter(([, key]) => {
      if (key === "price") return !String(draft.price).trim();
      return !String(draft[key as keyof DraftListing] ?? "").trim();
    }).map(([label]) => label),
    ...(draft.photos.length ? [] : ["En az bir fotoğraf"]),
  ];
  const allCategories = Array.from(new Set([...Object.keys(categoriesByName), ...(draft.category && !categoriesByName[draft.category] ? [draft.category] : [])]));
  const subs = categoriesByName[draft.category] ?? (draft.subCategory ? [draft.subCategory] : []);
  const locked = isSubmitted;
  const isPhotoDrop = (event: DragEvent<HTMLElement>) => event.dataTransfer.types.includes("text/plain");
  const renderField = (className: string, label: string, input: ReactNode, testId: string) => (
    <label className={`pt-bulk-field ${className}`} key={testId}>{label}{input}</label>
  );

  return (
    <article
      className={`pt-bulk-draft${locked ? " is-submitted" : ""}`}
      onDragOver={(event) => { if (isPhotoDrop(event) && !locked) { event.preventDefault(); event.currentTarget.classList.add("is-drop-target"); } }}
      onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) event.currentTarget.classList.remove("is-drop-target"); }}
      onDrop={(event) => { if (!locked) onDropPhoto(event, draft.id); }}
      data-testid={`card-bulk-draft-${draft.id}`}
    >
      <div className="pt-bulk-card-top">
        <div className="pt-bulk-card-ident">
          {!locked && <label className="pt-bulk-select-row" title={complete ? "İlanı gönderim için seç" : "Önce gerekli alanları tamamlayın"}>
            <input className="pt-bulk-select-check" type="checkbox" checked={selected} disabled={!complete || (!selectionAllowed && !selected)} onChange={(event) => onSelect(draft, event.target.checked)} data-testid={`checkbox-select-draft-${draft.id}`} />
            <span className="sr-only">Gönderim için seç: {draft.title || `İlan ${index + 1}`}</span>
          </label>}
          <span className="pt-bulk-number">{String(index + 1).padStart(2, "0")}</span>
          <div className="pt-bulk-draft-heading">
            <h4 className="pt-bulk-draft-title" data-testid={`text-bulk-draft-title-${draft.id}`}>{draft.title.trim() || `İlan ${index + 1}`}</h4>
            <p className="pt-bulk-draft-subtitle" data-testid={`text-bulk-draft-save-state-${draft.id}`}>{saving ? "Değişiklikler kaydediliyor…" : "Taslak kaydedildi"}</p>
          </div>
        </div>
        <div className="pt-bulk-card-actions">
          <button type="button" className="pt-bulk-button" onClick={() => onPreview(draft)} data-testid={`button-preview-draft-${draft.id}`}><Icon kind="eye" />Önizle</button>
          {!locked && (confirmingDelete ? <>
            <button type="button" className="pt-bulk-button pt-bulk-button-danger" onClick={onConfirmDelete} data-testid={`button-confirm-delete-draft-${draft.id}`}>Taslağı sil</button>
            <button type="button" className="pt-bulk-button" onClick={onCancelDelete} data-testid={`button-cancel-delete-draft-${draft.id}`}>Vazgeç</button>
          </> : <button type="button" className="pt-bulk-button pt-bulk-button-danger" onClick={onRequestDelete} aria-label={`${draft.title || "Taslak"} taslağını sil`} data-testid={`button-delete-draft-${draft.id}`}><Icon kind="trash" />Sil</button>)}
        </div>
      </div>

      {!locked ? (
        <>
          <div className="pt-bulk-fields">
            {renderField("pt-bulk-span-8", "İlan başlığı", <input className="pt-bulk-input" type="text" value={draft.title} onChange={(event) => onPatch(draft, "title", event.target.value)} placeholder="Örn. Buğday samanı" data-testid={`input-draft-title-${draft.id}`} />, `title-${draft.id}`)}
            {renderField("pt-bulk-span-4", "Fiyat", <input className="pt-bulk-input" type="number" min="0" step="any" value={draft.price} onChange={(event) => onPatch(draft, "price", event.target.value)} placeholder="Fiyat" data-testid={`input-draft-price-${draft.id}`} />, `price-${draft.id}`)}
            {renderField("pt-bulk-span-6", "Kategori", <select className="pt-bulk-select" value={draft.category} onChange={(event) => onPatch(draft, "category", event.target.value)} data-testid={`select-draft-category-${draft.id}`}>
              <option value="">Kategori seçin</option>{allCategories.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>, `category-${draft.id}`)}
            {renderField("pt-bulk-span-6", "Alt kategori", <select className="pt-bulk-select" value={draft.subCategory} onChange={(event) => onPatch(draft, "subCategory", event.target.value)} data-testid={`select-draft-subcategory-${draft.id}`}>
              <option value="">Alt kategori seçin</option>{subs.map((sub) => <option key={sub} value={sub}>{sub}</option>)}
            </select>, `subcategory-${draft.id}`)}
            {renderField("pt-bulk-span-6", "Konum", <input className="pt-bulk-input" type="text" value={draft.location} onChange={(event) => onPatch(draft, "location", event.target.value)} placeholder="İl / ilçe" data-testid={`input-draft-location-${draft.id}`} />, `location-${draft.id}`)}
            {renderField("pt-bulk-span-6", "İlan türü", <select className="pt-bulk-select" value={draft.mode} onChange={(event) => onPatch(draft, "mode", event.target.value)} data-testid={`select-draft-mode-${draft.id}`}>
              <option value="">İlan türü seçin</option>
              {draft.mode && !["Satılık", "Kiralık", "Hizmet"].includes(draft.mode) && <option value={draft.mode}>{draft.mode}</option>}
              {["Satılık", "Kiralık", "Hizmet"].map((mode) => <option key={mode} value={mode}>{mode}</option>)}
            </select>, `mode-${draft.id}`)}
            {renderField("pt-bulk-span-6", "Satıcı adı", <input className="pt-bulk-input" type="text" value={draft.seller} onChange={(event) => onPatch(draft, "seller", event.target.value)} placeholder="Satıcı adı" data-testid={`input-draft-seller-${draft.id}`} />, `seller-${draft.id}`)}
            {renderField("pt-bulk-span-6", "Telefon", <input className="pt-bulk-input" type="tel" value={draft.phone} onChange={(event) => onPatch(draft, "phone", event.target.value)} placeholder="Telefon numarası" data-testid={`input-draft-phone-${draft.id}`} />, `phone-${draft.id}`)}
            {renderField("pt-bulk-span-12", "Açıklama", <textarea className="pt-bulk-textarea" value={draft.description} onChange={(event) => onPatch(draft, "description", event.target.value)} placeholder="Ürünün durumu, miktarı ve teslimat bilgileri" data-testid={`textarea-draft-description-${draft.id}`} />, `description-${draft.id}`)}
          </div>
          <label className="pt-bulk-checkline">
            <input type="checkbox" checked={draft.offer_requested} onChange={(event) => onPatch(draft, "offer_requested", event.target.checked)} data-testid={`checkbox-draft-offers-${draft.id}`} />
            Alıcı tekliflerine açık
          </label>
          <div className="pt-bulk-photo-drop" data-testid={`drop-target-draft-photos-${draft.id}`}>
            <div className="pt-bulk-photo-drop-copy">
              <strong>{draft.photos.length} fotoğraf eklendi</strong>
              {draft.photos.length ? "Fotoğrafları sürükleyerek yeniden sıralayın veya aşağıdan başka ilana atayın." : "Fotoğraf havuzundan buraya sürükleyin ya da havuzdaki atama menüsünü kullanın."}
            </div>
            <span className="pt-bulk-drop-count">{draft.photos.length ? `${draft.photos.length} fotoğraf` : "Fotoğraf gerekli"}</span>
          </div>
          {draft.photos.length > 0 && <div className="pt-bulk-photo-list" data-testid={`list-draft-photos-${draft.id}`}>
            {draft.photos.map((photo) => (
              <AssignedPhoto key={photo.id} photo={photo} drafts={allDrafts} onAssign={onAssign} onRemove={onRemovePhoto} />
            ))}
          </div>}
          <div className="pt-bulk-bottomline">
            <div className="pt-bulk-missing" data-testid={`status-draft-requirements-${draft.id}`} aria-live="polite">
              {complete ? <span className="pt-bulk-ready">Gönderime hazır</span> : <>
                <span className="pt-bulk-missing-label">Eksik:</span>
                {missing.map((item) => <span className="pt-bulk-missing-item" key={item}>{item}</span>)}
              </>}
            </div>
            {complete && <span className="pt-bulk-ready" data-testid={`status-draft-ready-${draft.id}`}>Gönderime hazır</span>}
          </div>
        </>
      ) : (
        <div className="pt-bulk-submitted" data-testid={`status-submitted-draft-${draft.id}`}>
          <strong>Gönderildi</strong>
          <span className={`pt-bulk-status${draft.submitted_status === "approved" ? " pt-bulk-status-approved" : draft.submitted_status === "rejected" ? " pt-bulk-status-rejected" : ""}`} data-testid={`status-draft-submission-${draft.id}`}>{statusLabel(draft.submitted_status)}</span>
          {draft.submitted_listing_id !== null && <span>İlan no: {draft.submitted_listing_id}</span>}
          <span>Düzenleme ve yeniden gönderim kapalı</span>
        </div>
      )}
    </article>
  );
}

function AssignedPhoto({ photo, drafts, onAssign, onRemove }: {
  photo: PhotoAsset;
  drafts: DraftListing[];
  onAssign: (photoId: string, draftId: string | null) => void;
  onRemove: (photoId: string) => void;
}) {
  const currentDraftId = photo.draft_id ?? "";
  return (
    <article
      className="pt-bulk-photo-item"
      draggable
      onDragStart={(event) => { event.dataTransfer.setData("text/plain", photo.id); event.dataTransfer.effectAllowed = "move"; }}
      data-testid={`card-draft-photo-${photo.id}`}
    >
      <span className="pt-bulk-photo-thumb">{photo.signedUrl ? <img src={photo.signedUrl} alt={photo.fileName} /> : "Fotoğraf"}</span>
      <span className="pt-bulk-photo-info">
        <span className="pt-bulk-photo-name" title={photo.fileName}>{photo.fileName || "Adsız fotoğraf"}</span>
        <span className="pt-bulk-photo-controls">
          <label className="pt-bulk-field">
            <span className="sr-only">Fotoğrafı başka ilana ata: {photo.fileName}</span>
            <select className="pt-bulk-select" value={currentDraftId} onChange={(event) => onAssign(photo.id, event.target.value || null)} data-testid={`select-reassign-photo-${photo.id}`}>
              <option value="">Atanmamış fotoğraf havuzuna taşı</option>
              {drafts.map((draft) => <option key={draft.id} value={draft.id}>{draft.title.trim() || "Başlıksız ilan"}</option>)}
            </select>
          </label>
          <button type="button" className="pt-bulk-icon-button" aria-label={`${photo.fileName} fotoğrafını kaldır`} onClick={() => onRemove(photo.id)} data-testid={`button-remove-assigned-photo-${photo.id}`}><Icon kind="trash" /></button>
        </span>
      </span>
    </article>
  );
}

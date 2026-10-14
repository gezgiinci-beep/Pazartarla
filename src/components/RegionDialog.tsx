import { useEffect, useRef } from 'react';
import { MapPin, X } from 'lucide-react';

type Props = {
  open: boolean; onClose: () => void;
  provinces: string[]; districts: string[]; province: string; district: string;
  onProvince: (value: string) => void; onDistrict: (value: string) => void;
  onAll: () => void;
};

export default function RegionDialog(props: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (props.open && !dialog.open) dialog.showModal();
    if (!props.open && dialog.open) dialog.close();
  }, [props.open]);

  return (
    <dialog ref={dialogRef} className="rd-region-dialog" aria-labelledby="region-dialog-title"
      aria-describedby="region-search-info" data-testid="dialog-region"
      onClose={props.onClose}
      onCancel={event => { event.preventDefault(); props.onClose(); }}
      onClick={event => { if (event.target === event.currentTarget) props.onClose(); }}>
      <div className="rd-region-dialog-head">
        <h2 id="region-dialog-title"><MapPin size={18} aria-hidden="true" /> Bölge seçin</h2>
        <button type="button" className="rd-btn" aria-label="Bölge seçimini kapat" onClick={props.onClose}>
          <X size={18} />
        </button>
      </div>
      <section aria-label="İl ve ilçe seçimi" data-testid="region-search">
        <p id="region-search-info" className="rd-note">
          İl ve ilçe seçerek bölgenizdeki ilanları bulun. Telefon konumu istenmez; ilçeler ilanlarda belirtilen konumlara göre listelenir.
        </p>
        <div className="rd-region-fields">
          <label>İl
            <select value={props.province} onChange={event => props.onProvince(event.target.value)}
              aria-label="İl" data-testid="select-province">
              <option value="">Tüm iller</option>
              {props.provinces.map(value => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <label>İlçe
            <select value={props.district} onChange={event => props.onDistrict(event.target.value)}
              disabled={!props.province || !props.districts.length} aria-label="İlçe" data-testid="select-district">
              <option value="">Tüm ilçeler</option>
              {props.districts.map(value => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
        </div>
        <div className="rd-region-actions">
          <button type="button" className="rd-region-clear" aria-label="Bölgeyi temizle"
            data-testid="button-clear-region" onClick={() => { props.onProvince(''); props.onDistrict(''); }}>
            Temizle
          </button>
          <button type="button" className="rd-region-go" aria-label="Bölgedeki ilanları göster"
            data-testid="button-region-results" onClick={() => { props.onClose(); props.onAll(); }}>
            İlanları göster
          </button>
        </div>
      </section>
    </dialog>
  );
}

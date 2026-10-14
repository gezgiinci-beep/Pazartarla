import { useState } from 'react';
import BrandLogo from './BrandLogo';

export type HomeMenuAction = {
  key: string;
  label: string;
  onSelect?: () => void;
  note?: string;
};

type Props = {
  main: HomeMenuAction[];
  personal: HomeMenuAction[];
  sections: HomeMenuAction[];
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onLogout: () => void;
  signedIn: boolean;
};

const rowStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 44,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  border: 0,
  borderBottom: '1px solid #e6e0cb',
  background: 'transparent',
  padding: '10px 4px',
  color: '#244735',
  font: 'inherit',
  textAlign: 'left',
  cursor: 'pointer',
};

export default function HomeMenuDrawer({
  main, personal, sections, open, onOpen, onClose, onLogout, signedIn,
}: Props) {
  const [personalOpen, setPersonalOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [hint, setHint] = useState('');

  const run = (item: HomeMenuAction) => {
    if (!item.onSelect) {
      setHint(item.note || 'Bu bölüm şu anda kullanılamıyor.');
      return;
    }
    setHint('');
    onClose();
    item.onSelect();
  };
  const renderItem = (item: HomeMenuAction) => (
    <button key={item.key} type="button" style={{ ...rowStyle, color: item.onSelect ? '#244735' : '#819087' }}
      aria-disabled={!item.onSelect} onClick={() => run(item)} data-testid={`menu-item-${item.key}`}>
      {item.label}
    </button>
  );

  return (
    <>
      <button type="button" onClick={onOpen} aria-label="Menüyü aç" aria-expanded={open}
        data-testid="button-menu"
        style={{ width: 42, height: 42, display: 'grid', placeItems: 'center', flex: 'none', borderRadius: 8,
          border: '1px solid rgba(255,255,255,.25)', background: 'rgba(255,255,255,.1)', cursor: 'pointer' }}>
        <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
          <path d="M3 5h18M3 10h18M3 15h18M3 20h18" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <div role="presentation" onClick={onClose}
          style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(20,35,27,.55)', display: 'flex' }}>
          <nav role="dialog" aria-modal="true" aria-label="Ana menü" data-testid="drawer-menu"
            onClick={event => event.stopPropagation()}
            style={{ width: 'min(320px, 86vw)', height: '100%', overflowY: 'auto', boxSizing: 'border-box',
              padding: 14, background: '#fbf8ee', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: '#1b3a2b', margin: '-14px -14px 8px', padding: '12px 14px' }}>
              <BrandLogo />
              <button type="button" onClick={onClose} aria-label="Menüyü kapat"
                style={{ border: 0, background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: 22 }}>×</button>
            </div>
            {main.map(renderItem)}
            <button type="button" onClick={() => { setPersonalOpen(value => !value); setHint(''); }}
              aria-expanded={personalOpen} data-testid="menu-item-personal"
              style={{ ...rowStyle, fontWeight: 800 }}>
              Bana özel <span aria-hidden="true">{personalOpen ? '⌃' : '⌄'}</span>
            </button>
            {personalOpen && (
              <div style={{ background: '#f1ede0', borderRadius: 8, padding: '0 10px' }}>
                {personal.map(renderItem)}
                <button type="button" onClick={() => setConfirming(true)} data-testid="menu-item-logout"
                  style={{ ...rowStyle, borderBottom: 0 }}>Çıkış yap</button>
              </div>
            )}
            <p style={{ margin: '14px 0 2px', fontSize: 11, letterSpacing: '.08em', color: '#8a7a3a', fontWeight: 800 }}>BÖLÜMLER</p>
            {sections.map(renderItem)}
            {hint && <p role="status" data-testid="menu-hint" style={{ color: '#5b6b60', fontSize: 12 }}>{hint}</p>}
          </nav>
          {confirming && (
            <div role="alertdialog" aria-label="Çıkış onayı" onClick={event => event.stopPropagation()}
              style={{ position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', zIndex: 2100,
                width: 'min(320px, 88vw)', boxSizing: 'border-box', padding: 18, borderRadius: 12,
                background: '#fff', textAlign: 'center' }}>
              <p>Çıkış yapmak istediğinizden emin misiniz?</p>
              <button type="button" onClick={() => setConfirming(false)} style={{ marginRight: 8, padding: '8px 12px' }}>Vazgeç</button>
              <button type="button" onClick={() => { setConfirming(false); if (signedIn) { onClose(); onLogout(); } }}
                style={{ padding: '8px 12px', background: '#1b3a2b', color: '#fff', border: 0, borderRadius: 6 }}>Çıkış yap</button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

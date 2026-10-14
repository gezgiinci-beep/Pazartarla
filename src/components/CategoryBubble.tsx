const PASTELS = ['#fde2e4', '#dff3e3', '#fff1c9', '#dbe9fb', '#ece1f7', '#d8f1ee', '#fde5cf', '#e6efc8'];
const stroke = { fill: 'none', stroke: '#2c4a3a', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

function Glyph({ name }: { name: string }) {
  const n = name.toLocaleLowerCase('tr-TR');
  if (/makine|traktör|biçer|ekipman|alet/.test(n)) return <g {...stroke}><circle cx="9" cy="19" r="4" /><circle cx="21" cy="21" r="2.5" /><path d="M13 19h6M9 15V9h7l2 6h4v4M12 9V6" /></g>;
  if (/arı|bal|kovan/.test(n)) return <g {...stroke}><ellipse cx="15" cy="17" rx="8" ry="5" /><ellipse cx="12" cy="9" rx="4" ry="5" /><ellipse cx="19" cy="9" rx="4" ry="5" /><path d="M12 13v8M17 13v8M7 17H4M23 17h3" /></g>;
  if (/uzman|hizmet|veteriner/.test(n)) return <g {...stroke}><circle cx="15" cy="9" r="4" /><path d="M6 25v-5c0-4 4-6 9-6s9 2 9 6v5M11 15l4 5 4-5M15 20v5" /></g>;
  if (/hayvan|süt|büyükbaş|küçükbaş|et\b|kümes/.test(n)) return <g {...stroke}><path d="M7 11c0-3 3-5 8-5s8 2 8 5v5c0 3-2 6-8 6s-8-3-8-6z" /><path d="M7 11 4 8M23 11l3-3M12 14v1M18 14v1M13 19h4" /></g>;
  if (/meyve|fidan|ağaç|bahçe/.test(n)) return <g {...stroke}><path d="M15 9c-5-3-9 0-9 6s4 9 9 9 9-3 9-9-4-9-9-6z" /><path d="M15 9c0-2 1-4 3-5" /></g>;
  if (/gübre|ilaç|tohum|tarım malz/.test(n)) return <g {...stroke}><path d="M15 24V12M15 14c-5 0-7-3-7-7 5 0 7 3 7 7zM15 17c5 0 7-3 7-7-5 0-7 3-7 7z" /></g>;
  if (/arazi|tarla|arsa|bağ|çiftlik/.test(n)) return <g {...stroke}><path d="M4 22l6-10h10l6 10zM8 17h14M6 20h18" /></g>;
  if (/mahsul|tahıl|buğday|ceviz|ürün|sebze/.test(n)) return <g {...stroke}><path d="M15 25V8M15 8c-3-1-4-3-3-5 3 1 4 3 3 5zM15 8c3-1 4-3 3-5-3 1-4 3-3 5zM15 14c-4 0-6-2-6-4 4 0 6 1 6 4zM15 14c4 0 6-2 6-4-4 0-6 1-6 4zM15 20c-4 0-6-2-6-4 4 0 6 1 6 4zM15 20c4 0 6-2 6-4-4 0-6 1-6 4z" /></g>;
  return <g {...stroke}><circle cx="15" cy="15" r="8" /><path d="M15 7v16M7 15h16" /></g>;
}

export default function CategoryBubble({ name, index, size = 38 }: { name: string; index: number; size?: number }) {
  return (
    <span aria-hidden="true" style={{ width: size, height: size, display: 'inline-grid', placeItems: 'center',
      borderRadius: '50%', flex: 'none', background: PASTELS[index % PASTELS.length] }}>
      <svg viewBox="0 0 30 30" width={size * 0.72} height={size * 0.72}><Glyph name={name} /></svg>
    </span>
  );
}

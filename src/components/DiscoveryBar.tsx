import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import CategoryBubble from './CategoryBubble';
import type { SortKey } from '../lib/locationFilter';

type Props = {
  query: string; onQuery: (value: string) => void;
  categories: Record<string, string[]>; category: string; sub: string;
  onCategory: (category: string) => void; onSub: (subcategory: string) => void;
  province: string; district: string; onRegion: () => void;
  sort: SortKey; onSort: (sort: SortKey) => void; countText: string; onAll: () => void;
};

export default function DiscoveryBar(props: Props) {
  const categories = Object.keys(props.categories);
  const chooseCategory = (category: string, anchor: HTMLElement | null) => {
    props.onCategory(category);
    props.onSub('Tümü');
    if (anchor) requestAnimationFrame(() => anchor.scrollIntoView({ block: 'start', behavior: 'smooth' }));
  };

  return (
    <section className="rd-discovery" aria-label="İlan ara ve kategorilere göz at">
      <label className="rd-search">
        <Search size={16} aria-hidden="true" />
        <input type="search" value={props.query} onChange={event => props.onQuery(event.target.value)}
          onKeyDown={event => { if (event.key === 'Enter') props.onAll(); }}
          placeholder="Kelime veya ilan numarası ara" aria-label="Kelime veya ilan numarası ara"
          data-testid="input-home-search" />
      </label>
      {props.category === 'Tüm kategoriler' ? (
        <nav className="rd-category-list" aria-label="Ana kategoriler" data-testid="open-category-list">
          {categories.map((category, index) => (
            <button type="button" key={category} className="rd-category-row" aria-label={category}
              data-testid={`category-row-${category}`}
              onClick={event => chooseCategory(category, event.currentTarget.closest<HTMLElement>('.rd-discovery'))}>
              <CategoryBubble name={category} index={index + 1} size={44} />
              <span className="rd-category-copy">
                <strong>{category}</strong>
                <small>{(props.categories[category] || []).slice(0, 3).join(', ') || 'İlanları görüntüle'}</small>
              </span>
              <ChevronRight size={17} aria-hidden="true" />
            </button>
          ))}
        </nav>
      ) : (
        <nav className="rd-category-list" aria-label="Alt kategoriler" data-testid="subcategory-row">
          <button type="button" className="rd-category-back" data-testid="button-back-categories"
            onClick={event => chooseCategory('Tüm kategoriler', event.currentTarget.closest<HTMLElement>('.rd-discovery'))}>
            <ChevronLeft size={17} aria-hidden="true" /> Ana kategorilere dön
          </button>
          <div className="rd-category-selected">
            <CategoryBubble name={props.category} index={Math.max(0, categories.indexOf(props.category) + 1)} size={44} />
            <strong>{props.category}</strong>
          </div>
          {['Tümü', ...(props.categories[props.category] || [])].map(subcategory => (
            <button type="button" key={subcategory}
              className={`rd-category-row rd-category-sub${props.sub === subcategory ? ' on' : ''}`}
              aria-pressed={props.sub === subcategory} onClick={() => props.onSub(subcategory)}>
              <span className="rd-category-copy">
                <strong>{subcategory === 'Tümü' ? `Tüm ${props.category}` : subcategory}</strong>
              </span>
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          ))}
        </nav>
      )}
      <div className="rd-filters">
        <select value={props.sort} onChange={event => props.onSort(event.target.value as SortKey)}
          aria-label="Sırala" data-testid="select-sort">
          <option value="default">Varsayılan sıra</option>
          <option value="newest">En yeni</option>
          <option value="priceAsc">Fiyat: düşükten yükseğe</option>
          <option value="priceDesc">Fiyat: yüksekten düşüğe</option>
        </select>
      </div>
      <div className="rd-count" data-testid="text-discovery-count">
        {props.countText}
        {!!(props.province || props.district) && (
          <button type="button" className="rd-region-choice" onClick={props.onRegion} aria-label="Seçili bölgeyi değiştir">
            {[props.province, props.district].filter(Boolean).join(' / ')}
          </button>
        )}
        <button type="button" className="rd-view-all" onClick={props.onAll}>Tüm ilanları gör</button>
      </div>
      <div className="rd-location-action">
        <button type="button" onClick={props.onRegion} data-testid="button-select-region">İl / ilçe seç</button>
      </div>
    </section>
  );
}

import './BrandLogo.css';

type BrandLogoProps = {
  variant?: 'header' | 'splash';
};

function WheatEar() {
  return (
    <svg className="pt-wheat-ear" viewBox="0 0 32 48" role="img" aria-label="Sarı başak">
      <path className="pt-wheat-stem" d="M8 44C13 34 18 23 22 6" />
      <path className="pt-wheat-grain" d="M21 9c-5-1-7-4-6-7 4 1 7 3 6 7Zm-2 5c-5 0-8-2-8-5 4 0 7 1 8 5Zm-2 5c-5-1-7-4-6-7 4 1 7 3 6 7Zm-2 5c-5 0-8-2-8-5 4 0 7 1 8 5Zm-3 5c-4-2-6-5-4-8 4 2 6 4 4 8Zm11-24c4-2 5-5 4-8-4 2-6 4-4 8Zm-1 6c4-1 7-4 6-7-4 1-7 3-6 7Zm-2 6c4-2 6-5 4-8-4 2-6 4-4 8Zm-2 6c4-1 7-4 6-7-4 1-7 3-6 7Z" />
    </svg>
  );
}

export default function BrandLogo({ variant = 'header' }: BrandLogoProps) {
  return (
    <div className={`pt-brand pt-brand--${variant}`} role="img" aria-label="PazarTarla">
      <span className="pt-brand__symbol" aria-hidden="true">
        <WheatEar />
      </span>
      <span className="pt-brand__name">
        <span className="pt-brand__pazar">Pazar</span><span className="pt-brand__tarla">Tarla</span>
      </span>
    </div>
  );
}
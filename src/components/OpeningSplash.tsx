import BrandLogo from './BrandLogo';
import './OpeningSplash.css';

export default function OpeningSplash() {
  return (
    <div className="pt-splash" role="status" aria-label="PazarTarla açılıyor">
      <div className="pt-splash__stage">
        <div className="pt-splash__curtain pt-splash__curtain--left" aria-hidden="true" />
        <div className="pt-splash__curtain pt-splash__curtain--right" aria-hidden="true" />
        <div className="pt-splash__content">
          <BrandLogo variant="splash" />
          <p className="pt-splash__tagline">
            Türkiye'nin İlk ve Tek<br />
            <span>Tarım Platformu</span>
          </p>
        </div>
        <span className="pt-splash__ground" aria-hidden="true" />
      </div>
    </div>
  );
}
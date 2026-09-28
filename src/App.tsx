import React from 'react';

export default function HeroWelcome({ onEnter }: { onEnter?: () => void }) {
  return (
    <div 
      onClick={onEnter}
      className="relative w-full h-screen overflow-hidden bg-gradient-to-br from-emerald-950 via-zinc-900 to-stone-900 flex items-center justify-center cursor-pointer select-none"
    >
      {/* Hareketli Tül / Sis Efekti Katmanı */}
      <div className="absolute inset-0 opacity-45 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(16,185,129,0.15),transparent_50%)] animate-pulse" />
        <div className="absolute -inset-[100%] opacity-30 bg-[linear-gradient(to_right,#052e16_1px,transparent_1px),linear-gradient(to_bottom,#052e16_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] animate-[spin_60s_linear_infinite]" />
        
        {/* Dalgalanan Tül Gradiyeni */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-emerald-500/10 to-transparent animate-[pulse_4s_ease-in-out_infinite] blur-2xl transform -skew-x-12 scale-150" />
      </div>

      {/* İçerik ve Yazı */}
      <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
        <h1 className="text-4xl md:text-6xl lg:text-7xl font-light tracking-wide text-stone-100 drop-shadow-2xl">
          <span className="inline-block animate-[fadeInUp_1.5s_ease-out_forwards] font-normal text-emerald-400">
            Türkiye'nin
          </span>{' '}
          <span className="inline-block animate-[fadeInUp_1.5s_ease-out_0.3s_forwards] opacity-0">
            İlk ve Tek
          </span>{' '}
          <span className="inline-block animate-[fadeInUp_1.5s_ease-out_0.6s_forwards] opacity-0 font-semibold bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
            Tarım Platformu
          </span>
        </h1>
        
        <p className="mt-8 text-sm md:text-base text-stone-400 tracking-widest uppercase animate-[fadeIn_2s_ease-out_1.2s_forwards] opacity-0">
          Devam etmek için ekrana dokunun
        </p>
      </div>

      {/* Tailwind için özel keyframe tanımları (Tailwind config'e de eklenebilir) */}
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(25px) blur(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0) blur(0);
          }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}

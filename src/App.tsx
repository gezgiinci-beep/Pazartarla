import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom'; // veya kullandığın router yapısı

function SplashScreen() {
  const navigate = useNavigate();

  useEffect(() => {
    // 3 saniye (3000 milisaniye) sonra otomatik yönlendir
    const timer = setTimeout(() => {
      navigate('/anasayfa'); // Gitmesini istediğin sayfa yolu
    }, 3000);

    return () => clearTimeout(timer); // Bileşen kapanırsa zamanlayıcıyı temizle
  }, [navigate]);

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-[#111c18]">
      <h1 className="text-4xl text-white text-center">
        Türkiye'nin İlk ve Tek <br />
        <span className="text-[#2add9c]">Tarım Platformu</span>
      </h1>
      {/* "DEVAM ETMEK İÇİN EKRANA DOKUNUN" yazısı buradan kaldırıldı */}
    </div>
  );
}

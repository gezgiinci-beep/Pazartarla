const handleAutoFetchListings = () => {
    if (!isAdminLoggedIn) return;
    
    // Farklı kategorilerden zengin bir otomatik ilan havuzu
    const randomPool = [
      {
        title: 'John Deere 5075E 4WD Kabinli Traktör',
        price: 1350000,
        category: 'Traktör',
        subCategory: 'İkinci El Traktör',
        mode: 'Satılık',
        location: 'Balıkesir / Gönen',
        amount: '75 HP',
        description: 'Az kullanılmış, bakımlı ve masrafsız tarla traktörü.',
        seller: 'Can İnce',
        phone: '0535 768 1550',
        seoTags: 'john deere, traktör, gönen tarım'
      },
      {
        title: 'Organik Çiçek Yayla Balı (Süzme)',
        price: 480,
        category: 'Arıcılık',
        subCategory: 'Bal',
        mode: 'Satılık',
        location: 'Muğla / Fethiye',
        amount: '2 Kilo',
        description: 'Çam ve çiçek nektarından üretilmiş saf arı balı.',
        seller: 'Ahmet Arıcı',
        phone: '0534 777 2211',
        seoTags: 'organik bal, muğla balı, arıcılık'
      },
      {
        title: 'Soğuk Sıkım Erken Hasat Zeytinyağı',
        price: 300,
        category: 'Mahsuller',
        subCategory: 'Zeytin & Zeytinyağı',
        mode: 'Satılık',
        location: 'Ayvalık / Balıkesir',
        amount: '5 Litre',
        description: 'Yüksek polifenollü gurme zeytinyağı.',
        seller: 'Mehmet Zeytinci',
        phone: '0532 555 4433',
        seoTags: 'zeytinyağı, ayvalık, erken hasat'
      },
      {
        title: '3 Lü Hidrolik Dönerli Pulluk',
        price: 55000,
        category: 'Tarım Ekipmanları',
        subCategory: 'Pulluk',
        mode: 'Satılık',
        location: 'Konya / Merkez',
        amount: '1 Adet',
        description: 'Sağlam gövdeli, pistonlu dönerli tarım pulluğu.',
        seller: 'Konya Ekipman',
        phone: '0533 888 7766',
        seoTags: 'pulluk, tarım aletleri, konya'
      }
    ];

    // Havuzdan rastgele bir ilan seç
    const randomItem = randomPool[Math.floor(Math.random() * randomPool.length)];
    const randomId = Date.now();

    const newEntry = {
      ...randomItem,
      id: randomId,
      image: getSmartAutoImage(randomItem.title, randomItem.category),
      status: 'pending',
      isFeatured: false
    };

    const updated = [newEntry, ...listings];
    saveListings(updated);
    alert(`🎉 Harika! "${newEntry.title}" otomatik olarak onay kuyruğuna eklendi.`);
  };

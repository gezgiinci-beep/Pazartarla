<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <title>PazarTarla Kapsamlı Pratik İlan Üreticisi</title>
    <style>
        body { font-family: system-ui, sans-serif; background: #0f172a; padding: 20px; max-width: 480px; margin: 0 auto; color: #f8fafc; }
        .card { background: #1e293b; padding: 20px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); border: 1px solid #334155; }
        input, select, textarea { width: 100%; padding: 10px; margin-bottom: 10px; background: #0f172a; color: #fff; border: 1px solid #475569; border-radius: 6px; box-sizing: border-box; }
        button { width: 100%; padding: 12px; background: #22c55e; color: #fff; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 14px; }
        button:hover { background: #16a34a; }
        label { font-size: 12px; color: #94a3b8; display: block; margin-bottom: 4px; }
    </style>
</head>
<body>
    <div class="card">
        <h2 style="margin-top: 0; color: #4ade80; font-size: 18px;">🌾 PazarTarla Tarım & Arazi İlan Aracı</h2>
        
        <label>Tarım & Arazi Şablonu Seç:</label>
        <select id="preset" onchange="loadPreset()">
            <option value="">-- Tüm Tarım Kategorilerinden Seçin --</option>
            <option value="arazi">Satılık Cevizli Tarla / Arazi</option>
            <option value="ceviz">Tarladan Doğrudan Taze Chandler Ceviz</option>
            <option value="traktor">New Holland TD100D Tarım Traktörü</option>
            <option value="kovan">Arıcılık: 10 Çerçeveli Bal Kovanı</option>
            <option value="zeytin">Erken Hasat Sızma Zeytinyağı</option>
            <option value="koyun">Damızlık Merinos Koyun Sürüsü</option>
        </select>

        <label>İlan Başlığı *</label>
        <input type="text" id="title" placeholder="Örn: Gönen'de Satılık Tarla">

        <label>Fiyat (TL) *</label>
        <input type="number" id="price" placeholder="1250000">

        <label>Kategori</label>
        <input type="text" id="category" value="Mahsuller" placeholder="Mahsuller / Traktör / Arazi">

        <label>Konum</label>
        <input type="text" id="location" value="Gönen / Balıkesir" placeholder="Konum">

        <label>Satıcı ve Telefon</label>
        <input type="text" id="seller" value="Can İnce">
        <input type="text" id="phone" value="0535 768 1550">

        <label>Görsel URL</label>
        <input type="text" id="image" placeholder="https://...">

        <label>Açıklama</label>
        <textarea id="description" placeholder="Detaylı tarım ve arazi açıklaması..." style="height: 60px;"></textarea>

        <button onclick="sendToListings()">🚀 Doğrudan Yayına Gönder</button>
    </div>

    <script>
        const presets = {
            arazi: { title: "Gönen Kalburcu'da 5 Yıllık Chandler Cevizli Tarla", price: 2850000, category: "Arazi & Tarla", location: "Balıkesir / Gönen", image: "https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&q=80&w=800", description: "8.300 m2 içinde damla sulama sistemi kurulu, verimli Chandler cevizli tarla." },
            ceviz: { title: "Tarladan Doğrudan Taze Chandler Ceviz", price: 140, category: "Mahsuller", location: "Gönen / Balıkesir", image: "https://images.unsplash.com/photo-1559181567-c3190ca9959b?auto=format&fit=crop&q=80&w=800", description: "Kendi bahçemizin ürünü, ilaçsız ve dolgun Chandler ceviz." },
            traktor: { title: "New Holland TD100D Tarım Traktörü", price: 1450000, category: "Traktör", location: "Balıkesir / Gönen", image: "https://images.unsplash.com/photo-1592841202223-ca33cfd81b6f?auto=format&fit=crop&q=80&w=800", description: "Tertemiz, bakımları tam tarla traktörü." },
            kovan: { title: "Meşe Ormanı Çevresinde 10 Kovan Arı ve Bal", price: 3500, category: "Arıcılık", location: "Gönen / Kalburcu", image: "https://images.unsplash.com/photo-1587049352847-4a222e784d38?auto=format&fit=crop&q=80&w=800", description: "Zengin flora çevresinde üretilen doğal arı kovanı ve bal seti." },
            zeytin: { title: "Soğuk Sıkım Natürel Sızma Zeytinyağı (5 Lt)", price: 1750, category: "Mahsuller", location: "Balıkesir / Edremit", image: "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&q=80&w=800", description: "Düşük asit oranına sahip, kendi sıkımımız taze zeytinyağı." },
            koyun: { title: "Damızlık Safkan Merinos Koyun Sürüsü", price: 9500, category: "Canlı Hayvanlar", location: "Bandırma / Balıkesir", image: "https://images.unsplash.com/photo-1484557077804-d5c63391d79e?auto=format&fit=crop&q=80&w=800", description: "Sağlık kontrolleri yapılmış, aşılı damızlık koyunlar." }
        };

        function loadPreset() {
            const val = document.getElementById('preset').value;
            if (!val) return;
            const p = presets[val];
            document.getElementById('title').value = p.title;
            document.getElementById('price').value = p.price;
            document.getElementById('category').value = p.category;
            document.getElementById('location').value = p.location;
            document.getElementById('image').value = p.image;
            document.getElementById('description').value = p.description;
        }

        async function sendToListings() {
            const SUPABASE_URL = 'https://srbarfjzsfkmglsnmbtw.supabase.co';
            const SUPABASE_ANON_KEY = 'sb_publishable__8tUtClK2adq_ORRuL5PQ_oft6c';

            const data = {
                title: document.getElementById('title').value.trim(),
                price: Number(document.getElementById('price').value),
                category: document.getElementById('category').value.trim(),
                location: document.getElementById('location').value.trim(),
                description: document.getElementById('description').value.trim(),
                seller: document.getElementById('seller').value.trim(),
                phone: document.getElementById('phone').value.trim(),
                image: document.getElementById('image').value.trim() || 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&q=80&w=800',
                status: 'approved'
            };

            if (!data.title || !data.price) {
                alert('Lütfen başlık ve fiyat alanlarını doldurun!');
                return;
            }

            try {
                const res = await fetch(`${SUPABASE_URL}/rest/v1/listings`, {
                    method: 'POST',
                    headers: {
                        'apikey': SUPABASE_ANON_KEY,
                        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=minimal'
                    },
                    body: JSON.stringify(data)
                });

                if (res.ok) {
                    alert('🎉 Başarıyla eklendi! Sitenizde anında görünecektir.');
                    document.getElementById('title').value = '';
                    document.getElementById('price').value = '';
                    document.getElementById('description').value = '';
                } else {
                    const err = await res.text();
                    alert('Sunucu reddetti: ' + err);
                }
            } catch (e) {
                alert('Bağlantı hatası oluştu!');
            }
        }
    </script>
</body>
</html>

import rice from '../assets/demo/0-0.webp';
import wheat from '../assets/demo/0-1.webp';
import grain from '../assets/demo/0-2.webp';
import walnut from '../assets/demo/1-0.webp';
import pear from '../assets/demo/1-1.webp';
import apple from '../assets/demo/1-2.webp';
import tractorField from '../assets/demo/2-0.webp';
import tractorWork from '../assets/demo/2-1.webp';
import tractor from '../assets/demo/2-2.webp';

export type DemoCategory='Tahıllar'|'Meyveler'|'Traktörler';
export type DemoStore=Readonly<{
  id:string;name:string;location:string;description:string;category:DemoCategory;image:string;isDemo:true;
}>;
export type DemoListing=Readonly<{
  id:string;storeId:string;title:string;category:DemoCategory;location:string;
  price:number;unit:'ton'|'kg'|'adet';image:string;description:string;isDemo:true;
}>;
export const DEMO_NOTICE='Demo / Örnek: Bu mağazalar ve ilanlar gerçek satış kayıtları değildir. Fiyatlar ve fotoğraflar temsilidir; teklif, sipariş ve iletişim işlemi yapılamaz.';
export const DEMO_STORES:readonly DemoStore[]=Object.freeze([
  {id:'demo-bereket',name:'Bereket Tahıl',location:'Konya',category:'Tahıllar',image:grain,isDemo:true,
    description:'Tahıl ürünlerinin mağazada nasıl sergilendiğini gösteren örnek mağaza.'},
  {id:'demo-bahce',name:'Bahçeden Hasat',location:'Bursa',category:'Meyveler',image:apple,isDemo:true,
    description:'Meyve ve bahçe ürünleri için hazırlanmış örnek mağaza.'},
  {id:'demo-ekipman',name:'Tarla Ekipman',location:'Eskişehir',category:'Traktörler',image:tractor,isDemo:true,
    description:'Tarım araçlarının ilan görünümünü tanıtan örnek mağaza.'},
].map(store=>Object.freeze(store)) as DemoStore[]);
const rows:readonly [number,string,number,DemoListing['unit'],string][]=[
  [0,'Ekmeklik buğday',12500,'ton',wheat],
  [0,'Sert buğday',13800,'ton',grain],
  [0,'Yemlik tahıl karışımı',11200,'ton',grain],
  [0,'Tohumluk buğday',16200,'ton',wheat],
  [0,'Baldo pirinç',85,'kg',rice],
  [0,'Pilavlık pirinç',68,'kg',rice],
  [1,'Kırmızı elma',42,'kg',apple],
  [1,'Bahçeden sofralık elma',48,'kg',apple],
  [1,'Sofralık armut',55,'kg',pear],
  [1,'Bahçe hasadı armut',62,'kg',pear],
  [1,'Kabuklu ceviz',145,'kg',walnut],
  [1,'Taze hasat ceviz',165,'kg',walnut],
  [2,'70 HP tarla traktörü',875000,'adet',tractor],
  [2,'85 HP tarla traktörü',1125000,'adet',tractorField],
  [2,'Bahçe tipi traktör',640000,'adet',tractor],
  [2,'Arazi işleri için traktör',985000,'adet',tractorWork],
  [2,'4x4 tarla traktörü',1275000,'adet',tractorField],
  [2,'İkinci el çiftlik traktörü',725000,'adet',tractorWork],
];
export const DEMO_LISTINGS:readonly DemoListing[]=Object.freeze(rows.map(([index,title,price,unit,image],i)=>{
  const store=DEMO_STORES[index];
  return Object.freeze({id:`demo-product-${i+1}`,storeId:store.id,title,price,unit,image,
    category:store.category,location:store.location,isDemo:true as const,
    description:`${title} için hazırlanmış örnek ilan. ${store.name} gerçek bir satıcı hesabı değildir. Gösterilen ürün, konum ve fiyat yalnızca tanıtım amaçlıdır; bu ilan üzerinden satış veya iletişim yapılamaz.`});
}));

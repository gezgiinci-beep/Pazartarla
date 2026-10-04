import type { useTrafficAnalytics } from '../hooks/useTrafficAnalytics';
export default function TrafficPrivacy({state}:{state:ReturnType<typeof useTrafficAnalytics>}) {
  const style={border:'1px solid #dce2d3',borderRadius:8,padding:12,marginTop:18,color:'#475569',fontSize:11,lineHeight:1.6};
  return <section aria-label="İstatistik ölçüm tercihi" style={style} data-testid="traffic-privacy">
    {state.isBlocked ? <p>Tarayıcınızın izlememe tercihi nedeniyle istatistik ölçümü yapılmıyor.</p> :
      state.consent==='unknown' ? <>
        <strong>Ziyaret istatistiklerine izin verir misiniz?</strong>
        <p>İzin verirseniz hesap bilgilerinizle ilişkilendirilmeyen bir tarayıcı kimliği, yaklaşık ülke/il,
          ziyaret sıklığı ve açık, odakta olan sayfadaki süre ölçülür. IP adresi veya kesin konum saklanmaz.
          90 günden eski kayıtlar günlük temizlenir. Tercihinizi buradan değiştirebilirsiniz.</p>
        <button type="button" onClick={()=>state.choose(true)} data-testid="button-traffic-consent-allow">İzin ver</button>{' '}
        <button type="button" onClick={()=>state.choose(false)} data-testid="button-traffic-consent-deny">İstemiyorum</button>
      </> : <>
        <span>İstatistik ölçümü: {state.consent==='granted'?'izin verildi':'kapalı'}. </span>
        <button type="button" onClick={()=>state.choose(state.consent!=='granted')} data-testid="button-traffic-consent-change">
          {state.consent==='granted'?'İzni geri al':'Ölçüme izin ver'}
        </button>
        <small style={{display:'block'}}>Yalnızca yaklaşık ülke/il ve odaktaki sayfa süresi ölçülür. Kimlik veya IP saklanmaz.
          90 günden eski kayıtlar günlük temizlenir; izin geri alındığında yeni ölçüm durur.</small>
      </>}
    {state.error && <p role="status" style={{color:'#92400e'}}>{state.error}</p>}
  </section>;
}
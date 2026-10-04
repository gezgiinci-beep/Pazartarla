const routes = new Set(['home','detail','favorites','add']);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function validatePayload(body) {
  const keys = ['view_id','visitor_id','session_id','route','listing_id','active_seconds'];
  return body && typeof body === 'object' && !Array.isArray(body) &&
    Object.keys(body).length === keys.length && Object.keys(body).every(k=>keys.includes(k)) &&
    [body.view_id,body.visitor_id,body.session_id].every(v=>typeof v==='string'&&uuid.test(v)) &&
    routes.has(body.route) && Number.isInteger(body.active_seconds) && body.active_seconds>=0 && body.active_seconds<=43200 &&
    (body.route==='detail' ? typeof body.listing_id==='string' && /^[1-9]\d{0,18}$/.test(body.listing_id) &&
      BigInt(body.listing_id)<=9223372036854775807n : body.listing_id===null);
}
export function coarseLocation(headers, onVercel) {
  if (!onVercel) return {country:null,region:null};
  const country = headers['x-vercel-ip-country'];
  const region = headers['x-vercel-ip-country-region'];
  return {country:typeof country==='string'&&/^[A-Z]{2}$/.test(country)?country:null,
    region:typeof country==='string'&&/^[A-Z0-9-]{1,12}$/i.test(region)?region.toUpperCase():null};
}
export function createHandler(env = process.env, request = fetch) {
  return async function handler(req,res) {
    res.setHeader('Cache-Control','no-store');
    const allowedHost=req.headers.host==='www.pazartarla.com.tr' ||
      (req.method==='GET' && req.headers.host==='pazartarla-1.vercel.app');
    if (env.VERCEL_ENV!=='production' || !allowedHost) {
      return res.status(503).json({ready:false,error:'collector_disabled_outside_www_production'});
    }
    const base=env.VITE_SUPABASE_URL, key=env.VITE_SUPABASE_ANON_KEY;
    if (!base || !key) return res.status(503).json({ready:false,error:'collector_not_configured'});
    if (req.method!=='GET' && req.method!=='POST') { res.setHeader('Allow','GET, POST');return res.status(405).json({error:'method_not_allowed'}); }
    let body;
    if (req.method==='POST') {
      try {
        if (new URL(req.headers.origin).host!==req.headers.host) return res.status(403).json({error:'origin_denied'});
        if (Number(req.headers['content-length']||0)>2048) return res.status(413).json({error:'payload_too_large'});
        body=typeof req.body==='string'?JSON.parse(req.body):req.body;
        if (JSON.stringify(body)?.length>2048) return res.status(413).json({error:'payload_too_large'});
        if (!validatePayload(body)) return res.status(400).json({error:'invalid_view'});
      } catch { return res.status(400).json({error:'invalid_request'}); }
    }
    const geo=coarseLocation(req.headers,env.VERCEL==='1');
    const payload=req.method==='GET'?{}:{
      p_view_id:body.view_id,p_visitor_id:body.visitor_id,p_session_id:body.session_id,
      p_route:body.route,p_listing_id:body.listing_id,p_active_seconds:body.active_seconds,
      p_country:geo.country,p_region:geo.country?geo.region:null
    };
    try {
      const response=await request(base.replace(/\/$/,'')+'/rest/v1/rpc/'+(req.method==='GET'?'traffic_collector_status':'record_traffic_view'),{
        method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify(payload),
        signal:AbortSignal.timeout(5_000)
      });
      if (!response.ok) return res.status(503).json({ready:false,error:'collector_backend_unavailable'});
      const result=await response.json();
      if (req.method==='GET') return res.status(result?.ready===true?200:503).json(result?.ready===true?{ready:true}:{ready:false});
      if (result!==true) return res.status(503).json({error:'view_not_acknowledged'});
      return res.status(200).json({recorded:true});
    } catch { return res.status(503).json({ready:false,error:'collector_connection_failed'}); }
  };
}
export default createHandler();
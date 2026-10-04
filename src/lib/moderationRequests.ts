export function readModerationRows(data: any, normalize: (row: any)=>any) {
  if (!Array.isArray(data)) throw new Error('MODERATION_LOAD_FAILED');
  return data.map(entry=>{
    if (!entry?.listing?.id || !/^[a-f0-9]{64}$/.test(entry.edit_token))
      throw new Error('MODERATION_LOAD_FAILED');
    return {...normalize(entry.listing),_editToken:entry.edit_token};
  });
}
export async function saveModerationSnapshot(url: string,headers: Record<string,string>,id: number,decision: string,token: string) {
  if (!['approved','rejected'].includes(decision) || !/^[a-f0-9]{64}$/.test(token))
    throw new Error('MODERATION_SAVE_FAILED');
  const response=await fetch(`${url}/rest/v1/rpc/moderate_listing_snapshot`,{
    method:'POST',headers,body:JSON.stringify({p_listing_id:id,p_decision:decision,p_edit_token:token}),
  });
  if (!response.ok) throw new Error('MODERATION_SAVE_FAILED');
  const data=await response.json();
  if (data?.listing?.id!==id || data.listing.status!==decision) throw new Error('MODERATION_SAVE_FAILED');
  return data.listing;
}
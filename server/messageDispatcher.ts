// Provider-independent server worker. Never import into a browser bundle.
// Must be wired to a configured provider, server-only credentials and an approved scheduler.
import type {MessageChannel} from '../src/lib/contactDepot';
export type ClaimedDelivery={
  id:string;lease:string;destination:string;channel:MessageChannel;provider:string;
  subject:string;body:string;unsubscribe_token:string;
};
export type DispatchPort={
  claim:()=>Promise<ClaimedDelivery[]>;
  allowed:(id:string,lease:string)=>Promise<boolean>;
  send:(message:ClaimedDelivery,context:{idempotencyKey:string;unsubscribeUrl:string})=>
    Promise<{accepted:true;providerId:string}|{accepted:false}>;
  finish:(id:string,lease:string,status:'sent'|'failed'|'unknown'|'cancelled',providerId?:string)=>Promise<boolean>;
  unsubscribeUrl:(token:string)=>string;
};
export async function runDispatchBatch(port:DispatchPort) {
  const messages=await port.claim();
  const outcome={claimed:messages.length,sent:0,failed:0,unknown:0,cancelled:0};
  for(const message of messages) {
    if(!await port.allowed(message.id,message.lease)) {
      if(!await port.finish(message.id,message.lease,'cancelled'))throw Error('Delivery state not acknowledged.');
      outcome.cancelled++;continue;
    }
    const unsubscribeUrl=port.unsubscribeUrl(message.unsubscribe_token);
    if(!unsubscribeUrl.startsWith('https://'))throw Error('A verified HTTPS unsubscribe URL is required.');
    let response;
    try {response=await port.send(message,{idempotencyKey:message.id,unsubscribeUrl});}
    catch {
      // Sending may have succeeded before the network failed. Do not blindly retry.
      if(!await port.finish(message.id,message.lease,'unknown'))throw Error('Unknown outcome not acknowledged.');
      outcome.unknown++;continue;
    }
    const status=response.accepted?'sent':'failed';
    if(!await port.finish(message.id,message.lease,status,response.accepted?response.providerId:undefined))
      throw Error('Delivery outcome not acknowledged.');
    outcome[status]++;
  }
  return outcome;
}
// Offline recovery helper only. No database connections/restores/deletes.
import {readFile,open,lstat,mkdtemp,rm} from 'node:fs/promises';
import {createReadStream,createWriteStream} from 'node:fs';
import {createPrivateKey,privateDecrypt,createDecipheriv,constants} from 'node:crypto';
import {pipeline} from 'node:stream/promises';
import {dirname,join,resolve} from 'node:path';
export async function decryptBackup(source,output,pem) {
  // Refuse overwrite, including symlinks.
  try{await lstat(output);throw Error('Destination already exists.');}catch(e){if(e.code!=='ENOENT')throw e;}
  const f=await open(source),head=Buffer.alloc(16384),size=(await f.stat()).size;
  try{await f.read(head,0,head.length,0);}finally{await f.close();}
  const length=head.indexOf(10)+1;if(!length||length>=size-16)throw Error('Invalid backup envelope.');
  const aad=head.subarray(0,length),h=JSON.parse(aad.toString());
  if(h.format!=='pazartarla-backup-v1'||h.cipher!=='aes-256-gcm'||h.keyAlgorithm!=='RSA-OAEP-SHA256')throw Error('Unsupported envelope.');
  const secret=privateDecrypt({key:createPrivateKey(pem),oaepHash:'sha256',padding:constants.RSA_PKCS1_OAEP_PADDING},Buffer.from(h.wrappedKey,'base64'));
  const tag=Buffer.alloc(16),end=await open(source);
  try{await end.read(tag,0,16,size-16);}finally{await end.close();}
  const tmp=await mkdtemp(join(dirname(resolve(output)),'.private-recovery-'));
  const target=join(tmp,'verified');
  try {
    const decipher=createDecipheriv('aes-256-gcm',secret,Buffer.from(h.iv,'base64'));
    decipher.setAAD(aad);decipher.setAuthTag(tag);
    await pipeline(createReadStream(source,{start:length,end:size-17}),decipher,createWriteStream(target,{flags:'wx',mode:0o600}));
    // Link cannot overwrite an existing destination, even in a race.
    const {link}=await import('node:fs/promises');await link(target,output);
  }finally{secret.fill(0);await rm(tmp,{recursive:true,force:true});}
}
if(process.argv[1]&&resolve(process.argv[1])===new URL(import.meta.url).pathname) {
  try {
    if(!process.env.PAZARTARLA_RECOVERY_PRIVATE_KEY_FILE||!process.argv[2]||!process.argv[3])throw Error('Offline private key file, encrypted input and new output path required.');
    await decryptBackup(process.argv[2],process.argv[3],await readFile(process.env.PAZARTARLA_RECOVERY_PRIVATE_KEY_FILE,'utf8'));
    console.log('Backup decrypted and authentication verified. No database restored; keep plaintext private.');
  }catch{console.error('RECOVERY FAILED: no verified output produced. Check private key, input integrity and destination.');process.exitCode=1;}
}
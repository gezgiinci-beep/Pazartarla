import {createPublicKey,createCipheriv,publicEncrypt,randomBytes,constants} from 'node:crypto';
import {createReadStream,createWriteStream} from 'node:fs';
import {appendFile} from 'node:fs/promises';
import {pipeline} from 'node:stream/promises';
import {digest} from './migration-policy.mjs';
export function backupPublicKey(pem) {
  let key;try{key=createPublicKey(pem);}catch{throw Error('A valid backup encryption PUBLIC key is required.');}
  if(key.asymmetricKeyType!=='rsa'||key.asymmetricKeyDetails.modulusLength<3072)
    throw Error('Backup public key must be RSA, at least 3072 bits.');
  return key;
}
export async function encryptFile(source,destination,key) {
  const secret=randomBytes(32),iv=randomBytes(12);
  const header=Buffer.from(JSON.stringify({
    format:'pazartarla-backup-v1',cipher:'aes-256-gcm',keyAlgorithm:'RSA-OAEP-SHA256',
    keyFingerprint:digest(key.export({type:'spki',format:'der'})),iv:iv.toString('base64'),
    wrappedKey:publicEncrypt({key,oaepHash:'sha256',padding:constants.RSA_PKCS1_OAEP_PADDING},secret).toString('base64'),
  })+'\n');
  const cipher=createCipheriv('aes-256-gcm',secret,iv);cipher.setAAD(header);
  const out=createWriteStream(destination,{flags:'wx',mode:0o600});out.write(header);
  try {
    await pipeline(createReadStream(source),cipher,out);
    await appendFile(destination,cipher.getAuthTag());
  }finally{secret.fill(0);}
}
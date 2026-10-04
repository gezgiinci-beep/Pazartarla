import {createBackup} from './safety/backup.mjs';
try {
  const {dir}=await createBackup();
  console.log('Encrypted database + code backup completed:',dir);
  console.log('Archive readability verified; full restore drill and Storage file backup are separate requirements.');
}catch(e){console.error('BACKUP FAILED:',e.message);process.exitCode=1;}
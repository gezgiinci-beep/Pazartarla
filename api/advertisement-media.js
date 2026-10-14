import { put } from '@vercel/blob';
import { createTursoAdvertisementMediaUploadHandler } from '../server/tursoAdvertisementMedia.js';

export const config = { api: { bodyParser: false } };

export default createTursoAdvertisementMediaUploadHandler({ putBlob: put });

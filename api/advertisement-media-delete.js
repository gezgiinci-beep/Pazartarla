import { del } from '@vercel/blob';
import { createTursoAdvertisementMediaDeleteHandler } from '../server/tursoAdvertisementMedia.js';

export default createTursoAdvertisementMediaDeleteHandler({ deleteBlob: del });

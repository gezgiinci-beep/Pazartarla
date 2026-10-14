import {put} from '@vercel/blob';
import {createTursoListingMediaUploadHandler} from '../server/tursoListingMedia.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default createTursoListingMediaUploadHandler({putBlob: put});

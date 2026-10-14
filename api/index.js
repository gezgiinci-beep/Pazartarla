import advertisementMediaDelete from './advertisement-media-delete.js';
import advertisementMedia from './advertisement-media.js';
import advertisements from './advertisements.js';
import authRouter from './auth-router.js';
import contactDepot from './contact-depot.js';
import contactDepotUnsubscribe from './contact-depot-unsubscribe.js';
import listingArchive from './listing-archive.js';
import listingMedia from './listing-media.js';
import listingMetadata from './listing-metadata.js';
import listingModeration from './listing-moderation.js';
import listingOwner from './listing-owner.js';
import offers from './offers.js';
import publicListings from './public-listings.js';
import siteSettings from './site-settings.js';
import storeMembershipData from './store-membership-data.js';
import storeMembershipMutation from './store-membership/mutate.js';
import storeMembershipPublication from './store-membership/publication.js';
import submissions from './submissions.js';
import traffic from './traffic.js';
import {createVercelApiRouter} from '../server/vercelApiRouter.js';

export const config = {api: {bodyParser: false}};

export default createVercelApiRouter({
  'advertisement-media-delete': advertisementMediaDelete,
  'advertisement-media': advertisementMedia,
  advertisements,
  'auth-router': authRouter,
  'contact-depot': contactDepot,
  'contact-depot-unsubscribe': contactDepotUnsubscribe,
  'listing-archive': listingArchive,
  'listing-media': listingMedia,
  'listing-metadata': listingMetadata,
  'listing-moderation': listingModeration,
  'listing-owner': listingOwner,
  offers,
  'public-listings': publicListings,
  'site-settings': siteSettings,
  'store-membership-data': storeMembershipData,
  'store-membership/mutate': storeMembershipMutation,
  'store-membership/publication': storeMembershipPublication,
  submissions,
  traffic,
});

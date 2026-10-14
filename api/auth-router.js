import {
  createAdminLoginHandler,
  createAuthLoginHandler,
  createAuthLogoutHandler,
  createAuthSessionHandler,
} from '../server/authHandlers.js';
import { createAuthFlowHandler } from '../server/authFlowHandlers.js';
import { createAuthApiRouter } from '../server/authApiRouter.js';

const handlers = {
  'admin-login': createAdminLoginHandler(),
  login: createAuthLoginHandler(),
  logout: createAuthLogoutHandler(),
  session: createAuthSessionHandler(),
  'request-password-reset': createAuthFlowHandler('request-reset'),
  'resend-verification': createAuthFlowHandler('resend'),
  'reset-password': createAuthFlowHandler('reset-password'),
  signup: createAuthFlowHandler('signup'),
  'verify-email': createAuthFlowHandler('verify-email'),
};

export default createAuthApiRouter(handlers);

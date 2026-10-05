import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import { startReleaseRefresh } from './lib/releaseRefresh.js';

declare const __PAZARTARLA_BUILD_ID__: string;

if (import.meta.env.PROD) {
  startReleaseRefresh(import.meta.env.BASE_URL, __PAZARTARLA_BUILD_ID__);
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

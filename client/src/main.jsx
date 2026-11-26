import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles/tokens.css';
import './styles/global.css';
import './styles/auth.css';
import './styles/page-transitions.css';
import './styles/route-stability.css';
import './styles/flash-messages.css';
import './styles/shared-overlays.css';
// Public and authenticated pages share one interface.
import './styles/prelogin.css';
// Keep authenticated app surfaces and overlays consistent with the public pages.
import './styles/app-redesign.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

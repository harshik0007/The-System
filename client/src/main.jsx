import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles/tokens.css';
import './styles/global.css';
import './styles/click-effects.css';
import './styles/auth.css';
import './styles/page-transitions.css';
import './styles/route-stability.css';
// Global theme rules also contain the fixed, portaled theme-transition overlay.
import './styles/themes.css';
// Theme modules load after page styles so their scoped tokens and component
// overrides are the final word for the active member theme.
import './styles/themes/dark-navy/index.css';
import './styles/themes/obsidian/index.css';
import './styles/themes/aurora/index.css';
import './styles/themes/eclipse/index.css';
import './styles/themes/galaxion/index.css';
// Shared dialogs and transient messages use the active theme's semantic tokens.
import './styles/theme-overlays.css';
import './styles/flash-messages.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

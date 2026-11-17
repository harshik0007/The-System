# THE SYSTEM — Seven Rank Animation Prototype

A standalone, responsive HTML/CSS/JavaScript prototype for the original seven-stage rank progression section.

## Working rank names

These names are creative working titles and can be changed before the product's rank rules are finalized:

1. Origin
2. Ember
3. Surge
4. Vector
5. Apex
6. Zenith
7. Continuum

The seven emblems are original inline SVG designs. No anime characters, Solo Leveling assets, or third-party game branding are used.

## Run locally

1. Extract the ZIP file.
2. Open a terminal in this folder.
3. Run a local static server, for example:

   ```bash
   python -m http.server 8000
   ```

4. Open `http://localhost:8000` in your browser.

GSAP and ScrollTrigger are loaded from cdnjs. Google Fonts are loaded from Google Fonts. An IntersectionObserver fallback is included for basic reveal animations if GSAP is unavailable. An internet connection is needed for the GSAP CDN and custom fonts.

## Interactions

- Scroll to reveal the seven rank cards sequentially.
- Abstract shadow ribbons move at different speeds with scroll using GSAP ScrollTrigger.
- Select a rank card to update the detail panel.
- Use left/right arrow keys while focused on a rank card to move between ranks.
- Mobile navigation collapses into a menu.
- Reduced-motion preferences are respected.

## Files

- `index.html` — page structure and inline original SVG emblems
- `styles.css` — visual system, responsive layout, shadows and transitions
- `script.js` — GSAP timelines, ScrollTrigger parallax, rank selection and fallback behavior

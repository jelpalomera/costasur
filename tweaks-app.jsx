// CostaSur — Tweaks app
// Controls: palette (4 curated), heading + body fonts, hero layout, density,
// section accent. Applies via CSS custom properties on :root.

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "palette": ["#f5efe5", "#4ba3a0", "#2f3a3a", "#d8cdb7"],
  "headingFont": "Cormorant Garamond",
  "bodyFont": "Inter",
  "headingScale": 1,
  "showSpanish": true,
  "showImages": true,
  "cardStyle": "framed",
  "altSection": true
}/*EDITMODE-END*/;

const PALETTES = [
  // [bg, accent, fg, line]
  ["#f5efe5", "#4ba3a0", "#2f3a3a", "#d8cdb7"],  // CostaSur teal (brand)
  ["#f6efe4", "#5c6e4d", "#2a2620", "#d9cdb7"],  // sage & cream
  ["#efe9df", "#a88554", "#2b2520", "#d8cdb9"],  // gilded warm
  ["#ecebe6", "#6b7787", "#1f2126", "#cfd1cb"],  // misty stone
  ["#f1e9e4", "#9e6c4f", "#2b1f17", "#dfcfc4"],  // terracotta clay
  ["#1f1c17", "#c9a86a", "#f4eee2", "#3a3429"],  // night ritual
];

const HEADING_FONTS = ["Cormorant Garamond", "Playfair Display", "EB Garamond", "Italiana"];
const BODY_FONTS    = ["Inter", "Manrope", "Outfit"];

function hexLight(hex){
  const h = String(hex).replace('#','');
  const x = h.length === 3 ? h.replace(/./g,c=>c+c) : h.padEnd(6,'0');
  const n = parseInt(x.slice(0,6),16);
  const r=(n>>16)&255,g=(n>>8)&255,b=n&255;
  return r*299 + g*587 + b*114 > 148000;
}

function mix(a, b, p){
  // simple hex blend
  const pa = parseInt(a.replace('#',''),16);
  const pb = parseInt(b.replace('#',''),16);
  const ar=(pa>>16)&255, ag=(pa>>8)&255, ab=pa&255;
  const br=(pb>>16)&255, bg=(pb>>8)&255, bb=pb&255;
  const r = Math.round(ar + (br-ar)*p);
  const g = Math.round(ag + (bg-ag)*p);
  const bl= Math.round(ab + (bb-ab)*p);
  return '#' + [r,g,bl].map(v=>v.toString(16).padStart(2,'0')).join('');
}

function App(){
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  React.useEffect(() => {
    const root = document.documentElement;
    const [bg, accent, fg, line] = t.palette;
    const dark = !hexLight(bg);

    root.style.setProperty('--bg', bg);
    root.style.setProperty('--fg', fg);
    root.style.setProperty('--accent', accent);
    root.style.setProperty('--line', line);
    root.style.setProperty('--bg-soft', dark ? mix(bg,'#ffffff',.06) : mix(bg,'#000000',.04));
    root.style.setProperty('--fg-soft', dark ? mix(fg,bg,.45) : mix(fg,bg,.45));
    root.style.setProperty('--accent-soft', mix(accent, bg, .35));

    root.style.setProperty('--serif', `"${t.headingFont}", Georgia, serif`);
    root.style.setProperty('--sans',  `"${t.bodyFont}", system-ui, sans-serif`);

    // heading scale
    root.style.setProperty('--h-scale', t.headingScale);

    // toggles via body class
    document.body.classList.toggle('hide-es', !t.showSpanish);
    document.body.classList.toggle('hide-img', !t.showImages);
    document.body.classList.toggle('flat-cards', t.cardStyle === 'flat');
    document.body.classList.toggle('bordered-cards', t.cardStyle === 'bordered');
    document.body.classList.toggle('no-alt', !t.altSection);
  }, [t]);

  return (
    <TweaksPanel title="Tweaks">

      <TweakSection label="Palette" />
      <TweakColor
        label="Theme"
        value={t.palette}
        options={PALETTES}
        onChange={(v) => setTweak('palette', v)}
      />

      <TweakSection label="Typography" />
      <TweakSelect
        label="Headings"
        value={t.headingFont}
        options={HEADING_FONTS}
        onChange={(v) => setTweak('headingFont', v)}
      />
      <TweakSelect
        label="Body"
        value={t.bodyFont}
        options={BODY_FONTS}
        onChange={(v) => setTweak('bodyFont', v)}
      />
      <TweakSlider
        label="Heading scale"
        value={t.headingScale}
        min={0.75} max={1.35} step={0.05}
        onChange={(v) => setTweak('headingScale', v)}
      />

      <TweakSection label="Content" />
      <TweakToggle
        label="Spanish (bilingual)"
        value={t.showSpanish}
        onChange={(v) => setTweak('showSpanish', v)}
      />
      <TweakToggle
        label="Images"
        value={t.showImages}
        onChange={(v) => setTweak('showImages', v)}
      />

      <TweakSection label="Layout" />
      <TweakRadio
        label="Cards"
        value={t.cardStyle}
        options={['framed','flat','bordered']}
        onChange={(v) => setTweak('cardStyle', v)}
      />
      <TweakToggle
        label="Alternate section bg"
        value={t.altSection}
        onChange={(v) => setTweak('altSection', v)}
      />

      <TweakSection label="Tip" />
      <div style={{
        fontSize: 11, lineHeight: 1.4, color: 'rgba(41,38,27,.65)',
        padding: '4px 2px'
      }}>
        Click any text in the page to edit it directly. Drag &amp; drop images onto the slots.
      </div>

    </TweaksPanel>
  );
}

// scale + body-class overrides
const styleEl = document.createElement('style');
styleEl.textContent = `
  :root{ --h-scale: 1; }
  .hero h1{ font-size: calc(clamp(56px, 9vw, 132px) * var(--h-scale)); }
  .section-head h2{ font-size: calc(clamp(40px, 5.5vw, 72px) * var(--h-scale)); }
  .footer h3{ font-size: calc(56px * var(--h-scale)); }

  body.hide-es .es{ display: none !important; }
  body.hide-img .hero-image, body.hide-img .section-banner{ display: none !important; }
  body.hide-img .hero-grid{ grid-template-columns: 1fr !important; }

  body.flat-cards .pkg{
    background: transparent !important;
    border: 0 !important;
    border-radius: 0 !important;
  }
  body.flat-cards .pkg:hover{ transform: none; box-shadow: none; }
  body.flat-cards .pkg-body{ padding: 24px 0 0; }

  body.bordered-cards .pkg{
    background: transparent !important;
    border: 1px solid var(--line) !important;
    border-radius: 0 !important;
  }

  body.no-alt .section.alt{ background: transparent !important; }
`;
document.head.appendChild(styleEl);

const root = ReactDOM.createRoot(document.getElementById('tweaks-root'));
root.render(<App />);

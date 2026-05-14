/* CostaSur — hidden admin / editor mode
 * ─────────────────────────────────────────
 * Triggers (any of):
 *   • Triple-click on the topbar logo
 *   • Ctrl+Shift+L  (Windows / Linux)  ·  Cmd+Shift+L (Mac)
 *   • Add #admin to the URL and reload
 *
 * Default password:  costasur2026
 * Change it below in ADMIN_PASSWORD.
 *
 * Once unlocked:
 *   • Every text element is editable in place (click & type).
 *   • Every image-slot accepts drag-drop OR click-to-replace.
 *   • Edits autosave to localStorage on this device.
 *   • Use the Publish panel to download a static HTML file and
 *     generate a QR code for any URL where you host it.
 *
 * Storage keys:
 *   costasur-edits  → { ek-index: innerHTML }   (text edits)
 *   costasur-auth   → "1" if session is unlocked (sessionStorage)
 *   image-slot.js handles its own image sidecar.
 */

(() => {
  const ADMIN_PASSWORD  = 'costasur2026';
  const STORAGE_KEY     = 'costasur-edits';
  const AUTH_KEY        = 'costasur-auth';

  // Selectors of every editable text element, in document order.
  const EDITABLE_SEL = [
    '.eyebrow',
    'h1', 'h1 em',
    '.hero-sub',
    '.hero-meta div',
    '.hero-tag',
    '.section-num',
    'h2', 'h2 em',
    '.section-note',
    '.section-banner .tag',
    '.pkg-name',
    '.pkg-name .es',
    '.pkg-price',
    '.pkg-price .mxn',
    '.pkg-desc',
    '.pkg-desc .es',
    '.pkg-inclusions',
    '.footer h3', '.footer h3 em',
    '.footer .col-label',
    '.footer .col b',
    '.footer .col span',
    '.footer-base span',
    '.topbar-meta span',
  ].join(', ');

  /* ─── persistence ──────────────────────────────────────────── */
  const loadEdits = () => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
    catch { return {}; }
  };
  const saveEdits = (m) => localStorage.setItem(STORAGE_KEY, JSON.stringify(m));

  /* Assign stable index keys to every editable element. Nested
   * matches (e.g. `h1` and `h1 em`) both get unique indices because
   * we walk querySelectorAll which yields each element once. */
  function indexElements(){
    const els = Array.from(document.querySelectorAll(EDITABLE_SEL));
    els.forEach((el, i) => { el.dataset.ek = String(i); });
    return els;
  }

  /* On every page load, rehydrate edits from localStorage. */
  function hydrate(){
    const els = indexElements();
    const edits = loadEdits();
    els.forEach(el => {
      const v = edits[el.dataset.ek];
      if (v != null) el.innerHTML = v;
    });
  }

  /* ─── auth ─────────────────────────────────────────────────── */
  const isAuthed = () => sessionStorage.getItem(AUTH_KEY) === '1';
  const setAuthed = (b) => b
    ? sessionStorage.setItem(AUTH_KEY, '1')
    : sessionStorage.removeItem(AUTH_KEY);

  function promptLogin(){
    if (isAuthed()) { enableEditMode(); return; }
    const overlay = document.createElement('div');
    overlay.className = 'cs-admin-overlay';
    overlay.innerHTML = `
      <div class="cs-admin-modal" role="dialog" aria-label="Admin login">
        <div class="cs-admin-key">CostaSur · Editor</div>
        <h3>Acceso de edición</h3>
        <p>Ingresa la contraseña para editar textos e imágenes.</p>
        <form>
          <input type="password" autocomplete="off" placeholder="••••••••" autofocus />
          <button type="submit">Entrar</button>
        </form>
        <div class="cs-admin-err" hidden>Contraseña incorrecta.</div>
        <button class="cs-admin-close" aria-label="Cerrar">×</button>
      </div>`;
    document.body.appendChild(overlay);

    const input = overlay.querySelector('input');
    const err   = overlay.querySelector('.cs-admin-err');
    const close = () => overlay.remove();

    overlay.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      if (input.value === ADMIN_PASSWORD) {
        setAuthed(true);
        close();
        enableEditMode();
      } else {
        err.hidden = false;
        input.select();
      }
    });
    overlay.querySelector('.cs-admin-close').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  }

  /* ─── edit mode ───────────────────────────────────────────── */
  let editObserver = null;

  function enableEditMode(){
    document.body.classList.add('cs-editing');
    indexElements();

    // Make every editable element contenteditable.
    const els = Array.from(document.querySelectorAll(EDITABLE_SEL));
    els.forEach(el => {
      el.setAttribute('contenteditable', 'plaintext-only');
      el.spellcheck = false;
    });

    // Tell every <image-slot> we're in author-edit mode so its
    // drop-zone overlay activates.
    document.querySelectorAll('image-slot').forEach(s => {
      s.setAttribute('data-editable', '');
    });

    // Autosave on input (debounced).
    let t = null;
    document.addEventListener('input', onEdit, true);
    function onEdit(e){
      const el = e.target.closest('[data-ek]');
      if (!el) return;
      clearTimeout(t);
      t = setTimeout(() => {
        const edits = loadEdits();
        edits[el.dataset.ek] = el.innerHTML;
        saveEdits(edits);
        flashSaved();
      }, 400);
    }
    editObserver = { onEdit };

    mountToolbar();
  }

  function disableEditMode(){
    document.body.classList.remove('cs-editing');
    document.querySelectorAll('[data-ek]').forEach(el => {
      el.removeAttribute('contenteditable');
    });
    document.querySelectorAll('image-slot').forEach(s => {
      s.removeAttribute('data-editable');
    });
    if (editObserver) {
      document.removeEventListener('input', editObserver.onEdit, true);
      editObserver = null;
    }
    const tb = document.getElementById('cs-toolbar');
    if (tb) tb.remove();
  }

  /* ─── toolbar ─────────────────────────────────────────────── */
  function mountToolbar(){
    if (document.getElementById('cs-toolbar')) return;
    const tb = document.createElement('div');
    tb.id = 'cs-toolbar';
    tb.innerHTML = `
      <div class="cs-tb-brand">
        <span class="cs-tb-dot"></span>
        <span>Editor abierto</span>
      </div>
      <div class="cs-tb-help">Haz clic en cualquier texto para editar · Arrastra una imagen sobre cualquier foto para reemplazarla</div>
      <div class="cs-tb-actions">
        <button data-act="reset" class="ghost">Descartar cambios</button>
        <button data-act="publish">Publicar &amp; QR</button>
        <button data-act="exit" class="ghost">Salir</button>
      </div>
      <div class="cs-saved-toast">Guardado</div>`;
    document.body.appendChild(tb);

    tb.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-act]');
      if (!b) return;
      const act = b.dataset.act;
      if (act === 'exit') {
        setAuthed(false);
        disableEditMode();
      } else if (act === 'reset') {
        if (confirm('¿Descartar todos los cambios guardados en este dispositivo? Esto restaura textos e imágenes a la versión original.')) {
          localStorage.removeItem(STORAGE_KEY);
          // Clear image-slot sidecar for our two slots
          Object.keys(localStorage)
            .filter(k => k.startsWith('image-slot:'))
            .forEach(k => localStorage.removeItem(k));
          location.reload();
        }
      } else if (act === 'publish') {
        showPublish();
      }
    });
  }

  let toastT = null;
  function flashSaved(){
    const tb = document.getElementById('cs-toolbar');
    if (!tb) return;
    tb.classList.add('cs-saved');
    clearTimeout(toastT);
    toastT = setTimeout(() => tb.classList.remove('cs-saved'), 900);
  }

  /* ─── publish / QR ────────────────────────────────────────── */
  function showPublish(){
    const overlay = document.createElement('div');
    overlay.className = 'cs-admin-overlay';
    overlay.innerHTML = `
      <div class="cs-admin-modal wide" role="dialog" aria-label="Publicar">
        <div class="cs-admin-key">Publicar · QR</div>
        <h3>Compartir el menú</h3>

        <ol class="cs-pub-steps">
          <li><b>Descarga el archivo</b> con tus cambios incorporados.</li>
          <li><b>Súbelo a un hosting gratuito</b> (Netlify Drop, GitHub Pages, Vercel, o tu propio servidor).</li>
          <li><b>Pega la URL pública abajo</b> y obtén tu código QR para imprimir o compartir.</li>
        </ol>

        <div class="cs-pub-row">
          <button data-pub="download" class="primary">Descargar HTML autocontenido</button>
          <span class="cs-pub-hint">Incluye textos + imágenes en un solo archivo.</span>
        </div>

        <div class="cs-pub-sep"></div>

        <label class="cs-pub-label">URL pública del menú</label>
        <div class="cs-pub-row">
          <input type="url" placeholder="https://tu-sitio.com/menu.html" class="cs-pub-url" />
          <button data-pub="qr" class="primary">Generar QR</button>
        </div>

        <div class="cs-qr-out" hidden>
          <canvas class="cs-qr-canvas"></canvas>
          <div class="cs-qr-meta">
            <div class="cs-qr-url"></div>
            <div class="cs-qr-actions">
              <button data-pub="download-qr" class="ghost">Descargar QR (.png)</button>
              <button data-pub="print-qr" class="ghost">Imprimir QR</button>
            </div>
          </div>
        </div>

        <button class="cs-admin-close" aria-label="Cerrar">×</button>
      </div>`;
    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    overlay.querySelector('.cs-admin-close').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    overlay.addEventListener('click', async (e) => {
      const b = e.target.closest('button[data-pub]');
      if (!b) return;
      const a = b.dataset.pub;
      if (a === 'download')      await downloadStaticHtml();
      else if (a === 'qr')       await renderQR(overlay);
      else if (a === 'download-qr') downloadQR(overlay);
      else if (a === 'print-qr')    printQR(overlay);
    });

    // Restore last URL
    const saved = localStorage.getItem('costasur-public-url');
    if (saved) overlay.querySelector('.cs-pub-url').value = saved;
  }

  /* Build a flattened, self-contained HTML snapshot for download.
   * – Inlines local images as base64 data URLs.
   * – Strips edit-mode chrome and contenteditable attributes.
   * – Bakes current edits into the source so consumers see them.
   */
  async function downloadStaticHtml(){
    // 1. Clone the document.
    const clone = document.documentElement.cloneNode(true);

    // 2. Strip our admin UI + tweaks chrome.
    clone.querySelectorAll('#cs-toolbar, .cs-admin-overlay, #tweaks-root').forEach(n => n.remove());

    // 3. Remove edit attributes from the clone.
    clone.querySelectorAll('[contenteditable]').forEach(n => n.removeAttribute('contenteditable'));
    clone.querySelectorAll('[data-ek]').forEach(n => n.removeAttribute('data-ek'));
    clone.querySelectorAll('[data-editable]').forEach(n => n.removeAttribute('data-editable'));

    // 4. Inline image-slot current values into <img> tags so downstream
    //    viewers see them even without our JS. We replace each <image-slot>
    //    with a plain <img> wrapper.
    document.querySelectorAll('image-slot').forEach((slot, idx) => {
      const cloneSlot = clone.querySelectorAll('image-slot')[idx];
      if (!cloneSlot) return;
      // Read the current displayed image URL (user drop or src= fallback)
      const stored = localStorage.getItem('image-slot:' + slot.id);
      let url = slot.getAttribute('src') || '';
      if (stored) {
        try {
          const v = JSON.parse(stored);
          if (v && v.u) url = v.u;
        } catch {}
      }
      // Keep image-slot wrapper so styling stays identical when the
      // page is reopened with the script loaded. We just update src=.
      cloneSlot.setAttribute('src', url);
    });

    // 5. Inline external <img> assets (logo) as base64.
    const imgs = Array.from(clone.querySelectorAll('img'));
    for (const img of imgs){
      const src = img.getAttribute('src') || '';
      if (!src || src.startsWith('data:') || /^https?:\/\//.test(src)) continue;
      try {
        const dataUrl = await fetchAsDataUrl(src);
        if (dataUrl) img.setAttribute('src', dataUrl);
      } catch {}
    }

    // 6. Same for CSS url() references in style — main one is assets/coral-pattern.png.
    const styleTag = Array.from(clone.querySelectorAll('style'))[0];
    if (styleTag) {
      const urls = new Set();
      const re = /url\(['"]?([^'")]+)['"]?\)/g;
      let m; while ((m = re.exec(styleTag.textContent))) urls.add(m[1]);
      let css = styleTag.textContent;
      for (const u of urls) {
        if (u.startsWith('data:') || /^https?:\/\//.test(u)) continue;
        try {
          const data = await fetchAsDataUrl(u);
          if (data) css = css.split(u).join(data);
        } catch {}
      }
      styleTag.textContent = css;
    }

    // 7. Assemble final HTML.
    const html = '<!doctype html>\n' + clone.outerHTML;

    // 8. Trigger download.
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'costasur-spa-menu.html';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function fetchAsDataUrl(url){
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise(r => {
      const fr = new FileReader();
      fr.onload = () => r(fr.result);
      fr.readAsDataURL(blob);
    });
  }

  /* QR rendering — uses node-qrcode UMD build. */
  async function ensureQRLib(){
    if (window.QRCode && window.QRCode.toCanvas) return;
    await new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js';
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }

  async function renderQR(overlay){
    const input = overlay.querySelector('.cs-pub-url');
    const url = (input.value || '').trim();
    if (!url) { input.focus(); return; }
    localStorage.setItem('costasur-public-url', url);
    try {
      await ensureQRLib();
    } catch {
      alert('No se pudo cargar el generador de QR. Revisa la conexión.');
      return;
    }
    const out = overlay.querySelector('.cs-qr-out');
    const canvas = overlay.querySelector('.cs-qr-canvas');
    const meta   = overlay.querySelector('.cs-qr-url');
    await window.QRCode.toCanvas(canvas, url, {
      width: 320,
      margin: 2,
      color: { dark: '#2f3a3a', light: '#f5efe5' }
    });
    meta.textContent = url;
    out.hidden = false;
  }

  function downloadQR(overlay){
    const canvas = overlay.querySelector('.cs-qr-canvas');
    if (!canvas || canvas.width === 0) return;
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'costasur-qr.png';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  }

  function printQR(overlay){
    const canvas = overlay.querySelector('.cs-qr-canvas');
    const url = overlay.querySelector('.cs-qr-url').textContent;
    if (!canvas || canvas.width === 0) return;
    const dataUrl = canvas.toDataURL('image/png');
    const w = window.open('', '_blank', 'width=600,height=800');
    w.document.write(`<!doctype html><html><head><title>QR · CostaSur Spa</title>
      <style>
        body{ font-family: Georgia, serif; margin: 0; padding: 64px; text-align: center; color: #2f3a3a; background: #f5efe5;}
        h1{ font-family: "Cormorant Garamond", Georgia, serif; font-weight: 400; font-size: 36px; margin: 0 0 8px;}
        p{ font-style: italic; color: #6b7676; margin: 0 0 32px; }
        img{ display: block; margin: 0 auto 24px; max-width: 320px; }
        .url{ font-size: 12px; color: #6b7676; word-break: break-all; }
      </style></head><body>
      <h1>CostaSur Spa</h1>
      <p>Escanea para ver el menú completo</p>
      <img src="${dataUrl}" />
      <div class="url">${url}</div>
      </body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 250);
  }

  /* ─── triggers ────────────────────────────────────────────── */
  function installTriggers(){
    // 1. Triple-click on the logo.
    let clicks = 0, lastT = 0;
    const logo = document.querySelector('.brand img');
    if (logo) {
      logo.addEventListener('click', () => {
        const now = Date.now();
        if (now - lastT > 600) clicks = 0;
        lastT = now;
        clicks += 1;
        if (clicks >= 3) { clicks = 0; promptLogin(); }
      });
    }
    // 2. Keyboard shortcut.
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'L' || e.key === 'l')) {
        e.preventDefault();
        promptLogin();
      }
    });
    // 3. URL hash.
    if (location.hash === '#admin' || location.hash === '#edit') {
      promptLogin();
    }
  }

  /* ─── boot ────────────────────────────────────────────────── */
  function boot(){
    indexElements();
    hydrate();
    installTriggers();
    // If a session is already authed, re-open edit mode automatically.
    if (isAuthed()) enableEditMode();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();

/* CostaSur — hidden editor / publisher
 * ─────────────────────────────────────
 * Triggers (any of):
 *   • Triple-click on the topbar logo
 *   • Ctrl+Shift+L (Win) · Cmd+Shift+L (Mac)
 *   • Append #admin or #edit to the URL
 *
 * Default password: costasur2026   (change ADMIN_PASSWORD below)
 *
 * Once unlocked you can:
 *   • Click any text to type. The inspector lets you change color,
 *     font size, width, and free-position with drag.
 *   • Click any image to free-position / scale it; drag-drop a file
 *     onto it to replace.
 *   • "Publicar & QR" — generate a downloadable HTML and a QR. Also
 *     supports DIRECT commit to a GitHub Pages repo via Personal
 *     Access Token, so a phone seeing the live URL gets your edits.
 *
 * Storage (all on this device):
 *   costasur-edits        text innerHTML, keyed by element index
 *   costasur-styles       per-element { color, fontSize, x, y, width }
 *   costasur-img-styles   per <image-slot> { x, y, scale }
 *   costasur-github       { owner, repo, path, token }
 *   costasur-public-url   last URL pasted into the QR generator
 *   costasur-auth         sessionStorage flag
 */

(() => {
  const ADMIN_PASSWORD  = 'costasur2026';

  const STORAGE_KEY     = 'costasur-edits';
  const STYLES_KEY      = 'costasur-styles';
  const IMG_STYLES_KEY  = 'costasur-img-styles';
  const AUTH_KEY        = 'costasur-auth';
  const GH_KEY          = 'costasur-github';

  /* Selectors of every editable text element, in document order. */
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

  /* ─── tiny store helpers ───────────────────────────────────── */
  const load = (k, fb={}) => { try { return JSON.parse(localStorage.getItem(k) || 'null') || fb; } catch { return fb; } };
  const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));

  /* ─── element index ────────────────────────────────────────── */
  function indexElements(){
    const els = Array.from(document.querySelectorAll(EDITABLE_SEL));
    els.forEach((el, i) => { el.dataset.ek = String(i); });
    return els;
  }

  /* ─── apply persisted text + styles + image styles ─────────── */
  function applyStylesToElement(el, s){
    if (!s) {
      el.style.removeProperty('color');
      el.style.removeProperty('font-size');
      el.style.removeProperty('width');
      el.style.removeProperty('transform');
      return;
    }
    if (s.color)    el.style.color = s.color;     else el.style.removeProperty('color');
    if (s.fontSize) el.style.fontSize = s.fontSize + 'px'; else el.style.removeProperty('font-size');
    if (s.width)    el.style.width = s.width + 'px'; else el.style.removeProperty('width');
    const x = s.x || 0, y = s.y || 0;
    if (x || y) el.style.transform = `translate(${x}px, ${y}px)`;
    else el.style.removeProperty('transform');
  }

  function applyImgStyleToSlot(slot, s){
    if (!s) {
      slot.style.removeProperty('transform');
      slot.style.removeProperty('--cs-scale');
      return;
    }
    const x = s.x || 0, y = s.y || 0, sc = s.scale || 1;
    slot.style.transform = `translate(${x}px, ${y}px) scale(${sc})`;
    slot.style.transformOrigin = 'center';
  }

  function hydrate(){
    const els = indexElements();
    const edits = load(STORAGE_KEY);
    const styles = load(STYLES_KEY);
    els.forEach(el => {
      const v = edits[el.dataset.ek];
      if (v != null) el.innerHTML = v;
      applyStylesToElement(el, styles[el.dataset.ek]);
    });
    const imgStyles = load(IMG_STYLES_KEY);
    document.querySelectorAll('image-slot').forEach(slot => {
      applyImgStyleToSlot(slot, imgStyles[slot.id]);
    });
  }

  /* ─── auth ─────────────────────────────────────────────────── */
  const isAuthed = () => sessionStorage.getItem(AUTH_KEY) === '1';
  const setAuthed = (b) => b ? sessionStorage.setItem(AUTH_KEY, '1') : sessionStorage.removeItem(AUTH_KEY);

  function promptLogin(){
    if (isAuthed()) { enableEditMode(); return; }
    if (document.querySelector('.cs-admin-overlay')) return;
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
      if (input.value === ADMIN_PASSWORD) { setAuthed(true); close(); enableEditMode(); }
      else { err.hidden = false; input.select(); }
    });
    overlay.querySelector('.cs-admin-close').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  }

  /* ─── edit mode ───────────────────────────────────────────── */
  let editing = false;
  let selected = null;
  let inspector = null;
  let onInputHandler, onClickHandler;

  function enableEditMode(){
    if (editing) return;
    editing = true;
    document.body.classList.add('cs-editing');
    indexElements();

    document.querySelectorAll(EDITABLE_SEL).forEach(el => {
      el.setAttribute('contenteditable', 'true');
      el.spellcheck = false;
    });
    document.querySelectorAll('image-slot').forEach(s => s.setAttribute('data-editable', ''));

    // Autosave text edits
    let t;
    onInputHandler = (e) => {
      const el = e.target.closest('[data-ek]');
      if (!el) return;
      clearTimeout(t);
      t = setTimeout(() => {
        const edits = load(STORAGE_KEY);
        edits[el.dataset.ek] = el.innerHTML;
        save(STORAGE_KEY, edits);
        flashSaved();
      }, 400);
    };
    document.addEventListener('input', onInputHandler, true);

    // Click selection — pick element to show inspector
    onClickHandler = (e) => {
      // Skip clicks that originated inside our chrome
      if (e.target.closest('#cs-toolbar, #cs-inspector, .cs-admin-overlay')) return;
      const textEl = e.target.closest(EDITABLE_SEL);
      const slot   = e.target.closest('image-slot');
      if (slot) { selectImage(slot); return; }
      if (textEl) { selectText(textEl); return; }
      clearSelection();
    };
    document.addEventListener('click', onClickHandler, true);

    // Reposition inspector on scroll/resize
    window.addEventListener('scroll', positionInspector, true);
    window.addEventListener('resize', positionInspector);

    // Direct drag-to-move on a selected element (no need to use the
    // inspector grip). Also arrow-key nudging.
    document.addEventListener('pointerdown', onCanvasPointerDown, true);
    document.addEventListener('keydown', onNudgeKey, true);

    mountToolbar();
  }

  function onCanvasPointerDown(e){
    if (!editing || !selected) return;
    // Ignore clicks inside our chrome
    if (e.target.closest('#cs-toolbar, #cs-inspector, .cs-admin-overlay')) return;
    // For text: only direct-drag with Alt held — otherwise we'd hijack typing
    // For images: any pointerdown on the selected slot starts a move
    const isImage = selected.tagName && selected.tagName.toLowerCase() === 'image-slot';
    const inside = isImage
      ? (e.target.closest('image-slot') === selected)
      : (e.altKey && e.target.closest(EDITABLE_SEL) === selected);
    if (!inside) return;
    if (isImage) {
      // For images, don't start drag if the user is initiating a file-drop
      // gesture from outside (handled by image-slot itself via dragenter).
      if (e.pointerType === 'touch' && e.target.closest('[data-reframe]')) return;
    }
    e.preventDefault();
    e.stopPropagation();
    beginDrag(e, isImage ? 'image' : 'text');
  }

  function onNudgeKey(e){
    if (!editing || !selected) return;
    if (!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) return;
    // Only when no editable text element is focused (i.e. user isn't typing).
    if (document.activeElement && document.activeElement.isContentEditable) return;
    e.preventDefault();
    const step = e.shiftKey ? 10 : 1;
    const isImage = selected.tagName && selected.tagName.toLowerCase() === 'image-slot';
    const key = isImage ? IMG_STYLES_KEY : STYLES_KEY;
    const id  = isImage ? selected.id : selected.dataset.ek;
    const styles = load(key);
    const s = styles[id] || {};
    s.x = s.x || 0; s.y = s.y || 0;
    if (e.key === 'ArrowLeft')  s.x -= step;
    if (e.key === 'ArrowRight') s.x += step;
    if (e.key === 'ArrowUp')    s.y -= step;
    if (e.key === 'ArrowDown')  s.y += step;
    styles[id] = s;
    save(key, styles);
    if (isImage) applyImgStyleToSlot(selected, s);
    else         applyStylesToElement(selected, s);
    positionInspector();
    flashSaved();
  }

  function disableEditMode(){
    editing = false;
    document.body.classList.remove('cs-editing');
    document.querySelectorAll('[data-ek]').forEach(el => el.removeAttribute('contenteditable'));
    document.querySelectorAll('image-slot').forEach(s => s.removeAttribute('data-editable'));
    document.removeEventListener('input', onInputHandler, true);
    document.removeEventListener('click', onClickHandler, true);
    document.removeEventListener('pointerdown', onCanvasPointerDown, true);
    document.removeEventListener('keydown', onNudgeKey, true);
    window.removeEventListener('scroll', positionInspector, true);
    window.removeEventListener('resize', positionInspector);
    clearSelection();
    const tb = document.getElementById('cs-toolbar'); if (tb) tb.remove();
  }

  /* ─── selection + inspector ───────────────────────────────── */
  function clearSelection(){
    if (selected) selected.classList.remove('cs-selected');
    selected = null;
    if (inspector) { inspector.remove(); inspector = null; }
  }

  function selectText(el){
    if (selected === el) return;
    clearSelection();
    selected = el;
    el.classList.add('cs-selected');
    mountInspector('text');
  }

  function selectImage(slot){
    if (selected === slot) return;
    clearSelection();
    selected = slot;
    slot.classList.add('cs-selected');
    mountInspector('image');
  }

  const PRESET_COLORS = [
    '#2f3a3a', '#4ba3a0', '#b08a4c', '#9e6c4f', '#6b7787',
    '#5c6e4d', '#a23b3b', '#f5efe5', '#ffffff', '#000000'
  ];

  function mountInspector(kind){
    if (inspector) inspector.remove();
    inspector = document.createElement('div');
    inspector.id = 'cs-inspector';
    inspector.setAttribute('contenteditable', 'false');

    if (kind === 'text') {
      const ek = selected.dataset.ek;
      const styles = load(STYLES_KEY);
      const s = styles[ek] || {};
      const currentSize = Math.round(parseFloat(getComputedStyle(selected).fontSize));
      inspector.innerHTML = `
        <div class="cs-ins-head">
          <span class="cs-ins-grip" title="Mover"></span>
          <span class="cs-ins-title">Texto</span>
          <button class="cs-ins-close" title="Cerrar">×</button>
        </div>
        <div class="cs-ins-row">
          <label>Color</label>
          <div class="cs-color-row">
            ${PRESET_COLORS.map(c => `<button class="cs-swatch${(s.color||'').toLowerCase()===c?' active':''}" data-color="${c}" style="background:${c}"></button>`).join('')}
            <input type="color" class="cs-color-pick" value="${s.color || '#2f3a3a'}" title="Color personalizado" />
          </div>
        </div>
        <div class="cs-ins-row">
          <label>Tamaño</label>
          <div class="cs-step">
            <button data-step="size-" title="−">−</button>
            <span class="cs-val cs-size-val">${s.fontSize || currentSize}px</span>
            <button data-step="size+" title="+">+</button>
            <button class="cs-reset-btn" data-reset="size" title="Reset tamaño">⟲</button>
          </div>
        </div>
        <div class="cs-ins-row">
          <label>Ancho</label>
          <div class="cs-step">
            <button data-step="w-" title="−">−</button>
            <span class="cs-val cs-w-val">${s.width ? s.width + 'px' : 'auto'}</span>
            <button data-step="w+" title="+">+</button>
            <button class="cs-reset-btn" data-reset="width" title="Reset ancho">⟲</button>
          </div>
        </div>
        <div class="cs-ins-foot">
          <span class="cs-ins-hint">Mantén <b>Alt</b> + arrastra el texto para moverlo · o usa las flechas ← ↑ → ↓ (Shift para 10px) · o el ⠿ del inspector</span>
          <button class="cs-ins-reset">Restablecer todo</button>
        </div>`;
    } else {
      const slot = selected;
      const styles = load(IMG_STYLES_KEY);
      const s = styles[slot.id] || {};
      inspector.innerHTML = `
        <div class="cs-ins-head">
          <span class="cs-ins-grip" title="Mover"></span>
          <span class="cs-ins-title">Imagen</span>
          <button class="cs-ins-close" title="Cerrar">×</button>
        </div>
        <div class="cs-ins-row">
          <label>Escala</label>
          <div class="cs-step">
            <button data-step="sc-" title="−">−</button>
            <span class="cs-val cs-sc-val">${Math.round((s.scale || 1) * 100)}%</span>
            <button data-step="sc+" title="+">+</button>
            <button class="cs-reset-btn" data-reset="scale" title="Reset escala">⟲</button>
          </div>
        </div>
        <div class="cs-ins-foot">
          <span class="cs-ins-hint">Arrastra la imagen para moverla · flechas ← ↑ → ↓ para ajustar · doble-clic para recortar · suelta un archivo para reemplazar</span>
          <button class="cs-ins-reset">Restablecer todo</button>
        </div>`;
    }

    document.body.appendChild(inspector);
    wireInspector(kind);
    positionInspector();
  }

  function wireInspector(kind){
    const grip   = inspector.querySelector('.cs-ins-grip');
    const closeB = inspector.querySelector('.cs-ins-close');
    const resetB = inspector.querySelector('.cs-ins-reset');

    closeB.addEventListener('click', clearSelection);
    resetB.addEventListener('click', () => {
      if (!selected) return;
      if (kind === 'text') {
        const ek = selected.dataset.ek;
        const styles = load(STYLES_KEY);
        delete styles[ek];
        save(STYLES_KEY, styles);
        applyStylesToElement(selected, null);
        mountInspector('text');
      } else {
        const styles = load(IMG_STYLES_KEY);
        delete styles[selected.id];
        save(IMG_STYLES_KEY, styles);
        applyImgStyleToSlot(selected, null);
        mountInspector('image');
      }
      flashSaved();
    });

    // Drag from grip to move the selected element
    grip.addEventListener('pointerdown', (e) => { e.stopPropagation(); beginDrag(e, kind); });

    if (kind === 'text') {
      inspector.querySelectorAll('[data-color]').forEach(b => {
        b.addEventListener('click', () => setStyle('color', b.dataset.color));
      });
      inspector.querySelector('.cs-color-pick').addEventListener('input', (e) => {
        setStyle('color', e.target.value);
      });
      inspector.querySelectorAll('[data-step]').forEach(b => {
        b.addEventListener('click', () => onStep(b.dataset.step));
      });
      inspector.querySelectorAll('[data-reset]').forEach(b => {
        b.addEventListener('click', () => onReset(b.dataset.reset));
      });
    } else {
      inspector.querySelectorAll('[data-step]').forEach(b => {
        b.addEventListener('click', () => onImageStep(b.dataset.step));
      });
      inspector.querySelectorAll('[data-reset]').forEach(b => {
        b.addEventListener('click', () => onImageReset(b.dataset.reset));
      });
    }
  }

  /* ── style mutation: text ── */
  function setStyle(key, val){
    if (!selected || !selected.dataset.ek) return;
    const ek = selected.dataset.ek;
    const styles = load(STYLES_KEY);
    const s = styles[ek] || {};
    s[key] = val;
    styles[ek] = s;
    save(STYLES_KEY, styles);
    applyStylesToElement(selected, s);
    // Refresh swatches
    if (key === 'color') {
      inspector.querySelectorAll('.cs-swatch').forEach(sw => {
        sw.classList.toggle('active', (sw.dataset.color||'').toLowerCase() === val.toLowerCase());
      });
    }
    flashSaved();
  }

  function onStep(action){
    if (!selected) return;
    const ek = selected.dataset.ek;
    const styles = load(STYLES_KEY);
    const s = styles[ek] || {};
    if (action.startsWith('size')){
      const cur = s.fontSize || Math.round(parseFloat(getComputedStyle(selected).fontSize));
      const next = action === 'size+' ? cur + 2 : Math.max(8, cur - 2);
      s.fontSize = next;
      inspector.querySelector('.cs-size-val').textContent = next + 'px';
    } else if (action.startsWith('w')){
      const cur = s.width || Math.round(selected.getBoundingClientRect().width);
      const next = action === 'w+' ? cur + 20 : Math.max(60, cur - 20);
      s.width = next;
      inspector.querySelector('.cs-w-val').textContent = next + 'px';
    }
    styles[ek] = s;
    save(STYLES_KEY, styles);
    applyStylesToElement(selected, s);
    positionInspector();
    flashSaved();
  }

  function onReset(key){
    if (!selected) return;
    const ek = selected.dataset.ek;
    const styles = load(STYLES_KEY);
    const s = styles[ek] || {};
    if (key === 'size') delete s.fontSize;
    if (key === 'width') delete s.width;
    styles[ek] = s;
    save(STYLES_KEY, styles);
    applyStylesToElement(selected, s);
    mountInspector('text');
    flashSaved();
  }

  /* ── style mutation: image ── */
  function onImageStep(action){
    if (!selected) return;
    const styles = load(IMG_STYLES_KEY);
    const s = styles[selected.id] || {};
    if (action.startsWith('sc')){
      const cur = s.scale || 1;
      const next = action === 'sc+' ? Math.min(2, cur + 0.1) : Math.max(0.3, cur - 0.1);
      s.scale = parseFloat(next.toFixed(2));
      inspector.querySelector('.cs-sc-val').textContent = Math.round(s.scale * 100) + '%';
    }
    styles[selected.id] = s;
    save(IMG_STYLES_KEY, styles);
    applyImgStyleToSlot(selected, s);
    positionInspector();
    flashSaved();
  }

  function onImageReset(key){
    if (!selected) return;
    const styles = load(IMG_STYLES_KEY);
    const s = styles[selected.id] || {};
    if (key === 'scale') delete s.scale;
    styles[selected.id] = s;
    save(IMG_STYLES_KEY, styles);
    applyImgStyleToSlot(selected, s);
    mountInspector('image');
    flashSaved();
  }

  /* ── drag-to-move (works from inspector grip OR direct on element) ── */
  function beginDrag(e, kind){
    if (!selected) return;
    e.preventDefault();
    const captureTarget = e.currentTarget && e.currentTarget.setPointerCapture
      ? e.currentTarget
      : document.documentElement;
    try { captureTarget.setPointerCapture(e.pointerId); } catch {}

    const isText = kind === 'text';
    const key = isText ? STYLES_KEY : IMG_STYLES_KEY;
    const id  = isText ? selected.dataset.ek : selected.id;
    const styles = load(key);
    const s = styles[id] || {};
    const startX = e.clientX, startY = e.clientY;
    const baseX = s.x || 0, baseY = s.y || 0;

    document.body.classList.add('cs-dragging');

    const move = (ev) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      s.x = Math.round(baseX + dx);
      s.y = Math.round(baseY + dy);
      if (isText) applyStylesToElement(selected, s);
      else        applyImgStyleToSlot(selected, s);
      positionInspector();
    };
    const up = () => {
      styles[id] = s;
      save(key, styles);
      document.removeEventListener('pointermove', move, true);
      document.removeEventListener('pointerup', up, true);
      document.removeEventListener('pointercancel', up, true);
      document.body.classList.remove('cs-dragging');
      flashSaved();
    };
    document.addEventListener('pointermove', move, true);
    document.addEventListener('pointerup', up, true);
    document.addEventListener('pointercancel', up, true);
  }

  function positionInspector(){
    if (!inspector || !selected) return;
    const r = selected.getBoundingClientRect();
    const iw = inspector.offsetWidth || 280;
    const ih = inspector.offsetHeight || 200;
    // Prefer above the element; if no room, below
    let top = r.top - ih - 12;
    if (top < 70) top = r.bottom + 12;
    let left = r.left + r.width / 2 - iw / 2;
    left = Math.max(12, Math.min(window.innerWidth - iw - 12, left));
    inspector.style.top  = (window.scrollY + top) + 'px';
    inspector.style.left = (window.scrollX + left) + 'px';
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
      <div class="cs-tb-help">Haz clic en cualquier texto o imagen para abrir el inspector · cambios guardados solo en este dispositivo hasta que publiques</div>
      <div class="cs-tb-actions">
        <button data-act="reset" class="ghost">Descartar</button>
        <button data-act="publish">Publicar &amp; QR</button>
        <button data-act="exit" class="ghost">Salir</button>
      </div>
      <div class="cs-saved-toast">Guardado</div>`;
    document.body.appendChild(tb);

    tb.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-act]'); if (!b) return;
      const act = b.dataset.act;
      if (act === 'exit') { setAuthed(false); disableEditMode(); }
      else if (act === 'reset') {
        if (confirm('¿Descartar TODOS los cambios guardados en este dispositivo? Restaura textos, estilos e imágenes al original.')) {
          [STORAGE_KEY, STYLES_KEY, IMG_STYLES_KEY].forEach(k => localStorage.removeItem(k));
          Object.keys(localStorage).filter(k => k.startsWith('image-slot:')).forEach(k => localStorage.removeItem(k));
          location.reload();
        }
      }
      else if (act === 'publish') showPublish();
    });
  }

  let toastT;
  function flashSaved(){
    const tb = document.getElementById('cs-toolbar'); if (!tb) return;
    tb.classList.add('cs-saved');
    clearTimeout(toastT);
    toastT = setTimeout(() => tb.classList.remove('cs-saved'), 900);
  }

  /* ─── publish modal ───────────────────────────────────────── */
  function showPublish(){
    const gh = load(GH_KEY, {});
    const url = localStorage.getItem('costasur-public-url') || (gh.owner && gh.repo ? `https://${gh.owner}.github.io/${gh.repo}/` : '');
    const overlay = document.createElement('div');
    overlay.className = 'cs-admin-overlay';
    overlay.innerHTML = `
      <div class="cs-admin-modal wide" role="dialog">
        <div class="cs-admin-key">Publicar · QR</div>
        <h3>Compartir el menú</h3>

        <div class="cs-tab-bar">
          <button class="cs-tab active" data-tab="github">⚡ Publicar a GitHub</button>
          <button class="cs-tab" data-tab="download">Descargar HTML</button>
          <button class="cs-tab" data-tab="qr">QR</button>
        </div>

        <!-- GitHub -->
        <section class="cs-tab-panel" data-panel="github">
          <p>Publica directamente al repo donde está GitHub Pages. Tus cambios aparecerán en el celular ~30 seg después.</p>
          <div class="cs-form">
            <label>Usuario de GitHub</label>
            <input class="cs-gh-owner" placeholder="jelpalomera" value="${gh.owner || ''}" />
            <label>Nombre del repositorio</label>
            <input class="cs-gh-repo" placeholder="costasur" value="${gh.repo || ''}" />
            <label>Ruta del archivo</label>
            <input class="cs-gh-path" placeholder="index.html" value="${gh.path || 'index.html'}" />
            <label>Personal Access Token <a href="https://github.com/settings/tokens/new?description=CostaSur+Editor&scopes=public_repo" target="_blank" rel="noopener">crear uno →</a></label>
            <input class="cs-gh-token" type="password" placeholder="ghp_..." value="${gh.token || ''}" />
            <div class="cs-gh-hint">El token se guarda solo en este navegador. Necesita scope <b>public_repo</b> (o <b>repo</b> si es privado).</div>
          </div>
          <div class="cs-form-row">
            <button data-pub="github-commit" class="primary">↑ Publicar cambios</button>
            <span class="cs-gh-status"></span>
          </div>
        </section>

        <!-- Download -->
        <section class="cs-tab-panel" data-panel="download" hidden>
          <p>Descarga un archivo HTML único con tus textos, imágenes y estilos embebidos. Súbelo a cualquier hosting.</p>
          <button data-pub="download" class="primary">Descargar costasur-spa-menu.html</button>
        </section>

        <!-- QR -->
        <section class="cs-tab-panel" data-panel="qr" hidden>
          <p>Pega la URL pública del menú y genera el QR para imprimir o compartir.</p>
          <div class="cs-form-row">
            <input class="cs-pub-url" type="url" placeholder="https://jelpalomera.github.io/costasur/" value="${url}" />
            <button data-pub="qr" class="primary">Generar QR</button>
          </div>
          <div class="cs-qr-out" hidden>
            <div class="cs-qr-canvas-wrap"></div>
            <div class="cs-qr-meta">
              <div class="cs-qr-url"></div>
              <div class="cs-qr-actions">
                <button data-pub="download-qr" class="ghost">Descargar PNG</button>
                <button data-pub="print-qr" class="ghost">Imprimir</button>
              </div>
            </div>
          </div>
        </section>

        <button class="cs-admin-close" aria-label="Cerrar">×</button>
      </div>`;
    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    overlay.querySelector('.cs-admin-close').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    overlay.querySelectorAll('.cs-tab').forEach(t => {
      t.addEventListener('click', () => {
        overlay.querySelectorAll('.cs-tab').forEach(x => x.classList.toggle('active', x === t));
        overlay.querySelectorAll('.cs-tab-panel').forEach(p => p.hidden = p.dataset.panel !== t.dataset.tab);
      });
    });

    overlay.addEventListener('click', async (e) => {
      const b = e.target.closest('button[data-pub]'); if (!b) return;
      const a = b.dataset.pub;
      if (a === 'download')        await downloadStaticHtml();
      else if (a === 'qr')         await renderQR(overlay);
      else if (a === 'download-qr')      downloadQR(overlay);
      else if (a === 'print-qr')         printQR(overlay);
      else if (a === 'github-commit') await commitToGithub(overlay);
    });
  }

  /* ─── flatten current page to a self-contained HTML ───────── */
  async function buildStaticHtml(){
    const clone = document.documentElement.cloneNode(true);

    // 1. Strip admin chrome from clone
    clone.querySelectorAll('#cs-toolbar, #cs-inspector, .cs-admin-overlay, #tweaks-root').forEach(n => n.remove());

    // 2. Strip edit attributes
    clone.querySelectorAll('[contenteditable]').forEach(n => n.removeAttribute('contenteditable'));
    clone.querySelectorAll('[data-ek]').forEach(n => n.removeAttribute('data-ek'));
    clone.querySelectorAll('[data-editable]').forEach(n => n.removeAttribute('data-editable'));
    clone.querySelectorAll('.cs-selected').forEach(n => n.classList.remove('cs-selected'));

    // 3. Bake image-slot current src into the clone
    const liveSlots = document.querySelectorAll('image-slot');
    const cloneSlots = clone.querySelectorAll('image-slot');
    liveSlots.forEach((live, idx) => {
      const node = cloneSlots[idx]; if (!node) return;
      const stored = localStorage.getItem('image-slot:' + live.id);
      let url = live.getAttribute('src') || '';
      if (stored) { try { const v = JSON.parse(stored); if (v && v.u) url = v.u; } catch {} }
      if (url) node.setAttribute('src', url);
    });

    // 4. Inline external <img> files (logo) as base64
    for (const img of clone.querySelectorAll('img')) {
      const src = img.getAttribute('src') || '';
      if (!src || src.startsWith('data:') || /^https?:\/\//.test(src)) continue;
      try { const data = await fetchAsDataUrl(src); if (data) img.setAttribute('src', data); } catch {}
    }
    // 5. Same for image-slot src= attributes
    for (const node of clone.querySelectorAll('image-slot[src]')) {
      const src = node.getAttribute('src');
      if (!src || src.startsWith('data:') || /^https?:\/\//.test(src)) continue;
      try { const data = await fetchAsDataUrl(src); if (data) node.setAttribute('src', data); } catch {}
    }

    // 6. Inline CSS url() refs in the main <style>
    const styleTag = Array.from(clone.querySelectorAll('style')).find(s => s.textContent.includes('--bg'));
    if (styleTag) {
      const urls = new Set();
      const re = /url\(['"]?([^'")]+)['"]?\)/g;
      let m; while ((m = re.exec(styleTag.textContent))) urls.add(m[1]);
      let css = styleTag.textContent;
      for (const u of urls) {
        if (u.startsWith('data:') || /^https?:\/\//.test(u)) continue;
        try { const data = await fetchAsDataUrl(u); if (data) css = css.split(u).join(data); } catch {}
      }
      styleTag.textContent = css;
    }

    return '<!doctype html>\n' + clone.outerHTML;
  }

  async function downloadStaticHtml(){
    const html = await buildStaticHtml();
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'costasur-spa-menu.html';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function fetchAsDataUrl(url){
    const res = await fetch(url); if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); });
  }

  /* ─── GitHub direct commit ────────────────────────────────── */
  async function commitToGithub(overlay){
    const owner = overlay.querySelector('.cs-gh-owner').value.trim();
    const repo  = overlay.querySelector('.cs-gh-repo').value.trim();
    const path  = (overlay.querySelector('.cs-gh-path').value.trim() || 'index.html').replace(/^\/+/, '');
    const token = overlay.querySelector('.cs-gh-token').value.trim();
    const status = overlay.querySelector('.cs-gh-status');

    if (!owner || !repo || !token) {
      status.textContent = 'Faltan datos: usuario, repo o token.';
      status.className = 'cs-gh-status err';
      return;
    }
    save(GH_KEY, { owner, repo, path, token });
    status.textContent = 'Construyendo archivo…';
    status.className = 'cs-gh-status';

    try {
      const html = await buildStaticHtml();
      const b64 = await stringToBase64(html);

      status.textContent = 'Buscando archivo en GitHub…';
      // 1. Get current SHA (if file exists)
      let sha = null;
      const getRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' }
      });
      if (getRes.ok) {
        const j = await getRes.json();
        sha = j.sha;
      } else if (getRes.status !== 404) {
        const err = await getRes.json().catch(() => ({}));
        throw new Error(err.message || `GitHub respondió ${getRes.status}`);
      }

      status.textContent = 'Publicando…';
      const putRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Update ${path} via CostaSur editor — ${new Date().toLocaleString('es-MX')}`,
          content: b64,
          sha: sha || undefined,
        })
      });
      if (!putRes.ok) {
        const err = await putRes.json().catch(() => ({}));
        throw new Error(err.message || `GitHub respondió ${putRes.status}`);
      }

      const liveUrl = `https://${owner}.github.io/${repo}/`;
      localStorage.setItem('costasur-public-url', liveUrl);
      status.innerHTML = `✓ Publicado. <a href="${liveUrl}" target="_blank" rel="noopener">Ver en vivo</a> (espera ~30 seg).`;
      status.className = 'cs-gh-status ok';
    } catch (e) {
      console.error(e);
      status.textContent = 'Error: ' + e.message;
      status.className = 'cs-gh-status err';
    }
  }

  /* btoa can't handle UTF-8 directly — use TextEncoder */
  async function stringToBase64(str){
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  /* ─── QR generator ────────────────────────────────────────── */
  // Multi-CDN load with a final image-API fallback.
  async function ensureQRLib(){
    if (window.QRCode && window.QRCode.toCanvas) return 'js';
    const cdns = [
      'https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js',
      'https://unpkg.com/qrcode@1.5.3/build/qrcode.min.js',
      'https://cdn.skypack.dev/qrcode@1.5.3',
    ];
    for (const url of cdns) {
      try {
        await loadScript(url, 6000);
        if (window.QRCode && window.QRCode.toCanvas) return 'js';
      } catch (e) { /* try next */ }
    }
    return 'img'; // fall back to api.qrserver.com
  }

  function loadScript(src, timeout=8000){
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src; s.async = true;
      const to = setTimeout(() => { s.remove(); rej(new Error('timeout')); }, timeout);
      s.onload  = () => { clearTimeout(to); res(); };
      s.onerror = () => { clearTimeout(to); rej(new Error('failed: ' + src)); };
      document.head.appendChild(s);
    });
  }

  async function renderQR(overlay){
    const input = overlay.querySelector('.cs-pub-url');
    const url = (input.value || '').trim();
    if (!url) { input.focus(); return; }
    localStorage.setItem('costasur-public-url', url);

    const out  = overlay.querySelector('.cs-qr-out');
    const wrap = overlay.querySelector('.cs-qr-canvas-wrap');
    const meta = overlay.querySelector('.cs-qr-url');
    wrap.innerHTML = '<div class="cs-qr-loading">Generando…</div>';
    out.hidden = false;

    const mode = await ensureQRLib();
    wrap.innerHTML = '';

    if (mode === 'js') {
      const canvas = document.createElement('canvas');
      canvas.className = 'cs-qr-canvas';
      wrap.appendChild(canvas);
      try {
        await window.QRCode.toCanvas(canvas, url, {
          width: 320, margin: 2,
          color: { dark: '#2f3a3a', light: '#f5efe5' }
        });
      } catch (e) {
        // unexpected — fall through to image
        wrap.innerHTML = '';
        renderImgQR(wrap, url);
      }
    } else {
      renderImgQR(wrap, url);
    }
    meta.textContent = url;
  }

  function renderImgQR(wrap, url){
    const apiUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=10&color=2f3a3a&bgcolor=f5efe5&data=' + encodeURIComponent(url);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.className = 'cs-qr-canvas';
    img.alt = 'QR';
    img.src = apiUrl;
    img.dataset.url = url;
    wrap.appendChild(img);
  }

  function downloadQR(overlay){
    const node = overlay.querySelector('.cs-qr-canvas');
    if (!node) return;
    if (node.tagName === 'CANVAS') {
      node.toBlob((blob) => triggerDownload(blob, 'costasur-qr.png'));
    } else {
      // For <img>, fetch and download
      fetch(node.src).then(r => r.blob()).then(blob => triggerDownload(blob, 'costasur-qr.png'));
    }
  }
  function triggerDownload(blob, name){
    const u = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = u; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 1000);
  }
  function printQR(overlay){
    const node = overlay.querySelector('.cs-qr-canvas');
    const url  = overlay.querySelector('.cs-qr-url').textContent;
    if (!node) return;
    let src;
    if (node.tagName === 'CANVAS') src = node.toDataURL('image/png');
    else src = node.src;
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
      <img src="${src}" />
      <div class="url">${url}</div>
      </body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 250);
  }

  /* ─── triggers ────────────────────────────────────────────── */
  function installTriggers(){
    let clicks = 0, lastT = 0;
    const logo = document.querySelector('.brand img');
    if (logo) logo.addEventListener('click', () => {
      const now = Date.now();
      if (now - lastT > 600) clicks = 0;
      lastT = now; clicks += 1;
      if (clicks >= 3) { clicks = 0; promptLogin(); }
    });
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'L' || e.key === 'l')) {
        e.preventDefault(); promptLogin();
      }
    });
    if (location.hash === '#admin' || location.hash === '#edit') promptLogin();
  }

  function boot(){
    indexElements();
    hydrate();
    installTriggers();
    if (isAuthed()) enableEditMode();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

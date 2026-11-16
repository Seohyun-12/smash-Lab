import { WEAPONS } from './weapons.js';

const $ = (selector) => document.querySelector(selector);

export function createUI() {
  let toastTimer;

  function toast(message, persistent = false) {
    $('#toast').textContent = message;
    $('#toast').style.opacity = 1;
    clearTimeout(toastTimer);
    if (!persistent) {
      toastTimer = setTimeout(() => {
        $('#toast').style.opacity = 0.45;
      }, 3500);
    }
  }

  function renderScore(points, percentage) {
    $('#score').textContent = String(points).padStart(5, '0');
    $('#percent').textContent = `${percentage}%`;
    $('#bar').style.width = `${percentage}%`;
  }

  function renderWeapon(kind) {
    document.querySelectorAll('.weapon').forEach((button) => {
      const active = button.dataset.weapon === kind;
      button.classList.toggle('selected', active);
      button.setAttribute('aria-pressed', active);
    });
    $('#weaponHint').textContent = WEAPONS[kind].hint;
  }

  function renderSound(enabled, unavailable = false) {
    $('#sound').textContent = unavailable ? '소리 사용 불가' : `소리 ${enabled ? 'ON' : 'OFF'}`;
    $('#sound').setAttribute('aria-pressed', enabled);
  }

  function renderBuilding(id, percentage) {
    $('#progress' + id).textContent = percentage + '%';
  }
  function renderView(id) {
    document.querySelectorAll('[data-view]').forEach((button) => {
      button.setAttribute('aria-pressed', button.dataset.view === id);
    });
  }
  return { toast, renderScore, renderWeapon, renderSound, renderBuilding, renderView };
}

export function bindControls({
  viewport,
  attack,
  reset,
  selectWeapon,
  toggleSound,
  home,
  zoom,
  orbit,
  focus,
}) {
  document.querySelectorAll('.weapon').forEach((button) => {
    button.onclick = () => selectWeapon(button.dataset.weapon);
  });
  document
    .querySelectorAll('[data-view]')
    .forEach((button) => (button.onclick = () => focus(button.dataset.view)));
  $('#reset').onclick = reset;
  $('#home').onclick = home;
  $('#zoomIn').onclick = () => zoom(-7);
  $('#zoomOut').onclick = () => zoom(7);
  $('#sound').onclick = toggleSound;
  $('#info').onclick = () => $('#details').showModal();

  window.addEventListener('keydown', (event) => {
    if (event.target.closest('button,dialog,input,textarea,select') || event.repeat) return;
    const chosen = Object.entries(WEAPONS).find(([, config]) => config.key === event.key);
    if (chosen) selectWeapon(chosen[0]);
    if (event.key.toLowerCase() === 'r') reset();
  });

  let drag = null;
  viewport.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    drag = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      moved: false,
    };
    viewport.setPointerCapture(event.pointerId);
  });
  viewport.addEventListener('pointermove', (event) => {
    if (!drag || drag.id !== event.pointerId) return;
    if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 6) drag.moved = true;
    if (drag.moved) orbit(event.clientX - drag.lastX, event.clientY - drag.lastY);
    drag.lastX = event.clientX;
    drag.lastY = event.clientY;
  });
  viewport.addEventListener('pointerup', (event) => {
    if (!drag || drag.id !== event.pointerId) return;
    if (!drag.moved) attack(event.clientX, event.clientY);
    drag = null;
  });
  viewport.addEventListener('pointercancel', () => {
    drag = null;
  });
  viewport.addEventListener('lostpointercapture', () => {
    drag = null;
  });
  viewport.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();
      zoom(event.deltaY * 0.045);
    },
    { passive: false },
  );
}

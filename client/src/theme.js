// Tiny theme helper: persists 'dark' | 'light' and applies it to <html data-theme>.
const KEY = 'helppy-theme';

export function getTheme() {
  return localStorage.getItem(KEY) || 'dark';
}

export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(KEY, theme);
}

// Call once on app start.
export function initTheme() {
  applyTheme(getTheme());
}

export type ThemePreference = 'light' | 'dark' | 'system'

const KEY = 'theme'
const media = () => window.matchMedia('(prefers-color-scheme: dark)')

export function getThemePreference(): ThemePreference {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch { /* storage blocked */ }
  return 'system'
}

function apply(pref: ThemePreference) {
  const dark = pref === 'dark' || (pref === 'system' && media().matches)
  document.documentElement.classList.toggle('dark', dark)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0b1020' : '#2563eb')
}

export function setThemePreference(pref: ThemePreference) {
  try { localStorage.setItem(KEY, pref) } catch { /* storage blocked */ }
  apply(pref)
}

/** Applies the saved theme and follows OS changes while set to "system". */
export function initTheme() {
  apply(getThemePreference())
  media().addEventListener('change', () => {
    if (getThemePreference() === 'system') apply('system')
  })
}

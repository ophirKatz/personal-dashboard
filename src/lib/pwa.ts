import { registerSW } from 'virtual:pwa-register'

export function setupPWA() {
  if (!('serviceWorker' in navigator)) return

  // iOS home-screen apps are usually resumed from a suspended process rather
  // than freshly navigated to, so the browser's normal update check never
  // runs. Force a check whenever the app is foregrounded, and reload once a
  // new service worker takes over so the new build is actually shown.
  let reloaded = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) return
    reloaded = true
    window.location.reload()
  })

  registerSW({
    immediate: true,
    onRegisteredSW(_url, registration) {
      if (!registration) return
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') registration.update()
      })
    },
  })
}

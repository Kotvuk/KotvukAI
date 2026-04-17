'use strict'

// NOTE: contextIsolation is false for this window, so this runs in the same
// JS context as the page. We can directly modify navigator and window here.

try {
  const brands = [
    { brand: 'Chromium', version: '130' },
    { brand: 'Google Chrome', version: '130' },
    { brand: 'Not-A.Brand', version: '99' },
  ]
  const uaData = {
    brands,
    mobile: false,
    platform: 'Windows',
    getHighEntropyValues: async () => ({
      architecture: 'x86', bitness: '64', mobile: false, model: '',
      platform: 'Windows', platformVersion: '15.0.0',
      uaFullVersion: '130.0.0.0', wow64: false,
      brands: brands.map(b => ({ brand: b.brand, version: b.version + '.0.0.0' })),
      fullVersionList: brands.map(b => ({ brand: b.brand, version: b.version + '.0.0.0' })),
    }),
    toJSON: () => ({ brands, mobile: false, platform: 'Windows' }),
  }
  // Override on prototype so ALL access to userAgentData returns spoofed data
  Object.defineProperty(Navigator.prototype, 'userAgentData', {
    get: () => uaData,
    configurable: true,
  })
} catch (_) {}

try {
  Object.defineProperty(navigator, 'webdriver', { get: () => false, configurable: true })
} catch (_) {}

// Ensure window.chrome looks like real Chrome (Electron may lack some props)
if (typeof window.chrome === 'undefined' || !window.chrome) {
  window.chrome = {}
}
if (!window.chrome.runtime) {
  window.chrome.runtime = {}
}

// Expose electronAPI to the page (contextIsolation: false → direct assignment works)
window.electronAPI = {
  platform: process.platform,
  isElectron: true,
}

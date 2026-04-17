// Run this once to generate icon files from the SVG
// Usage: node electron/create-icon.js
//
// Requires: npm install -g sharp  OR  npm install sharp
// If sharp not available, manually place:
//   electron/icon.ico  (256x256 Windows icon)
//   electron/icon.png  (512x512 PNG)

const fs = require('fs')
const path = require('path')

const SVG_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="80" fill="#0e0e10"/>
  <rect x="60" y="60" width="392" height="392" rx="50" fill="#161618"/>
  <!-- K -->
  <rect x="110" y="130" width="40" height="252" fill="#ffffff"/>
  <polygon points="150,256 280,130 330,130 200,256 330,382 280,382" fill="#ffffff"/>
  <!-- AI cyan dot -->
  <circle cx="380" cy="150" r="36" fill="#00d4ff"/>
  <!-- AI text -->
  <text x="355" y="163" font-family="Arial Black" font-size="32" font-weight="900" fill="#0e0e10">AI</text>
</svg>`

const svgPath = path.join(__dirname, 'icon.svg')
fs.writeFileSync(svgPath, SVG_ICON)
console.log('SVG written to', svgPath)
console.log('')
console.log('To convert to ICO and PNG, run:')
console.log('  npx sharp-cli --input electron/icon.svg --output electron/icon.png resize 512 512')
console.log('  npx png2icons electron/icon.png electron/icon --ico')
console.log('')
console.log('Or use online tool: https://convertio.co/svg-ico/')
console.log('Place the result as electron/icon.ico (256x256 min)')

const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'node_modules', '@techstark', 'opencv-js', 'dist', 'opencv.js');
const destDir = path.join(__dirname, '..', 'public', 'vendor');
const dest = path.join(destDir, 'opencv.js');

if (!fs.existsSync(src)) {
  console.error('OpenCV source file not found:', src);
  process.exit(1);
}

fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(src, dest);
console.log('Copied OpenCV to', dest);

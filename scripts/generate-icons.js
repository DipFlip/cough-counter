const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const sizes = [192, 512];

async function generateIcons() {
  // Create SVG with emoji
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
      <rect width="512" height="512" rx="100" fill="#111827"/>
      <text x="256" y="360" font-size="300" text-anchor="middle" font-family="Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif">😷</text>
    </svg>
  `;

  for (const size of sizes) {
    const outputPath = path.join(__dirname, '..', 'public', `icon-${size}.png`);

    await sharp(Buffer.from(svg))
      .resize(size, size)
      .png()
      .toFile(outputPath);

    console.log(`Generated ${outputPath}`);
  }
}

generateIcons().catch(console.error);

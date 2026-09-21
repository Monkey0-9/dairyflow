import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';

async function main() {
  const publicDir = path.join(process.cwd(), 'public', 'images');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  const upiString = 'upi://pay?pa=9980592787@ybl&pn=Green%20Valley%20Dairy&cu=INR';
  const outPath = path.join(publicDir, 'upi-qr.png');

  await QRCode.toFile(outPath, upiString, {
    width: 600,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#ffffff'
    }
  });

  console.log('Saved UPI QR Code to', outPath);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

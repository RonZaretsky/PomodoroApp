const { app, BrowserWindow, Tray, nativeImage, ipcMain, Notification, Menu } = require('electron');
const path = require('path');
const zlib = require('zlib');

let tray = null;
let win = null;
let lastBlurTime = 0;

// Pure-Node PNG helpers (no native deps).
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  }
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function pngChunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const len = Buffer.allocUnsafe(4); len.writeUInt32BE(data.length);
  const crcBuf = Buffer.allocUnsafe(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crcBuf]);
}

function buildPNG(size, raw) {
  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([sig, pngChunk('IHDR', ihdr), pngChunk('IDAT', zlib.deflateSync(raw)), pngChunk('IEND', Buffer.alloc(0))]);
}

// Draw a ring with a depleting progress arc.
// Rendered at 2× (44 px) so it looks sharp on Retina displays.
// progress = 1.0 → full ring; 0.0 → empty ring.
function makeProgressPNG(size, progress) {
  const cx = size / 2, cy = size / 2;
  const outerR = size / 2 - 2.5;
  const strokeW = size * 0.12; // ~12% of size
  const innerR  = outerR - strokeW;
  const clampedProgress = Math.max(0, Math.min(1, progress));
  const arcSpan = 2 * Math.PI * clampedProgress;
  const startAngle = -Math.PI / 2; // 12 o'clock

  const raw = Buffer.allocUnsafe(size * (size * 4 + 1));

  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // PNG scanline filter: None
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const i = y * (size * 4 + 1) + 1 + x * 4;
      raw[i] = 0; raw[i + 1] = 0; raw[i + 2] = 0; raw[i + 3] = 0;

      // Anti-aliased ring coverage
      const coverage = Math.min(
        Math.max(0, Math.min(1, dist - innerR + 0.75)),
        Math.max(0, Math.min(1, outerR - dist + 0.75))
      );
      if (coverage <= 0) continue;

      // Faint background track
      raw[i + 3] = Math.round(coverage * 55);

      // Progress arc (clockwise from top)
      if (arcSpan > 0) {
        let rel = Math.atan2(dy, dx) - startAngle;
        if (rel < 0) rel += 2 * Math.PI;
        if (rel <= arcSpan) raw[i + 3] = Math.round(coverage * 255);
      }
    }
  }

  return buildPNG(size, raw);
}

function makeTrayImage(progress) {
  const buf = makeProgressPNG(44, progress); // 44 px @ 2× = 22 pt
  const img = nativeImage.createFromBuffer(buf, { scaleFactor: 2.0 });
  img.setTemplateImage(true);
  return img;
}

function showWindow() {
  const trayBounds = tray.getBounds();
  const [winW, winH] = win.getSize();
  const x = Math.round(trayBounds.x + trayBounds.width / 2 - winW / 2);
  const y = Math.round(trayBounds.y + trayBounds.height + 4);
  win.setPosition(x, y);
  win.show();
  win.focus();
}

app.on('ready', () => {
  if (process.platform === 'darwin') app.dock.hide();

  tray = new Tray(makeTrayImage(1.0));
  tray.setToolTip('Pomodoro Timer');

  win = new BrowserWindow({
    width: 320,
    height: 440,
    show: false,
    frame: false,
    resizable: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      backgroundThrottling: false,
    },
  });

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  tray.on('click', () => {
    // Ignore rapid re-open right after blur (happens when clicking tray while window is focused)
    if (Date.now() - lastBlurTime < 500) return;
    if (win.isVisible()) { win.hide(); } else { showWindow(); }
  });

  tray.on('right-click', () => {
    tray.popUpContextMenu(Menu.buildFromTemplate([{ label: 'Quit Pomodoro', click: () => app.quit() }]));
  });

  win.on('blur', () => {
    lastBlurTime = Date.now();
    win.hide();
  });
});

ipcMain.on('notify', (_, { title, body }) => {
  if (Notification.isSupported()) new Notification({ title, body }).show();
});

ipcMain.on('update-icon', (_, progress) => {
  if (tray) tray.setImage(makeTrayImage(progress));
});

ipcMain.on('update-tooltip', (_, text) => {
  if (tray) tray.setToolTip(text);
});

app.on('window-all-closed', (e) => e.preventDefault());

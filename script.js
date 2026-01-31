let currentLogo = null;
const RESOLUTION = 2048;

// Init
document.addEventListener('DOMContentLoaded', () => {
    loadHistory();

    // Sync initial color labels
    const fgInput = document.getElementById('color-fg');
    const bgInput = document.getElementById('color-bg');

    if (fgInput) updateColorLabel('color-fg-hex', fgInput.value);
    if (bgInput) updateColorLabel('color-bg-hex', bgInput.value);

    // Check share capability
    if (navigator.share) {
        document.getElementById('share-btn')?.classList.remove('hidden');
    }
});

function updateColorLabel(id, val) {
    document.getElementById(id).innerText = val.toUpperCase();
}

// Color Inputs
document.getElementById('color-fg').addEventListener('input', (e) => updateColorLabel('color-fg-hex', e.target.value));
document.getElementById('color-bg').addEventListener('input', (e) => updateColorLabel('color-bg-hex', e.target.value));

window.updateLabel = function (id, val) {
    document.getElementById(id).innerText = val;
}

window.handleLogoUpload = function (input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                currentLogo = img;
                document.getElementById('logo-name').innerText = input.files[0].name;
                document.getElementById('logo-controls').classList.remove('hidden');
                generateQR();
            };
        };
        reader.readAsDataURL(input.files[0]);
    }
}

window.setShape = function (type, shape, btn) {
    // Update hidden input
    document.getElementById(`shape-${type}`).value = shape;

    // Update UI
    const container = document.getElementById(`${type}-shape-selector`);
    container.querySelectorAll('.shape-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    // Regenerate
    generateQR();
}

// Main logic
window.generateQR = async function (save = false) {
    const wrapper = document.getElementById('qr-wrapper');
    const actions = document.getElementById('actions');
    const input = document.getElementById('qr-input');

    const content = input.value.trim();

    if (!content) {
        wrapper.innerHTML = `
            <div class="text-slate-500 text-center">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 mx-auto mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
                <p>Enter content to generate</p>
            </div>
        `;
        actions.classList.add('hidden');
        actions.classList.remove('flex');
        return;
    }

    try {
        // Create Data Matrix
        const rawQR = QRCode.create(content, { errorCorrectionLevel: 'H' });
        const modules = rawQR.modules;
        const moduleCount = modules.size;

        wrapper.innerHTML = "";
        const canvas = document.createElement('canvas');
        canvas.width = RESOLUTION;
        canvas.height = RESOLUTION;
        wrapper.appendChild(canvas);

        const ctx = canvas.getContext('2d');
        const colorDark = document.getElementById('color-fg').value;
        const colorLight = document.getElementById('color-bg').value;

        const outerShape = document.getElementById('shape-outer')?.value || 'square';
        const innerShape = document.getElementById('shape-inner')?.value || 'square';

        // Background
        ctx.fillStyle = colorLight;
        ctx.fillRect(0, 0, RESOLUTION, RESOLUTION);

        // Drawing calculation
        const margin = 4;
        const totalSize = moduleCount + (margin * 2);
        const cellSize = RESOLUTION / totalSize;

        ctx.fillStyle = colorDark;

        // Render Loop
        for (let r = 0; r < moduleCount; r++) {
            for (let c = 0; c < moduleCount; c++) {
                if (modules.get(c, r)) {
                    const x = (c + margin) * cellSize;
                    const y = (r + margin) * cellSize;

                    // Check if it's an Eye
                    const isEye = isFinderPattern(c, r, moduleCount);

                    if (isEye.isEye) {
                        // We will handle eyes separately to draw shapes
                        // To avoid over-drawing, we can track if we've processed this block
                        // But getting granular is pixel-based.

                        // Simplest way: 
                        // If it's the external 7x7 frame (Outer Eye)
                        if (isEye.type === 'outer') {
                            drawShape(ctx, x, y, cellSize, outerShape);
                        }
                        // If it's the internal 3x3 box (Inner Eye)
                        else if (isEye.type === 'inner') {
                            drawShape(ctx, x, y, cellSize, innerShape);
                        }
                        // Default square for the "space" between inner/outer (usually white) - we don't draw dark there anyway
                        // BUT modules.get() returns true for the dark parts only.
                        // The structure of the eye is: 7x7 outer ring (dark), 5x5 middle ring (light), 3x3 inner block (dark).
                        // modules.get() will be TRUE for outer ring and inner block.
                        // So we just need to know if this specific pixel belongs to outer or inner part.
                    } else {
                        // Body
                        drawShape(ctx, x, y, cellSize, 'square'); // Always square for body for now (to be safe)
                    }
                }
            }
        }

        // Draw Logo if exists
        if (currentLogo) {
            drawLogo(ctx, RESOLUTION, colorLight);
        }

        actions.classList.remove('hidden');
        actions.classList.add('flex');

        if (save) {
            saveToHistory(content, content, 'url'); // Default to 'url' type now
        }

    } catch (err) {
        console.error(err);
        if (save) alert("Error generating QR code");
    }
}

// Helper to identify Finder Patterns
// Finder pattern is 7x7
function isFinderPattern(x, y, count) {
    // Top Left
    if (x < 7 && y < 7) {
        return getEyePart(x, y, 0, 0);
    }
    // Top Right
    if (x >= count - 7 && y < 7) {
        return getEyePart(x, y, count - 7, 0);
    }
    // Bottom Left
    if (x < 7 && y >= count - 7) {
        return getEyePart(x, y, 0, count - 7);
    }
    return { isEye: false };
}

function getEyePart(x, y, ox, oy) {
    // Relative coordinates
    const rx = x - ox;
    const ry = y - oy;

    // Inner 3x3 center
    if (rx >= 2 && rx <= 4 && ry >= 2 && ry <= 4) {
        return { isEye: true, type: 'inner' };
    }
    // Outer Border (all other dark pixels in 7x7 are outer)
    return { isEye: true, type: 'outer' };
}

function drawShape(ctx, x, y, size, shape) {
    // Standard adjustment to avoid sub-pixel anti-aliasing gaps
    const s = size + 0.5;

    ctx.beginPath();
    if (shape === 'circle') {
        const cx = x + size / 2;
        const cy = y + size / 2;
        ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
    } else if (shape === 'rounded') {
        // A bit of rounding
        ctx.roundRect(x, y, s, s, size * 0.4);
    } else if (shape === 'leaf') {
        // Top-Left and Bottom-Right rounded
        ctx.roundRect(x, y, s, s, [size * 0.4, 0, size * 0.4, 0]);
    } else if (shape === 'diamond') {
        ctx.moveTo(x + size / 2, y);
        ctx.lineTo(x + size, y + size / 2);
        ctx.lineTo(x + size / 2, y + size);
        ctx.lineTo(x, y + size / 2);
        ctx.closePath();
    } else if (shape === 'hexagon') {
        // Flat topped hexagon
        const r = size / 2;
        const cx = x + r;
        const cy = y + r;
        ctx.moveTo(cx + r * Math.cos(0), cy + r * Math.sin(0));
        for (let i = 1; i <= 6; i++) {
            ctx.lineTo(cx + r * Math.cos(i * 2 * Math.PI / 6), cy + r * Math.sin(i * 2 * Math.PI / 6));
        }
    } else if (shape === 'star') {
        // 5 Point Star
        const cx = x + size / 2;
        const cy = y + size / 2;
        const spikes = 5;
        const outerRadius = size / 2;
        const innerRadius = size / 4;
        let rot = Math.PI / 2 * 3;
        let x1 = cx;
        let y1 = cy;
        const step = Math.PI / spikes;

        ctx.moveTo(cx, cy - outerRadius);
        for (let i = 0; i < spikes; i++) {
            x1 = cx + Math.cos(rot) * outerRadius;
            y1 = cy + Math.sin(rot) * outerRadius;
            ctx.lineTo(x1, y1);
            rot += step;

            x1 = cx + Math.cos(rot) * innerRadius;
            y1 = cy + Math.sin(rot) * innerRadius;
            ctx.lineTo(x1, y1);
            rot += step;
        }
        ctx.lineTo(cx, cy - outerRadius);
        ctx.closePath();
    } else {
        // Square
        ctx.rect(x, y, s, s);
    }
    ctx.fill();
    ctx.closePath();
}


window.setLogoShape = function (shape, btn) {
    document.getElementById('logo-shape').value = shape;
    const container = document.getElementById('logo-shape-selector');
    container.querySelectorAll('.shape-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    generateQR();
}

function drawLogo(ctx, totalSize, bgColor) {
    const sizePercent = parseInt(document.getElementById('logo-size').value) / 100;
    const removeBg = document.getElementById('remove-bg').checked;
    const shape = document.getElementById('logo-shape').value || 'rounded';

    const logoW = totalSize * sizePercent;
    const x = (totalSize - logoW) / 2;
    const y = (totalSize - logoW) / 2;

    // Define Shape Path Helper
    const definePath = () => {
        ctx.beginPath();
        if (shape === 'circle') {
            ctx.arc(x + logoW / 2, y + logoW / 2, logoW / 2, 0, Math.PI * 2);
        } else if (shape === 'rounded') {
            if (ctx.roundRect) ctx.roundRect(x, y, logoW, logoW, logoW * 0.2); // 20% rounding
            else ctx.rect(x, y, logoW, logoW);
        } else {
            ctx.rect(x, y, logoW, logoW);
        }
        ctx.closePath();
    };

    // 1. Draw Background Backing (The "Quiet Zone")
    ctx.fillStyle = bgColor;
    definePath();
    ctx.fill();

    // Prepare Logo Source (Bg Removal if needed)
    let logoSource = currentLogo;
    if (removeBg && currentLogo) {
        const offCanvas = document.createElement('canvas');
        offCanvas.width = currentLogo.width;
        offCanvas.height = currentLogo.height;
        const offCtx = offCanvas.getContext('2d');
        offCtx.drawImage(currentLogo, 0, 0);

        const imageData = offCtx.getImageData(0, 0, offCanvas.width, offCanvas.height);
        const data = imageData.data;
        const bgR = data[0], bgG = data[1], bgB = data[2];
        const tolerance = 45;

        for (let i = 0; i < data.length; i += 4) {
            const diff = Math.sqrt(
                Math.pow(data[i] - bgR, 2) + Math.pow(data[i + 1] - bgG, 2) + Math.pow(data[i + 2] - bgB, 2)
            );
            if (diff < tolerance) data[i + 3] = 0;
        }
        offCtx.putImageData(imageData, 0, 0);
        logoSource = offCanvas;
    }

    // 2. Draw Logo Clipped to Shape
    ctx.save();
    definePath(); // Re-define path for clipping
    ctx.clip();
    ctx.drawImage(logoSource, x, y, logoW, logoW);
    ctx.restore();
}

// Download & Share
window.downloadQR = function () {
    const canvas = document.querySelector('#qr-wrapper canvas');
    if (canvas) {
        const link = document.createElement('a');
        link.download = `qr-pro-${Date.now()}.png`;
        link.href = canvas.toDataURL();
        link.click();
    }
}

window.shareQR = async function () {
    const canvas = document.querySelector('#qr-wrapper canvas');
    if (canvas && navigator.share) {
        canvas.toBlob(async (blob) => {
            const file = new File([blob], 'qr-code.png', { type: 'image/png' });
            try {
                await navigator.share({
                    title: 'QR Code',
                    text: 'Created with Sanish QR Pro',
                    files: [file]
                });
            } catch (err) {
                console.log('Share canceled');
            }
        });
    }
}

// History
function saveToHistory(label, content, type) {
    let history = JSON.parse(localStorage.getItem('qr_history') || '[]');
    if (history.length > 0 && history[0].content === content) return;

    history.unshift({ label, content, type, date: new Date().toLocaleDateString() });
    if (history.length > 10) history.pop();
    localStorage.setItem('qr_history', JSON.stringify(history));
    loadHistory();
}

function loadHistory() {
    const list = document.getElementById('history-list');
    const history = JSON.parse(localStorage.getItem('qr_history') || '[]');

    if (history.length === 0) {
        list.innerHTML = '<p class="text-xs text-slate-500 text-center py-4">No recent QR codes</p>';
        return;
    }

    list.innerHTML = history.map(item => `
        <div class="flex items-center justify-between p-3 rounded-lg bg-slate-800/40 hover:bg-slate-700/50 cursor-pointer border border-transparent hover:border-slate-600 transition-all group" onclick="document.getElementById('qr-input').value = '${item.content}'; generateQR()">
            <div class="flex items-center gap-3 overflow-hidden">
                <div class="w-8 h-8 rounded bg-slate-700/50 flex items-center justify-center text-slate-400">
                     <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                </div>
                <div class="flex flex-col min-w-0">
                    <span class="text-sm text-slate-200 truncate font-medium">${item.label}</span>
                    <span class="text-[10px] text-slate-500">${item.date}</span>
                </div>
            </div>
            <button onclick="event.stopPropagation(); deleteHistoryItem('${item.content}')" class="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
        </div>
    `).join('');
}

window.deleteHistoryItem = function (content) {
    let history = JSON.parse(localStorage.getItem('qr_history') || '[]');
    history = history.filter(h => h.content !== content);
    localStorage.setItem('qr_history', JSON.stringify(history));
    loadHistory();
}

window.clearHistory = function () {
    if (confirm('Clear all history?')) {
        localStorage.removeItem('qr_history');
        loadHistory();
    }
}

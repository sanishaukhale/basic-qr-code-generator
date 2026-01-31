let currentTab = 'url';
let currentLogo = null;

// Init
document.addEventListener('DOMContentLoaded', () => {
    loadHistory();
    
    // Sync initial color labels
    const fgInput = document.getElementById('color-fg');
    const bgInput = document.getElementById('color-bg');

    if(fgInput) updateColorLabel('color-fg-hex', fgInput.value);
    if(bgInput) updateColorLabel('color-bg-hex', bgInput.value);

    // Check share capability
    if (navigator.share) {
        document.getElementById('share-btn')?.classList.remove('hidden');
    }
});

function updateColorLabel(id, val) {
    document.getElementById(id).innerText = val.toUpperCase();
}

// Tabs
window.switchTab = function(tab) {
    currentTab = tab;
    // Update UI
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    // We can't rely on event.target if called programmatically easily without passing it, 
    // so we find the button that calls this. 
    // To keep it simple for the HTML onclicks:
    const clickedBtn = document.querySelector(`button[onclick="switchTab('${tab}')"]`);
    if(clickedBtn) clickedBtn.classList.add('active');
    
    // Hide all forms
    document.getElementById('url-form').classList.add('hidden');
    document.getElementById('email-form').classList.add('hidden');
    document.getElementById('wifi-form').classList.add('hidden');

    // Show selected
    document.getElementById(`${tab}-form`).classList.remove('hidden');
}

// Color Inputs
document.getElementById('color-fg').addEventListener('input', (e) => updateColorLabel('color-fg-hex', e.target.value));
document.getElementById('color-bg').addEventListener('input', (e) => updateColorLabel('color-bg-hex', e.target.value));

window.updateLabel = function(id, val) {
    document.getElementById(id).innerText = val;
}

window.handleLogoUpload = function(input) {
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

window.generateQR = async function(save = false) {
    const wrapper = document.getElementById('qr-wrapper');
    const actions = document.getElementById('actions');
    
    // Gather Content
    let content = "";
    let displayLabel = "";

    if (currentTab === 'url') {
        content = document.getElementById('qr-input').value.trim();
        displayLabel = content;
    } else if (currentTab === 'email') {
        const email = document.getElementById('email-address').value.trim();
        const sub = document.getElementById('email-subject').value.trim();
        const body = document.getElementById('email-body').value.trim();
        if(!email) {
            if(save) alert("Please enter an email address"); 
            return;
        }
        content = `mailto:${email}?subject=${encodeURIComponent(sub)}&body=${encodeURIComponent(body)}`;
        displayLabel = `Email: ${email}`;
    } else if (currentTab === 'wifi') {
        const ssid = document.getElementById('wifi-ssid').value.trim();
        const pass = document.getElementById('wifi-pass').value.trim();
        const type = document.getElementById('wifi-type').value;
        if(!ssid) {
            if(save) alert("SSID is required");
            return;
        }
        content = `WIFI:S:${ssid};T:${type};P:${pass};;`;
        displayLabel = `WiFi: ${ssid}`;
    }

    if (!content) return; // Silent return if empty on auto-generation

    // Clear previous
    wrapper.innerHTML = "";
    
    // Colors
    const colorDark = document.getElementById('color-fg').value;
    const colorLight = document.getElementById('color-bg').value;

    const canvas = document.createElement('canvas');
    wrapper.appendChild(canvas);

    try {
        // High resolution canvas
        const size = 2048; 
        await QRCode.toCanvas(canvas, content, {
            width: size,
            margin: 4,
            color: {
                dark: colorDark,
                light: colorLight
            },
            errorCorrectionLevel: 'H'
        });

        // Draw Logo if exists
        if (currentLogo) {
            const ctx = canvas.getContext('2d');
            // Calculate based on new large size
            const logoSizePercent = parseInt(document.getElementById('logo-size').value) / 100;
            const removeBg = document.getElementById('remove-bg').checked;
            
            const logoW = size * logoSizePercent;
            const x = (size - logoW) / 2;
            const y = (size - logoW) / 2;

            // Clear center for logo
            ctx.fillStyle = colorLight;
            // Slightly larger backing box to avoid artifacts at edges
            const bgSize = logoW; 
            const bgX = (size - bgSize) / 2;
            
            if (ctx.roundRect) ctx.roundRect(bgX, bgX, bgSize, bgSize, 64); // Increased radius for large canvas
            else ctx.fillRect(bgX, bgX, bgSize, bgSize);
            ctx.fill();

            // Draw Logo
            let logoSource = currentLogo;

            if (removeBg) {
                    const offCanvas = document.createElement('canvas');
                    offCanvas.width = currentLogo.width;
                    offCanvas.height = currentLogo.height;
                    const offCtx = offCanvas.getContext('2d');
                    offCtx.drawImage(currentLogo, 0, 0);

                    const imageData = offCtx.getImageData(0, 0, offCanvas.width, offCanvas.height);
                    const data = imageData.data;

                    // Simple chroma key based on top-left pixel
                    const bgR = data[0], bgG = data[1], bgB = data[2];
                    const tolerance = 45;

                    for (let i = 0; i < data.length; i += 4) {
                        const diff = Math.sqrt(
                            Math.pow(data[i] - bgR, 2) +
                            Math.pow(data[i+1] - bgG, 2) +
                            Math.pow(data[i+2] - bgB, 2)
                        );
                        if (diff < tolerance) data[i + 3] = 0;
                    }
                    offCtx.putImageData(imageData, 0, 0);
                    logoSource = offCanvas;
            }
            
            ctx.drawImage(logoSource, x, y, logoW, logoW);
        }

        // Show actions
        actions.classList.remove('hidden');
        actions.classList.add('flex');

        if (save) {
            saveToHistory(displayLabel, content, currentTab);
        }

    } catch (err) {
        console.error(err);
        if(save) alert("Error generating QR code");
    }
}

window.downloadQR = function() {
    const canvas = document.querySelector('#qr-wrapper canvas');
    if (canvas) {
        const link = document.createElement('a');
        link.download = `qr-pro-${Date.now()}.png`;
        link.href = canvas.toDataURL();
        link.click();
    }
}

window.shareQR = async function() {
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

// --- History / LocalStorage ---

function saveToHistory(label, content, type) {
    let history = JSON.parse(localStorage.getItem('qr_history') || '[]');
    // Avoid duplicates at top
    if (history.length > 0 && history[0].content === content) return;

    history.unshift({
        label,
        content,
        type,
        date: new Date().toLocaleDateString()
    });

    if (history.length > 10) history.pop(); // Keep last 10
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
        <div class="flex items-center justify-between p-3 rounded-lg bg-slate-800/40 hover:bg-slate-700/50 cursor-pointer border border-transparent hover:border-slate-600 transition-all group" onclick="restoreFromHistory('${item.content}', '${item.type}')">
            <div class="flex items-center gap-3 overflow-hidden">
                <div class="w-8 h-8 rounded bg-slate-700/50 flex items-center justify-center text-slate-400">
                        ${getIconForType(item.type)}
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

function getIconForType(type) {
    if (type === 'wifi') return '<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" /></svg>';
    if (type === 'email') return '<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>';
    return '<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>';
}

window.restoreFromHistory = function(content, type) {
    switchTab(type);
    
    // To keep simple: We will just set it in the "Link/Text" area if it's complex, OR parsing logic.
    if (type === 'url') {
        document.getElementById('qr-input').value = content;
    } else if (type === 'wifi') {
        const ssid = content.match(/S:(.*?);/)?.[1] || "";
        const pass = content.match(/P:(.*?);/)?.[1] || "";
        document.getElementById('wifi-ssid').value = ssid;
        document.getElementById('wifi-pass').value = pass;
    } else if (type === 'email') {
        const email = content.split('?')[0].replace('mailto:', '');
        document.getElementById('email-address').value = email;
    }
    
    generateQR(false); 
}

window.clearHistory = function() {
    if(confirm('Clear all history?')) {
        localStorage.removeItem('qr_history');
        loadHistory();
    }
}

window.deleteHistoryItem = function(content) {
    let history = JSON.parse(localStorage.getItem('qr_history') || '[]');
    history = history.filter(h => h.content !== content);
    localStorage.setItem('qr_history', JSON.stringify(history));
    loadHistory();
}

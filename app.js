/**
 * PixCut Studio — Frontend Application (Clean Swiss / Notion 2D Design)
 * Features:
 * 1. AI Background Removal with NVIDIA GPU acceleration
 * 2. On-Click BG Erase (Magic Erase Flood-Fill)
 * 3. On-Click BG Restore (Magic Pixel Restore from un-cut original photo)
 * 4. High-contrast dark canvas backdrop for easy artifact & fringe detection
 * 5. 1080p Free Cap vs 4K Ultra-HD Pro (Admin Unlimited Bypass)
 */

const API_BASE = window.API_BASE_URL || (
    window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:8080/api/v1'
        : 'https://bgremoverbackend-anvb.onrender.com/api/v1'
);

// Production AI Engine Endpoint (Render Cloud)
const AI_ENGINE_URL = localStorage.getItem('ai_engine_url') || window.AI_ENGINE_URL || 'https://bgremover-aiengine.onrender.com';
window.setAiEngineUrl = function(url) {
    if (url) {
        localStorage.setItem('ai_engine_url', url.trim());
        console.log('AI Engine URL updated to:', url.trim());
    }
};

// Safely retrieve stored token & user
const rawToken = localStorage.getItem('token');
const rawUser = localStorage.getItem('user');
const safeToken = (rawToken && rawToken !== 'null' && rawToken !== 'undefined' && rawToken.trim() !== '') ? rawToken.trim() : null;
let safeUser = null;
try {
    if (rawUser && rawUser !== 'null' && rawUser !== 'undefined') {
        safeUser = JSON.parse(rawUser);
    }
} catch (e) {
    safeUser = null;
}

// Application State
const state = {
    token: safeToken,
    user: safeUser,
    currentFile: null,
    originalImageUrl: null,
    processedImageUrl: null,
    authMode: 'login', // 'login' or 'register'

    // Studio Editing State
    toolMode: 'erase', // 'erase' or 'restore'
    viewMode: 'canvas', // 'canvas' or 'slider'
    tolerance: 25,
    undoStack: [],
    maxUndoSteps: 30,
    originalCutoutData: null,
    originalImageData: null, // Full original un-cut image pixel buffer
    isMouseDown: false,
    brushRadius: 12
};

// DOM Elements: Navigation & Auth
const navGuest = document.getElementById('nav-guest');
const navAuth = document.getElementById('nav-auth');
const badgeStandardCredits = document.getElementById('badge-standard-credits');
const badgeProCredits = document.getElementById('badge-pro-credits');
const badgeAdminCredits = document.getElementById('badge-admin-credits');
const btnHeaderUpgrade = document.getElementById('btn-header-upgrade');
const navCreditsCount = document.getElementById('nav-credits-count');
const navUserEmail = document.getElementById('nav-user-email');
const navGuestCount = document.getElementById('nav-guest-count');
const badgeGuestCredits = document.getElementById('badge-guest-credits');

const btnNavPricing = document.getElementById('btn-nav-pricing');
const btnOpenLogin = document.getElementById('btn-open-login');
const btnOpenRegister = document.getElementById('btn-open-register');
const btnLogout = document.getElementById('btn-logout');
const btnOpenKeys = document.getElementById('btn-open-keys');

// Upload & Processing Boxes
const uploadBox = document.getElementById('upload-box');
const fileInput = document.getElementById('file-input');
const btnBrowse = document.getElementById('btn-browse');

const processingBox = document.getElementById('processing-box');
const processingTitle = document.getElementById('processing-title');
const processingStatusText = document.getElementById('processing-status-text');

// Result View Elements
const resultBox = document.getElementById('result-box');
const badgeResolutionStatus = document.getElementById('badge-resolution-status');
const bannerFreeCap = document.getElementById('banner-free-cap');
const btnBannerUpgrade = document.getElementById('btn-banner-upgrade');
const btnUploadAnother = document.getElementById('btn-upload-another');
const btnDownloadImage = document.getElementById('btn-download-image');

// Studio Tools (Erase vs Restore)
const btnToolErase = document.getElementById('btn-tool-erase');
const btnToolRestore = document.getElementById('btn-tool-restore');
const labelToolHint = document.getElementById('label-tool-hint');
const btnToggleView = document.getElementById('btn-toggle-view');
const labelViewMode = document.getElementById('label-view-mode');
const magicSwatch = document.getElementById('magic-swatch');
const magicHex = document.getElementById('magic-hex');
const magicToleranceSlider = document.getElementById('magic-tolerance-slider');
const magicToleranceVal = document.getElementById('magic-tolerance-val');
const btnMagicUndo = document.getElementById('btn-magic-undo');
const btnMagicReset = document.getElementById('btn-magic-reset');

// Backdrop Switcher Buttons
const btnBgDark = document.getElementById('btn-bg-dark');
const btnBgGrid = document.getElementById('btn-bg-grid');
const btnBgLight = document.getElementById('btn-bg-light');

// Viewports
const canvasContainerWrap = document.getElementById('canvas-container-wrap');
const magicCanvas = document.getElementById('magic-canvas');
const sliderContainer = document.getElementById('slider-container');
const imgBefore = document.getElementById('img-before');
const imgAfter = document.getElementById('img-after');
const beforeWrap = document.getElementById('before-wrap');
const sliderDivider = document.getElementById('slider-divider');

const imgFileDetails = document.getElementById('img-file-details');
const creditDeductionBadge = document.getElementById('credit-deduction-badge');

// Modals
const modalPricing = document.getElementById('modal-pricing');
const btnClosePricing = document.getElementById('btn-close-pricing');
const btnUpgradePro = document.getElementById('btn-upgrade-pro');
const btnUpgradeBusiness = document.getElementById('btn-upgrade-business');

const modalAuth = document.getElementById('modal-auth');
const btnCloseAuth = document.getElementById('btn-close-auth');
const tabLogin = document.getElementById('tab-login');
const tabRegister = document.getElementById('tab-register');
const formAuth = document.getElementById('form-auth');
const authEmail = document.getElementById('auth-email');
const authPassword = document.getElementById('auth-password');
const registerBonusBadge = document.getElementById('register-bonus-badge');
const btnAuthSubmit = document.getElementById('btn-auth-submit');

const modalKeys = document.getElementById('modal-keys');
const btnCloseKeys = document.getElementById('btn-close-keys');
const formCreateKey = document.getElementById('form-create-key');
const inputKeyName = document.getElementById('input-key-name');
const apiKeysList = document.getElementById('api-keys-list');

// Download Resolution Modal
const modalDownload = document.getElementById('modal-download');
const btnCloseDownload = document.getElementById('btn-close-download');
const btnCancelDownload = document.getElementById('btn-cancel-download');
const btnDl1080 = document.getElementById('btn-dl-1080');
const btnDlOriginal = document.getElementById('btn-dl-original');
const dl1080Dims = document.getElementById('dl-1080-dims');
const dlOriginalDims = document.getElementById('dl-original-dims');
const dlOriginalBadge = document.getElementById('dl-original-badge');
const btnDlOriginalLabel = document.getElementById('btn-dl-original-label');

const toastContainer = document.getElementById('toast-container');

// Canvas 2D context
let magicCtx = null;
let currentLoadedImage = null;

// ==================== THEME MANAGEMENT ====================
function initTheme() {
    const storedTheme = localStorage.getItem('theme');
    const systemPrefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (storedTheme === 'dark' || (!storedTheme && systemPrefersDark)) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
}

function toggleTheme() {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    if (window.lucide) {
        window.lucide.createIcons();
    }
}

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    lucide.createIcons();
    initAuthUI();
    initEventListeners();
    initComparisonSlider();

    if (state.token && state.token !== 'null' && state.token !== 'undefined' && state.token.length > 10) {
        refreshUserProfile();
    }
});

// ==================== AUTHENTICATION UI ====================
function initAuthUI() {
    const hasValidToken = state.token && state.token !== 'null' && state.token !== 'undefined' && state.token.length > 10;
    if (hasValidToken && state.user) {
        navGuest.classList.add('hidden');
        navAuth.classList.remove('hidden');
        if (navUserEmail) {
            navUserEmail.textContent = state.user.email;
        }

        const isAdmin = Boolean(
            state.user.isUnlimited || 
            state.user.role === 'ROLE_ADMIN' ||
            (state.user.email && (state.user.email.toLowerCase() === 'sufi11729@gmail.com' || state.user.email.toLowerCase() === 'sufi111729@gmail.com'))
        );

        const isPro = Boolean(state.user.isPremium || state.user.hasOriginalResolutionAccess || isAdmin);

        if (isAdmin) {
            badgeAdminCredits.classList.remove('hidden');
            badgeStandardCredits.classList.add('hidden');
            badgeProCredits.classList.add('hidden');
            btnHeaderUpgrade.classList.add('hidden');
            if (bannerFreeCap) bannerFreeCap.classList.add('hidden');
        } else if (isPro) {
            badgeProCredits.classList.remove('hidden');
            badgeStandardCredits.classList.add('hidden');
            badgeAdminCredits.classList.add('hidden');
            btnHeaderUpgrade.classList.add('hidden');
            if (bannerFreeCap) bannerFreeCap.classList.add('hidden');
        } else {
            badgeStandardCredits.classList.remove('hidden');
            badgeAdminCredits.classList.add('hidden');
            badgeProCredits.classList.add('hidden');
            btnHeaderUpgrade.classList.remove('hidden');
            if (navCreditsCount) {
                navCreditsCount.textContent = state.user.remainingCredits ?? 0;
            }
        }
    } else {
        navGuest.classList.remove('hidden');
        navAuth.classList.add('hidden');
        updateGuestUI();
    }
    if (window.lucide) {
        window.lucide.createIcons();
    }
}

function getGuestRemaining() {
    return parseInt(localStorage.getItem('guest_remaining') ?? '10', 10);
}

function updateGuestUI() {
    const remaining = getGuestRemaining();
    if (navGuestCount) {
        navGuestCount.textContent = remaining;
    }
}

async function refreshUserProfile() {
    if (!state.token || state.token === 'null' || state.token === 'undefined' || state.token.length < 10) return;
    try {
        const res = await fetch(`${API_BASE}/users/me`, {
            headers: { 'Authorization': `Bearer ${state.token}` }
        });
        if (res.ok) {
            const json = await res.json();
            if (json.data) {
                const u = json.data;
                const isAdmin = Boolean(u.isUnlimited || u.role === 'ROLE_ADMIN' || (u.email && (u.email.toLowerCase() === 'sufi11729@gmail.com' || u.email.toLowerCase() === 'sufi111729@gmail.com')));
                state.user = {
                    id: u.id,
                    email: u.email,
                    remainingCredits: u.remainingCredits,
                    role: u.role,
                    isUnlimited: isAdmin,
                    isPremium: Boolean(u.isPremium || isAdmin)
                };
                localStorage.setItem('user', JSON.stringify(state.user));
                initAuthUI();
            }
        } else if (res.status === 401) {
            handleLogout();
        }
    } catch (e) {
        console.warn('Profile sync:', e);
    }
}

function handleLoginSuccess(authData) {
    if (!authData) return;
    const token = authData.accessToken || authData.token;
    state.token = token;

    const isAdmin = Boolean(
        authData.isUnlimited || 
        authData.role === 'ROLE_ADMIN' || 
        (authData.email && (authData.email.toLowerCase() === 'sufi11729@gmail.com' || authData.email.toLowerCase() === 'sufi111729@gmail.com'))
    );

    state.user = {
        id: authData.userId || authData.id,
        email: authData.email,
        remainingCredits: authData.remainingCredits,
        role: authData.role,
        isUnlimited: isAdmin,
        isPremium: Boolean(authData.isPremium || isAdmin)
    };

    if (token) {
        localStorage.setItem('token', token);
    }
    if (state.user) {
        localStorage.setItem('user', JSON.stringify(state.user));
    }

    initAuthUI();
    closeModal(modalAuth);
    showToast(`Signed in as ${state.user.email}`, 'success');
}

function handleLogout() {
    state.token = null;
    state.user = null;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    initAuthUI();
    resetToUploadState();
    showToast('Signed out successfully.', 'info');
}

// ==================== EVENT LISTENERS ====================
function initEventListeners() {
    // Theme Toggle
    const btnThemeToggle = document.getElementById('btn-theme-toggle');
    btnThemeToggle?.addEventListener('click', toggleTheme);

    // Navigation & Modals
    btnNavPricing?.addEventListener('click', () => openModal(modalPricing));
    btnClosePricing?.addEventListener('click', () => closeModal(modalPricing));
    btnHeaderUpgrade?.addEventListener('click', () => openModal(modalPricing));
    btnBannerUpgrade?.addEventListener('click', () => openModal(modalPricing));

    btnUpgradePro?.addEventListener('click', () => executeUpgradeToPro());
    btnUpgradeBusiness?.addEventListener('click', () => {
        showToast('Contact us at api@pixcut.io for enterprise volume.', 'info');
    });

    btnOpenLogin?.addEventListener('click', () => openAuthModal('login'));
    btnOpenRegister?.addEventListener('click', () => openAuthModal('register'));
    btnCloseAuth?.addEventListener('click', () => closeModal(modalAuth));
    modalAuth?.addEventListener('click', (e) => {
        if (e.target === modalAuth) closeModal(modalAuth);
    });

    tabLogin?.addEventListener('click', () => switchAuthTab('login'));
    tabRegister?.addEventListener('click', () => switchAuthTab('register'));

    formAuth?.addEventListener('submit', handleAuthSubmit);
    btnLogout?.addEventListener('click', handleLogout);

    // API Keys Modal
    btnOpenKeys?.addEventListener('click', () => {
        openModal(modalKeys);
        loadApiKeys();
    });
    btnCloseKeys?.addEventListener('click', () => closeModal(modalKeys));
    modalKeys?.addEventListener('click', (e) => {
        if (e.target === modalKeys) closeModal(modalKeys);
    });
    formCreateKey?.addEventListener('submit', handleCreateApiKey);

    // Upload & Drag-and-Drop
    btnBrowse?.addEventListener('click', (e) => {
        e.stopPropagation();
        fileInput.click();
    });
    uploadBox?.addEventListener('click', () => fileInput.click());

    fileInput?.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleSelectedFile(e.target.files[0]);
        }
    });

    uploadBox?.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadBox.classList.add('dropzone-active');
    });

    uploadBox?.addEventListener('dragleave', () => {
        uploadBox.classList.remove('dropzone-active');
    });

    uploadBox?.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadBox.classList.remove('dropzone-active');
        if (e.dataTransfer.files.length > 0) {
            handleSelectedFile(e.dataTransfer.files[0]);
        }
    });

    // Clipboard Paste Listener (Ctrl+V anywhere on page)
    window.addEventListener('paste', (e) => {
        if (!e.clipboardData || !e.clipboardData.items) return;
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const blob = items[i].getAsFile();
                if (blob) {
                    showToast('Image pasted from clipboard!', 'info');
                    handleSelectedFile(blob);
                    break;
                }
            }
        }
    });

    // Sample Image Buttons
    document.querySelectorAll('.btn-sample').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const sampleType = btn.dataset.sample || 'sneaker';
            loadSampleImage(sampleType);
        });
    });

    // Tool Switcher: Erase vs Restore
    btnToolErase?.addEventListener('click', () => switchToolMode('erase'));
    btnToolRestore?.addEventListener('click', () => switchToolMode('restore'));

    // View mode toggle
    btnToggleView?.addEventListener('click', toggleViewMode);

    // Tolerance slider
    magicToleranceSlider?.addEventListener('input', (e) => {
        state.tolerance = parseInt(e.target.value, 10);
        magicToleranceVal.textContent = `${state.tolerance}%`;
    });

    // Backdrop Switcher Buttons
    btnBgDark?.addEventListener('click', () => setCanvasBackdrop('dark'));
    btnBgGrid?.addEventListener('click', () => setCanvasBackdrop('grid'));
    btnBgLight?.addEventListener('click', () => setCanvasBackdrop('light'));

    // Undo / Reset
    btnMagicUndo?.addEventListener('click', undoAction);
    btnMagicReset?.addEventListener('click', resetToCutout);

    // Canvas Events (Click & Drag)
    magicCanvas?.addEventListener('mousedown', handleCanvasMouseDown);
    magicCanvas?.addEventListener('mousemove', handleCanvasMouseMove);
    window.addEventListener('mouseup', handleCanvasMouseUp);

    // Download Resolution Modal Listeners
    btnCloseDownload?.addEventListener('click', () => closeModal(modalDownload));
    btnCancelDownload?.addEventListener('click', () => closeModal(modalDownload));
    modalDownload?.addEventListener('click', (e) => {
        if (e.target === modalDownload) closeModal(modalDownload);
    });
    btnDl1080?.addEventListener('click', executeDownload1080p);
    btnDlOriginal?.addEventListener('click', executeDownloadOriginal);

    // Download & Reset
    btnDownloadImage?.addEventListener('click', openDownloadModal);
    btnUploadAnother?.addEventListener('click', resetToUploadState);

    // Keyboard Shortcuts (Ctrl+Z)
    window.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
            if (!resultBox.classList.contains('hidden') && state.undoStack.length > 0) {
                e.preventDefault();
                undoAction();
            }
        }
    });
}

// ==================== STUDIO TOOL SWITCHING ====================
function switchToolMode(mode) {
    state.toolMode = mode;

    if (mode === 'erase') {
        btnToolErase.className = 'py-1 px-3 rounded-md transition-all duration-150 bg-indigo-600 text-white shadow-xs flex items-center gap-1.5 font-medium';
        btnToolRestore.className = 'py-1 px-3 rounded-md transition-all duration-150 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center gap-1.5 font-medium';
        labelToolHint.innerHTML = '<strong class="text-slate-900 dark:text-slate-200">Erase Mode:</strong> Click any leftover background or unwanted color to erase it to transparent.';
        magicCanvas.classList.add('cursor-crosshair');
    } else {
        btnToolRestore.className = 'py-1 px-3 rounded-md transition-all duration-150 bg-indigo-600 text-white shadow-xs flex items-center gap-1.5 font-medium';
        btnToolErase.className = 'py-1 px-3 rounded-md transition-all duration-150 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center gap-1.5 font-medium';
        labelToolHint.innerHTML = '<strong class="text-slate-900 dark:text-slate-200">Restore Mode:</strong> Click any erased area or subject edge to restore original pixels from your photo.';
        magicCanvas.classList.add('cursor-crosshair');
    }

    if (window.lucide) lucide.createIcons();
}

// ==================== BACKDROP SWITCHER ====================
function setCanvasBackdrop(type) {
    canvasContainerWrap.className = 'relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 flex justify-center items-center max-h-[580px] min-h-[380px] transition-colors duration-150';

    btnBgDark.className = 'px-2 py-0.5 rounded text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white';
    btnBgGrid.className = 'px-2 py-0.5 rounded text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white';
    btnBgLight.className = 'px-2 py-0.5 rounded text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white';

    if (type === 'dark') {
        canvasContainerWrap.classList.add('checkerboard-dark');
        btnBgDark.className = 'px-2 py-0.5 rounded bg-slate-900 text-white font-medium shadow-xs';
    } else if (type === 'grid') {
        canvasContainerWrap.classList.add('checkerboard-light');
        btnBgGrid.className = 'px-2 py-0.5 rounded bg-slate-900 text-white font-medium shadow-xs';
    } else if (type === 'light') {
        canvasContainerWrap.classList.add('canvas-bg-light');
        btnBgLight.className = 'px-2 py-0.5 rounded bg-slate-900 text-white font-medium shadow-xs';
    }
}

// ==================== SAMPLE IMAGE GENERATOR ====================
function loadSampleImage(sampleType) {
    const width = 800;
    const height = 600;

    // Create Offscreen Original (with background)
    const canvasOrig = document.createElement('canvas');
    canvasOrig.width = width;
    canvasOrig.height = height;
    const ctxOrig = canvasOrig.getContext('2d');

    // Create Offscreen Cutout (transparent background)
    const canvasCutout = document.createElement('canvas');
    canvasCutout.width = width;
    canvasCutout.height = height;
    const ctxCutout = canvasCutout.getContext('2d');

    if (sampleType === 'sneaker') {
        // Background: Soft gradient studio backdrop
        const grad = ctxOrig.createLinearGradient(0, 0, width, height);
        grad.addColorStop(0, '#fde047');
        grad.addColorStop(1, '#f97316');
        ctxOrig.fillStyle = grad;
        ctxOrig.fillRect(0, 0, width, height);

        // Draw Sneaker Object on both
        [ctxOrig, ctxCutout].forEach(ctx => {
            // Sole
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.ellipse(400, 380, 220, 45, 0, 0, Math.PI * 2);
            ctx.fill();

            // Sole rubber bottom
            ctx.fillStyle = '#0f172a';
            ctx.beginPath();
            ctx.ellipse(400, 400, 210, 25, 0, 0, Math.PI * 2);
            ctx.fill();

            // Sneaker Body
            ctx.fillStyle = '#4f46e5';
            ctx.beginPath();
            ctx.moveTo(220, 380);
            ctx.lineTo(260, 260);
            ctx.quadraticCurveTo(340, 240, 420, 280);
            ctx.quadraticCurveTo(520, 310, 600, 370);
            ctx.lineTo(220, 380);
            ctx.closePath();
            ctx.fill();

            // Swoosh / Stripe
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 14;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(280, 320);
            ctx.quadraticCurveTo(380, 360, 500, 310);
            ctx.stroke();

            // Laces
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 5;
            for (let i = 0; i < 4; i++) {
                ctx.beginPath();
                ctx.moveTo(330 + i * 25, 260 + i * 10);
                ctx.lineTo(350 + i * 25, 290 + i * 10);
                ctx.stroke();
            }
        });
    } else if (sampleType === 'portrait') {
        // Background: Warm Teal / Slate Studio
        const grad = ctxOrig.createRadialGradient(400, 300, 50, 400, 300, 400);
        grad.addColorStop(0, '#0284c7');
        grad.addColorStop(1, '#0f172a');
        ctxOrig.fillStyle = grad;
        ctxOrig.fillRect(0, 0, width, height);

        [ctxOrig, ctxCutout].forEach(ctx => {
            // Shoulders & Torso
            ctx.fillStyle = '#e2e8f0';
            ctx.beginPath();
            ctx.ellipse(400, 560, 220, 140, 0, 0, Math.PI * 2);
            ctx.fill();

            // Neck
            ctx.fillStyle = '#fbcfe8';
            ctx.fillRect(360, 340, 80, 100);

            // Head / Face
            ctx.fillStyle = '#fbcfe8';
            ctx.beginPath();
            ctx.ellipse(400, 270, 95, 125, 0, 0, Math.PI * 2);
            ctx.fill();

            // Hair (Fine silhouette)
            ctx.fillStyle = '#1e1b4b';
            ctx.beginPath();
            ctx.ellipse(400, 200, 115, 80, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillRect(285, 200, 40, 160);
            ctx.fillRect(475, 200, 40, 160);

            // Glasses
            ctx.strokeStyle = '#6366f1';
            ctx.lineWidth = 6;
            ctx.strokeRect(330, 250, 50, 35);
            ctx.strokeRect(420, 250, 50, 35);
            ctx.beginPath();
            ctx.moveTo(380, 265);
            ctx.lineTo(420, 265);
            ctx.stroke();
        });
    } else if (sampleType === 'cat') {
        // Background: Lush outdoor garden grass
        const grad = ctxOrig.createLinearGradient(0, 0, 0, height);
        grad.addColorStop(0, '#86efac');
        grad.addColorStop(1, '#15803d');
        ctxOrig.fillStyle = grad;
        ctxOrig.fillRect(0, 0, width, height);

        [ctxOrig, ctxCutout].forEach(ctx => {
            // Cat Body
            ctx.fillStyle = '#f97316';
            ctx.beginPath();
            ctx.ellipse(400, 420, 140, 110, 0, 0, Math.PI * 2);
            ctx.fill();

            // Cat Head
            ctx.beginPath();
            ctx.ellipse(400, 280, 100, 85, 0, 0, Math.PI * 2);
            ctx.fill();

            // Left Ear
            ctx.beginPath();
            ctx.moveTo(320, 240);
            ctx.lineTo(310, 160);
            ctx.lineTo(370, 210);
            ctx.closePath();
            ctx.fill();

            // Right Ear
            ctx.beginPath();
            ctx.moveTo(480, 240);
            ctx.lineTo(490, 160);
            ctx.lineTo(430, 210);
            ctx.closePath();
            ctx.fill();

            // Whiskers
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(350, 300); ctx.lineTo(260, 290);
            ctx.moveTo(350, 310); ctx.lineTo(250, 320);
            ctx.moveTo(450, 300); ctx.lineTo(540, 290);
            ctx.moveTo(450, 310); ctx.lineTo(550, 320);
            ctx.stroke();

            // Eyes
            ctx.fillStyle = '#fef08a';
            ctx.beginPath();
            ctx.ellipse(360, 275, 14, 20, 0, 0, Math.PI * 2);
            ctx.ellipse(440, 275, 14, 20, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#0f172a';
            ctx.beginPath();
            ctx.ellipse(360, 275, 6, 18, 0, 0, Math.PI * 2);
            ctx.ellipse(440, 275, 6, 18, 0, 0, Math.PI * 2);
            ctx.fill();
        });
    } else { // car
        // Background: City sunset street
        const grad = ctxOrig.createLinearGradient(0, 0, 0, height);
        grad.addColorStop(0, '#f43f5e');
        grad.addColorStop(0.6, '#38bdf8');
        grad.addColorStop(1, '#334155');
        ctxOrig.fillStyle = grad;
        ctxOrig.fillRect(0, 0, width, height);

        [ctxOrig, ctxCutout].forEach(ctx => {
            // Car Body
            ctx.fillStyle = '#e11d48';
            ctx.beginPath();
            ctx.moveTo(180, 380);
            ctx.quadraticCurveTo(240, 310, 360, 290);
            ctx.lineTo(520, 290);
            ctx.quadraticCurveTo(620, 320, 680, 380);
            ctx.lineTo(180, 380);
            ctx.closePath();
            ctx.fill();

            // Roof / Cabin
            ctx.fillStyle = '#0f172a';
            ctx.beginPath();
            ctx.moveTo(320, 290);
            ctx.lineTo(380, 220);
            ctx.lineTo(500, 220);
            ctx.lineTo(550, 290);
            ctx.closePath();
            ctx.fill();

            // Wheels
            ctx.fillStyle = '#18181b';
            ctx.beginPath();
            ctx.arc(280, 380, 45, 0, Math.PI * 2);
            ctx.arc(580, 380, 45, 0, Math.PI * 2);
            ctx.fill();

            // Rim
            ctx.fillStyle = '#cbd5e1';
            ctx.beginPath();
            ctx.arc(280, 380, 25, 0, Math.PI * 2);
            ctx.arc(580, 380, 25, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    const beforeUrl = canvasOrig.toDataURL('image/jpeg', 0.95);
    const afterUrl = canvasCutout.toDataURL('image/png');

    state.originalImageUrl = beforeUrl;
    state.processedImageUrl = afterUrl;
    state.currentFile = { name: `sample_${sampleType}.png` };

    uploadBox.classList.add('hidden');
    initializeResultView(beforeUrl, afterUrl, '0.42', `Sample ${sampleType.toUpperCase()}`, false, `${width}x${height}`, 'PREMIUM');
    showToast(`Loaded sample ${sampleType}! Click anywhere on canvas to Erase or Restore.`, 'success');
}

// ==================== AUTHENTICATION FLOW ====================
function openAuthModal(mode) {
    state.authMode = mode;
    switchAuthTab(mode);
    openModal(modalAuth);
}

function switchAuthTab(mode) {
    state.authMode = mode;
    if (mode === 'login') {
        tabLogin.className = 'text-xs font-semibold text-zinc-900 border-b-2 border-zinc-900 pb-1';
        tabRegister.className = 'text-xs font-semibold text-zinc-400 hover:text-zinc-900 pb-1';
        registerBonusBadge.classList.add('hidden');
        btnAuthSubmit.querySelector('span').textContent = 'Log In';
    } else {
        tabRegister.className = 'text-xs font-semibold text-zinc-900 border-b-2 border-zinc-900 pb-1';
        tabLogin.className = 'text-xs font-semibold text-zinc-400 hover:text-zinc-900 pb-1';
        registerBonusBadge.classList.remove('hidden');
        btnAuthSubmit.querySelector('span').textContent = 'Sign Up (50 Free Credits)';
    }
}

async function handleAuthSubmit(e) {
    e.preventDefault();
    const email = authEmail.value.trim();
    const password = authPassword.value;

    const endpoint = state.authMode === 'register' ? '/auth/register' : '/auth/login';
    btnAuthSubmit.disabled = true;
    btnAuthSubmit.querySelector('span').textContent = 'Processing...';

    try {
        const res = await fetch(`${API_BASE}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await res.json();
        if (res.ok) {
            handleLoginSuccess(data.data);
            formAuth.reset();
        } else {
            showToast(data.message || 'Authentication failed.', 'error');
        }
    } catch (err) {
        showToast('Unable to connect to gateway.', 'error');
    } finally {
        btnAuthSubmit.disabled = false;
        btnAuthSubmit.querySelector('span').textContent = state.authMode === 'register' ? 'Sign Up (50 Free Credits)' : 'Log In';
    }
}

// ==================== FILE HANDLING & AI PROCESSING ====================
function handleSelectedFile(file) {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
        showToast('Please upload a valid JPEG, PNG, or WEBP image.', 'error');
        return;
    }

    if (file.size > 25 * 1024 * 1024) {
        showToast('File size exceeds the 25MB limit.', 'error');
        return;
    }

    // Guest users get 10 free removals without logging in!
    if (!state.token) {
        const remaining = getGuestRemaining();
        if (remaining <= 0) {
            showToast('You have used all 10 free guest removals. Please sign up to get 50 more credits!', 'info');
            openAuthModal('register');
            return;
        }
    }

    state.currentFile = file;
    state.originalImageUrl = URL.createObjectURL(file);

    executeAiBackgroundRemoval(file);
}

async function executeAiBackgroundRemoval(file) {
    uploadBox.classList.add('hidden');
    resultBox.classList.add('hidden');
    processingBox.classList.remove('hidden');

    processingTitle.textContent = 'Removing Background...';
    processingStatusText.textContent = 'Detecting foreground subjects with NVIDIA GPU acceleration...';

    const startTime = performance.now();

    try {
        const formData = new FormData();
        formData.append('file', file);

        const headers = {};
        if (state.token && state.token !== 'null' && state.token !== 'undefined' && state.token.length > 10) {
            headers['Authorization'] = `Bearer ${state.token}`;
        }

        let res;
        try {
            res = await fetch(`${API_BASE}/remove-bg`, {
                method: 'POST',
                headers: headers,
                body: formData
            });

            // If backend gateway returns 500 or 503, fallback directly to Cloudflare AI Tunnel
            if (!res.ok && res.status >= 500) {
                console.warn(`Gateway returned ${res.status}. Falling back to Cloudflare AI Engine at ${AI_ENGINE_URL}...`);
                formData.append('is_premium', String(Boolean(state.user && (state.user.isPremium || state.user.role === 'ROLE_ADMIN'))));
                res = await fetch(`${AI_ENGINE_URL}/api/v1/remove-bg`, {
                    method: 'POST',
                    body: formData
                });
            }
        } catch (fetchErr) {
            console.warn(`Gateway connection error (${fetchErr.message}). Falling back to Cloudflare AI Engine at ${AI_ENGINE_URL}...`);
            formData.append('is_premium', String(Boolean(state.user && (state.user.isPremium || state.user.role === 'ROLE_ADMIN'))));
            res = await fetch(`${AI_ENGINE_URL}/api/v1/remove-bg`, {
                method: 'POST',
                body: formData
            });
        }

        if (res.ok) {
            const blob = await res.blob();
            state.processedImageUrl = URL.createObjectURL(blob);
            const durationSec = ((performance.now() - startTime) / 1000).toFixed(2);

            const isDownscaled = res.headers.get('X-Is-Downscaled') === 'true';
            const resolution = res.headers.get('X-Resolution') || '1080p';
            const tier = res.headers.get('X-Tier') || 'FREE';

            // Handle guest counter
            if (!state.token) {
                const guestHdr = res.headers.get('X-Guest-Remaining');
                let remaining;
                if (guestHdr !== null) {
                    remaining = parseInt(guestHdr, 10);
                } else {
                    remaining = Math.max(0, getGuestRemaining() - 1);
                }
                localStorage.setItem('guest_remaining', remaining);
                updateGuestUI();
                showToast(`Background removed! (${remaining}/10 guest removals left)`, 'success');
            } else {
                showToast('Background removed. Use Erase / Restore to perfect your cutout.', 'success');
            }

            updateCreditsAfterSuccess();
            initializeResultView(state.originalImageUrl, state.processedImageUrl, durationSec, 'Background Cutout', isDownscaled, resolution, tier);
        } else if (res.status === 402 || res.status === 401) {
            if (!state.token) {
                localStorage.setItem('guest_remaining', '0');
                updateGuestUI();
                showToast('You have used all 10 free guest removals. Please create an account to get 50 more credits!', 'info');
                openAuthModal('register');
            } else {
                showToast('Insufficient credits. Please upgrade your account.', 'error');
            }
            resetToUploadState();
        } else {
            const errorJson = await res.json().catch(() => null);
            showToast(errorJson?.message || 'Processing failed.', 'error');
            resetToUploadState();
        }
    } catch (err) {
        console.error(err);
        showToast('Error connecting to background removal service.', 'error');
        resetToUploadState();
    }
}

function updateCreditsAfterSuccess() {
    if (!state.token) {
        const remaining = getGuestRemaining();
        creditDeductionBadge.innerHTML = `
            <i data-lucide="check" class="w-3.5 h-3.5 text-zinc-900"></i>
            <span class="text-zinc-900 font-medium">Guest Free Trial — ${remaining} of 10 remaining (Sign up for 50 free credits)</span>
        `;
        lucide.createIcons();
        return;
    }

    const isAdmin = state.user && (state.user.isUnlimited || state.user.role === 'ROLE_ADMIN' ||
                    (state.user.email && (state.user.email.toLowerCase() === 'sufi11729@gmail.com' || state.user.email.toLowerCase() === 'sufi111729@gmail.com')));

    if (isAdmin) {
        creditDeductionBadge.innerHTML = `
            <i data-lucide="check" class="w-3.5 h-3.5 text-zinc-900"></i>
            <span class="text-zinc-900 font-semibold">Admin Account — Unlimited Operations (0 Deducted)</span>
        `;
    } else {
        if (state.user && state.user.remainingCredits > 0) {
            state.user.remainingCredits -= 1;
            localStorage.setItem('user', JSON.stringify(state.user));
            navCreditsCount.textContent = state.user.remainingCredits;
        }
        creditDeductionBadge.innerHTML = `
            <i data-lucide="check" class="w-3.5 h-3.5 text-zinc-700"></i>
            <span>1 Credit deducted</span>
        `;
    }
    lucide.createIcons();
}

// ==================== RESULT & CANVAS SETUP ====================
function initializeResultView(beforeUrl, afterUrl, durationSec, modeLabel, isDownscaled, resolution, tier) {
    processingBox.classList.add('hidden');
    resultBox.classList.remove('hidden');

    imgBefore.src = beforeUrl;
    imgAfter.src = afterUrl;

    const isProOrAdmin = tier === 'PREMIUM' || (state.user && (state.user.isUnlimited || state.user.isPremium));

    if (isProOrAdmin) {
        badgeResolutionStatus.className = 'text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-900 text-white font-medium';
        badgeResolutionStatus.textContent = `4K Original (${resolution})`;
        bannerFreeCap.classList.add('hidden');
    } else {
        badgeResolutionStatus.className = 'text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-100 text-zinc-700 border border-zinc-200';
        badgeResolutionStatus.textContent = `Standard (${resolution})`;
        if (isDownscaled) {
            bannerFreeCap.classList.remove('hidden');
        } else {
            bannerFreeCap.classList.add('hidden');
        }
    }

    imgFileDetails.textContent = `${modeLabel} • ${resolution} • ${durationSec}s`;

    // 1. Load Processed Image onto Magic Canvas
    const imgProcessed = new Image();
    imgProcessed.crossOrigin = 'anonymous';
    imgProcessed.onload = () => {
        currentLoadedImage = imgProcessed;
        magicCanvas.width = imgProcessed.naturalWidth;
        magicCanvas.height = imgProcessed.naturalHeight;
        magicCtx = magicCanvas.getContext('2d', { willReadFrequently: true });
        magicCtx.clearRect(0, 0, magicCanvas.width, magicCanvas.height);
        magicCtx.drawImage(imgProcessed, 0, 0);

        // Store initial cutout snapshot
        state.originalCutoutData = magicCtx.getImageData(0, 0, magicCanvas.width, magicCanvas.height);
        state.undoStack = [];
        btnMagicUndo.disabled = true;

        // 2. Load Original Image buffer on offscreen canvas at exact same dimensions for Instant Pixel Restoration
        const imgOrig = new Image();
        imgOrig.crossOrigin = 'anonymous';
        imgOrig.onload = () => {
            const offscreenCanvas = document.createElement('canvas');
            offscreenCanvas.width = magicCanvas.width;
            offscreenCanvas.height = magicCanvas.height;
            const offscreenCtx = offscreenCanvas.getContext('2d', { willReadFrequently: true });
            offscreenCtx.drawImage(imgOrig, 0, 0, magicCanvas.width, magicCanvas.height);
            state.originalImageData = offscreenCtx.getImageData(0, 0, magicCanvas.width, magicCanvas.height);
        };
        imgOrig.src = beforeUrl;

        // Default to Erase mode & dark contrast backdrop
        switchToolMode('erase');
        setCanvasBackdrop('dark');
        state.viewMode = 'canvas';
        canvasContainerWrap.classList.remove('hidden');
        sliderContainer.classList.add('hidden');
    };
    imgProcessed.src = afterUrl;

    setSliderPosition(50);
    lucide.createIcons();
}

function toggleViewMode() {
    state.viewMode = state.viewMode === 'canvas' ? 'slider' : 'canvas';
    if (state.viewMode === 'slider') {
        canvasContainerWrap.classList.add('hidden');
        sliderContainer.classList.remove('hidden');
        labelViewMode.textContent = 'Canvas Mode';
    } else {
        canvasContainerWrap.classList.remove('hidden');
        sliderContainer.classList.add('hidden');
        labelViewMode.textContent = 'Compare Slider';
    }
}

// ==================== INTERACTIVE ERASER & RESTORER ALGORITHMS ====================
function getCanvasCoords(e) {
    if (!magicCanvas || !currentLoadedImage) return null;
    const rect = magicCanvas.getBoundingClientRect();
    const scaleX = magicCanvas.width / rect.width;
    const scaleY = magicCanvas.height / rect.height;

    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);

    if (x < 0 || x >= magicCanvas.width || y < 0 || y >= magicCanvas.height) return null;
    return { x, y };
}

function handleCanvasMouseDown(e) {
    state.isMouseDown = true;
    handleCanvasAction(e);
}

function handleCanvasMouseUp() {
    state.isMouseDown = false;
}

function handleCanvasMouseMove(e) {
    const coords = getCanvasCoords(e);
    if (!coords || !magicCtx) return;

    // Eyedropper hover preview
    const pixel = magicCtx.getImageData(coords.x, coords.y, 1, 1).data;
    if (pixel[3] > 0) {
        const hex = rgbToHex(pixel[0], pixel[1], pixel[2]);
        magicSwatch.style.backgroundColor = hex;
        magicHex.textContent = hex;
    } else {
        magicSwatch.style.backgroundColor = 'transparent';
        magicHex.textContent = 'Transparent';
    }

    // Drag-to-restore or drag-to-erase
    if (state.isMouseDown) {
        applyBrushAction(coords.x, coords.y);
    }
}

function handleCanvasAction(e) {
    const coords = getCanvasCoords(e);
    if (!coords || !magicCtx) return;

    // Push current canvas state to undo stack
    pushUndoState();

    if (state.toolMode === 'erase') {
        executeFloodFillErase(coords.x, coords.y);
    } else {
        executeFloodFillRestore(coords.x, coords.y);
    }
}

function pushUndoState() {
    if (!magicCtx) return;
    state.undoStack.push(magicCtx.getImageData(0, 0, magicCanvas.width, magicCanvas.height));
    if (state.undoStack.length > state.maxUndoSteps) {
        state.undoStack.shift();
    }
    btnMagicUndo.disabled = false;
}

/**
 * Erase Algorithm: BFS Flood-Fill
 * Erases connected matching pixels into transparent (Alpha = 0).
 */
function executeFloodFillErase(startX, startY) {
    const width = magicCanvas.width;
    const height = magicCanvas.height;
    const currentImageData = magicCtx.getImageData(0, 0, width, height);
    const data = currentImageData.data;

    const startIdx = (startY * width + startX) * 4;
    const targetR = data[startIdx];
    const targetG = data[startIdx + 1];
    const targetB = data[startIdx + 2];
    const targetA = data[startIdx + 3];

    if (targetA === 0) {
        showToast('Selected pixel is already transparent.', 'info');
        return;
    }

    const totalPixels = width * height;
    const visited = new Uint8Array(totalPixels);
    const queue = new Int32Array(totalPixels);
    let head = 0;
    let tail = 0;

    const maxDistance = (state.tolerance / 100) * 441.67;
    const maxDistSq = maxDistance * maxDistance;

    const startIndex = startY * width + startX;
    queue[tail++] = startIndex;
    visited[startIndex] = 1;

    let erasedCount = 0;

    while (head < tail) {
        const curr = queue[head++];
        const cx = curr % width;
        const cy = (curr / width) | 0;
        const pixelIdx = curr * 4;

        data[pixelIdx] = 0;
        data[pixelIdx + 1] = 0;
        data[pixelIdx + 2] = 0;
        data[pixelIdx + 3] = 0;
        erasedCount++;

        const neighbors = [
            (cy > 0) ? (curr - width) : -1,
            (cy < height - 1) ? (curr + width) : -1,
            (cx > 0) ? (curr - 1) : -1,
            (cx < width - 1) ? (curr + 1) : -1
        ];

        for (let i = 0; i < 4; i++) {
            const nIdx = neighbors[i];
            if (nIdx !== -1 && visited[nIdx] === 0) {
                const nPixelIdx = nIdx * 4;
                const na = data[nPixelIdx + 3];

                if (na > 0) {
                    const nr = data[nPixelIdx];
                    const ng = data[nPixelIdx + 1];
                    const nb = data[nPixelIdx + 2];

                    const dr = nr - targetR;
                    const dg = ng - targetG;
                    const db = nb - targetB;
                    const distSq = dr * dr + dg * dg + db * db;

                    if (distSq <= maxDistSq) {
                        visited[nIdx] = 1;
                        queue[tail++] = nIdx;
                    }
                }
            }
        }
    }

    magicCtx.putImageData(currentImageData, 0, 0);
    imgAfter.src = magicCanvas.toDataURL('image/png');

    const clickedHex = rgbToHex(targetR, targetG, targetB);
    showToast(`Erased ${erasedCount.toLocaleString()} connected pixels (${clickedHex})`, 'success');
}

/**
 * Restore Algorithm: BFS Flood-Fill from Original Photo
 * Re-reads pixels from state.originalImageData and copies them back onto the cutout canvas!
 */
function executeFloodFillRestore(startX, startY) {
    if (!state.originalImageData) {
        showToast('Original image buffer not loaded yet.', 'error');
        return;
    }

    const width = magicCanvas.width;
    const height = magicCanvas.height;
    const currentImageData = magicCtx.getImageData(0, 0, width, height);
    const currentData = currentImageData.data;
    const origData = state.originalImageData.data;

    const startIdx = (startY * width + startX) * 4;
    const targetR = origData[startIdx];
    const targetG = origData[startIdx + 1];
    const targetB = origData[startIdx + 2];

    const totalPixels = width * height;
    const visited = new Uint8Array(totalPixels);
    const queue = new Int32Array(totalPixels);
    let head = 0;
    let tail = 0;

    const maxDistance = (state.tolerance / 100) * 441.67;
    const maxDistSq = maxDistance * maxDistance;

    const startIndex = startY * width + startX;
    queue[tail++] = startIndex;
    visited[startIndex] = 1;

    let restoredCount = 0;

    while (head < tail) {
        const curr = queue[head++];
        const cx = curr % width;
        const cy = (curr / width) | 0;
        const pixelIdx = curr * 4;

        // Restore pixel from original image
        currentData[pixelIdx] = origData[pixelIdx];
        currentData[pixelIdx + 1] = origData[pixelIdx + 1];
        currentData[pixelIdx + 2] = origData[pixelIdx + 2];
        currentData[pixelIdx + 3] = origData[pixelIdx + 3] || 255;
        restoredCount++;

        const neighbors = [
            (cy > 0) ? (curr - width) : -1,
            (cy < height - 1) ? (curr + width) : -1,
            (cx > 0) ? (curr - 1) : -1,
            (cx < width - 1) ? (curr + 1) : -1
        ];

        for (let i = 0; i < 4; i++) {
            const nIdx = neighbors[i];
            if (nIdx !== -1 && visited[nIdx] === 0) {
                const nPixelIdx = nIdx * 4;

                // Match original image color region
                const nr = origData[nPixelIdx];
                const ng = origData[nPixelIdx + 1];
                const nb = origData[nPixelIdx + 2];

                const dr = nr - targetR;
                const dg = ng - targetG;
                const db = nb - targetB;
                const distSq = dr * dr + dg * dg + db * db;

                // If original pixel matches and current cutout was transparent or erased
                if (distSq <= maxDistSq) {
                    visited[nIdx] = 1;
                    queue[tail++] = nIdx;
                }
            }
        }
    }

    magicCtx.putImageData(currentImageData, 0, 0);
    imgAfter.src = magicCanvas.toDataURL('image/png');

    const restoredHex = rgbToHex(targetR, targetG, targetB);
    showToast(`Restored ${restoredCount.toLocaleString()} original pixels (${restoredHex})`, 'success');
}

/**
 * Brush Drag Support:
 * Paints back or erases pixels under the brush cursor
 */
function applyBrushAction(centerX, centerY) {
    if (!magicCtx) return;
    const width = magicCanvas.width;
    const height = magicCanvas.height;
    const radius = state.brushRadius;
    const rSq = radius * radius;

    const currentImageData = magicCtx.getImageData(0, 0, width, height);
    const currentData = currentImageData.data;
    const origData = state.originalImageData ? state.originalImageData.data : null;

    const minX = Math.max(0, centerX - radius);
    const maxX = Math.min(width - 1, centerX + radius);
    const minY = Math.max(0, centerY - radius);
    const maxY = Math.min(height - 1, centerY + radius);

    for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
            const dx = x - centerX;
            const dy = y - centerY;
            if (dx * dx + dy * dy <= rSq) {
                const idx = (y * width + x) * 4;
                if (state.toolMode === 'erase') {
                    currentData[idx] = 0;
                    currentData[idx + 1] = 0;
                    currentData[idx + 2] = 0;
                    currentData[idx + 3] = 0;
                } else if (origData) {
                    currentData[idx] = origData[idx];
                    currentData[idx + 1] = origData[idx + 1];
                    currentData[idx + 2] = origData[idx + 2];
                    currentData[idx + 3] = origData[idx + 3] || 255;
                }
            }
        }
    }

    magicCtx.putImageData(currentImageData, 0, 0);
    imgAfter.src = magicCanvas.toDataURL('image/png');
}

function undoAction() {
    if (state.undoStack.length === 0 || !magicCtx) return;

    const previousData = state.undoStack.pop();
    magicCtx.putImageData(previousData, 0, 0);
    imgAfter.src = magicCanvas.toDataURL('image/png');

    btnMagicUndo.disabled = state.undoStack.length === 0;
    showToast('Undo completed.', 'info');
}

function resetToCutout() {
    if (!state.originalCutoutData || !magicCtx) return;
    if (!confirm('Reset canvas back to the initial AI cutout?')) return;

    pushUndoState();
    magicCtx.putImageData(state.originalCutoutData, 0, 0);
    imgAfter.src = magicCanvas.toDataURL('image/png');
    showToast('Reset to original cutout.', 'info');
}

// ==================== 2-TIER DOWNLOAD SYSTEM (1080p Free vs Original Pro) ====================
function openDownloadModal() {
    if (!magicCanvas) return;
    const origW = magicCanvas.width;
    const origH = magicCanvas.height;

    // Calculate aspect-ratio preserved dimensions fitting inside 1080 x 1080
    const scale = Math.min(1, Math.min(1080 / origW, 1080 / origH));
    const targetW = Math.max(1, Math.round(origW * scale));
    const targetH = Math.max(1, Math.round(origH * scale));

    if (dl1080Dims) {
        dl1080Dims.textContent = `${targetW} × ${targetH} px`;
    }
    if (dlOriginalDims) {
        dlOriginalDims.textContent = `${origW} × ${origH} px`;
    }

    const isProOrAdmin = Boolean(
        state.user && (
            state.user.isPremium ||
            state.user.isUnlimited ||
            state.user.role === 'ROLE_ADMIN' ||
            state.user.email === 'sufi11729@gmail.com' ||
            state.user.email === 'sufi111729@gmail.com'
        )
    );

    if (isProOrAdmin) {
        if (dlOriginalBadge) {
            dlOriginalBadge.className = 'px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1';
            dlOriginalBadge.innerHTML = '<i data-lucide="check" class="w-2.5 h-2.5"></i> Included (Pro)';
        }
        if (btnDlOriginal) {
            btnDlOriginal.className = 'w-full py-2 px-3 rounded-md bg-zinc-900 hover:bg-zinc-800 text-white font-medium text-xs transition-colors duration-150 flex items-center justify-center gap-1.5 cursor-pointer';
        }
        if (btnDlOriginalLabel) {
            btnDlOriginalLabel.textContent = `Download Original (${origW}×${origH})`;
        }
    } else {
        if (dlOriginalBadge) {
            dlOriginalBadge.className = 'px-2 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1';
            dlOriginalBadge.innerHTML = '<i data-lucide="lock" class="w-2.5 h-2.5"></i> Pro (₹499)';
        }
        if (btnDlOriginal) {
            btnDlOriginal.className = 'w-full py-2 px-3 rounded-md bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs transition-colors duration-150 flex items-center justify-center gap-1.5 cursor-pointer shadow-sm';
        }
        if (btnDlOriginalLabel) {
            btnDlOriginalLabel.textContent = '🔒 Unlock Original (Upgrade ₹499)';
        }
    }

    if (window.lucide) window.lucide.createIcons();
    openModal(modalDownload);
}

function executeDownload1080p() {
    if (!magicCanvas) return;
    const origW = magicCanvas.width;
    const origH = magicCanvas.height;

    const scale = Math.min(1, Math.min(1080 / origW, 1080 / origH));
    const targetW = Math.max(1, Math.round(origW * scale));
    const targetH = Math.max(1, Math.round(origH * scale));

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = targetW;
    exportCanvas.height = targetH;
    const exportCtx = exportCanvas.getContext('2d');
    exportCtx.imageSmoothingEnabled = true;
    exportCtx.imageSmoothingQuality = 'high';
    exportCtx.drawImage(magicCanvas, 0, 0, targetW, targetH);

    exportCanvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const baseName = state.currentFile ? state.currentFile.name.replace(/\.[^/.]+$/, "") : 'image';
        a.download = `${baseName}_1080p.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        closeModal(modalDownload);
        showToast(`Standard HD (${targetW}×${targetH}) transparent PNG downloaded.`, 'success');
    }, 'image/png');
}

function executeDownloadOriginal() {
    if (!magicCanvas) return;
    const isProOrAdmin = Boolean(
        state.user && (
            state.user.isPremium ||
            state.user.isUnlimited ||
            state.user.role === 'ROLE_ADMIN' ||
            state.user.email === 'sufi11729@gmail.com' ||
            state.user.email === 'sufi111729@gmail.com'
        )
    );

    if (isProOrAdmin) {
        magicCanvas.toBlob((blob) => {
            if (!blob) return;
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const baseName = state.currentFile ? state.currentFile.name.replace(/\.[^/.]+$/, "") : 'image';
            a.download = `${baseName}_original_${magicCanvas.width}x${magicCanvas.height}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            closeModal(modalDownload);
            showToast(`Original Ultra-HD (${magicCanvas.width}×${magicCanvas.height}) transparent PNG downloaded.`, 'success');
        }, 'image/png');
    } else {
        closeModal(modalDownload);
        openModal(modalPricing);
        showToast('Original resolution requires a Pro Plan (₹499/mo). Please upgrade to unlock original downloads.', 'info');
    }
}

function rgbToHex(r, g, b) {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
}

function resetToUploadState() {
    resultBox.classList.add('hidden');
    processingBox.classList.add('hidden');
    uploadBox.classList.remove('hidden');
    fileInput.value = '';
    state.currentFile = null;
    state.originalImageUrl = null;
    state.processedImageUrl = null;
    state.undoStack = [];
    state.originalCutoutData = null;
    state.originalImageData = null;
}

// ==================== BEFORE / AFTER COMPARISON SLIDER ====================
function initComparisonSlider() {
    let isDragging = false;

    function onMove(e) {
        if (!isDragging) return;
        const rect = sliderContainer.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        let x = clientX - rect.left;

        if (x < 0) x = 0;
        if (x > rect.width) x = rect.width;

        const percentage = (x / rect.width) * 100;
        setSliderPosition(percentage);
    }

    sliderContainer?.addEventListener('mousedown', (e) => {
        isDragging = true;
        onMove(e);
    });

    window.addEventListener('mouseup', () => { isDragging = false; });
    window.addEventListener('mousemove', onMove);

    sliderContainer?.addEventListener('touchstart', (e) => {
        isDragging = true;
        onMove(e);
    });
    window.addEventListener('touchend', () => { isDragging = false; });
    window.addEventListener('touchmove', onMove);
}

function setSliderPosition(percentage) {
    if (!beforeWrap || !sliderDivider) return;
    sliderDivider.style.left = `${percentage}%`;
    beforeWrap.style.clipPath = `polygon(0 0, ${percentage}% 0, ${percentage}% 100%, 0 100%)`;
}

// ==================== UPGRADE TO PRO ====================
async function executeUpgradeToPro() {
    if (!state.token) {
        closeModal(modalPricing);
        showToast('Please sign in or create an account to upgrade.', 'info');
        openAuthModal('register');
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/subscription/upgrade`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${state.token}` }
        });
        const json = await res.json();
        if (res.ok) {
            state.user = json.data;
            localStorage.setItem('user', JSON.stringify(state.user));
            initAuthUI();
            closeModal(modalPricing);
            bannerFreeCap.classList.add('hidden');
            showToast('Upgraded to Pro! 4K Original Resolution and 500 Credits unlocked.', 'success');
        } else {
            showToast(json.message || 'Upgrade failed.', 'error');
        }
    } catch (err) {
        showToast('Network error during upgrade.', 'error');
    }
}

// ==================== DEVELOPER API KEYS ====================
async function loadApiKeys() {
    apiKeysList.innerHTML = `<p class="text-xs text-zinc-400 text-center py-4">Loading keys...</p>`;
    try {
        const res = await fetch(`${API_BASE}/keys`, {
            headers: { 'Authorization': `Bearer ${state.token}` }
        });
        const json = await res.json();
        if (res.ok && json.data) {
            renderApiKeys(json.data);
        } else {
            apiKeysList.innerHTML = `<p class="text-xs text-red-500 text-center py-4">Failed to load API keys.</p>`;
        }
    } catch (err) {
        apiKeysList.innerHTML = `<p class="text-xs text-red-500 text-center py-4">Network error.</p>`;
    }
}

function renderApiKeys(keys) {
    if (keys.length === 0) {
        apiKeysList.innerHTML = `<p class="text-xs text-zinc-400 text-center py-4">No API keys created yet.</p>`;
        return;
    }

    apiKeysList.innerHTML = keys.map(k => `
        <div class="p-3 rounded-md bg-zinc-50 border border-zinc-200 flex items-center justify-between gap-3 ${!k.isActive ? 'opacity-40' : ''}">
            <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                    <span class="text-xs font-semibold text-zinc-900 truncate">${escapeHtml(k.name)}</span>
                    <span class="text-[10px] font-mono px-1.5 py-0.2 rounded ${k.isActive ? 'bg-zinc-200 text-zinc-800' : 'bg-red-100 text-red-700'}">${k.isActive ? 'ACTIVE' : 'REVOKED'}</span>
                </div>
                <div class="flex items-center gap-2 mt-1">
                    <code class="text-[11px] font-mono text-zinc-600 bg-white px-1.5 py-0.5 rounded border border-zinc-200">${escapeHtml(k.keyValue)}</code>
                    ${k.isActive ? `<button onclick="copyToClipboard('${k.keyValue}')" class="text-zinc-400 hover:text-zinc-900 text-xs" title="Copy"><i data-lucide="copy" class="w-3 h-3"></i></button>` : ''}
                </div>
            </div>
            ${k.isActive ? `
                <button onclick="revokeApiKey(${k.id})" class="p-1.5 text-zinc-400 hover:text-red-600 rounded transition-colors duration-150" title="Revoke">
                    <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                </button>
            ` : ''}
        </div>
    `).join('');

    lucide.createIcons();
}

async function handleCreateApiKey(e) {
    e.preventDefault();
    const name = inputKeyName.value.trim();
    if (!name) return;

    try {
        const res = await fetch(`${API_BASE}/keys`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${state.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name })
        });
        const json = await res.json();
        if (res.ok) {
            inputKeyName.value = '';
            showToast('API Key created.', 'success');
            loadApiKeys();
        } else {
            showToast(json.message || 'Failed to create key.', 'error');
        }
    } catch (err) {
        showToast('Network error.', 'error');
    }
}

window.revokeApiKey = async function(keyId) {
    if (!confirm('Revoke this API key? This action is permanent.')) return;
    try {
        const res = await fetch(`${API_BASE}/keys/${keyId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${state.token}` }
        });
        if (res.ok) {
            showToast('API Key revoked.', 'info');
            loadApiKeys();
        } else {
            showToast('Failed to revoke.', 'error');
        }
    } catch (err) {
        showToast('Network error.', 'error');
    }
};

window.copyToClipboard = function(text) {
    navigator.clipboard.writeText(text);
    showToast('Copied to clipboard.', 'success');
};

// ==================== MODALS & HELPERS ====================
function openModal(modal) {
    if (!modal) return;
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeModal(modal) {
    if (!modal) return;
    modal.classList.add('hidden');
    document.body.style.overflow = '';
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = 'flex items-center gap-2.5 px-4 py-3 rounded-xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white shadow-xl text-xs font-medium pointer-events-auto transition-all duration-200 translate-y-0 opacity-100';

    const iconMap = {
        success: { icon: 'check-circle-2', color: 'text-emerald-500' },
        error: { icon: 'alert-circle', color: 'text-rose-500' },
        info: { icon: 'info', color: 'text-indigo-500' }
    };

    const cfg = iconMap[type] || iconMap.info;

    toast.innerHTML = `
        <i data-lucide="${cfg.icon}" class="w-4 h-4 shrink-0 ${cfg.color}"></i>
        <span class="leading-relaxed">${escapeHtml(message)}</span>
    `;

    toastContainer.appendChild(toast);
    if (window.lucide) lucide.createIcons();

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(8px)';
        setTimeout(() => toast.remove(), 200);
    }, 3800);
}

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (m) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[m]);
}

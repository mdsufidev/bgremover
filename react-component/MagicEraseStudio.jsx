import React, { useState, useRef, useEffect, useCallback } from 'react';

/**
 * MagicEraseStudio — Minimalist 2D React Component with On-Click Erase & Restore
 * 
 * Features:
 * 1. Erase Mode: Click any leftover background pixel to erase connected matching pixels (Alpha = 0).
 * 2. Restore Mode: Click any cut-off area to restore original pixels from the un-cut photo (Alpha = 255).
 * 3. High-Contrast Dark Canvas Backdrop: Highlights un-removed light artifacts and halos.
 * 4. High-Performance BFS Algorithms using typed arrays (Int32Array queue).
 * 5. Undo / Redo history stack and transparent PNG export.
 */
export default function MagicEraseStudio({
  processedImageUrl,
  originalImageUrl,
  fileName = 'clean_cutout.png',
  initialTolerance = 25,
  isPremium = false,
  onUpgrade = null,
  onDownload = null
}) {
  const canvasRef = useRef(null);
  const undoStackRef = useRef([]);
  const redoStackRef = useRef([]);
  const originalDataRef = useRef(null);
  const originalCutoutRef = useRef(null);

  // Component State
  const [toolMode, setToolMode] = useState('erase'); // 'erase' | 'restore'
  const [tolerance, setTolerance] = useState(initialTolerance);
  const [backdrop, setBackdrop] = useState('dark'); // 'dark' | 'grid' | 'light'
  const [clickedColor, setClickedColor] = useState(null);
  const [hoverColor, setHoverColor] = useState(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [viewMode, setViewMode] = useState('editor'); // 'editor' | 'compare'
  const [sliderPosition, setSliderPosition] = useState(50);
  const [statusMessage, setStatusMessage] = useState('Erase Mode: Click any unwanted color to erase it to transparent');
  const [showDownloadModal, setShowDownloadModal] = useState(false);

  // Load Processed Cutout into HTML5 Canvas & Original Buffer for Restoration
  useEffect(() => {
    if (!processedImageUrl) return;

    const imgCutout = new Image();
    imgCutout.crossOrigin = 'anonymous';
    imgCutout.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      canvas.width = imgCutout.naturalWidth;
      canvas.height = imgCutout.naturalHeight;

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(imgCutout, 0, 0);

      // Save initial cutout copy
      originalCutoutRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
      undoStackRef.current = [];
      redoStackRef.current = [];
      setCanUndo(false);
      setCanRedo(false);

      // Load Original Photo into offscreen buffer at exact same resolution for restoration
      if (originalImageUrl) {
        const imgOrig = new Image();
        imgOrig.crossOrigin = 'anonymous';
        imgOrig.onload = () => {
          const offscreenCanvas = document.createElement('canvas');
          offscreenCanvas.width = canvas.width;
          offscreenCanvas.height = canvas.height;
          const offscreenCtx = offscreenCanvas.getContext('2d', { willReadFrequently: true });
          offscreenCtx.drawImage(imgOrig, 0, 0, canvas.width, canvas.height);
          originalDataRef.current = offscreenCtx.getImageData(0, 0, canvas.width, canvas.height);
        };
        imgOrig.src = originalImageUrl;
      }
    };
    imgCutout.src = processedImageUrl;
  }, [processedImageUrl, originalImageUrl]);

  // Convert Client Mouse Coordinates to Exact Canvas Resolution
  const getCanvasCoords = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);

    if (x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) return null;
    return { x, y };
  }, []);

  // Hover Eyedropper Preview
  const handleCanvasMouseMove = useCallback((e) => {
    if (!canvasRef.current) return;
    const coords = getCanvasCoords(e);
    if (!coords) return;

    const ctx = canvasRef.current.getContext('2d', { willReadFrequently: true });
    const pixel = ctx.getImageData(coords.x, coords.y, 1, 1).data;
    if (pixel[3] > 0) {
      setHoverColor({ hex: rgbToHex(pixel[0], pixel[1], pixel[2]), r: pixel[0], g: pixel[1], b: pixel[2] });
    } else {
      setHoverColor({ hex: 'Transparent', isTransparent: true });
    }
  }, [getCanvasCoords]);

  // Push Undo Snapshot
  const pushUndoSnapshot = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    undoStackRef.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    if (undoStackRef.current.length > 25) undoStackRef.current.shift();
    redoStackRef.current = [];
    setCanUndo(true);
    setCanRedo(false);
  }, []);

  // Execute Erase or Restore on Canvas Click
  const handleCanvasClick = useCallback((e) => {
    const coords = getCanvasCoords(e);
    if (!coords || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const width = canvas.width;
    const height = canvas.height;

    const currentData = ctx.getImageData(0, 0, width, height);
    const data = currentData.data;

    pushUndoSnapshot();

    if (toolMode === 'erase') {
      // ===== ERASE ALGORITHM =====
      const startIdx = (coords.y * width + coords.x) * 4;
      const targetR = data[startIdx];
      const targetG = data[startIdx + 1];
      const targetB = data[startIdx + 2];
      const targetA = data[startIdx + 3];

      if (targetA === 0) {
        setStatusMessage('Selected pixel is already transparent.');
        return;
      }

      const hexColor = rgbToHex(targetR, targetG, targetB);
      setClickedColor({ hex: hexColor, r: targetR, g: targetG, b: targetB });

      const totalPixels = width * height;
      const visited = new Uint8Array(totalPixels);
      const queue = new Int32Array(totalPixels);
      let head = 0;
      let tail = 0;

      const maxDistance = (tolerance / 100) * 441.67;
      const maxDistSq = maxDistance * maxDistance;

      const startNode = coords.y * width + coords.x;
      queue[tail++] = startNode;
      visited[startNode] = 1;

      let erasedPixels = 0;

      while (head < tail) {
        const curr = queue[head++];
        const cx = curr % width;
        const cy = (curr / width) | 0;
        const pixelIdx = curr * 4;

        data[pixelIdx] = 0;
        data[pixelIdx + 1] = 0;
        data[pixelIdx + 2] = 0;
        data[pixelIdx + 3] = 0;
        erasedPixels++;

        const neighbors = [
          cy > 0 ? curr - width : -1,
          cy < height - 1 ? curr + width : -1,
          cx > 0 ? curr - 1 : -1,
          cx < width - 1 ? curr + 1 : -1
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
              if (dr * dr + dg * dg + db * db <= maxDistSq) {
                visited[nIdx] = 1;
                queue[tail++] = nIdx;
              }
            }
          }
        }
      }

      ctx.putImageData(currentData, 0, 0);
      setStatusMessage(`Erased ${erasedPixels.toLocaleString()} connected pixels (${hexColor})`);

    } else {
      // ===== RESTORE ALGORITHM =====
      if (!originalDataRef.current) {
        setStatusMessage('Original image buffer not available for restore.');
        return;
      }

      const origData = originalDataRef.current.data;
      const startIdx = (coords.y * width + coords.x) * 4;
      const targetR = origData[startIdx];
      const targetG = origData[startIdx + 1];
      const targetB = origData[startIdx + 2];

      const totalPixels = width * height;
      const visited = new Uint8Array(totalPixels);
      const queue = new Int32Array(totalPixels);
      let head = 0;
      let tail = 0;

      const maxDistance = (tolerance / 100) * 441.67;
      const maxDistSq = maxDistance * maxDistance;

      const startNode = coords.y * width + coords.x;
      queue[tail++] = startNode;
      visited[startNode] = 1;

      let restoredPixels = 0;

      while (head < tail) {
        const curr = queue[head++];
        const cx = curr % width;
        const cy = (curr / width) | 0;
        const pixelIdx = curr * 4;

        // Restore pixel from original un-cut photo
        data[pixelIdx] = origData[pixelIdx];
        data[pixelIdx + 1] = origData[pixelIdx + 1];
        data[pixelIdx + 2] = origData[pixelIdx + 2];
        data[pixelIdx + 3] = origData[pixelIdx + 3] || 255;
        restoredPixels++;

        const neighbors = [
          cy > 0 ? curr - width : -1,
          cy < height - 1 ? curr + width : -1,
          cx > 0 ? curr - 1 : -1,
          cx < width - 1 ? curr + 1 : -1
        ];

        for (let i = 0; i < 4; i++) {
          const nIdx = neighbors[i];
          if (nIdx !== -1 && visited[nIdx] === 0) {
            const nPixelIdx = nIdx * 4;
            const nr = origData[nPixelIdx];
            const ng = origData[nPixelIdx + 1];
            const nb = origData[nPixelIdx + 2];

            const dr = nr - targetR;
            const dg = ng - targetG;
            const db = nb - targetB;

            if (dr * dr + dg * dg + db * db <= maxDistSq) {
              visited[nIdx] = 1;
              queue[tail++] = nIdx;
            }
          }
        }
      }

      ctx.putImageData(currentData, 0, 0);
      const hexColor = rgbToHex(targetR, targetG, targetB);
      setStatusMessage(`Restored ${restoredPixels.toLocaleString()} original pixels (${hexColor})`);
    }
  }, [toolMode, getCanvasCoords, tolerance, pushUndoSnapshot]);

  // Undo
  const handleUndo = useCallback(() => {
    if (undoStackRef.current.length === 0 || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    redoStackRef.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    setCanRedo(true);

    const prevState = undoStackRef.current.pop();
    ctx.putImageData(prevState, 0, 0);

    setCanUndo(undoStackRef.current.length > 0);
    setStatusMessage('Undo completed.');
  }, []);

  // Redo
  const handleRedo = useCallback(() => {
    if (redoStackRef.current.length === 0 || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    undoStackRef.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    setCanUndo(true);

    const nextState = redoStackRef.current.pop();
    ctx.putImageData(nextState, 0, 0);

    setCanRedo(redoStackRef.current.length > 0);
    setStatusMessage('Redo completed.');
  }, []);

  // Reset to Original Cutout
  const handleReset = useCallback(() => {
    if (!originalCutoutRef.current || !canvasRef.current) return;
    if (!window.confirm('Reset all manual changes back to initial cutout?')) return;

    pushUndoSnapshot();
    const ctx = canvasRef.current.getContext('2d', { willReadFrequently: true });
    ctx.putImageData(originalCutoutRef.current, 0, 0);
    setStatusMessage('Reset to initial cutout.');
  }, [pushUndoSnapshot]);

  // Open Download Options Modal (1080p Free vs Original Pro)
  const handleOpenDownloadModal = useCallback(() => {
    setShowDownloadModal(true);
  }, []);

  // Standard 1080p Free Download (Aspect-Ratio Preserved)
  const handleDownload1080p = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const origW = canvas.width;
    const origH = canvas.height;
    const scale = Math.min(1, Math.min(1080 / origW, 1080 / origH));
    const targetW = Math.max(1, Math.round(origW * scale));
    const targetH = Math.max(1, Math.round(origH * scale));

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = targetW;
    exportCanvas.height = targetH;
    const exportCtx = exportCanvas.getContext('2d');
    exportCtx.imageSmoothingEnabled = true;
    exportCtx.imageSmoothingQuality = 'high';
    exportCtx.drawImage(canvas, 0, 0, targetW, targetH);

    exportCanvas.toBlob((blob) => {
      if (!blob) return;
      if (onDownload) {
        onDownload(blob, exportCanvas.toDataURL('image/png'), '1080p');
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const baseName = fileName.replace(/\.[^/.]+$/, '');
        a.download = `${baseName}_1080p.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
      setShowDownloadModal(false);
      setStatusMessage(`Standard 1080p (${targetW}×${targetH}) PNG downloaded for free.`);
    }, 'image/png');
  }, [fileName, onDownload]);

  // Original Resolution Pro Download
  const handleDownloadOriginal = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (!isPremium) {
      if (onUpgrade) {
        setShowDownloadModal(false);
        onUpgrade();
      } else {
        setStatusMessage('Original full resolution requires a Pro subscription (₹499/mo).');
      }
      return;
    }

    canvas.toBlob((blob) => {
      if (!blob) return;
      if (onDownload) {
        onDownload(blob, canvas.toDataURL('image/png'), 'original');
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const baseName = fileName.replace(/\.[^/.]+$/, '');
        a.download = `${baseName}_original_${canvas.width}x${canvas.height}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
      setShowDownloadModal(false);
      setStatusMessage(`Original Ultra-HD (${canvas.width}×${canvas.height}) PNG downloaded.`);
    }, 'image/png');
  }, [fileName, isPremium, onDownload, onUpgrade]);

  // Backdrop CSS
  const getBackdropClass = () => {
    if (backdrop === 'dark') return 'bg-[#18181b]';
    if (backdrop === 'grid') return 'bg-white';
    return 'bg-white';
  };

  const getBackdropStyle = () => {
    if (backdrop === 'dark') {
      return {
        backgroundColor: '#18181b',
        backgroundImage: `
          linear-gradient(45deg, #222226 25%, transparent 25%),
          linear-gradient(-45deg, #222226 25%, transparent 25%),
          linear-gradient(45deg, transparent 75%, #222226 75%),
          linear-gradient(-45deg, transparent 75%, #222226 75%)
        `,
        backgroundSize: '16px 16px',
        backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0'
      };
    }
    if (backdrop === 'grid') {
      return {
        backgroundColor: '#ffffff',
        backgroundImage: `
          linear-gradient(45deg, #f4f4f5 25%, transparent 25%),
          linear-gradient(-45deg, #f4f4f5 25%, transparent 25%),
          linear-gradient(45deg, transparent 75%, #f4f4f5 75%),
          linear-gradient(-45deg, transparent 75%, #f4f4f5 75%)
        `,
        backgroundSize: '16px 16px',
        backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0'
      };
    }
    return { backgroundColor: '#ffffff' };
  };

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-3 font-sans text-zinc-900">
      
      {/* 2D Minimalist Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white rounded-lg border border-zinc-200">
        
        {/* Left: Erase vs Restore Tool Switcher */}
        <div className="flex items-center gap-2">
          <div className="inline-flex p-0.5 bg-zinc-200 rounded-md text-xs font-medium">
            <button
              type="button"
              onClick={() => {
                setToolMode('erase');
                setStatusMessage('Erase Mode: Click any leftover background pixel to erase it to transparent');
              }}
              className={`py-1 px-3 rounded transition-colors duration-150 font-medium ${
                toolMode === 'erase' ? 'bg-zinc-900 text-white shadow-xs' : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              🧹 Erase BG
            </button>
            <button
              type="button"
              onClick={() => {
                setToolMode('restore');
                setStatusMessage('Restore Mode: Click any cut-off area to restore original pixels from photo');
              }}
              className={`py-1 px-3 rounded transition-colors duration-150 font-medium ${
                toolMode === 'restore' ? 'bg-zinc-900 text-white shadow-xs' : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              🖌️ Restore Pixels
            </button>
          </div>

          {originalImageUrl && (
            <button
              type="button"
              onClick={() => setViewMode(viewMode === 'editor' ? 'compare' : 'editor')}
              className="px-2.5 py-1 rounded-md text-xs font-medium bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-700 transition-colors duration-150"
            >
              {viewMode === 'editor' ? 'Compare' : 'Canvas Mode'}
            </button>
          )}
        </div>

        {/* Middle: Tolerance Slider */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-zinc-500">Tolerance:</span>
          <input
            type="range"
            min="1"
            max="100"
            value={tolerance}
            onChange={(e) => setTolerance(Number(e.target.value))}
            className="w-24 h-1 bg-zinc-200 rounded cursor-pointer accent-zinc-900"
          />
          <span className="font-mono text-zinc-900 font-semibold w-7">{tolerance}%</span>
        </div>

        {/* Right: Backdrop Toggle, Undo & Download */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-[11px] text-zinc-500">
            <span>Backdrop:</span>
            <div className="inline-flex p-0.5 bg-zinc-200 rounded text-[10px]">
              <button
                type="button"
                onClick={() => setBackdrop('dark')}
                className={`px-2 py-0.5 rounded font-medium ${backdrop === 'dark' ? 'bg-zinc-900 text-white' : 'text-zinc-700'}`}
                title="Dark backdrop (highlights un-erased light spots)"
              >
                Dark
              </button>
              <button
                type="button"
                onClick={() => setBackdrop('grid')}
                className={`px-2 py-0.5 rounded font-medium ${backdrop === 'grid' ? 'bg-zinc-900 text-white' : 'text-zinc-700'}`}
              >
                Grid
              </button>
              <button
                type="button"
                onClick={() => setBackdrop('light')}
                className={`px-2 py-0.5 rounded font-medium ${backdrop === 'light' ? 'bg-zinc-900 text-white' : 'text-zinc-700'}`}
              >
                Light
              </button>
            </div>
          </div>

          <button
            onClick={handleUndo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            className="px-2.5 py-1 rounded-md text-xs font-medium bg-white hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed border border-zinc-200 text-zinc-700 transition-colors duration-150"
          >
            Undo
          </button>
          <button
            onClick={handleReset}
            className="px-2.5 py-1 rounded-md text-xs font-medium text-zinc-500 hover:text-zinc-900 bg-white hover:bg-zinc-50 border border-zinc-200 transition-colors duration-150"
          >
            Reset
          </button>
          <button
            onClick={handleOpenDownloadModal}
            className="px-3.5 py-1 rounded-md text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-white transition-colors duration-150 flex items-center gap-1"
          >
            Download PNG
          </button>
        </div>
      </div>

      {/* High-Contrast Canvas Viewport */}
      <div
        className={`relative overflow-hidden rounded-md border border-zinc-200 flex justify-center items-center min-h-[380px] max-h-[580px] ${getBackdropClass()}`}
        style={getBackdropStyle()}
      >
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          onMouseMove={handleCanvasMouseMove}
          className="max-w-full max-h-[560px] object-contain cursor-crosshair"
        />
      </div>

      {/* Status Bar */}
      <div className="flex justify-between items-center text-[11px] text-zinc-500 px-1">
        <span>{statusMessage}</span>
        <span>Dark canvas highlights light halos and un-removed fringes</span>
      </div>

      {/* 2-Tier Download Modal (1080p Free vs Original Pro) */}
      {showDownloadModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-zinc-200 p-6 max-w-md w-full shadow-lg">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-zinc-200">
              <div>
                <h3 className="text-sm font-semibold text-zinc-900">Choose Download Resolution</h3>
                <p className="text-xs text-zinc-500">Select transparent PNG export size.</p>
              </div>
              <button
                onClick={() => setShowDownloadModal(false)}
                className="text-zinc-400 hover:text-zinc-900 text-xs px-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 mb-5">
              {/* Option 1: Standard 1080p (Free) */}
              <div className="p-3.5 rounded-lg border border-zinc-200 bg-zinc-50/50 flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-xs font-semibold text-zinc-900">Standard HD</span>
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Free
                    </span>
                  </div>
                  <div className="text-xs font-mono font-medium text-zinc-800">
                    {canvasRef.current ? (
                      (() => {
                        const w = canvasRef.current.width;
                        const h = canvasRef.current.height;
                        const s = Math.min(1, Math.min(1080 / w, 1080 / h));
                        return `${Math.round(w * s)} × ${Math.round(h * s)} px`;
                      })()
                    ) : '1080 × 1080 px'}
                  </div>
                  <p className="text-[10px] text-zinc-500">Crisp transparent PNG for web & digital use.</p>
                </div>
                <button
                  onClick={handleDownload1080p}
                  className="px-3 py-1.5 rounded-md bg-white hover:bg-zinc-100 border border-zinc-300 text-zinc-900 font-medium text-xs transition-colors shrink-0"
                >
                  Download Free
                </button>
              </div>

              {/* Option 2: Original Ultra-HD (Pro / Payment Required) */}
              <div className="p-3.5 rounded-lg border-2 border-zinc-900 bg-white flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-xs font-semibold text-zinc-900">Original Resolution</span>
                    <span className={`px-1.5 py-0.2 rounded text-[10px] font-medium border ${isPremium ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                      {isPremium ? '👑 Unlocked' : '🔒 Pro (₹499)'}
                    </span>
                  </div>
                  <div className="text-xs font-mono font-medium text-zinc-800">
                    {canvasRef.current ? `${canvasRef.current.width} × ${canvasRef.current.height} px` : 'Ultra-HD / 4K'}
                  </div>
                  <p className="text-[10px] text-zinc-500">Uncompressed camera quality for print & professional work.</p>
                </div>
                <button
                  onClick={handleDownloadOriginal}
                  className={`px-3 py-1.5 rounded-md text-white font-medium text-xs transition-colors shrink-0 ${isPremium ? 'bg-zinc-900 hover:bg-zinc-800' : 'bg-amber-600 hover:bg-amber-700'}`}
                >
                  {isPremium ? 'Download Original' : 'Unlock (₹499)'}
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setShowDownloadModal(false)}
                className="text-xs text-zinc-500 hover:text-zinc-900 font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function rgbToHex(r, g, b) {
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
}

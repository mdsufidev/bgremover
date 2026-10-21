import React, { useState } from 'react';
import MagicEraseStudio from './MagicEraseStudio';

/**
 * Example Parent Component:
 * Shows how to upload an image, call the AI background removal API,
 * and then automatically present the MagicEraseStudio component for post-processing.
 */
export default function App() {
  const [originalImage, setOriginalImage] = useState(null);
  const [processedImageUrl, setProcessedImageUrl] = useState(null);
  const [loading, setLoading] = useState(false);

  // 1. Handle file upload and call backend AI background remover
  const handleImageUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setOriginalImage(URL.createObjectURL(file));
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      // Call your backend gateway (Spring Boot or FastAPI)
      const response = await fetch('http://localhost:8080/api/v1/remove-bg', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error('AI background removal failed');
      }

      // Convert PNG result to Blob URL
      const blob = await response.blob();
      const resultUrl = URL.createObjectURL(blob);
      setProcessedImageUrl(resultUrl);
    } catch (err) {
      console.error(err);
      alert('Error removing background: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6 flex flex-col items-center">
      <h1 className="text-3xl font-extrabold mb-6">AI Background Remover + Magic Erase</h1>

      {/* Step 1: Upload Image (if not processed yet) */}
      {!processedImageUrl && (
        <div className="w-full max-w-xl p-10 border-2 border-dashed border-zinc-700 rounded-2xl flex flex-col items-center justify-center text-center">
          <input
            type="file"
            id="file-upload"
            className="hidden"
            accept="image/*"
            onChange={handleImageUpload}
          />
          <label
            htmlFor="file-upload"
            className="cursor-pointer px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold shadow-lg transition"
          >
            {loading ? 'Processing with AI...' : 'Upload Image for AI Cutout'}
          </label>
        </div>
      )}

      {/* Step 2: Post-Processing Magic Erase Studio */}
      {processedImageUrl && (
        <div className="w-full max-w-5xl flex flex-col items-center gap-4">
          <button
            onClick={() => {
              setProcessedImageUrl(null);
              setOriginalImage(null);
            }}
            className="self-start text-xs text-zinc-400 hover:text-white underline mb-2"
          >
            ← Upload another image
          </button>

          <MagicEraseStudio
            processedImageUrl={processedImageUrl}
            originalImageUrl={originalImage}
            fileName="my_clean_cutout.png"
            initialTolerance={25}
            onDownload={(blob) => {
              console.log('User downloaded final edited image blob:', blob);
            }}
          />
        </div>
      )}
    </div>
  );
}

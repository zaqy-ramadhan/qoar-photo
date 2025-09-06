import React, { useState, useCallback, useRef, RefObject } from 'react';
import { EditedImageResult } from './types';
import { editImageWithGemini } from './services/geminiService';
import { UploadIcon, DownloadIcon, XCircleIcon, BrushIcon } from './components/icons';
import Loader from './components/Loader';
import CanvasEditor, { CanvasEditorRef } from './components/CanvasEditor';

// Helper component for displaying the final edited image
const ImageViewer = ({ title, imageUrl, isLoading = false }: { title: string; imageUrl: string | null; isLoading?: boolean }) => (
  <div className="w-full bg-gray-800 rounded-lg shadow-lg p-4 flex flex-col items-center justify-center aspect-square">
    <h3 className="text-lg font-semibold text-gray-300 mb-3 self-start">{title}</h3>
    <div className="relative w-full h-full border-2 border-dashed border-gray-600 rounded-md flex items-center justify-center overflow-hidden">
      {isLoading && <Loader />}
      {imageUrl ? (
        <img src={imageUrl} alt={title} className="w-full h-full object-contain" />
      ) : (
        <div className="text-center text-gray-500">
          <p>Your edited image will appear here</p>
        </div>
      )}
    </div>
  </div>
);

// Main App Component
const App: React.FC = () => {
  const [originalImage, setOriginalImage] = useState<{ url: string; file: File } | null>(null);
  const [objectImage, setObjectImage] = useState<{ url: string; file: File } | null>(null);
  const [editHistory, setEditHistory] = useState<EditedImageResult[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [prompt, setPrompt] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isBrushEnabled, setIsBrushEnabled] = useState<boolean>(false);
  const [brushSize, setBrushSize] = useState<number>(30);
  
  const canvasRef: RefObject<CanvasEditorRef> = useRef(null);
  const currentEdit = editHistory[historyIndex] ?? null;

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>, imageType: 'original' | 'object') => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 4 * 1024 * 1024) { // 4MB limit
        setError("File is too large. Please select an image under 4MB.");
        return;
      }
      setError(null);
      const fileUrl = URL.createObjectURL(file);
      const newImage = { url: fileUrl, file };
      
      if (imageType === 'original') {
        setOriginalImage(newImage);
        setEditHistory([]);
        setHistoryIndex(-1);
        setObjectImage(null); // Reset object image when main image changes
        canvasRef.current?.clearMask();
      } else {
        setObjectImage(newImage);
      }
    }
  };

  const handleEditRequest = useCallback(async () => {
    if (!originalImage || !prompt.trim()) {
      setError('Please upload an image and provide an editing prompt.');
      return;
    }
    setError(null);
    setIsLoading(true);
    
    try {
      let maskBase64: string | undefined = undefined;
      if (isBrushEnabled) {
          maskBase64 = await canvasRef.current?.getMaskAsBase64();
      }
      
      const result = await editImageWithGemini(originalImage.file, prompt, maskBase64, objectImage?.file);
      const newHistory = [...editHistory.slice(0, historyIndex + 1), result];
      setEditHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
    } catch (e: any) {
      setError(e.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  }, [originalImage, prompt, editHistory, historyIndex, objectImage, isBrushEnabled]);
  
  const handleUndo = () => {
    if (historyIndex >= 0) {
      setHistoryIndex(historyIndex - 1);
    }
  };
  
  const handleRedo = () => {
    if (historyIndex < editHistory.length - 1) {
      setHistoryIndex(historyIndex + 1);
    }
  };

  const resetState = () => {
    setOriginalImage(null);
    setObjectImage(null);
    setEditHistory([]);
    setHistoryIndex(-1);
    setPrompt('');
    setError(null);
    setIsLoading(false);
    setIsBrushEnabled(false);
    ['file-upload-main', 'file-upload-object'].forEach(id => {
        const fileInput = document.getElementById(id) as HTMLInputElement;
        if (fileInput) fileInput.value = '';
    });
  };
  
  const editedImageUrl = currentEdit ? `data:image/png;base64,${currentEdit.imageB64}` : null;

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col p-4 sm:p-6 lg:p-8">
      <header className="text-center mb-8">
        <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-teal-500">
          QOAR AI Photo Studio
        </h1>
        <p className="text-gray-400 mt-2">Created by Creative QOAR</p>
      </header>

      <main className="flex-grow container mx-auto max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Controls Panel */}
          <div className="bg-gray-800/50 rounded-lg p-6 shadow-2xl backdrop-blur-sm border border-gray-700 flex flex-col space-y-4">
            {/* 1. UPLOAD IMAGE */}
            <div>
              <label htmlFor="file-upload-main" className="block text-lg font-medium text-gray-300 mb-2">1. Upload Image</label>
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-600 border-dashed rounded-md">
                <div className="space-y-1 text-center">
                  <UploadIcon className="mx-auto h-12 w-12 text-gray-500" />
                  <div className="flex text-sm text-gray-500">
                    <label htmlFor="file-upload-main" className="relative cursor-pointer bg-gray-800 rounded-md font-medium text-cyan-400 hover:text-cyan-300">
                      <span>{originalImage ? 'Change image' : 'Upload a file'}</span>
                      <input id="file-upload-main" type="file" className="sr-only" accept="image/png, image/jpeg, image/webp" onChange={(e) => handleFileChange(e, 'original')} />
                    </label>
                  </div>
                  <p className="text-xs text-gray-600">PNG, JPG, WEBP up to 4MB</p>
                </div>
              </div>
               {originalImage && <p className="text-sm text-gray-400 mt-2">Loaded: {originalImage.file.name}</p>}
            </div>

            {/* 2. ADD OBJECT (Optional) */}
            <div className={!originalImage ? 'opacity-50' : ''}>
              <label htmlFor="file-upload-object" className="block text-lg font-medium text-gray-300 mb-2">2. Add an Object <span className="text-sm text-gray-500">(Optional)</span></label>
                <div className="mt-1 flex justify-center px-2 py-1 border-2 border-gray-600 border-dashed rounded-md">
                   <div className="space-y-1 text-center text-sm w-full">
                     <label htmlFor="file-upload-object" className="relative cursor-pointer bg-gray-800 rounded-md font-medium text-cyan-400 hover:text-cyan-300">
                      <span>{objectImage ? 'Change object' : 'Upload object image'}</span>
                      <input id="file-upload-object" type="file" className="sr-only" accept="image/png, image/jpeg, image/webp" onChange={(e) => handleFileChange(e, 'object')} disabled={!originalImage}/>
                    </label>
                  </div>
                </div>
                {objectImage && <p className="text-sm text-gray-400 mt-2">Object: {objectImage.file.name}</p>}
            </div>

            {/* 3. BRUSH TOOL (Optional) */}
            <div className={`p-4 bg-gray-900/50 rounded-md border border-gray-700 ${!originalImage ? 'opacity-50' : ''}`}>
                <div className="flex justify-between items-center mb-3">
                    <label htmlFor="brush-toggle" className="flex items-center text-lg font-medium text-gray-300">
                        <BrushIcon className="h-5 w-5 mr-2" />
                        Brush Tool
                    </label>
                    <div className="relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in">
                        <input type="checkbox" name="brush-toggle" id="brush-toggle" className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer" 
                            checked={isBrushEnabled} onChange={() => originalImage && setIsBrushEnabled(!isBrushEnabled)} disabled={!originalImage} />
                        <label htmlFor="brush-toggle" className="toggle-label block overflow-hidden h-6 rounded-full bg-gray-600 cursor-pointer"></label>
                    </div>
                </div>
                {isBrushEnabled && (
                    <div className="space-y-3">
                        <div className="flex items-center gap-3">
                            <label htmlFor="brush-size" className="text-sm">Size:</label>
                            <input type="range" id="brush-size" min="5" max="100" value={brushSize} onChange={e => setBrushSize(Number(e.target.value))} className="w-full" />
                        </div>
                        <button onClick={() => canvasRef.current?.clearMask()} className="w-full text-sm text-gray-400 hover:text-white transition">Clear Mask</button>
                    </div>
                )}
            </div>

            {/* 4. DESCRIBE EDIT */}
            <div>
              <label htmlFor="prompt" className="block text-lg font-medium text-gray-300 mb-2">3. Describe Your Edit</label>
              <textarea
                id="prompt" rows={3}
                className="w-full bg-gray-900/70 border border-gray-600 rounded-md shadow-sm p-3 focus:ring-cyan-500 focus:border-cyan-500 transition"
                placeholder="e.g., 'add a futuristic helmet', or if adding object, 'put this cat on the sofa'"
                value={prompt} onChange={(e) => setPrompt(e.target.value)} disabled={!originalImage}
              />
            </div>
            
            {/* ACTIONS */}
            <div className="flex flex-col gap-4 pt-2">
               <button onClick={handleEditRequest} disabled={isLoading || !originalImage || !prompt} className="w-full inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors">
                {isLoading ? 'Generating...' : 'Generate'}
              </button>
              <div className="grid grid-cols-3 gap-4">
                <button title="Undo" onClick={handleUndo} disabled={historyIndex < 0} className="inline-flex items-center justify-center p-3 border border-gray-600 text-sm font-medium rounded-md text-gray-300 hover:bg-gray-700 disabled:opacity-50 transition-colors">Undo</button>
                <button title="Redo" onClick={handleRedo} disabled={historyIndex >= editHistory.length - 1} className="inline-flex items-center justify-center p-3 border border-gray-600 text-sm font-medium rounded-md text-gray-300 hover:bg-gray-700 disabled:opacity-50 transition-colors">Redo</button>
                <a title="Download" href={editedImageUrl || '#'} onClick={(e) => !editedImageUrl && e.preventDefault()} download={`edited-${originalImage?.file.name || 'image'}.png`} className={`inline-flex items-center justify-center p-3 border border-gray-600 text-sm font-medium rounded-md text-gray-300 hover:bg-gray-700 transition-colors ${!editedImageUrl ? 'opacity-50 cursor-not-allowed' : ''}`} aria-disabled={!editedImageUrl}><DownloadIcon className="h-5 w-5" /></a>
              </div>
            </div>

            {(originalImage || editHistory.length > 0) && <button onClick={resetState} className="text-sm text-gray-500 hover:text-gray-300 transition-colors">Start Over</button>}
            {error && <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-md relative" role="alert"><strong className="font-bold">Error: </strong><span className="block sm:inline">{error}</span><span className="absolute top-0 bottom-0 right-0 px-4 py-3" onClick={() => setError(null)}><XCircleIcon className="h-6 w-6 text-red-400 cursor-pointer" /></span></div>}
            <style>{`.toggle-checkbox:checked { right: 0; border-color: #0891b2; } .toggle-checkbox:checked + .toggle-label { background-color: #0891b2; }`}</style>
          </div>

          {/* Image Display Panel */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            <CanvasEditor ref={canvasRef} imageUrl={originalImage?.url} brushSize={brushSize} isBrushEnabled={isBrushEnabled} />
            <div className="flex flex-col gap-4">
              <ImageViewer title="Edited" imageUrl={editedImageUrl} isLoading={isLoading} />
              {currentEdit?.text && !isLoading && (
                  <div className="bg-gray-800 rounded-lg p-4 text-sm text-gray-300 italic shadow-lg">
                      <span className="font-bold text-cyan-400">AI says:</span> "{currentEdit.text}"
                  </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <footer className="text-center text-gray-600 mt-12 text-sm">
        <p>&copy; 2025 PT QOAR MEDIA KREATIF. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default App;
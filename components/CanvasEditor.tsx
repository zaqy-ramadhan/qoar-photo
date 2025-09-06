
import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle, ForwardedRef } from 'react';
import { UploadIcon } from './icons';

interface CanvasEditorProps {
  imageUrl: string | null | undefined;
  brushSize: number;
  isBrushEnabled: boolean;
}

export interface CanvasEditorRef {
  getMaskAsBase64: () => Promise<string | undefined>;
  clearMask: () => void;
}

const CanvasEditor = forwardRef<CanvasEditorRef, CanvasEditorProps>(
  ({ imageUrl, brushSize, isBrushEnabled }, ref: ForwardedRef<CanvasEditorRef>) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const maskCanvasRef = useRef<HTMLCanvasElement>(document.createElement('canvas'));
    const [isDrawing, setIsDrawing] = useState(false);
    const [imageElement, setImageElement] = useState<HTMLImageElement | null>(null);

    // Load image and set canvas dimensions
    useEffect(() => {
      if (imageUrl) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = imageUrl;
        img.onload = () => {
          setImageElement(img);
          const canvas = canvasRef.current;
          const maskCanvas = maskCanvasRef.current;
          if (canvas) {
            // Set display size
            canvas.style.width = '100%';
            canvas.style.height = '100%';
            // Set actual size in memory
            canvas.width = canvas.offsetWidth;
            canvas.height = canvas.offsetHeight;
            
            // Set mask canvas size
            maskCanvas.width = img.naturalWidth;
            maskCanvas.height = img.naturalHeight;

            // Clear previous mask
            const maskCtx = maskCanvas.getContext('2d');
            maskCtx?.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
          }
        };
      } else {
        setImageElement(null); // Clear image when URL is null
      }
    }, [imageUrl]);
    
    // Draw image and mask on canvas
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !imageElement) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Calculate aspect ratios
        const canvasAspect = canvas.width / canvas.height;
        const imageAspect = imageElement.naturalWidth / imageElement.naturalHeight;

        let drawWidth, drawHeight, drawX, drawY;

        if (imageAspect > canvasAspect) {
            drawWidth = canvas.width;
            drawHeight = drawWidth / imageAspect;
            drawX = 0;
            drawY = (canvas.height - drawHeight) / 2;
        } else {
            drawHeight = canvas.height;
            drawWidth = drawHeight * imageAspect;
            drawY = 0;
            drawX = (canvas.width - drawWidth) / 2;
        }

        // Draw the main image
        ctx.drawImage(imageElement, drawX, drawY, drawWidth, drawHeight);

        // Draw the mask on top if enabled
        if(isBrushEnabled) {
            ctx.globalAlpha = 0.4; // Make mask semi-transparent
            ctx.drawImage(maskCanvasRef.current, drawX, drawY, drawWidth, drawHeight);
            ctx.globalAlpha = 1.0;
        }

    }, [imageElement, isBrushEnabled, brushSize]); // Redraw when these change

    const getCoords = (e: React.MouseEvent<HTMLCanvasElement>): { x: number; y: number } | null => {
      const canvas = canvasRef.current;
      const image = imageElement;
      if (!canvas || !image) return null;
      
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const canvasX = (e.clientX - rect.left) * scaleX;
      const canvasY = (e.clientY - rect.top) * scaleY;
      
      // Convert canvas coords to image coords
      const canvasAspect = canvas.width / canvas.height;
      const imageAspect = image.naturalWidth / image.naturalHeight;
      let drawWidth, drawHeight, drawX, drawY;
      if (imageAspect > canvasAspect) {
        drawWidth = canvas.width;
        drawHeight = drawWidth / imageAspect;
        drawX = 0;
        drawY = (canvas.height - drawHeight) / 2;
      } else {
        drawHeight = canvas.height;
        drawWidth = drawHeight * imageAspect;
        drawY = 0;
        drawX = (canvas.width - drawWidth) / 2;
      }

      if (canvasX < drawX || canvasX > drawX + drawWidth || canvasY < drawY || canvasY > drawY + drawHeight) {
          return null; // Click was outside the image
      }

      // Scale to original image dimensions for the mask
      const imgX = (canvasX - drawX) / drawWidth * image.naturalWidth;
      const imgY = (canvasY - drawY) / drawHeight * image.naturalHeight;

      return { x: imgX, y: imgY };
    };

    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isBrushEnabled) return;
      setIsDrawing(true);
      draw(e);
    };

    const stopDrawing = () => {
      setIsDrawing(false);
      const maskCtx = maskCanvasRef.current.getContext('2d');
      maskCtx?.beginPath(); // Reset the path
    };

    const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDrawing || !isBrushEnabled) return;
      const coords = getCoords(e);
      if (!coords) return;
      
      const maskCtx = maskCanvasRef.current.getContext('2d');
      if (!maskCtx) return;

      maskCtx.lineWidth = brushSize * (imageElement!.naturalWidth / canvasRef.current!.width); // Scale brush size to image
      maskCtx.lineCap = 'round';
      maskCtx.strokeStyle = 'rgba(255, 0, 255, 1)';
      maskCtx.lineTo(coords.x, coords.y);
      maskCtx.stroke();
      maskCtx.beginPath();
      maskCtx.moveTo(coords.x, coords.y);

      // Trigger a redraw of the visible canvas
      requestAnimationFrame(() => {
        const canvas = canvasRef.current;
        if (!canvas || !imageElement) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        // Recalculate drawing dimensions
        const canvasAspect = canvas.width / canvas.height;
        const imageAspect = imageElement.naturalWidth / imageElement.naturalHeight;
        let drawWidth, drawHeight, drawX, drawY;
        if (imageAspect > canvasAspect) {
            drawWidth = canvas.width;
            drawHeight = drawWidth / imageAspect;
            drawX = 0;
            drawY = (canvas.height - drawHeight) / 2;
        } else {
            drawHeight = canvas.height;
            drawWidth = drawHeight * imageAspect;
            drawY = 0;
            drawX = (canvas.width - drawWidth) / 2;
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(imageElement, drawX, drawY, drawWidth, drawHeight);
        ctx.globalAlpha = 0.4;
        ctx.drawImage(maskCanvasRef.current, drawX, drawY, drawWidth, drawHeight);
        ctx.globalAlpha = 1.0;
      });
    };
    
    useImperativeHandle(ref, () => ({
      getMaskAsBase64: () => new Promise((resolve) => {
          const tempCanvas = document.createElement('canvas');
          const mask = maskCanvasRef.current;
          tempCanvas.width = mask.width;
          tempCanvas.height = mask.height;
          const tempCtx = tempCanvas.getContext('2d');
          if (!tempCtx) return resolve(undefined);

          // Create a black background
          tempCtx.fillStyle = 'black';
          tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

          // Draw the magenta lines as white on the new canvas
          tempCtx.drawImage(mask, 0, 0);
          tempCtx.globalCompositeOperation = 'source-in';
          tempCtx.fillStyle = 'white';
          tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
          
          const base64 = tempCanvas.toDataURL('image/png').split(',')[1];
          resolve(base64);
      }),
      clearMask: () => {
          const maskCtx = maskCanvasRef.current.getContext('2d');
          maskCtx?.clearRect(0, 0, maskCanvasRef.current.width, maskCanvasRef.current.height);
          // Trigger redraw
          useEffect(() => {}, []);
      }
    }));

    return (
      <div className="w-full bg-gray-800 rounded-lg shadow-lg p-4 flex flex-col items-center justify-center aspect-square">
        <h3 className="text-lg font-semibold text-gray-300 mb-3 self-start">Original</h3>
        <div className="relative w-full h-full border-2 border-dashed border-gray-600 rounded-md flex items-center justify-center overflow-hidden">
          {imageUrl ? (
            <canvas
              ref={canvasRef}
              className={`w-full h-full object-contain ${isBrushEnabled ? 'cursor-crosshair' : ''}`}
              onMouseDown={startDrawing}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onMouseMove={draw}
            />
          ) : (
            <div className="text-center text-gray-500">
              <UploadIcon className="mx-auto h-12 w-12" />
              <p>Upload an image to start</p>
            </div>
          )}
        </div>
      </div>
    );
  }
);

export default CanvasEditor;

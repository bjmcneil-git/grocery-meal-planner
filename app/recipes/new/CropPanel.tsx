"use client";

import { useRef, useState } from "react";

interface CropBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface CropPanelProps {
  images: string[];
  onCropped: (dataUrl: string) => void;
  onSkip: () => void;
}

const HANDLE_SIZE = 16;
const MIN_BOX_SIZE = 20;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export default function CropPanel({ images, onCropped, onSkip }: CropPanelProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [box, setBox] = useState<CropBox | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{
    mode: "move" | "resize";
    startX: number;
    startY: number;
    startBox: CropBox;
  } | null>(null);

  function initBox() {
    const img = imgRef.current;
    if (!img) return;
    const width = img.clientWidth * 0.6;
    const height = img.clientHeight * 0.6;
    setBox({
      x: (img.clientWidth - width) / 2,
      y: (img.clientHeight - height) / 2,
      width,
      height,
    });
  }

  function selectImage(index: number) {
    setSelectedIndex(index);
    setBox(null);
  }

  function handlePointerDown(e: React.PointerEvent, mode: "move" | "resize") {
    if (!box) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    dragRef.current = { mode, startX: e.clientX, startY: e.clientY, startBox: box };
  }

  function handlePointerMove(e: React.PointerEvent) {
    const drag = dragRef.current;
    const img = imgRef.current;
    if (!drag || !img) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;

    if (drag.mode === "move") {
      const maxX = Math.max(img.clientWidth - drag.startBox.width, 0);
      const maxY = Math.max(img.clientHeight - drag.startBox.height, 0);
      setBox({
        ...drag.startBox,
        x: clamp(drag.startBox.x + dx, 0, maxX),
        y: clamp(drag.startBox.y + dy, 0, maxY),
      });
    } else {
      const maxWidth = img.clientWidth - drag.startBox.x;
      const maxHeight = img.clientHeight - drag.startBox.y;
      setBox({
        ...drag.startBox,
        width: clamp(drag.startBox.width + dx, MIN_BOX_SIZE, maxWidth),
        height: clamp(drag.startBox.height + dy, MIN_BOX_SIZE, maxHeight),
      });
    }
  }

  function handlePointerUp() {
    dragRef.current = null;
  }

  function useThisCrop() {
    const img = imgRef.current;
    if (!img || !box) return;
    const scaleX = img.naturalWidth / img.clientWidth;
    const scaleY = img.naturalHeight / img.clientHeight;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(box.width * scaleX);
    canvas.height = Math.round(box.height * scaleY);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(
      img,
      box.x * scaleX,
      box.y * scaleY,
      box.width * scaleX,
      box.height * scaleY,
      0,
      0,
      canvas.width,
      canvas.height
    );
    onCropped(canvas.toDataURL("image/jpeg", 0.85));
  }

  return (
    <div className="mb-4 p-3 border rounded bg-gray-50">
      <p className="font-medium mb-2">Crop the dish photo for the thumbnail</p>
      {images.length > 1 && (
        <div className="flex gap-2 mb-2">
          {images.map((src, i) => (
            <button
              key={i}
              type="button"
              onClick={() => selectImage(i)}
              className={`border-2 rounded ${i === selectedIndex ? "border-pink-600" : "border-transparent"}`}
            >
              <img src={src} alt="" className="w-12 h-12 object-cover rounded" />
            </button>
          ))}
        </div>
      )}
      <div
        className="relative inline-block touch-none"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <img
          ref={imgRef}
          src={images[selectedIndex]}
          alt="Uploaded screenshot"
          className="max-w-full max-h-96 block"
          onLoad={initBox}
        />
        {box && (
          <div
            className="absolute border-2 border-pink-600 bg-pink-600/20 cursor-move"
            style={{ left: box.x, top: box.y, width: box.width, height: box.height }}
            onPointerDown={(e) => handlePointerDown(e, "move")}
          >
            <div
              className="absolute bg-pink-600 rounded-full cursor-nwse-resize"
              style={{
                right: -HANDLE_SIZE / 2,
                bottom: -HANDLE_SIZE / 2,
                width: HANDLE_SIZE,
                height: HANDLE_SIZE,
              }}
              onPointerDown={(e) => handlePointerDown(e, "resize")}
            />
          </div>
        )}
      </div>
      <div className="flex gap-2 mt-2">
        <button type="button" onClick={useThisCrop} className="bg-pink-600 text-white rounded px-3 py-1">
          Use this crop
        </button>
        <button type="button" onClick={onSkip} className="text-gray-600 rounded px-3 py-1">
          Skip
        </button>
      </div>
    </div>
  );
}

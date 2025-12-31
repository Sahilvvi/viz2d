// TextureDemo.tsx
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  ChangeEvent,
  MouseEvent,
} from "react";
import { TextureRenderer } from "@viz2d/core";

// ----------------------
// Types
// ----------------------
type SegmentWithMask = {
  segment_id: number;
  mask: Uint32Array;
  class_name: string;
};

type TextureInfo = {
  id: number;
  name: number;
  rotation: number;
  scale: number;
  offset_x: number;
  offset_y: number;
};

// ----------------------
// Helpers
// ----------------------
function getMouseIndex(
  e: MouseEvent<HTMLCanvasElement>,
  canvas: HTMLCanvasElement,
  width: number,
  height: number
) {
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor(((e.clientX - rect.left) / rect.width) * width);
  const y = Math.floor(((e.clientY - rect.top) / rect.height) * height);
  return x < 0 || y < 0 || x >= width || y >= height ? -1 : y * width + x;
}

// ----------------------
// UI Components
// ----------------------
const TextureSlider = ({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) => (
  <div>
    <div className="flex justify-between text-xs text-zinc-400">
      <span>{label}</span>
      <span>{value.toFixed(2)}</span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full accent-indigo-500"
    />
  </div>
);

const TextureCard = ({
  tex,
  onRemove,
  onUpdate,
}: {
  tex: TextureInfo;
  onRemove: (id: number) => void;
  onUpdate: (id: number, field: keyof TextureInfo, value: number) => void;
}) => (
  <div className="rounded-lg border border-zinc-700 p-3 space-y-1">
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium">Texture #{tex.id}</span>
      <button
        onClick={() => onRemove(tex.id)}
        className="text-xs rounded-md bg-red-600/80 px-2 py-1 hover:bg-red-600"
      >
        Remove
      </button>
    </div>

    <TextureSlider
      label="Rotation"
      value={tex.rotation}
      min={-180}
      max={180}
      step={1}
      onChange={(v) => onUpdate(tex.id, "rotation", v)}
    />
    <TextureSlider
      label="Scale"
      value={tex.scale}
      min={0.2}
      max={5}
      step={0.05}
      onChange={(v) => onUpdate(tex.id, "scale", v)}
    />
    <TextureSlider
      label="Offset X"
      value={tex.offset_x}
      min={-2}
      max={2}
      step={0.05}
      onChange={(v) => onUpdate(tex.id, "offset_x", v)}
    />
    <TextureSlider
      label="Offset Y"
      value={tex.offset_y}
      min={-2}
      max={2}
      step={0.05}
      onChange={(v) => onUpdate(tex.id, "offset_y", v)}
    />
  </div>
);

// ----------------------
// Main Component
// ----------------------
export default function Visualizer({ file }:{file:File}){
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const rendererRef = useRef(new TextureRenderer());
  const renderer = rendererRef.current;

  const [bundleLoaded, setBundleLoaded] = useState(false);
  const [isBundleLoading, setIsBundleLoading] = useState(false);
  const [isTextureLoading, setIsTextureLoading] = useState(false);

  const [textures, setTextures] = useState<TextureInfo[]>([]);
  const [segments, setSegments] = useState<SegmentWithMask[]>([]);
  const [segMap, setSegMap] = useState<Int32Array | null>(null);
  const [selectedSeg, setSelectedSeg] = useState<number | null>(null);
  const [hoverSeg, setHoverSeg] = useState<number | null>(null);
  const [imageSize, setImageSize] =
    useState<{ width: number; height: number } | null>(null);
  const [imageVersion, setImageVersion] = useState(0);

  const refreshTextures = useCallback(() => {
    const list = renderer.get_textures();
    setTextures(
      list.map((t: any) => ({
        id: t.id,
        name: t.name,
        rotation: t.rotation,
        scale: t.scale,
        offset_x: t.offset_x,
        offset_y: t.offset_y,
      }))
    );
    setImageVersion((v) => v + 1);
  }, [renderer]);

  const draw = useCallback(() => {
    if (!canvasRef.current) return;

    const out = renderer.get_output();
    const { width, height, pixels } = out;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    const img = new ImageData(new Uint8ClampedArray(pixels), width, height);

    if (hoverSeg != null) {
      const seg = segments.find((s) => s.segment_id === hoverSeg);
      if (seg) {
        for (const i of seg.mask) {
          const idx = i * 4;
          img.data[idx] *= 0.6;
          img.data[idx + 1] = Math.min(255, img.data[idx + 1] * 0.5 + 120);
          img.data[idx + 2] *= 0.6;
        }
      }
    }

    canvasRef.current.width = width;
    canvasRef.current.height = height;
    ctx.putImageData(img, 0, 0);
  }, [renderer, hoverSeg, segments]);

  useEffect(() => {
    if (bundleLoaded) draw();
  }, [imageVersion, hoverSeg, bundleLoaded, draw]);

  const loadFile = async () => {

    setIsBundleLoading(true);
    try {
      await renderer.load(
        new Uint8Array(await file.arrayBuffer())
      );

      const segs = renderer.get_segments() as SegmentWithMask[];
      setSegments(segs);

      const out = renderer.get_output();
      const map = new Int32Array(out.width * out.height).fill(-1);
      for (const s of segs) for (const idx of s.mask) map[idx] = s.segment_id;

      setSegMap(map);
      setImageSize({ width: out.width, height: out.height });
      setBundleLoaded(true);
      refreshTextures();
    } finally {
      setIsBundleLoading(false);
    }
  };

  useEffect(() => {
    loadFile();
  }, [file]);

  const handleMove = (e: MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !segMap || !imageSize) return;
    const idx = getMouseIndex(
      e,
      canvasRef.current,
      imageSize.width,
      imageSize.height
    );
    setHoverSeg(idx >= 0 ? segMap[idx] : null);
  };

  const handleClick = () => {
    if (hoverSeg == null || isBundleLoading || isTextureLoading) return;
    setSelectedSeg(hoverSeg);
    fileInputRef.current?.click();
  };

  const handleTextureUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || selectedSeg == null) return;

    const seg = segments.find((s) => s.segment_id === selectedSeg);
    if (!seg) return;

    setIsTextureLoading(true);
    try {
      await renderer.apply_texture(
        seg.mask,
        new Uint8Array(await file.arrayBuffer()),
        {
          name: 1,
          rotation: 0,
          scale: 1,
          offset_x: 0,
          offset_y: 0,
        }
      );
      refreshTextures();
    } finally {
      setIsTextureLoading(false);
      e.target.value = "";
    }
  };

  const updateTextureField = async (
    id: number,
    field: keyof TextureInfo,
    value: number
  ) => {
    setIsTextureLoading(true);
    try {
      await renderer.update_texture(id, { [field]: value } as any);
      refreshTextures();
    } finally {
      setIsTextureLoading(false);
    }
  };

  const removeTexture = async (id: number) => {
    setIsTextureLoading(true);
    try {
      await renderer.remove_texture(id);
      refreshTextures();
    } finally {
      setIsTextureLoading(false);
    }
  };

  // ----------------------
  // Render
  // ----------------------
  return (
    <div className="fixed inset-0 bg-zinc-950 text-zinc-100">
  <div className="flex flex-col lg:flex-row h-screen w-screen gap-4 p-3">

    {/* Sidebar */}
    <aside
      className="
        w-full lg:w-72
        h-auto lg:h-full
        border border-zinc-800 rounded-xl
        bg-zinc-900
        p-4
        space-y-3
        overflow-y-auto
      "
    >
      <div className="text-xs rounded-md border border-zinc-700 px-2 py-1 bg-zinc-950">
        Hovering:{" "}
        <b className="text-zinc-200">
          {segments.find(s => s.segment_id === hoverSeg)?.class_name || "none"}
        </b>
      </div>

      <h3 className="text-sm font-semibold">Textures</h3>

      {!bundleLoaded && (
        <p className="text-xs text-zinc-500">
          Load a bundle and click a segment
        </p>
      )}

      {bundleLoaded && textures.length === 0 && (
        <p className="text-xs text-zinc-500">No textures yet</p>
      )}

      {textures.map(tex => (
        <TextureCard
          key={tex.id}
          tex={tex}
          onRemove={removeTexture}
          onUpdate={updateTextureField}
        />
      ))}
    </aside>

    {/* Main */}
    <main className="flex-1 h-full">
      <div className="relative h-full rounded-xl border border-zinc-800 overflow-hidden bg-black">

        <canvas
          ref={canvasRef}
          onMouseMove={handleMove}
          onMouseLeave={() => setHoverSeg(null)}
          onClick={handleClick}
          className="
            block
            max-w-full
            max-h-full
            cursor-pointer
          "
          style={{
            pointerEvents:
              isBundleLoading || isTextureLoading ? "none" : "auto",
          }}
        />

        {(isBundleLoading || isTextureLoading) && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-sm text-zinc-200">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-500 border-t-transparent" />
              {isBundleLoading
                ? "Loading bundle…"
                : "Applying texture…"}
            </div>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleTextureUpload}
      />
    </main>
  </div>
</div>

  );
};

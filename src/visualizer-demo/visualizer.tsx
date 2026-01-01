'use client'
// TextureDemo.tsx
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { TextureRenderer } from "@viz2d/core";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { textureSamples } from "@/lib/samples";

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
function getHoverIndex(
  e: React.MouseEvent | React.TouchEvent,
  canvas: HTMLCanvasElement,
  width: number,
  height: number
) {
  let clientX: number | null = null
  let clientY: number | null = null

  if ("touches" in e) {
    const touch = e.touches[0]
    if (!touch) return
    clientX = touch.clientX
    clientY = touch.clientY
  } else {
    clientX = e.clientX
    clientY = e.clientY
  }

  const rect = canvas.getBoundingClientRect()

  const x = Math.floor(((clientX - rect.left) / rect.width) * width)
  const y = Math.floor(((clientY - rect.top) / rect.height) * height)

  return x < 0 || y < 0 || x >= width || y >= height
    ? -1
    : y * width + x
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
    <div className="flex justify-between text-xs">
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
      className="w-full accent-cyan-500"
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
  <div className="rounded-lg border p-3 space-y-1">
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium">Texture #{tex.id}</span>
      <Button
        onClick={() => onRemove(tex.id)}
        variant='destructive'
        size='sm'
      >
        Remove
      </Button>
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

const TextureSelector=({open,onOpenChange,onSelect}:{open:boolean,onOpenChange:(open:boolean)=>void,onSelect:(file:File,scale:number)=>void})=>{
  function loadInputTexture(e:React.ChangeEvent<HTMLInputElement>){
    onSelect(e.target.files?.[0]!,1)
    onOpenChange(false)
  }

  async function loadSampleTexture(url:string,scale:number){
    const response = await fetch(url)
    const blob = await response.blob()

    const file = new File([blob], "texture.png", {
      type: blob.type || "image/png",
      lastModified: Date.now(),
    })
    onSelect(file,scale)
    onOpenChange(false)
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Select Texture</DialogTitle>
        </DialogHeader>
        <div className="flex flex-wrap justify-center gap-4">

        <label htmlFor="textureinput" className="w-40 h-40 border shadow rounded flex flex-col gap-4 items-center justify-center cursor-pointer font-semibold">
          <input
            type="file"
            accept=".png,.jpg"
            id="textureinput"
            className="hidden"
            onChange={loadInputTexture}
          />
          <Upload/>
          Upload Texture
        </label>
        {
          textureSamples.map((t,index)=>(
            <div key={index} className="w-40 h-40 border shadow rounded cursor-pointer" onClick={()=>loadSampleTexture(t.url,t.scale)}>
              <img src={t.url} className="w-full h-full object-contain"/>
              </div>
          ))
        }
            </div>
      </DialogContent>
    </Dialog>
  )
}

// ----------------------
// Main Component
// ----------------------
export default function Visualizer({ file }: { file: File }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef(new TextureRenderer());
  const renderer = rendererRef.current;

  const [bundleLoaded, setBundleLoaded] = useState(false);
  const [isBundleLoading, setIsBundleLoading] = useState(false);
  const [isTextureLoading, setIsTextureLoading] = useState(false);

  const [textures, setTextures] = useState<TextureInfo[]>([]);
  const [segments, setSegments] = useState<SegmentWithMask[]>([]);
  const [segMap, setSegMap] = useState<Int32Array | null>(null);
  const [hoverSeg, setHoverSeg] = useState<number | null>(null);
  const [selectedSeg, setSelectedSeg] = useState<number | null>(null);
  const [imageSize, setImageSize] =
    useState<{ width: number; height: number } | null>(null);
  const [imageVersion, setImageVersion] = useState(0);

  const [textureSelectorOpen, setTextureSelectorOpen] = useState(false)

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
      renderer.load(
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

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!canvasRef.current || !segMap || !imageSize) return

    const idx = getHoverIndex(
      e,
      canvasRef.current,
      imageSize.width,
      imageSize.height
    )
    if (!idx) return

    setHoverSeg(idx >= 0 ? segMap[idx] : null)
  }


  const handleClick = (e: React.MouseEvent | React.TouchEvent) => {
    if (!canvasRef.current || !imageSize || !segMap) return;
    if (isBundleLoading || isTextureLoading) return;

    const clicked_idx = getHoverIndex(
      e,
      canvasRef.current,
      imageSize.width,
      imageSize.height)
    if(!clicked_idx) return

    if ( hoverSeg != segMap[clicked_idx]) return

    setSelectedSeg(hoverSeg)
    setTextureSelectorOpen(true)
  };

  const applyTexture = async (file:File,scale:number) => {
    if (!file) return;

    const seg = segments.find((s) => s.segment_id === selectedSeg);
    if (!seg) return;

    setIsTextureLoading(true);
    try {
      renderer.apply_texture(
        seg.mask,
        new Uint8Array(await file.arrayBuffer()),
        {
          name: 1,
          rotation: 0,
          scale,
          offset_x: 0,
          offset_y: 0,
        }
      );
      refreshTextures();
    } finally {
      setIsTextureLoading(false);
      setHoverSeg(null)
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
    <div className="fixed inset-0 bg-accent">
      <div className="flex flex-col lg:flex-row h-screen w-screen gap-4 p-3">

        {/* Sidebar */}
        <aside
          className="w-full lg:w-72 h-auto lg:h-full border rounded-xl p-4 space-y-3 overflow-y-auto"
        >
          <div className="text-xs rounded-md border px-2 py-1">
            Hovering:{" "}
            <b>
              {segments.find(s => s.segment_id === hoverSeg)?.class_name || "none"}
            </b>
          </div>

          <h3 className="text-sm font-semibold">Textures</h3>

          {!bundleLoaded && (
            <p className="text-xs">
              Load a bundle and click a segment
            </p>
          )}

          {bundleLoaded && textures.length === 0 && (
            <p className="text-xs">No textures yet</p>
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
          <div className="relative h-full rounded-xl border overflow-hidden">

            <canvas
              ref={canvasRef}
              onMouseMove={handleMove}
              onMouseLeave={() => setHoverSeg(null)}
              onClick={handleClick}
              onTouchMove={handleMove}
              onTouchCancel={() => setHoverSeg(null)}
              className="block max-w-full max-h-full cursor-pointer"
              style={{
                pointerEvents:
                  isBundleLoading || isTextureLoading ? "none" : "auto",
              }}
            />

            {(isBundleLoading || isTextureLoading) && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                <div className="flex items-center gap-2 text-sm text-secondary">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-t-transparent" />
                  {isBundleLoading
                    ? "Loading bundle…"
                    : "Applying texture…"}
                </div>
              </div>
            )}
          </div>

          <TextureSelector open={textureSelectorOpen} onOpenChange={(o)=>setTextureSelectorOpen(o)} onSelect={(f,s)=>applyTexture(f,s)}/>
        </main>
      </div>
    </div>

  );
};

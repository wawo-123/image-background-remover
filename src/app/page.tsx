"use client";

import {
  ChangeEvent,
  DragEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type ToolTab = "bg" | "id" | "erase";
type ItemStatus = "idle" | "uploading" | "success" | "error";
type SizePresetKey = "one-inch" | "two-inch" | "passport" | "square";
type BgColorKey = "white" | "blue" | "red" | "gray";
type StyleKey = "natural" | "polished" | "bright" | "studio";

type RemovalItem = {
  id: string;
  file: File;
  previewUrl: string;
  resultUrl: string;
  resultBlob: Blob | null;
  status: ItemStatus;
  error: string;
};

type SizePreset = {
  key: SizePresetKey;
  label: string;
  width: number;
  height: number;
  // desired proportion of subject bbox height to canvas height (rough)
  bboxHeightRatio: number;
  // desired top padding ratio from canvas top to subject bbox top
  topPadRatio: number;
  // desired bottom padding ratio from canvas bottom to subject bbox bottom
  bottomPadRatio: number;
};

type StylePreset = {
  key: StyleKey;
  label: string;
  desc: string;
  brightness: number;
  contrast: number;
  saturation: number;
  softGlow: number;
};

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const SIZE_PRESETS: SizePreset[] = [
  { key: "one-inch", label: "一寸", width: 295, height: 413, bboxHeightRatio: 1.0, topPadRatio: 0.0, bottomPadRatio: 0.0 },
  { key: "two-inch", label: "二寸", width: 413, height: 579, bboxHeightRatio: 1.0, topPadRatio: 0.0, bottomPadRatio: 0.0 },
  { key: "passport", label: "护照", width: 413, height: 531, bboxHeightRatio: 1.0, topPadRatio: 0.0, bottomPadRatio: 0.0 },
  { key: "square", label: "方图", width: 600, height: 600, bboxHeightRatio: 0.76, topPadRatio: 0.08, bottomPadRatio: 0.035 },
];

const BG_COLORS: Record<BgColorKey, { label: string; value: string }>= {
  white: { label: "白底", value: "#f8fafc" },
  blue: { label: "蓝底", value: "#4f86ff" },
  red: { label: "红底", value: "#d9465f" },
  gray: { label: "浅灰", value: "#d8dee9" },
};

const STYLE_PRESETS: StylePreset[] = [
  { key: "natural", label: "自然", desc: "真实自然", brightness: 1.02, contrast: 1.02, saturation: 1.02, softGlow: 0 },
  { key: "polished", label: "更好看", desc: "更精神一点", brightness: 1.08, contrast: 1.05, saturation: 1.08, softGlow: 0.05 },
  { key: "bright", label: "通透", desc: "更亮更清爽", brightness: 1.13, contrast: 1.05, saturation: 1.11, softGlow: 0.08 },
  { key: "studio", label: "海马体", desc: "更柔和更干净", brightness: 1.10, contrast: 1.03, saturation: 1.05, softGlow: 0.14 },
];

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function revokeUrl(url: string) {
  if (url) URL.revokeObjectURL(url);
}

function validateFile(file: File) {
  if (!ACCEPTED_TYPES.includes(file.type)) return "仅支持 JPG、PNG、WEBP 图片。";
  if (file.size > MAX_FILE_SIZE) return "图片不能超过 10MB。";
  return "";
}

function formatSize(size: number) {
  return `${(size / 1024 / 1024).toFixed(2)} MB`;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function loadImage(url: string) {
  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("图片加载失败"));
    img.src = url;
  });
}

function applyPixelStyle(imageData: ImageData, style: StylePreset) {
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a === 0) continue;

    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    r = ((r - 128) * style.contrast + 128) * style.brightness;
    g = ((g - 128) * style.contrast + 128) * style.brightness;
    b = ((b - 128) * style.contrast + 128) * style.brightness;

    const avg = (r + g + b) / 3;
    r = avg + (r - avg) * style.saturation;
    g = avg + (g - avg) * style.saturation;
    b = avg + (b - avg) * style.saturation;

    if (style.softGlow > 0) {
      r = r * (1 - style.softGlow) + 255 * style.softGlow;
      g = g * (1 - style.softGlow) + 255 * style.softGlow;
      b = b * (1 - style.softGlow) + 255 * style.softGlow;
    }

    data[i] = clamp255(r);
    data[i + 1] = clamp255(g);
    data[i + 2] = clamp255(b);
  }
  return imageData;
}

function clamp255(v: number) {
  return Math.max(0, Math.min(255, Math.round(v)));
}

type BBox = { minX: number; minY: number; maxX: number; maxY: number };

function computeAlphaBBox(imageData: ImageData, alphaThreshold = 12): BBox | null {
  const { data, width, height } = imageData;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = (y * width + x) * 4;
      const a = data[idx + 3];
      if (a > alphaThreshold) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < 0 || maxY < 0) return null;
  return { minX, minY, maxX, maxY };
}

async function renderIdPhotoBlob(
  cutoutUrl: string,
  presetKey: SizePresetKey,
  bgColor: BgColorKey,
  styleKey: StyleKey
) {
  const preset = SIZE_PRESETS.find((p) => p.key === presetKey) ?? SIZE_PRESETS[0];
  const style = STYLE_PRESETS.find((s) => s.key === styleKey) ?? STYLE_PRESETS[0];

  const cutoutImg = await loadImage(cutoutUrl);

  // draw cutout to temp canvas to measure bbox (alpha)
  const measureMax = 520;
  const measureScale = Math.min(1, measureMax / Math.max(cutoutImg.width, cutoutImg.height));
  const measureW = Math.max(1, Math.round(cutoutImg.width * measureScale));
  const measureH = Math.max(1, Math.round(cutoutImg.height * measureScale));

  const measureCanvas = document.createElement("canvas");
  measureCanvas.width = measureW;
  measureCanvas.height = measureH;
  const mctx = measureCanvas.getContext("2d");
  if (!mctx) throw new Error("测量画布初始化失败");
  mctx.clearRect(0, 0, measureW, measureH);
  mctx.drawImage(cutoutImg, 0, 0, measureW, measureH);
  const measureData = mctx.getImageData(0, 0, measureW, measureH);
  const bbox = computeAlphaBBox(measureData);

  // output canvas
  const canvas = document.createElement("canvas");
  canvas.width = preset.width;
  canvas.height = preset.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("证件照画布初始化失败");

  ctx.fillStyle = BG_COLORS[bgColor].value;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // draw cutout into a styled layer at its natural resolution then scale to fit
  const layerCanvas = document.createElement("canvas");
  layerCanvas.width = cutoutImg.width;
  layerCanvas.height = cutoutImg.height;
  const lctx = layerCanvas.getContext("2d");
  if (!lctx) throw new Error("证件照图层初始化失败");
  lctx.clearRect(0, 0, layerCanvas.width, layerCanvas.height);
  lctx.drawImage(cutoutImg, 0, 0);
  const styled = lctx.getImageData(0, 0, layerCanvas.width, layerCanvas.height);
  lctx.putImageData(applyPixelStyle(styled, style), 0, 0);

  // fit subject bbox to desired size so it doesn't look too small
  let drawX = canvas.width * 0.1;
  let drawY = canvas.height * preset.topPadRatio;
  let drawW = canvas.width * 0.8;
  let drawH = canvas.height * 0.85;

  if (bbox) {
    const bboxW = (bbox.maxX - bbox.minX + 1) / measureScale;
    const bboxH = (bbox.maxY - bbox.minY + 1) / measureScale;

    // Scale to fit BOTH top & bottom paddings (and avoid horizontal overflow).
    const targetTop = canvas.height * preset.topPadRatio;
    const targetBottom = canvas.height * (1 - preset.bottomPadRatio);
    const availableH = Math.max(1, targetBottom - targetTop);
    const availableW = canvas.width;

    const scaleH = availableH / bboxH;
    const scaleW = availableW / bboxW;
    const scale = Math.min(scaleH, scaleW);

    const scaledImgW = cutoutImg.width * scale;
    const scaledImgH = cutoutImg.height * scale;

    // bbox in scaled image coords
    const bboxTop = (bbox.minY / measureScale) * scale;
    const bboxLeft = (bbox.minX / measureScale) * scale;
    const bboxBottom = (bbox.maxY / measureScale) * scale;

    // Center by bbox horizontally
    const targetLeft = (canvas.width - bboxW * scale) / 2;
    drawX = targetLeft - bboxLeft;

    // Bottom-anchor so clothes sit at the bottom; with scale chosen above, top will also fit.
    drawY = targetBottom - bboxBottom;

    // Square avatar: still prefer top-ish framing.
    if (presetKey === "square") {
      drawY = targetTop - bboxTop;
    }

    drawW = scaledImgW;
    drawH = scaledImgH;
  }

  ctx.save();
  ctx.shadowColor = "rgba(15, 23, 42, 0.14)";
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 8;
  ctx.drawImage(layerCanvas, drawX, drawY, drawW, drawH);
  ctx.restore();

  // subtle highlight
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fillRect(0, 0, canvas.width, canvas.height * 0.16);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("证件照生成失败"))), "image/png");
  });
}

function findMaskBBox(mask: Uint8ClampedArray, width: number, height: number, threshold = 20) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = (y * width + x) * 4;
      const a = mask[idx + 3];
      const r = mask[idx];
      if (a > threshold || r > threshold) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < 0) return null;
  return { minX, minY, maxX, maxY };
}

async function createMaskBlob(maskCanvas: HTMLCanvasElement) {
  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = maskCanvas.width;
  exportCanvas.height = maskCanvas.height;
  const ctx = exportCanvas.getContext("2d");
  const sourceCtx = maskCanvas.getContext("2d");
  if (!ctx || !sourceCtx) throw new Error("Mask 生成失败");

  const data = sourceCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
  const out = ctx.createImageData(maskCanvas.width, maskCanvas.height);

  for (let i = 0; i < data.data.length; i += 4) {
    const active = data.data[i + 3] > 10 || data.data[i + 1] > 10;
    const v = active ? 255 : 0;
    out.data[i] = v;
    out.data[i + 1] = v;
    out.data[i + 2] = v;
    out.data[i + 3] = 255;
  }

  ctx.putImageData(out, 0, 0);
  return await new Promise<Blob>((resolve, reject) => {
    exportCanvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Mask 导出失败"))), "image/png");
  });
}

let openCvPromise: Promise<any> | null = null;
let inpaintWorker: Worker | null = null;
let inpaintWorkerWarmup: Promise<void> | null = null;

function getInpaintWorker() {
  if (typeof window === "undefined") throw new Error("浏览器环境不可用");
  if (!inpaintWorker) {
    inpaintWorker = new Worker("/vendor/inpaint-worker.js");
  }
  return inpaintWorker;
}

function warmupInpaintWorker() {
  if (typeof window === "undefined") return Promise.resolve();
  if (inpaintWorkerWarmup) return inpaintWorkerWarmup;

  const worker = getInpaintWorker();
  const jobId = `warmup-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  inpaintWorkerWarmup = new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      inpaintWorkerWarmup = null;
      reject(new Error("AI 修复引擎预热超时"));
    }, 12000);

    const onMessage = (evt: MessageEvent) => {
      const msg = evt.data || {};
      if (msg.id !== jobId) return;
      cleanup();
      if (msg.ok) resolve();
      else {
        inpaintWorkerWarmup = null;
        reject(new Error(msg.error || "AI 修复引擎预热失败"));
      }
    };

    const onError = () => {
      cleanup();
      inpaintWorkerWarmup = null;
      reject(new Error("AI 修复引擎预热失败"));
    };

    const cleanup = () => {
      clearTimeout(timeout);
      worker.removeEventListener("message", onMessage);
      worker.removeEventListener("error", onError);
    };

    worker.addEventListener("message", onMessage);
    worker.addEventListener("error", onError);
    worker.postMessage({ type: "warmup", id: jobId });
  });

  return inpaintWorkerWarmup;
}

async function loadOpenCv() {
  if (typeof window === "undefined") throw new Error("浏览器环境不可用");

  const w = window as any;
  if (w.cv?.inpaint) return w.cv;

  const waitUntilReady = () =>
    new Promise<any>((resolve, reject) => {
      const start = Date.now();
      const timeoutMs = 45000;

      const tick = () => {
        const cv = w.cv;
        if (cv?.inpaint) {
          resolve(cv);
          return;
        }
        if (Date.now() - start > timeoutMs) {
          reject(new Error("OpenCV 加载超时，请刷新页面重试"));
          return;
        }
        setTimeout(tick, 120);
      };

      tick();
    });

  if (!openCvPromise) {
    openCvPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-opencv="true"]') as HTMLScriptElement | null;

      const afterScript = async () => {
        try {
          const cv = await waitUntilReady();
          resolve(cv);
        } catch (e) {
          reject(e);
        }
      };

      if (existing) {
        // script 已插入
        afterScript();
        return;
      }

      const script = document.createElement("script");
      script.src = "/vendor/opencv.js";
      script.async = true;
      script.defer = true;
      script.dataset.opencv = "true";
      script.onload = () => void afterScript();
      script.onerror = () => reject(new Error("OpenCV 加载失败"));
      document.body.appendChild(script);
    });
  }

  return await openCvPromise;
}

async function localInpaint(baseCanvas: HTMLCanvasElement, maskCanvas: HTMLCanvasElement) {
  await warmupInpaintWorker();

  const maskCtx = maskCanvas.getContext("2d");
  if (!maskCtx) throw new Error("画布初始化失败");

  const maskImage = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
  const bbox = findMaskBBox(maskImage.data, maskCanvas.width, maskCanvas.height);
  if (!bbox) throw new Error("请先涂抹要消除的区域");

  const pad = 24;
  const x = Math.max(0, bbox.minX - pad);
  const y = Math.max(0, bbox.minY - pad);
  const w = Math.min(baseCanvas.width - x, bbox.maxX - bbox.minX + 1 + pad * 2);
  const h = Math.min(baseCanvas.height - y, bbox.maxY - bbox.minY + 1 + pad * 2);

  const maxSide = 320;
  const scale = Math.min(1, maxSide / Math.max(w, h));
  const sw = Math.max(1, Math.round(w * scale));
  const sh = Math.max(1, Math.round(h * scale));

  const srcCanvas = document.createElement("canvas");
  srcCanvas.width = sw;
  srcCanvas.height = sh;
  const srcCtx = srcCanvas.getContext("2d");
  if (!srcCtx) throw new Error("临时画布失败");
  srcCtx.drawImage(baseCanvas, x, y, w, h, 0, 0, sw, sh);
  const originalData = srcCtx.getImageData(0, 0, sw, sh);

  const regionMaskCanvas = document.createElement("canvas");
  regionMaskCanvas.width = sw;
  regionMaskCanvas.height = sh;
  const regionMaskCtx = regionMaskCanvas.getContext("2d");
  if (!regionMaskCtx) throw new Error("临时画布失败");
  regionMaskCtx.drawImage(maskCanvas, x, y, w, h, 0, 0, sw, sh);

  const rawMask = regionMaskCtx.getImageData(0, 0, sw, sh);
  const maskGray = new Uint8ClampedArray(sw * sh);
  for (let i = 0, p = 0; i < rawMask.data.length; i += 4, p += 1) {
    maskGray[p] = rawMask.data[i + 3] > 10 || rawMask.data[i + 1] > 10 ? 255 : 0;
  }

  const featherCanvas = document.createElement("canvas");
  featherCanvas.width = sw;
  featherCanvas.height = sh;
  const featherCtx = featherCanvas.getContext("2d");
  if (!featherCtx) throw new Error("临时画布失败");
  const maskCanvas2 = document.createElement("canvas");
  maskCanvas2.width = sw;
  maskCanvas2.height = sh;
  const maskCanvas2Ctx = maskCanvas2.getContext("2d");
  if (!maskCanvas2Ctx) throw new Error("临时画布失败");
  const maskImageData = maskCanvas2Ctx.createImageData(sw, sh);
  for (let i = 0, p = 0; i < maskImageData.data.length; i += 4, p += 1) {
    const v = maskGray[p];
    maskImageData.data[i] = v;
    maskImageData.data[i + 1] = v;
    maskImageData.data[i + 2] = v;
    maskImageData.data[i + 3] = 255;
  }
  maskCanvas2Ctx.putImageData(maskImageData, 0, 0);
  featherCtx.filter = "blur(8px)";
  featherCtx.drawImage(maskCanvas2, 0, 0);
  featherCtx.filter = "none";
  const featherData = featherCtx.getImageData(0, 0, sw, sh);

  const worker = getInpaintWorker();
  const jobId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const outBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("处理超时，请缩小涂抹范围后重试"));
    }, 12000);

    const onMessage = (evt: MessageEvent) => {
      const msg = evt.data || {};
      if (msg.id !== jobId) return;
      cleanup();
      if (msg.ok) resolve(msg.outBuffer);
      else reject(new Error(msg.error || "AI 修复失败"));
    };

    const onError = () => {
      cleanup();
      inpaintWorkerWarmup = null;
      reject(new Error("AI 修复进程启动失败"));
    };

    const cleanup = () => {
      clearTimeout(timeout);
      worker.removeEventListener("message", onMessage);
      worker.removeEventListener("error", onError);
    };

    worker.addEventListener("message", onMessage);
    worker.addEventListener("error", onError);
    worker.postMessage(
      {
        id: jobId,
        width: sw,
        height: sh,
        srcBuffer: originalData.data.buffer,
        maskBuffer: maskGray.buffer,
        radius: 2,
      },
      [originalData.data.buffer, maskGray.buffer]
    );
  });

  const inpaintData = new ImageData(new Uint8ClampedArray(outBuffer), sw, sh);
  const blendedCanvas = document.createElement("canvas");
  blendedCanvas.width = sw;
  blendedCanvas.height = sh;
  const blendedCtx = blendedCanvas.getContext("2d");
  if (!blendedCtx) throw new Error("结果合成失败");
  const finalData = blendedCtx.createImageData(sw, sh);
  for (let i = 0; i < finalData.data.length; i += 4) {
    const alpha = featherData.data[i] / 255;
    finalData.data[i] = Math.round(originalData.data[i] * (1 - alpha) + inpaintData.data[i] * alpha);
    finalData.data[i + 1] = Math.round(originalData.data[i + 1] * (1 - alpha) + inpaintData.data[i + 1] * alpha);
    finalData.data[i + 2] = Math.round(originalData.data[i + 2] * (1 - alpha) + inpaintData.data[i + 2] * alpha);
    finalData.data[i + 3] = 255;
  }
  blendedCtx.putImageData(finalData, 0, 0);

  const finalCanvas = document.createElement("canvas");
  finalCanvas.width = baseCanvas.width;
  finalCanvas.height = baseCanvas.height;
  const finalCtx = finalCanvas.getContext("2d");
  if (!finalCtx) throw new Error("结果合成失败");
  finalCtx.drawImage(baseCanvas, 0, 0);
  finalCtx.drawImage(blendedCanvas, 0, 0, sw, sh, x, y, w, h);

  return await new Promise<Blob>((resolve, reject) => {
    finalCanvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("输出失败"))), "image/png");
  });
}

export default function Home() {
  const [tab, setTab] = useState<ToolTab>("bg");

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.22),transparent_45%),radial-gradient(circle_at_bottom_right,rgba(168,85,247,0.18),transparent_45%),radial-gradient(circle_at_center,rgba(16,185,129,0.10),transparent_55%)]" />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/60 via-slate-950/95 to-slate-950" />
      </div>

      <section className="mx-auto w-full max-w-7xl px-5 py-8 md:px-8 lg:px-10 lg:py-10">
        <header className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 shadow-2xl shadow-sky-950/25 backdrop-blur md:p-10">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.34em] text-sky-300">image-process-online.xyz</p>
              <h1 className="mt-4 text-3xl font-bold tracking-tight md:text-5xl">图片处理</h1>
              <p className="mt-4 text-sm leading-7 text-slate-200/90 md:text-base">背景消除 · 证件照 · 消除</p>
            </div>
          </div>

          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            <TabCard active={tab === "bg"} tone="sky" title="背景消除" subtitle="支持批量" onClick={() => setTab("bg")} />
            <TabCard active={tab === "id"} tone="violet" title="证件照" subtitle="一键生成" onClick={() => setTab("id")} />
            <TabCard active={tab === "erase"} tone="emerald" title="AI 消除" subtitle="局部处理" onClick={() => setTab("erase")} />
          </div>
        </header>

        <div className="mt-8">
          {tab === "bg" && <BackgroundRemover />}
          {tab === "id" && <IdPhotoMaker />}
          {tab === "erase" && <AiEraser />}
        </div>

        <footer className="mt-10 text-center text-xs text-slate-400">处理完成后可直接下载</footer>
      </section>
    </main>
  );
}

function BackgroundRemover() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [items, setItems] = useState<RemovalItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");

  const hasResults = items.some((i) => i.resultUrl);
  const counts = useMemo(() => {
    const uploading = items.filter((i) => i.status === "uploading").length;
    const ok = items.filter((i) => i.status === "success").length;
    const bad = items.filter((i) => i.status === "error").length;
    return { uploading, ok, bad };
  }, [items]);

  function appendFiles(list: FileList | File[]) {
    const incoming = Array.from(list);
    if (!incoming.length) return;

    const valid: RemovalItem[] = [];
    let firstErr = "";

    for (const file of incoming) {
      const v = validateFile(file);
      if (v) {
        if (!firstErr) firstErr = `${file.name}：${v}`;
        continue;
      }
      valid.push({
        id: createId(),
        file,
        previewUrl: URL.createObjectURL(file),
        resultUrl: "",
        resultBlob: null,
        status: "idle",
        error: "",
      });
    }

    if (valid.length) {
      setItems((cur) => [...cur, ...valid]);
      setError("");
    } else if (firstErr) {
      setError(firstErr);
    }
  }

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.length) return;
    appendFiles(e.target.files);
    e.target.value = "";
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    if (!e.dataTransfer.files?.length) return;
    appendFiles(e.dataTransfer.files);
  }

  function clearAll() {
    setItems((cur) => {
      cur.forEach((it) => {
        revokeUrl(it.previewUrl);
        revokeUrl(it.resultUrl);
      });
      return [];
    });
    setError("");
  }

  function removeOne(id: string) {
    setItems((cur) => {
      const target = cur.find((x) => x.id === id);
      if (target) {
        revokeUrl(target.previewUrl);
        revokeUrl(target.resultUrl);
      }
      return cur.filter((x) => x.id !== id);
    });
  }

  async function processItem(itemId: string) {
    const target = items.find((i) => i.id === itemId);
    if (!target) return;

    setItems((cur) => cur.map((i) => (i.id === itemId ? { ...i, status: "uploading", error: "" } : i)));

    const form = new FormData();
    form.append("file", target.file);

    try {
      const res = await fetch("/api/remove-background", { method: "POST", body: form });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "背景消除失败，请稍后重试");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      setItems((cur) =>
        cur.map((i) => {
          if (i.id !== itemId) return i;
          revokeUrl(i.resultUrl);
          return { ...i, status: "success", resultBlob: blob, resultUrl: url, error: "" };
        })
      );
    } catch (err) {
      setItems((cur) =>
        cur.map((i) =>
          i.id === itemId
            ? { ...i, status: "error", error: err instanceof Error ? err.message : "背景消除失败" }
            : i
        )
      );
    }
  }

  async function processAll() {
    const targets = items.filter((i) => i.status !== "uploading");
    for (const item of targets) {
      // eslint-disable-next-line no-await-in-loop
      await processItem(item.id);
    }
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 backdrop-blur md:p-8">
        <div
          onDrop={onDrop}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          className={`rounded-[1.5rem] border-2 border-dashed p-5 transition md:p-7 ${
            dragging ? "border-sky-400 bg-sky-400/10" : "border-white/15 bg-slate-950/40"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={onFileChange}
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-lg font-semibold">上传图片</p>
              <p className="mt-1 text-sm text-slate-300">支持追加上传，多张一起处理。</p>
            </div>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-sky-100"
            >
              {items.length ? "继续添加" : "选择图片"}
            </button>
          </div>

          <div className="mt-4 text-xs text-slate-400">JPG / PNG / WEBP · 单张 ≤ 10MB</div>

          {items.length ? (
            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((it) => (
                <div key={it.id} className="rounded-[1.25rem] border border-white/10 bg-white/[0.04] p-3">
                  <div className="relative overflow-hidden rounded-xl bg-slate-900/70">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={it.previewUrl} alt={it.file.name} className="aspect-[4/3] w-full object-cover" />
                    <span className="absolute left-3 top-3 rounded-full bg-slate-950/80 px-3 py-1 text-xs font-medium">
                      {it.status === "success" ? "完成" : it.status === "uploading" ? "处理中" : it.status === "error" ? "失败" : "待处理"}
                    </span>
                  </div>
                  <div className="mt-3">
                    <p className="truncate text-sm font-semibold">{it.file.name}</p>
                    <p className="mt-1 text-xs text-slate-400">{formatSize(it.file.size)}</p>
                    {it.error && <p className="mt-2 text-xs text-rose-300">{it.error}</p>}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => processItem(it.id)}
                      disabled={it.status === "uploading"}
                      className="rounded-full bg-sky-500 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-sky-300"
                    >
                      {it.status === "uploading" ? "处理中" : it.status === "success" ? "再处理" : "开始"}
                    </button>
                    {it.resultBlob && (
                      <button
                        type="button"
                        onClick={() => downloadBlob(it.resultBlob as Blob, `${it.file.name.replace(/\.[^.]+$/, "")}-transparent.png`)}
                        className="rounded-full border border-white/15 px-4 py-2 text-xs font-medium text-slate-200 hover:bg-white/5"
                      >
                        下载
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => removeOne(it.id)}
                      className="rounded-full border border-white/15 px-4 py-2 text-xs font-medium text-slate-200 hover:bg-white/5"
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-6 rounded-[1.25rem] border border-white/10 bg-white/[0.04] px-5 py-6 text-sm text-slate-300">
              拖拽图片到这里，或点击按钮选择。
            </div>
          )}
        </div>

        <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-slate-950/60 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-slate-200">
              {items.length ? (
                <span>
                  共 {items.length} 张 · 完成 {counts.ok} · 失败 {counts.bad}
                  {counts.uploading ? ` · 处理中 ${counts.uploading}` : ""}
                </span>
              ) : (
                <span>先选图，再开始批量处理。</span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={clearAll}
                disabled={!items.length}
                className="rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-white/5 disabled:opacity-40"
              >
                清空
              </button>
              <button
                type="button"
                onClick={processAll}
                disabled={!items.length}
                className="rounded-full bg-sky-500 px-5 py-2 text-sm font-semibold text-white hover:bg-sky-400 disabled:bg-sky-300"
              >
                批量处理
              </button>
            </div>
          </div>
          {error && <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>}
        </div>
      </div>

      <div className="rounded-[2rem] border border-white/10 bg-white p-6 text-slate-900 shadow-2xl shadow-slate-950/20 md:p-8">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">结果预览</h3>
          {hasResults && <span className="text-xs text-slate-500">透明 PNG 可逐张下载</span>}
        </div>
        <div className="mt-4">
          {hasResults ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {items
                .filter((x) => x.resultUrl)
                .map((x) => (
                  <div key={x.id} className="rounded-[1.25rem] border border-slate-200 p-3">
                    <div className="rounded-[1rem] bg-[linear-gradient(45deg,#e5e7eb_25%,transparent_25%),linear-gradient(-45deg,#e5e7eb_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#e5e7eb_75%),linear-gradient(-45deg,transparent_75%,#e5e7eb_75%)] bg-[length:18px_18px] bg-[position:0_0,0_9px,9px_-9px,-9px_0px] p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={x.resultUrl} alt="result" className="aspect-[4/3] w-full object-contain" />
                    </div>
                    <p className="mt-3 truncate text-sm font-semibold">{x.file.name}</p>
                  </div>
                ))}
            </div>
          ) : (
            <EmptyCard text="处理成功后会在这里看到透明 PNG 结果。" />
          )}
        </div>
      </div>
    </section>
  );
}

function IdPhotoMaker() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [cutoutUrl, setCutoutUrl] = useState("");
  const [resultUrl, setResultUrl] = useState("");
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [status, setStatus] = useState<ItemStatus>("idle");
  const [error, setError] = useState("");
  const [sizePreset, setSizePreset] = useState<SizePresetKey>("one-inch");
  const [bgColor, setBgColor] = useState<BgColorKey>("blue");
  const [styleKey, setStyleKey] = useState<StyleKey>("natural");

  function resetAll() {
    revokeUrl(previewUrl);
    revokeUrl(cutoutUrl);
    revokeUrl(resultUrl);
    setFile(null);
    setPreviewUrl("");
    setCutoutUrl("");
    setResultUrl("");
    setResultBlob(null);
    setStatus("idle");
    setError("");
  }

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const next = e.target.files?.[0];
    if (!next) return;
    const v = validateFile(next);
    if (v) {
      setError(v);
      setStatus("error");
      return;
    }
    resetAll();
    const url = URL.createObjectURL(next);
    setFile(next);
    setPreviewUrl(url);
    e.target.value = "";
  }

  async function generate() {
    if (!file) {
      setError("请先上传一张人像照片");
      setStatus("error");
      return;
    }

    setStatus("uploading");
    setError("");

    try {
      let activeCutout = cutoutUrl;
      if (!activeCutout) {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/remove-background", { method: "POST", body: form });
        if (!res.ok) {
          const payload = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error || "抠图失败，请稍后重试");
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        revokeUrl(cutoutUrl);
        setCutoutUrl(url);
        activeCutout = url;
      }

      const outBlob = await renderIdPhotoBlob(activeCutout, sizePreset, bgColor, styleKey);
      revokeUrl(resultUrl);
      setResultBlob(outBlob);
      setResultUrl(URL.createObjectURL(outBlob));
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "证件照生成失败");
    }
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
      <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 backdrop-blur md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">证件照制作</h2>
            <p className="mt-1 text-sm text-slate-300">上传 → 一键生成（自动抠图 + 自动贴合人物大小）</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-violet-100"
            >
              {file ? "换一张" : "上传照片"}
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={onFileChange}
            />
          </div>
        </div>

        <div className="mt-4 rounded-[1.25rem] border border-amber-300/20 bg-amber-400/10 px-5 py-4 text-sm text-amber-100">
          <span className="font-semibold text-white">建议照片：</span>
          正面、头部端正、肩膀平、头顶到胸口（或上半身），背景尽量干净，光线均匀。
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <SettingCard title="尺寸">
            <div className="grid grid-cols-2 gap-2">
              {SIZE_PRESETS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setSizePreset(p.key)}
                  className={`rounded-xl border px-3 py-2 text-left text-sm transition ${
                    p.key === sizePreset
                      ? "border-violet-400 bg-violet-400/10 text-white"
                      : "border-white/10 bg-slate-950/40 text-slate-200 hover:bg-white/5"
                  }`}
                >
                  {p.label}
                  <span className="ml-2 text-xs text-slate-300">{p.width}×{p.height}</span>
                </button>
              ))}
            </div>
          </SettingCard>

          <SettingCard title="底色">
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(BG_COLORS) as BgColorKey[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setBgColor(k)}
                  className={`rounded-xl border px-3 py-2 text-left text-sm transition ${
                    k === bgColor
                      ? "border-violet-400 bg-violet-400/10 text-white"
                      : "border-white/10 bg-slate-950/40 text-slate-200 hover:bg-white/5"
                  }`}
                >
                  <span className="inline-flex items-center gap-2">
                    <span className="h-4 w-4 rounded-full border border-white/20" style={{ backgroundColor: BG_COLORS[k].value }} />
                    {BG_COLORS[k].label}
                  </span>
                </button>
              ))}
            </div>
          </SettingCard>
        </div>

        <div className="mt-4">
          <SettingCard title="风格">
            <div className="grid gap-2 sm:grid-cols-2">
              {STYLE_PRESETS.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setStyleKey(s.key)}
                  className={`rounded-xl border px-3 py-2 text-left text-sm transition ${
                    s.key === styleKey
                      ? "border-violet-400 bg-violet-400/10 text-white"
                      : "border-white/10 bg-slate-950/40 text-slate-200 hover:bg-white/5"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{s.label}</span>
                    <span className="text-xs text-slate-300">{s.desc}</span>
                  </div>
                </button>
              ))}
            </div>
          </SettingCard>
        </div>

        <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-slate-950/60 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-slate-200">切换尺寸/底色/风格后，直接再次点击生成即可。</div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={generate}
                disabled={!file || status === "uploading"}
                className="rounded-full bg-violet-500 px-5 py-2 text-sm font-semibold text-white hover:bg-violet-400 disabled:bg-violet-300"
              >
                {status === "uploading" ? "生成中…" : "一键生成"}
              </button>
              <button
                type="button"
                onClick={resetAll}
                className="rounded-full border border-white/15 px-5 py-2 text-sm font-medium text-slate-200 hover:bg-white/5"
              >
                清空
              </button>
            </div>
          </div>
          {error && <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>}
        </div>
      </div>

      <div className="rounded-[2rem] border border-white/10 bg-white p-6 text-slate-900 shadow-2xl shadow-slate-950/20 md:p-8">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
          <PreviewPanel title="原图">
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt="portrait" className="aspect-[4/5] w-full rounded-[1.25rem] object-cover" />
            ) : (
              <EmptyCard text="上传人像后预览会显示在这里。" />
            )}
          </PreviewPanel>

          <PreviewPanel title="抠图（自动）">
            {cutoutUrl ? (
              <div className="rounded-[1.25rem] bg-[linear-gradient(45deg,#e5e7eb_25%,transparent_25%),linear-gradient(-45deg,#e5e7eb_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#e5e7eb_75%),linear-gradient(-45deg,transparent_75%,#e5e7eb_75%)] bg-[length:18px_18px] bg-[position:0_0,0_9px,9px_-9px,-9px_0px] p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={cutoutUrl} alt="cutout" className="aspect-[4/5] w-full object-contain" />
              </div>
            ) : (
              <EmptyCard text="生成时会自动抠图，你不用手动操作。" />
            )}
          </PreviewPanel>

          <PreviewPanel title="证件照输出">
            {resultUrl ? (
              <div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={resultUrl} alt="id" className="w-full rounded-[1.25rem] border border-slate-200" />
                <button
                  type="button"
                  onClick={() => resultBlob && downloadBlob(resultBlob, `id-photo-${sizePreset}-${bgColor}-${styleKey}.png`)}
                  className="mt-4 w-full rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  下载 PNG
                </button>
              </div>
            ) : (
              <EmptyCard text="生成成功后会在这里看到证件照。" />
            )}
          </PreviewPanel>
        </div>
      </div>
    </section>
  );
}

function AiEraser() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const imageCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [pendingDrawUrl, setPendingDrawUrl] = useState("");
  const [resultUrl, setResultUrl] = useState("");
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<ItemStatus>("idle");
  const [brushSize, setBrushSize] = useState(28);
  const [drawing, setDrawing] = useState(false);

  async function drawBase(url: string) {
    const base = imageCanvasRef.current;
    const mask = maskCanvasRef.current;
    if (!base || !mask) return false;

    const img = await loadImage(url);
    const maxW = 720;
    const w = Math.min(maxW, img.width);
    const h = Math.round(img.height * (w / img.width));

    base.width = w;
    base.height = h;
    mask.width = w;
    mask.height = h;

    const bctx = base.getContext("2d");
    const mctx = mask.getContext("2d");
    if (!bctx || !mctx) return false;

    bctx.clearRect(0, 0, w, h);
    bctx.drawImage(img, 0, 0, w, h);

    mctx.clearRect(0, 0, w, h);
    mctx.lineCap = "round";
    mctx.lineJoin = "round";
    mctx.strokeStyle = "rgba(34, 197, 94, 0.92)";
    mctx.fillStyle = "rgba(34, 197, 94, 0.92)";
    mctx.lineWidth = brushSize;
    return true;
  }

  useEffect(() => {
    if (!pendingDrawUrl) return;
    let cancelled = false;

    const run = async () => {
      const ok = await drawBase(pendingDrawUrl);
      if (!cancelled && ok) {
        setPendingDrawUrl("");
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [pendingDrawUrl, brushSize]);

  function resetMask() {
    const mask = maskCanvasRef.current;
    const ctx = mask?.getContext("2d");
    if (!mask || !ctx) return;
    ctx.clearRect(0, 0, mask.width, mask.height);
  }

  async function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const next = e.target.files?.[0];
    if (!next) return;
    const v = validateFile(next);
    if (v) {
      setError(v);
      setStatus("error");
      return;
    }

    revokeUrl(sourceUrl);
    revokeUrl(resultUrl);

    const url = URL.createObjectURL(next);
    setSourceFile(next);
    setSourceUrl(url);
    setPendingDrawUrl(url);
    setResultUrl("");
    setResultBlob(null);
    setError("");
    setStatus("idle");

    // Prewarm AI erase engine in background to avoid cold-start timeout.
    void warmupInpaintWorker().catch(() => {
      // ignore; actual run will surface error if it still fails
    });

    e.target.value = "";
  }

  function canvasPoint(event: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = maskCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function start(event: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = maskCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    canvas.setPointerCapture(event.pointerId);
    setDrawing(true);
    ctx.lineWidth = brushSize;

    const { x, y } = canvasPoint(event);
    ctx.beginPath();
    ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function move(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawing) return;
    const canvas = maskCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    ctx.lineWidth = brushSize;
    const { x, y } = canvasPoint(event);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function stop(event: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = maskCanvasRef.current;
    if (canvas && canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
    setDrawing(false);
  }

  async function erase() {
    const base = imageCanvasRef.current;
    const mask = maskCanvasRef.current;
    if (!base || !mask || !sourceFile) {
      setError("请先上传图片并涂抹要消除的区域");
      setStatus("error");
      return;
    }

    setStatus("uploading");
    setError("");

    try {
      const blob = await localInpaint(base, mask);
      revokeUrl(resultUrl);
      setResultBlob(blob);
      setResultUrl(URL.createObjectURL(blob));
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "AI 修复失败");
    }
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 backdrop-blur md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">AI 消除</h2>
            <p className="mt-1 text-sm text-slate-300">涂抹后开始处理</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-100"
            >
              {sourceFile ? "换一张" : "上传图片"}
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={onFileChange}
            />
          </div>
        </div>

        <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-slate-950/60 p-5">
          <div className="mb-3 text-xs text-slate-400">本地增强修复（已保留云端备用方案）</div>
          <div className="flex flex-wrap items-center gap-4">
            <label className="text-sm text-slate-300">
              画笔：<span className="ml-2 font-semibold text-white">{brushSize}px</span>
            </label>
            <input
              type="range"
              min={10}
              max={76}
              value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
              className="w-52"
            />
            <button
              type="button"
              onClick={resetMask}
              className="rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-white/5"
            >
              清空涂抹
            </button>
            <button
              type="button"
              onClick={erase}
              disabled={!sourceFile || status === "uploading"}
              className="rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-400 disabled:bg-emerald-300"
            >
              {status === "uploading" ? "处理中…" : "开始消除"}
            </button>
          </div>
          {error && <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>}
        </div>

        <div className="mt-6 overflow-hidden rounded-[1.5rem] border border-white/10 bg-slate-950/40 p-3">
          {sourceUrl ? (
            <div className="relative mx-auto w-full max-w-[720px]">
              <canvas ref={imageCanvasRef} className="h-auto w-full rounded-[1rem]" />
              <canvas
                ref={maskCanvasRef}
                className="absolute inset-0 h-full w-full rounded-[1rem]"
                style={{ touchAction: "none" }}
                onPointerDown={start}
                onPointerMove={move}
                onPointerUp={stop}
                onPointerCancel={stop}
                onPointerLeave={stop}
              />
            </div>
          ) : (
            <EmptyCard text="上传图片后在图上涂抹要消除的区域。" dark />
          )}
        </div>
      </div>

      <div className="rounded-[2rem] border border-white/10 bg-white p-6 text-slate-900 shadow-2xl shadow-slate-950/20 md:p-8">
        <PreviewPanel title="消除结果">
          {resultUrl ? (
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={resultUrl} alt="erase" className="w-full rounded-[1.25rem] border border-slate-200" />
              <button
                type="button"
                onClick={() => resultBlob && downloadBlob(resultBlob, "ai-erase-result.png")}
                className="mt-4 w-full rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
              >
                下载 PNG
              </button>
            </div>
          ) : (
            <EmptyCard text="处理完成后会在这里看到结果。" />
          )}
        </PreviewPanel>
      </div>
    </section>
  );
}

function TabCard({
  active,
  tone,
  title,
  subtitle,
  onClick,
}: {
  active: boolean;
  tone: "sky" | "violet" | "emerald";
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  const toneCls =
    tone === "sky"
      ? "from-sky-400/15 to-sky-400/0 border-sky-400/30"
      : tone === "violet"
        ? "from-violet-400/15 to-violet-400/0 border-violet-400/30"
        : "from-emerald-400/15 to-emerald-400/0 border-emerald-400/30";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[1.5rem] border p-5 text-left transition ${
        active
          ? `bg-gradient-to-b ${toneCls} shadow-lg shadow-slate-950/30`
          : "border-white/10 bg-white/[0.04] hover:bg-white/[0.07]"
      }`}
    >
      <div className="flex items-center justify-between">
        <p className="text-base font-semibold text-white">{title}</p>
        <span className={`h-2.5 w-2.5 rounded-full ${active ? "bg-white" : "bg-white/30"}`} />
      </div>
      <p className="mt-2 text-sm text-slate-300">{subtitle}</p>
    </button>
  );
}

function Badge({ children, tone }: { children: string; tone: "sky" | "violet" | "emerald" }) {
  const cls =
    tone === "sky"
      ? "border-sky-300/20 bg-sky-400/10 text-sky-200"
      : tone === "violet"
        ? "border-violet-300/20 bg-violet-400/10 text-violet-200"
        : "border-emerald-300/20 bg-emerald-400/10 text-emerald-200";

  return (
    <span className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] ${cls}`}>
      {children}
    </span>
  );
}

function SettingCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-[1.25rem] border border-white/10 bg-slate-950/40 p-4">
      <p className="text-sm font-semibold text-white">{title}</p>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function PreviewPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function EmptyCard({ text, dark = false }: { text: string; dark?: boolean }) {
  return (
    <div
      className={`flex min-h-[240px] items-center justify-center rounded-[1.5rem] border px-6 text-center text-sm leading-6 ${
        dark
          ? "border-white/10 bg-white/[0.04] text-slate-300"
          : "border-slate-200 bg-slate-50 text-slate-400"
      }`}
    >
      <p className="max-w-sm">{text}</p>
    </div>
  );
}

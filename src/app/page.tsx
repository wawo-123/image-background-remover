"use client";

import {
  ChangeEvent,
  DragEvent,
  MouseEvent as ReactMouseEvent,
  ReactNode,
  useMemo,
  useRef,
  useState,
} from "react";

type ToolTab = "background" | "id-photo" | "ai-erase";
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
  description: string;
  width: number;
  height: number;
  subjectScale: number;
};

type StylePreset = {
  key: StyleKey;
  label: string;
  description: string;
  brightness: number;
  contrast: number;
  saturation: number;
  softGlow: number;
};

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const SIZE_PRESETS: SizePreset[] = [
  {
    key: "one-inch",
    label: "一寸",
    description: "求职、报名、考试常见",
    width: 295,
    height: 413,
    subjectScale: 0.78,
  },
  {
    key: "two-inch",
    label: "二寸",
    description: "更正式，签证和证书更常见",
    width: 413,
    height: 579,
    subjectScale: 0.8,
  },
  {
    key: "passport",
    label: "护照 / 通用证件",
    description: "构图更稳，适合大多数证件场景",
    width: 413,
    height: 531,
    subjectScale: 0.82,
  },
  {
    key: "square",
    label: "头像方图",
    description: "社媒头像、简历封面、资料卡",
    width: 600,
    height: 600,
    subjectScale: 0.72,
  },
];

const BG_COLORS: Record<BgColorKey, { label: string; value: string }> = {
  white: { label: "白底", value: "#f8fafc" },
  blue: { label: "蓝底", value: "#4f86ff" },
  red: { label: "红底", value: "#d9465f" },
  gray: { label: "浅灰底", value: "#d8dee9" },
};

const STYLE_PRESETS: StylePreset[] = [
  {
    key: "natural",
    label: "真实自然",
    description: "尽量保留原始状态，不过度修饰",
    brightness: 1.02,
    contrast: 1.02,
    saturation: 1.02,
    softGlow: 0,
  },
  {
    key: "polished",
    label: "更好看一点",
    description: "轻提亮，气色更舒服，适合简历和报名",
    brightness: 1.08,
    contrast: 1.05,
    saturation: 1.08,
    softGlow: 0.05,
  },
  {
    key: "bright",
    label: "通透显精神",
    description: "更干净、更有精神感，适合头像展示",
    brightness: 1.13,
    contrast: 1.05,
    saturation: 1.11,
    softGlow: 0.08,
  },
  {
    key: "studio",
    label: "海马体一点",
    description: "整体更柔和、瑕疵感更轻一点",
    brightness: 1.1,
    contrast: 1.03,
    saturation: 1.05,
    softGlow: 0.14,
  },
];

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function revokeUrl(url: string) {
  if (url) URL.revokeObjectURL(url);
}

function validateFile(file: File) {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return "仅支持 JPG、PNG、WEBP 图片。";
  }
  if (file.size > MAX_FILE_SIZE) {
    return "图片不能超过 10MB。";
  }
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
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("图片加载失败。"));
    image.src = url;
  });
}

function applyPixelStyle(
  imageData: ImageData,
  style: StylePreset,
  shouldBlendWhite = false
) {
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];
    if (alpha === 0) continue;

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

    if (shouldBlendWhite && style.softGlow > 0) {
      r = r * (1 - style.softGlow) + 255 * style.softGlow;
      g = g * (1 - style.softGlow) + 255 * style.softGlow;
      b = b * (1 - style.softGlow) + 255 * style.softGlow;
    }

    data[i] = Math.max(0, Math.min(255, Math.round(r)));
    data[i + 1] = Math.max(0, Math.min(255, Math.round(g)));
    data[i + 2] = Math.max(0, Math.min(255, Math.round(b)));
  }

  return imageData;
}

async function renderIdPhotoBlob(
  cutoutUrl: string,
  presetKey: SizePresetKey,
  bgColor: BgColorKey,
  styleKey: StyleKey
) {
  const image = await loadImage(cutoutUrl);
  const preset = SIZE_PRESETS.find((item) => item.key === presetKey) ?? SIZE_PRESETS[0];
  const style = STYLE_PRESETS.find((item) => item.key === styleKey) ?? STYLE_PRESETS[0];

  const canvas = document.createElement("canvas");
  canvas.width = preset.width;
  canvas.height = preset.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("证件照画布初始化失败。 ");

  ctx.fillStyle = BG_COLORS[bgColor].value;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const scale = Math.min(
    (canvas.width * 0.82) / image.width,
    (canvas.height * preset.subjectScale) / image.height
  );
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  const x = (canvas.width - drawWidth) / 2;
  const y = canvas.height - drawHeight - canvas.height * 0.04;

  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = drawWidth;
  tempCanvas.height = drawHeight;
  const tempCtx = tempCanvas.getContext("2d");
  if (!tempCtx) throw new Error("证件照临时图层初始化失败。 ");

  tempCtx.drawImage(image, 0, 0, drawWidth, drawHeight);
  const styledData = tempCtx.getImageData(0, 0, drawWidth, drawHeight);
  tempCtx.putImageData(applyPixelStyle(styledData, style, true), 0, 0);

  ctx.save();
  ctx.shadowColor = "rgba(15, 23, 42, 0.14)";
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 8;
  ctx.drawImage(tempCanvas, x, y, drawWidth, drawHeight);
  ctx.restore();

  ctx.fillStyle = "rgba(255,255,255,0.10)";
  ctx.fillRect(0, 0, canvas.width, canvas.height * 0.16);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("证件照生成失败。"));
    }, "image/png");
  });
}

function fillMaskedRegion(
  sourceData: Uint8ClampedArray,
  maskData: Uint8ClampedArray,
  width: number,
  height: number
) {
  const result = new Uint8ClampedArray(sourceData);
  const masked = new Uint8Array(width * height);

  for (let i = 0; i < width * height; i += 1) {
    masked[i] = maskData[i * 4 + 3] > 20 || maskData[i * 4] > 20 ? 1 : 0;
  }

  const directions = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ];

  let changed = true;
  let safety = 0;

  while (changed && safety < width + height) {
    changed = false;
    safety += 1;

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const idx = y * width + x;
        if (!masked[idx]) continue;

        let r = 0;
        let g = 0;
        let b = 0;
        let count = 0;

        for (const [dx, dy] of directions) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const nidx = ny * width + nx;
          if (masked[nidx]) continue;
          const offset = nidx * 4;
          r += result[offset];
          g += result[offset + 1];
          b += result[offset + 2];
          count += 1;
        }

        if (count > 0) {
          const offset = idx * 4;
          result[offset] = Math.round(r / count);
          result[offset + 1] = Math.round(g / count);
          result[offset + 2] = Math.round(b / count);
          result[offset + 3] = 255;
          masked[idx] = 0;
          changed = true;
        }
      }
    }
  }

  for (let pass = 0; pass < 2; pass += 1) {
    const snapshot = new Uint8ClampedArray(result);
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const idx = (y * width + x) * 4;
        let r = 0;
        let g = 0;
        let b = 0;
        let count = 0;

        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            const offset = ((y + dy) * width + (x + dx)) * 4;
            r += snapshot[offset];
            g += snapshot[offset + 1];
            b += snapshot[offset + 2];
            count += 1;
          }
        }

        result[idx] = Math.round(r / count);
        result[idx + 1] = Math.round(g / count);
        result[idx + 2] = Math.round(b / count);
        result[idx + 3] = 255;
      }
    }
  }

  return result;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<ToolTab>("background");

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-5 py-8 md:px-8 lg:px-10 lg:py-10">
        <header className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.20),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(99,102,241,0.18),transparent_35%),rgba(15,23,42,0.92)] p-7 shadow-2xl shadow-sky-950/30 md:p-10">
          <div className="max-w-5xl">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-sky-300">
              AI Photo Studio
            </p>
            <h1 className="mt-4 text-4xl font-bold tracking-tight text-white md:text-6xl">
              一个站里完成批量背景消除、证件照制作、智能局部消除。
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-8 text-slate-300 md:text-lg">
              这版重点是做成真正能连续用的工作流：背景消除支持继续追加图片；证件照只要上传人像后直接生成；AI 消除不再依赖外部慢加载方案，直接在浏览器里就能用。
            </p>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <ToolSwitcherCard
            active={activeTab === "background"}
            title="背景消除（支持批量）"
            description="一次选多张，也支持后续继续追加图片。"
            onClick={() => setActiveTab("background")}
          />
          <ToolSwitcherCard
            active={activeTab === "id-photo"}
            title="证件照制作"
            description="上传后直接一键生成证件照，不需要你先手动抠图。"
            onClick={() => setActiveTab("id-photo")}
          />
          <ToolSwitcherCard
            active={activeTab === "ai-erase"}
            title="AI 消除"
            description="大概涂抹一下，就能自动把区域修补掉。"
            onClick={() => setActiveTab("ai-erase")}
          />
        </section>

        {activeTab === "background" && <BackgroundRemover />}
        {activeTab === "id-photo" && <IdPhotoMaker />}
        {activeTab === "ai-erase" && <AiEraser />}
      </section>
    </main>
  );
}

function BackgroundRemover() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [items, setItems] = useState<RemovalItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");

  const summary = useMemo(() => {
    const uploading = items.filter((item) => item.status === "uploading").length;
    const success = items.filter((item) => item.status === "success").length;
    const failed = items.filter((item) => item.status === "error").length;

    if (!items.length) return "支持一次选多张图片，也支持后续继续追加图片。";
    if (uploading) return `正在处理 ${uploading} 张图片，请稍等。`;
    if (success && !failed) return `已完成 ${success} 张图片的背景消除。`;
    if (failed) return `已完成 ${success} 张，失败 ${failed} 张，可以重新处理失败图片。`;
    return `当前已选 ${items.length} 张图片，可以继续追加，也可以直接开始批量处理。`;
  }, [items]);

  function appendFiles(fileList: FileList | File[]) {
    const incoming = Array.from(fileList);
    if (!incoming.length) return;

    const validItems: RemovalItem[] = [];
    let firstError = "";

    for (const file of incoming) {
      const validation = validateFile(file);
      if (validation) {
        if (!firstError) firstError = `${file.name}：${validation}`;
        continue;
      }

      validItems.push({
        id: createId(),
        file,
        previewUrl: URL.createObjectURL(file),
        resultUrl: "",
        resultBlob: null,
        status: "idle",
        error: "",
      });
    }

    if (validItems.length) {
      setItems((current) => [...current, ...validItems]);
      setError("");
    } else if (firstError) {
      setError(firstError);
    }
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    if (!event.target.files?.length) return;
    appendFiles(event.target.files);
    event.target.value = "";
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    if (!event.dataTransfer.files?.length) return;
    appendFiles(event.dataTransfer.files);
  }

  function clearAll() {
    setItems((current) => {
      current.forEach((item) => {
        revokeUrl(item.previewUrl);
        revokeUrl(item.resultUrl);
      });
      return [];
    });
    setError("");
  }

  function removeOne(id: string) {
    setItems((current) => {
      const target = current.find((item) => item.id === id);
      if (target) {
        revokeUrl(target.previewUrl);
        revokeUrl(target.resultUrl);
      }
      return current.filter((item) => item.id !== id);
    });
  }

  async function processItem(itemId: string) {
    const target = items.find((item) => item.id === itemId);
    if (!target) return;

    setItems((current) =>
      current.map((item) =>
        item.id === itemId ? { ...item, status: "uploading", error: "" } : item
      )
    );

    const formData = new FormData();
    formData.append("file", target.file);

    try {
      const response = await fetch("/api/remove-background", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "背景消除失败，请稍后重试。");
      }

      const blob = await response.blob();
      const resultUrl = URL.createObjectURL(blob);

      setItems((current) =>
        current.map((item) => {
          if (item.id !== itemId) return item;
          revokeUrl(item.resultUrl);
          return {
            ...item,
            status: "success",
            resultBlob: blob,
            resultUrl,
            error: "",
          };
        })
      );
    } catch (err) {
      setItems((current) =>
        current.map((item) =>
          item.id === itemId
            ? {
                ...item,
                status: "error",
                error: err instanceof Error ? err.message : "背景消除失败，请稍后重试。",
              }
            : item
        )
      );
    }
  }

  async function processAll() {
    const targets = items.filter((item) => item.status !== "uploading");
    for (const item of targets) {
      // eslint-disable-next-line no-await-in-loop
      await processItem(item.id);
    }
  }

  return (
    <section className="grid gap-8 lg:grid-cols-[1.08fr_0.92fr]">
      <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 shadow-2xl shadow-sky-950/30 backdrop-blur md:p-8">
        <div
          onDrop={onDrop}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          className={`rounded-[1.5rem] border-2 border-dashed p-6 transition md:p-8 ${
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

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-2xl font-semibold text-white">Upload your image</p>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                支持多张上传，而且已经选完之后还可以继续加，不会把前面的图片冲掉。
              </p>
            </div>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-100"
            >
              {items.length ? "继续添加图片" : "Choose Image"}
            </button>
          </div>

          <div className="mt-5 text-xs text-slate-400">
            支持 JPG / PNG / WEBP · 单张最大 10MB · 适合商品图、人像图、证件照原图
          </div>

          {items.length ? (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((item) => (
                <div key={item.id} className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-3">
                  <div className="relative overflow-hidden rounded-2xl bg-slate-900/70">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.previewUrl}
                      alt={item.file.name}
                      className="aspect-[4/3] w-full object-cover"
                    />
                    <span className="absolute left-3 top-3 rounded-full bg-slate-950/80 px-3 py-1 text-xs font-medium text-white">
                      {item.status === "success"
                        ? "已完成"
                        : item.status === "uploading"
                          ? "处理中"
                          : item.status === "error"
                            ? "失败"
                            : "待处理"}
                    </span>
                  </div>
                  <div className="mt-3">
                    <p className="truncate text-sm font-semibold text-white">{item.file.name}</p>
                    <p className="mt-1 text-xs text-slate-400">{formatSize(item.file.size)}</p>
                    {item.error && <p className="mt-2 text-xs text-rose-300">{item.error}</p>}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => processItem(item.id)}
                      disabled={item.status === "uploading"}
                      className="rounded-full bg-sky-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-sky-300"
                    >
                      {item.status === "uploading" ? "处理中..." : item.status === "success" ? "重新处理" : "开始处理"}
                    </button>
                    {item.resultBlob && (
                      <button
                        type="button"
                        onClick={() =>
                          downloadBlob(
                            item.resultBlob as Blob,
                            `${item.file.name.replace(/\.[^.]+$/, "")}-transparent.png`
                          )
                        }
                        className="rounded-full border border-white/15 px-4 py-2 text-xs font-medium text-slate-200 hover:bg-white/5"
                      >
                        下载结果
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => removeOne(item.id)}
                      className="rounded-full border border-white/15 px-4 py-2 text-xs font-medium text-slate-200 hover:bg-white/5"
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-6 rounded-[1.5rem] border border-white/10 bg-white/[0.04] px-5 py-6 text-sm text-slate-300">
              还没有选择图片。你可以一次选多张，也可以后面继续添加。
            </div>
          )}
        </div>

        <div className="mt-6 rounded-[1.5rem] border border-white/10 bg-slate-950/60 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-white">Processing status</p>
              <p className="mt-1 text-sm text-slate-300">{summary}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={clearAll}
                disabled={!items.length}
                className="rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                清空
              </button>
              <button
                type="button"
                onClick={processAll}
                disabled={!items.length}
                className="rounded-full bg-sky-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-sky-300"
              >
                批量开始背景消除
              </button>
            </div>
          </div>
          {error && (
            <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {error}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-[2rem] border border-white/10 bg-white p-6 text-slate-900 shadow-2xl shadow-slate-950/20 md:p-8">
        <PreviewPanel
          title="结果预览"
          description="处理成功后会在这里汇总展示，方便你逐张检查边缘效果。"
        >
          {items.some((item) => item.resultUrl) ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {items
                .filter((item) => item.resultUrl)
                .map((item) => (
                  <div key={item.id} className="rounded-[1.25rem] border border-slate-200 p-3">
                    <div className="rounded-[1rem] bg-[linear-gradient(45deg,#e5e7eb_25%,transparent_25%),linear-gradient(-45deg,#e5e7eb_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#e5e7eb_75%),linear-gradient(-45deg,transparent_75%,#e5e7eb_75%)] bg-[length:20px_20px] bg-[position:0_0,0_10px,10px_-10px,-10px_0px] p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.resultUrl} alt={`${item.file.name} result`} className="aspect-[4/3] w-full object-contain" />
                    </div>
                    <p className="mt-3 truncate text-sm font-semibold text-slate-900">{item.file.name}</p>
                  </div>
                ))}
            </div>
          ) : (
            <EmptyCard text="处理成功的透明 PNG 会显示在这里。" />
          )}
        </PreviewPanel>
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

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0];
    if (!nextFile) return;
    const validation = validateFile(nextFile);
    if (validation) {
      setError(validation);
      setStatus("error");
      return;
    }

    resetAll();
    const url = URL.createObjectURL(nextFile);
    setFile(nextFile);
    setPreviewUrl(url);
    event.target.value = "";
  }

  async function generateIdPhoto() {
    if (!file) {
      setError("请先上传一张人像图片。 ");
      setStatus("error");
      return;
    }

    setStatus("uploading");
    setError("");

    try {
      let activeCutoutUrl = cutoutUrl;

      if (!activeCutoutUrl) {
        const formData = new FormData();
        formData.append("file", file);
        const response = await fetch("/api/remove-background", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error || "证件照抠图失败，请稍后重试。");
        }

        const cutoutBlob = await response.blob();
        const nextCutoutUrl = URL.createObjectURL(cutoutBlob);
        revokeUrl(cutoutUrl);
        setCutoutUrl(nextCutoutUrl);
        activeCutoutUrl = nextCutoutUrl;
      }

      const outputBlob = await renderIdPhotoBlob(activeCutoutUrl, sizePreset, bgColor, styleKey);
      revokeUrl(resultUrl);
      setResultBlob(outputBlob);
      setResultUrl(URL.createObjectURL(outputBlob));
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "证件照生成失败，请稍后重试。");
    }
  }

  return (
    <section className="grid gap-8 lg:grid-cols-[1.02fr_0.98fr]">
      <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 shadow-2xl shadow-sky-950/30 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-2xl font-semibold text-white">证件照制作</p>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              上传之后直接一键生成证件照，不需要你先手动点背景消除。
            </p>
          </div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-100"
          >
            {file ? "重新选择人像" : "上传人像"}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={onFileChange}
          />
        </div>

        <div className="mt-5 rounded-[1.5rem] border border-amber-300/20 bg-amber-400/10 px-5 py-4 text-sm leading-7 text-amber-100">
          <p className="font-semibold text-white">上传姿势建议</p>
          <p className="mt-2">
            最好上传：<strong>正面站姿 / 坐姿、头部端正、肩膀基本平、人物完整清晰、头顶到胸口或上半身</strong> 的照片。背景尽量简单，光线均匀，不要大侧脸、低头、遮脸、多人同框。
          </p>
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <SettingCard title="尺寸规格">
            <div className="grid gap-3">
              {SIZE_PRESETS.map((preset) => (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => setSizePreset(preset.key)}
                  className={`rounded-[1.25rem] border px-4 py-3 text-left transition ${
                    preset.key === sizePreset
                      ? "border-sky-400 bg-sky-400/10 text-white"
                      : "border-white/10 bg-slate-950/40 text-slate-200 hover:bg-white/5"
                  }`}
                >
                  <p className="font-semibold">{preset.label}</p>
                  <p className="mt-1 text-xs text-slate-300">{preset.description}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {preset.width} × {preset.height}px
                  </p>
                </button>
              ))}
            </div>
          </SettingCard>

          <SettingCard title="背景颜色">
            <div className="grid grid-cols-2 gap-3">
              {(Object.keys(BG_COLORS) as BgColorKey[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setBgColor(key)}
                  className={`rounded-[1.25rem] border px-4 py-3 text-left transition ${
                    key === bgColor
                      ? "border-sky-400 bg-sky-400/10 text-white"
                      : "border-white/10 bg-slate-950/40 text-slate-200 hover:bg-white/5"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="h-6 w-6 rounded-full border border-white/20" style={{ backgroundColor: BG_COLORS[key].value }} />
                    <span className="font-semibold">{BG_COLORS[key].label}</span>
                  </div>
                </button>
              ))}
            </div>
          </SettingCard>
        </div>

        <div className="mt-5">
          <SettingCard title="人物风格">
            <div className="grid gap-3 md:grid-cols-2">
              {STYLE_PRESETS.map((style) => (
                <button
                  key={style.key}
                  type="button"
                  onClick={() => setStyleKey(style.key)}
                  className={`rounded-[1.25rem] border px-4 py-3 text-left transition ${
                    style.key === styleKey
                      ? "border-sky-400 bg-sky-400/10 text-white"
                      : "border-white/10 bg-slate-950/40 text-slate-200 hover:bg-white/5"
                  }`}
                >
                  <p className="font-semibold">{style.label}</p>
                  <p className="mt-1 text-xs text-slate-300">{style.description}</p>
                </button>
              ))}
            </div>
          </SettingCard>
        </div>

        <div className="mt-6 rounded-[1.5rem] border border-white/10 bg-slate-950/60 p-5">
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={generateIdPhoto}
              disabled={!file || status === "uploading"}
              className="rounded-full bg-sky-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-sky-300"
            >
              {status === "uploading" ? "生成中..." : "一键生成证件照"}
            </button>
            <button
              type="button"
              onClick={resetAll}
              className="rounded-full border border-white/15 px-5 py-3 text-sm font-medium text-slate-200 hover:bg-white/5"
            >
              清空
            </button>
          </div>
          <p className="mt-4 text-sm text-slate-300">
            生成完成后，你仍然可以切换尺寸、底色、风格，再次点击“一键生成证件照”继续重做。
          </p>
          {error && (
            <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {error}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-[2rem] border border-white/10 bg-white p-6 text-slate-900 shadow-2xl shadow-slate-950/20 md:p-8">
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-1">
          <PreviewPanel title="原始照片" description="建议上传正面、清晰、头部端正的人像。">
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt="Original portrait" className="aspect-[4/5] w-full rounded-[1.25rem] object-cover" />
            ) : (
              <EmptyCard text="原图预览会显示在这里。" />
            )}
          </PreviewPanel>

          <PreviewPanel title="抠图中间结果" description="系统会自动完成这一步，你不用手动点。">
            {cutoutUrl ? (
              <div className="rounded-[1.25rem] bg-[linear-gradient(45deg,#e5e7eb_25%,transparent_25%),linear-gradient(-45deg,#e5e7eb_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#e5e7eb_75%),linear-gradient(-45deg,transparent_75%,#e5e7eb_75%)] bg-[length:20px_20px] bg-[position:0_0,0_10px,10px_-10px,-10px_0px] p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={cutoutUrl} alt="Cutout" className="aspect-[4/5] w-full object-contain" />
              </div>
            ) : (
              <EmptyCard text="一键生成时会自动完成背景消除。" />
            )}
          </PreviewPanel>

          <PreviewPanel title="证件照输出" description="切换风格后，继续点击生成即可得到新的版本。">
            {resultUrl ? (
              <div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={resultUrl} alt="ID photo result" className="w-full rounded-[1.25rem] border border-slate-200" />
                <button
                  type="button"
                  onClick={() =>
                    resultBlob &&
                    downloadBlob(resultBlob, `id-photo-${sizePreset}-${bgColor}-${styleKey}.png`)
                  }
                  className="mt-4 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  下载证件照 PNG
                </button>
              </div>
            ) : (
              <EmptyCard text="证件照生成成功后会显示在这里。" />
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
  const [resultUrl, setResultUrl] = useState("");
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<ItemStatus>("idle");
  const [brushSize, setBrushSize] = useState(28);
  const [isDrawing, setIsDrawing] = useState(false);

  async function drawBaseImage(url: string) {
    const canvas = imageCanvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    if (!canvas || !maskCanvas) return;

    const image = await loadImage(url);
    const maxWidth = 720;
    const width = Math.min(maxWidth, image.width);
    const height = Math.round(image.height * (width / image.width));

    canvas.width = width;
    canvas.height = height;
    maskCanvas.width = width;
    maskCanvas.height = height;

    const ctx = canvas.getContext("2d");
    const maskCtx = maskCanvas.getContext("2d");
    if (!ctx || !maskCtx) return;

    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);

    maskCtx.clearRect(0, 0, width, height);
    maskCtx.lineCap = "round";
    maskCtx.lineJoin = "round";
    maskCtx.strokeStyle = "rgba(239, 68, 68, 0.92)";
    maskCtx.fillStyle = "rgba(239, 68, 68, 0.92)";
    maskCtx.lineWidth = brushSize;
  }

  function resetMask() {
    const canvas = maskCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  async function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0];
    if (!nextFile) return;

    const validation = validateFile(nextFile);
    if (validation) {
      setError(validation);
      setStatus("error");
      return;
    }

    revokeUrl(sourceUrl);
    revokeUrl(resultUrl);
    const url = URL.createObjectURL(nextFile);
    setSourceFile(nextFile);
    setSourceUrl(url);
    setResultUrl("");
    setResultBlob(null);
    setError("");
    setStatus("idle");
    await drawBaseImage(url);
    event.target.value = "";
  }

  function pointOnCanvas(event: ReactMouseEvent<HTMLCanvasElement>) {
    const canvas = maskCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function startDrawing(event: ReactMouseEvent<HTMLCanvasElement>) {
    const canvas = maskCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    setIsDrawing(true);
    ctx.lineWidth = brushSize;
    const { x, y } = pointOnCanvas(event);
    ctx.beginPath();
    ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function draw(event: ReactMouseEvent<HTMLCanvasElement>) {
    if (!isDrawing) return;
    const canvas = maskCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.lineWidth = brushSize;
    const { x, y } = pointOnCanvas(event);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function stopDrawing() {
    setIsDrawing(false);
  }

  async function handleErase() {
    const sourceCanvas = imageCanvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    if (!sourceCanvas || !maskCanvas || !sourceFile) {
      setError("请先上传图片并涂抹你想消除的区域。 ");
      setStatus("error");
      return;
    }

    setStatus("uploading");
    setError("");

    try {
      const sourceCtx = sourceCanvas.getContext("2d");
      const maskCtx = maskCanvas.getContext("2d");
      if (!sourceCtx || !maskCtx) throw new Error("画布初始化失败。");

      const sourceImageData = sourceCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
      const maskImageData = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
      const nextPixels = fillMaskedRegion(
        sourceImageData.data,
        maskImageData.data,
        sourceCanvas.width,
        sourceCanvas.height
      );

      const outputCanvas = document.createElement("canvas");
      outputCanvas.width = sourceCanvas.width;
      outputCanvas.height = sourceCanvas.height;
      const outputCtx = outputCanvas.getContext("2d");
      if (!outputCtx) throw new Error("输出画布初始化失败。");

      const resultImageData = new ImageData(nextPixels, sourceCanvas.width, sourceCanvas.height);
      outputCtx.putImageData(resultImageData, 0, 0);

      const blob = await new Promise<Blob>((resolve, reject) => {
        outputCanvas.toBlob((nextBlob) => {
          if (nextBlob) resolve(nextBlob);
          else reject(new Error("AI 消除输出失败。"));
        }, "image/png");
      });

      revokeUrl(resultUrl);
      setResultBlob(blob);
      setResultUrl(URL.createObjectURL(blob));
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "AI 消除失败，请重试。");
    }
  }

  return (
    <section className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
      <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 shadow-2xl shadow-sky-950/30 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-2xl font-semibold text-white">AI 消除</p>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              现在改成直接在浏览器里就能工作，不再依赖之前那个一直加载不出来的外部引擎。
            </p>
          </div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-100"
          >
            {sourceFile ? "重新选择图片" : "上传图片"}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={onFileChange}
          />
        </div>

        <div className="mt-6 rounded-[1.5rem] border border-white/10 bg-slate-950/60 p-5">
          <div className="flex flex-wrap items-center gap-4">
            <label className="text-sm text-slate-300">
              画笔大小：<span className="ml-2 font-semibold text-white">{brushSize}px</span>
            </label>
            <input
              type="range"
              min={10}
              max={72}
              value={brushSize}
              onChange={(event) => setBrushSize(Number(event.target.value))}
              className="w-48"
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
              onClick={handleErase}
              disabled={!sourceFile || status === "uploading"}
              className="rounded-full bg-sky-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-sky-300"
            >
              {status === "uploading" ? "处理中..." : "开始 AI 消除"}
            </button>
          </div>
          <p className="mt-4 text-sm text-slate-300">
            使用建议：大概把人或物体刷出来就行，不用描得特别精细；适合去掉路人、小杂物、电线、告示牌等干扰元素。
          </p>
          {error && (
            <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {error}
            </div>
          )}
        </div>

        <div className="mt-6 overflow-hidden rounded-[1.5rem] border border-white/10 bg-slate-950/40 p-3">
          {sourceUrl ? (
            <div className="relative mx-auto w-full max-w-[720px]">
              <canvas ref={imageCanvasRef} className="h-auto w-full rounded-[1rem]" />
              <canvas
                ref={maskCanvasRef}
                className="absolute inset-0 h-full w-full cursor-crosshair rounded-[1rem]"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
              />
            </div>
          ) : (
            <EmptyCard text="上传图片后，这里会出现可涂抹编辑画布。" dark />
          )}
        </div>
      </div>

      <div className="rounded-[2rem] border border-white/10 bg-white p-6 text-slate-900 shadow-2xl shadow-slate-950/20 md:p-8">
        <PreviewPanel title="智能消除结果" description="结果会尽量把消除区域和周边环境融合起来。">
          {resultUrl ? (
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={resultUrl} alt="AI erase result" className="w-full rounded-[1.25rem] border border-slate-200" />
              <button
                type="button"
                onClick={() => resultBlob && downloadBlob(resultBlob, "ai-erase-result.png")}
                className="mt-4 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                下载结果 PNG
              </button>
            </div>
          ) : (
            <EmptyCard text="完成消除后，结果会显示在这里。" />
          )}
        </PreviewPanel>
      </div>
    </section>
  );
}

function ToolSwitcherCard({
  active,
  title,
  description,
  onClick,
}: {
  active: boolean;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[1.75rem] border p-5 text-left transition ${
        active
          ? "border-sky-400 bg-sky-400/10 shadow-lg shadow-sky-950/20"
          : "border-white/10 bg-white/[0.04] hover:bg-white/[0.07]"
      }`}
    >
      <p className="text-lg font-semibold text-white">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-300">{description}</p>
    </button>
  );
}

function SettingCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/40 p-5">
      <p className="text-sm font-semibold text-white">{title}</p>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function PreviewPanel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div>
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function EmptyCard({ text, dark = false }: { text: string; dark?: boolean }) {
  return (
    <div
      className={`flex min-h-[260px] items-center justify-center rounded-[1.5rem] border px-6 text-center text-sm leading-6 ${
        dark
          ? "border-white/10 bg-white/[0.04] text-slate-300"
          : "border-slate-200 bg-slate-50 text-slate-400"
      }`}
    >
      <p className="max-w-sm">{text}</p>
    </div>
  );
}

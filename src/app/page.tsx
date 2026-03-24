"use client";

import { ChangeEvent, DragEvent, useMemo, useRef, useState } from "react";

type Status = "idle" | "uploading" | "success" | "error";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const SCENES = [
  "Product photos for ecommerce listings",
  "Portraits and profile pictures",
  "Logos and clean transparent graphics",
  "Quick marketing and social media assets",
];

const FAQS = [
  {
    question: "Is this image background remover free?",
    answer: "This MVP is free to try for single-image background removal.",
  },
  {
    question: "What file formats are supported?",
    answer: "You can upload JPG, PNG, and WEBP images up to 10MB.",
  },
  {
    question: "Do you store my images?",
    answer: "No persistent storage is used in this MVP flow. Images are processed per request only.",
  },
  {
    question: "Can I download a transparent PNG?",
    answer: "Yes. Successful results are returned as transparent PNG files ready to download.",
  },
];

export default function Home() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [resultUrl, setResultUrl] = useState("");
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);

  const statusText = useMemo(() => {
    if (status === "uploading") return "Removing background... this usually takes a few seconds.";
    if (status === "success") return "Done. Your transparent PNG is ready to preview and download.";
    if (status === "error") return "We hit a problem while processing the image.";
    if (file) return "Image selected. Click remove background to start.";
    return "Upload one image to remove the background instantly.";
  }, [file, status]);

  function resetResult() {
    setError("");
    setStatus("idle");
    setResultUrl("");
    setResultBlob(null);
  }

  function cleanupPreview(url: string) {
    if (url) URL.revokeObjectURL(url);
  }

  function validateFile(nextFile: File) {
    if (!ACCEPTED_TYPES.includes(nextFile.type)) {
      return "Unsupported file format. Please upload JPG, PNG, or WEBP.";
    }

    if (nextFile.size > MAX_FILE_SIZE) {
      return "File is too large. Please upload an image under 10MB.";
    }

    return "";
  }

  function prepareFile(nextFile: File) {
    const validationError = validateFile(nextFile);
    if (validationError) {
      cleanupPreview(previewUrl);
      setFile(null);
      setPreviewUrl("");
      setError(validationError);
      setStatus("error");
      return;
    }

    cleanupPreview(previewUrl);
    cleanupPreview(resultUrl);
    resetResult();
    setFile(nextFile);
    setPreviewUrl(URL.createObjectURL(nextFile));
  }

  function clearAll() {
    cleanupPreview(previewUrl);
    cleanupPreview(resultUrl);
    setFile(null);
    setPreviewUrl("");
    setResultUrl("");
    setResultBlob(null);
    setError("");
    setStatus("idle");
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0];
    if (!nextFile) return;
    prepareFile(nextFile);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    const nextFile = event.dataTransfer.files?.[0];
    if (!nextFile) return;
    prepareFile(nextFile);
  }

  async function handleSubmit() {
    if (!file) {
      setError("Please choose an image first.");
      setStatus("error");
      return;
    }

    setStatus("uploading");
    setError("");
    cleanupPreview(resultUrl);
    setResultUrl("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/remove-background", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Failed to remove background. Please try again.");
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      setResultBlob(blob);
      setResultUrl(objectUrl);
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Failed to remove background. Please try again.");
    }
  }

  function handleDownload() {
    if (!resultBlob || !resultUrl) return;
    const link = document.createElement("a");
    link.href = resultUrl;
    link.download = `${file?.name.replace(/\.[^.]+$/, "") || "removed-background"}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-14 px-6 py-8 md:px-10 lg:px-12 lg:py-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-sky-300">
              Image Background Remover
            </p>
            <h1 className="mt-3 max-w-4xl text-4xl font-bold tracking-tight text-white md:text-6xl">
              Remove image backgrounds instantly with a clean, download-ready PNG.
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-7 text-slate-300 md:text-lg">
              A lightweight online tool for product photos, portraits, and graphics. Upload one
              image, remove the background in seconds, and download your transparent result.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 text-sm text-slate-200">
            <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2">Next.js</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2">Tailwind CSS</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2">Remove.bg API</span>
          </div>
        </header>

        <section className="grid gap-8 lg:grid-cols-[1.08fr_0.92fr]">
          <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 shadow-2xl shadow-sky-950/30 backdrop-blur md:p-8">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.24),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.16),transparent_35%)]" />
            <div className="relative">
              <div
                onDrop={onDrop}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                className={`rounded-[1.5rem] border-2 border-dashed p-8 text-center transition md:p-10 ${
                  dragging
                    ? "border-sky-400 bg-sky-400/10"
                    : "border-white/15 bg-slate-950/40"
                }`}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={onFileChange}
                />
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-500/15 text-xl text-sky-200">
                  ✦
                </div>
                <p className="mt-5 text-xl font-semibold">Upload your image</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Drag and drop an image here, or click below. This MVP supports single-image
                  background removal with no persistent file storage.
                </p>
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="mt-6 inline-flex rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-100"
                >
                  Choose Image
                </button>
                <p className="mt-4 text-xs text-slate-400">
                  Supported formats: JPG, PNG, WEBP · Max size: 10MB
                </p>
              </div>

              <div className="mt-6 rounded-[1.5rem] border border-white/10 bg-slate-950/60 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">Processing status</p>
                    <p className="mt-1 text-sm text-slate-300">{statusText}</p>
                  </div>
                  {status === "uploading" && <LoadingBadge />}
                </div>

                {error && (
                  <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                    {error}
                  </div>
                )}

                {file ? (
                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <div>
                      <p className="text-sm font-semibold text-white">Selected file</p>
                      <p className="text-sm text-slate-300">
                        {file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={clearAll}
                        className="rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-white/5"
                      >
                        Reset
                      </button>
                      <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={status === "uploading"}
                        className="rounded-full bg-sky-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-sky-300"
                      >
                        {status === "uploading" ? "Processing..." : "Remove Background"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 text-sm text-slate-300">
                    No file selected yet. Upload one image to start the remove-background flow.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white p-6 text-slate-900 shadow-2xl shadow-slate-950/20 md:p-8">
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <PreviewCard
                title="Before"
                imageUrl={previewUrl}
                emptyText="Your original image preview will appear here."
              />
              <PreviewCard
                title="After"
                imageUrl={resultUrl}
                emptyText="Your transparent PNG result will appear here."
                checkerboard
                loading={status === "uploading"}
              />
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleDownload}
                disabled={!resultUrl}
                className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                Download PNG
              </button>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="rounded-full border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Upload another image
              </button>
            </div>

            <div className="mt-8 rounded-[1.5rem] bg-slate-50 p-5">
              <p className="text-sm font-semibold text-slate-900">Why this MVP exists</p>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                This version focuses on the shortest possible path: arrive, upload, remove the
                background, and download. No account system, no batch jobs, and no stored file
                history.
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-5 md:grid-cols-3">
          {[
            ["01", "Upload one image", "Use a product shot, portrait, or logo and start immediately."],
            ["02", "Process with AI", "The server route sends your image to Remove.bg and returns a PNG."],
            ["03", "Preview and download", "Check the result, then save the transparent PNG right away."],
          ].map(([step, title, description]) => (
            <div key={step} className="rounded-[1.75rem] border border-white/10 bg-white/[0.05] p-6">
              <p className="text-sm font-semibold tracking-[0.2em] text-sky-300">{step}</p>
              <h2 className="mt-4 text-2xl font-semibold text-white">{title}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-300">{description}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.05] p-6 md:p-8">
            <h2 className="text-3xl font-bold tracking-tight text-white">A focused MVP for fast background removal.</h2>
            <p className="mt-4 max-w-3xl text-base leading-8 text-slate-300">
              This image background remover is aimed at users who need a fast result without opening
              heavy design software. It works especially well for product photos, profile images,
              clean logos, and quick social media assets. The current version keeps the scope narrow
              and useful: one image in, transparent PNG out.
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {SCENES.map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-4 text-sm font-medium text-slate-200"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white p-6 text-slate-900 md:p-8">
            <h2 className="text-2xl font-bold tracking-tight">FAQ</h2>
            <div className="mt-6 space-y-5 text-sm leading-7 text-slate-600">
              {FAQS.map((item) => (
                <FaqItem key={item.question} question={item.question} answer={item.answer} />
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-sky-400/20 bg-sky-400/10 px-6 py-6 text-sm leading-7 text-sky-100">
          <p className="font-semibold text-white">Cloudflare deployment prep</p>
          <p className="mt-2">
            The project is structured for MVP development now. A deployment note and Cloudflare prep
            script guidance are included in the repository so the next step can be wiring the target
            runtime and environment variables for production deployment.
          </p>
        </section>
      </section>
    </main>
  );
}

function LoadingBadge() {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-sky-300/20 bg-sky-400/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-sky-200">
      <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-sky-300" />
      Processing
    </div>
  );
}

function PreviewCard({
  title,
  imageUrl,
  emptyText,
  checkerboard = false,
  loading = false,
}: {
  title: string;
  imageUrl: string;
  emptyText: string;
  checkerboard?: boolean;
  loading?: boolean;
}) {
  return (
    <div>
      <p className="mb-3 text-sm font-semibold text-slate-700">{title}</p>
      <div
        className={`relative flex aspect-square items-center justify-center overflow-hidden rounded-[1.5rem] border border-slate-200 ${
          checkerboard
            ? "bg-[linear-gradient(45deg,#e5e7eb_25%,transparent_25%),linear-gradient(-45deg,#e5e7eb_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#e5e7eb_75%),linear-gradient(-45deg,transparent_75%,#e5e7eb_75%)] bg-[length:20px_20px] bg-[position:0_0,0_10px,10px_-10px,-10px_0px]"
            : "bg-slate-50"
        }`}
      >
        {loading && !imageUrl && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/75 backdrop-blur-sm">
            <div className="flex items-center gap-3 rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-lg">
              <span className="h-3 w-3 animate-pulse rounded-full bg-sky-400" />
              Removing background...
            </div>
          </div>
        )}
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={`${title} preview`} className="h-full w-full object-contain" />
        ) : (
          <p className="max-w-[14rem] px-4 text-center text-sm leading-6 text-slate-400">{emptyText}</p>
        )}
      </div>
    </div>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  return (
    <div>
      <h3 className="font-semibold text-slate-900">{question}</h3>
      <p className="mt-1">{answer}</p>
    </div>
  );
}

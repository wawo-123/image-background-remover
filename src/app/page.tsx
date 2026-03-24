"use client";

import { ChangeEvent, DragEvent, useMemo, useRef, useState } from "react";

type Status = "idle" | "uploading" | "success" | "error";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

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
    if (status === "uploading") return "Removing background...";
    if (status === "success") return "Background removed successfully.";
    if (status === "error") return "Something went wrong.";
    return "Upload an image to get started.";
  }, [status]);

  function resetResult() {
    setError("");
    setStatus("idle");
    setResultUrl("");
    setResultBlob(null);
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
      setFile(null);
      setPreviewUrl("");
      setError(validationError);
      setStatus("error");
      return;
    }

    resetResult();
    setFile(nextFile);
    setPreviewUrl(URL.createObjectURL(nextFile));
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
    <main className="min-h-screen bg-white text-slate-900">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-16 px-6 py-10 md:px-10 lg:px-12">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-600">
              Image Background Remover
            </p>
            <h1 className="mt-3 max-w-3xl text-4xl font-bold tracking-tight md:text-6xl">
              Remove image backgrounds instantly.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600 md:text-lg">
              Upload one image, remove the background in seconds, and download a transparent PNG.
              Built for product photos, portraits, logos, and quick content workflows.
            </p>
            <div className="mt-8 flex flex-wrap gap-3 text-sm text-slate-600">
              <span className="rounded-full bg-slate-100 px-4 py-2">Free to try</span>
              <span className="rounded-full bg-slate-100 px-4 py-2">JPG / PNG / WEBP</span>
              <span className="rounded-full bg-slate-100 px-4 py-2">Up to 10MB</span>
            </div>
          </div>
        </header>

        <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-sm md:p-8">
            <div
              onDrop={onDrop}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              className={`rounded-2xl border-2 border-dashed p-8 text-center transition ${
                dragging
                  ? "border-sky-500 bg-sky-50"
                  : "border-slate-300 bg-white"
              }`}
            >
              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={onFileChange}
              />
              <p className="text-lg font-semibold">Upload your image</p>
              <p className="mt-2 text-sm text-slate-500">
                Drag and drop an image here, or click the button below.
              </p>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="mt-6 inline-flex rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
              >
                Choose Image
              </button>
              <p className="mt-4 text-xs text-slate-400">
                Supported formats: JPG, PNG, WEBP · Max size: 10MB
              </p>
            </div>

            {file && (
              <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Selected file</p>
                    <p className="text-sm text-slate-500">
                      {file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setFile(null);
                        setPreviewUrl("");
                        resetResult();
                      }}
                      className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                    >
                      Reset
                    </button>
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={status === "uploading"}
                      className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-sky-300"
                    >
                      {status === "uploading" ? "Processing..." : "Remove Background"}
                    </button>
                  </div>
                </div>
                <p className="mt-4 text-sm text-slate-600">{statusText}</p>
                {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <PreviewCard title="Before" imageUrl={previewUrl} emptyText="Your original image preview will appear here." />
              <PreviewCard title="After" imageUrl={resultUrl} emptyText="Your transparent PNG result will appear here." checkerboard />
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleDownload}
                disabled={!resultUrl}
                className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
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
          </div>
        </section>

        <section className="grid gap-6 rounded-3xl bg-slate-950 px-6 py-8 text-white md:grid-cols-3 md:px-8">
          {[
            ["1", "Upload image", "Choose a product photo, portrait, or logo from your device."],
            ["2", "AI removes background", "We send your image to Remove.bg and return the transparent PNG."],
            ["3", "Download instantly", "Review the result and download it without signing up."],
          ].map(([step, title, description]) => (
            <div key={step} className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-sm font-semibold text-sky-300">Step {step}</p>
              <h2 className="mt-3 text-xl font-semibold">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">{description}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Built for simple, fast background removal.</h2>
            <p className="mt-4 max-w-3xl text-base leading-8 text-slate-600">
              This image background remover is designed for people who want a quick result without
              opening heavy design software. It works well for product photos, profile pictures,
              social graphics, and transparent PNG exports. The goal of this MVP is simple: help a
              user arrive, upload one image, remove the background, and download the result with as
              little friction as possible.
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {[
                "Product photos",
                "Portraits and profile photos",
                "Logos and graphics",
                "Social media assets",
              ].map((item) => (
                <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-medium text-slate-700">
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
            <h2 className="text-2xl font-bold tracking-tight">FAQ</h2>
            <div className="mt-6 space-y-5 text-sm leading-7 text-slate-600">
              <FaqItem question="Is this image background remover free?" answer="This MVP is free to try for single-image background removal." />
              <FaqItem question="What file formats are supported?" answer="You can upload JPG, PNG, and WEBP images up to 10MB." />
              <FaqItem question="Do you store my images?" answer="No persistent storage is used in the MVP flow. Images are processed per request." />
              <FaqItem question="Can I download a transparent PNG?" answer="Yes. Successful results are returned as PNG files with transparent backgrounds." />
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}

function PreviewCard({
  title,
  imageUrl,
  emptyText,
  checkerboard = false,
}: {
  title: string;
  imageUrl: string;
  emptyText: string;
  checkerboard?: boolean;
}) {
  return (
    <div>
      <p className="mb-3 text-sm font-semibold text-slate-700">{title}</p>
      <div
        className={`flex aspect-square items-center justify-center overflow-hidden rounded-2xl border border-slate-200 ${
          checkerboard
            ? "bg-[linear-gradient(45deg,#e5e7eb_25%,transparent_25%),linear-gradient(-45deg,#e5e7eb_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#e5e7eb_75%),linear-gradient(-45deg,transparent_75%,#e5e7eb_75%)] bg-[length:20px_20px] bg-[position:0_0,0_10px,10px_-10px,-10px_0px]"
            : "bg-slate-50"
        }`}
      >
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

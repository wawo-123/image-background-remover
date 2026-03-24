import { NextResponse } from "next/server";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export async function POST(request: Request) {
  const apiKey = process.env.REMOVE_BG_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Server configuration error: REMOVE_BG_API_KEY is missing." },
      { status: 500 }
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Please upload an image file." }, { status: 400 });
  }

  if (!ACCEPTED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Unsupported file format. Please upload JPG, PNG, or WEBP." },
      { status: 400 }
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "File is too large. Please upload an image under 10MB." },
      { status: 400 }
    );
  }

  const removeBgPayload = new FormData();
  removeBgPayload.append("image_file", file, file.name);
  removeBgPayload.append("size", "auto");

  const response = await fetch("https://api.remove.bg/v1.0/removebg", {
    method: "POST",
    headers: {
      "X-Api-Key": apiKey,
    },
    body: removeBgPayload,
  });

  if (!response.ok) {
    const message = await response.text();
    return NextResponse.json(
      {
        error:
          response.status === 402
            ? "Remove.bg quota or billing issue. Please check your API account."
            : `Remove.bg request failed: ${message || response.statusText}`,
      },
      { status: response.status }
    );
  }

  const buffer = await response.arrayBuffer();

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": 'attachment; filename="removed-background.png"',
      "Cache-Control": "no-store",
    },
  });
}

import { NextResponse } from "next/server";

export const runtime = "edge";

const CLIPDROP_ENDPOINT = "https://clipdrop-api.co/cleanup/v1";

export async function POST(req: Request) {
  try {
    const apiKey = process.env.CLIPDROP_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          error: "AI 修复未配置（缺少 CLIPDROP_API_KEY）。请稍后提供 API Key 后再试。",
          code: "CLIPDROP_KEY_MISSING",
        },
        { status: 400 }
      );
    }

    const form = await req.formData();
    const image = form.get("image");
    const mask = form.get("mask");

    if (!(image instanceof File) || !(mask instanceof File)) {
      return NextResponse.json(
        { error: "参数错误：需要 image + mask 文件", code: "BAD_REQUEST" },
        { status: 400 }
      );
    }

    const out = new FormData();
    out.append("image_file", image, image.name || "image.png");
    out.append("mask_file", mask, mask.name || "mask.png");

    const resp = await fetch(CLIPDROP_ENDPOINT, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
      },
      body: out,
    });

    if (!resp.ok) {
      const txt = await resp.text().catch(() => "");
      return NextResponse.json(
        {
          error: "AI 修复失败（上游返回错误）",
          upstream_status: resp.status,
          upstream_body: txt?.slice(0, 2000),
          code: "CLIPDROP_UPSTREAM_ERROR",
        },
        { status: 502 }
      );
    }

    const blob = await resp.blob();
    return new NextResponse(blob, {
      status: 200,
      headers: {
        "Content-Type": blob.type || "image/png",
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "AI 修复失败",
        code: "INPAINT_INTERNAL_ERROR",
      },
      { status: 500 }
    );
  }
}

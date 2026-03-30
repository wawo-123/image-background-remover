import { NextResponse } from "next/server";

const ALIYUN_OBJREMOVE_DOMAIN = "https://objremove.market.alicloudapi.com";
const SUBMIT_URL = `${ALIYUN_OBJREMOVE_DOMAIN}/api/v1/obj-remove/submit`;
const QUERY_URL = `${ALIYUN_OBJREMOVE_DOMAIN}/api/v1/obj-remove/query`;
const TEMP_ASSET_TTL_SEC = 60 * 10;
const POLL_INTERVAL_MS = 800;
const POLL_TIMEOUT_MS = 12_000;

function getCache(): Cache {
  const c = (globalThis as any).caches as any;
  if (!c?.default) throw new Error("当前运行环境不支持 Cache API");
  return c.default as Cache;
}

function buildAssetUrl(origin: string, token: string, kind: "image" | "mask") {
  return `${origin}/api/inpaint?token=${encodeURIComponent(token)}&kind=${kind}`;
}

async function putTempAsset(origin: string, token: string, kind: "image" | "mask", blob: Blob) {
  const cache = getCache();
  const url = buildAssetUrl(origin, token, kind);
  const key = new Request(url, { method: "GET" });
  const resp = new Response(blob, {
    headers: {
      "Content-Type": blob.type || "image/png",
      "Cache-Control": `public, max-age=${TEMP_ASSET_TTL_SEC}`,
    },
  });
  await cache.put(key, resp.clone());
  return url;
}

async function getTempAsset(req: Request) {
  const cache = getCache();
  const hit = await cache.match(new Request(req.url, { method: "GET" }));
  if (!hit) {
    return NextResponse.json({ error: "资源不存在或已过期", code: "TEMP_ASSET_NOT_FOUND" }, { status: 404 });
  }
  return hit;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildAliyunHeaders(appCode: string) {
  return {
    "Content-Type": "application/json",
    Authorization: `APPCODE ${appCode}`,
    "X-Ca-Nonce": crypto.randomUUID(),
  };
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    const kind = url.searchParams.get("kind");
    if (!token || (kind !== "image" && kind !== "mask")) {
      return NextResponse.json({ error: "参数错误", code: "BAD_REQUEST" }, { status: 400 });
    }
    return await getTempAsset(req);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "读取临时资源失败", code: "TEMP_ASSET_GET_FAILED" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const appCode = process.env.ALIYUN_OBJREMOVE_APPCODE || process.env.AppCode;
    if (!appCode) {
      return NextResponse.json(
        {
          error: "AI 修复未配置（缺少 ALIYUN_OBJREMOVE_APPCODE / AppCode）",
          code: "ALIYUN_APPCODE_MISSING",
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

    const origin = new URL(req.url).origin;
    const token = crypto.randomUUID();
    const imageBlob = new Blob([await image.arrayBuffer()], { type: image.type || "image/png" });
    const maskBlob = new Blob([await mask.arrayBuffer()], { type: mask.type || "image/png" });

    const imageUrl = await putTempAsset(origin, token, "image", imageBlob);
    const maskUrl = await putTempAsset(origin, token, "mask", maskBlob);

    const submitPayload = {
      data: {
        task_list: [
          {
            image: imageUrl,
            mask: maskUrl,
            kernel_size: 15,
          },
        ],
      },
    };

    const submitResp = await fetch(SUBMIT_URL, {
      method: "POST",
      headers: buildAliyunHeaders(appCode),
      body: JSON.stringify(submitPayload),
      cache: "no-store",
    });

    const submitText = await submitResp.text();
    let submitJson: any = null;
    try {
      submitJson = JSON.parse(submitText);
    } catch {
      submitJson = null;
    }

    if (!submitResp.ok || !submitJson?.success || !submitJson?.data?.result_key) {
      return NextResponse.json(
        {
          error: "AI 修复提交失败（阿里云）",
          upstream_status: submitResp.status,
          upstream_body: submitText.slice(0, 2000),
          code: "ALIYUN_SUBMIT_FAILED",
        },
        { status: 502 }
      );
    }

    const resultKey = submitJson.data.result_key as string;
    const started = Date.now();
    let lastQueryBody = "";

    while (Date.now() - started < POLL_TIMEOUT_MS) {
      await sleep(POLL_INTERVAL_MS);
      const queryResp = await fetch(QUERY_URL, {
        method: "POST",
        headers: buildAliyunHeaders(appCode),
        body: JSON.stringify({ data: { result_key: resultKey } }),
        cache: "no-store",
      });
      lastQueryBody = await queryResp.text();

      let queryJson: any = null;
      try {
        queryJson = JSON.parse(lastQueryBody);
      } catch {
        queryJson = null;
      }

      if (!queryResp.ok || !queryJson?.success) {
        return NextResponse.json(
          {
            error: "AI 修复查询失败（阿里云）",
            upstream_status: queryResp.status,
            upstream_body: lastQueryBody.slice(0, 2000),
            code: "ALIYUN_QUERY_FAILED",
          },
          { status: 502 }
        );
      }

      const task = queryJson?.data?.task_list?.[0];
      const status = task?.status;
      const resultUrl = Array.isArray(task?.results) ? task.results[0] : undefined;

      if (status === "SUCCESS" && resultUrl) {
        const resultResp = await fetch(resultUrl, { cache: "no-store" });
        if (!resultResp.ok) {
          return NextResponse.json(
            {
              error: "AI 修复结果下载失败",
              upstream_status: resultResp.status,
              code: "ALIYUN_RESULT_FETCH_FAILED",
            },
            { status: 502 }
          );
        }
        const blob = await resultResp.blob();
        return new NextResponse(blob, {
          status: 200,
          headers: {
            "Content-Type": blob.type || "image/png",
            "Cache-Control": "no-store",
          },
        });
      }

      if (status === "FAILED") {
        return NextResponse.json(
          {
            error: "AI 修复失败（任务执行失败）",
            upstream_body: lastQueryBody.slice(0, 2000),
            code: "ALIYUN_TASK_FAILED",
          },
          { status: 502 }
        );
      }
    }

    return NextResponse.json(
      {
        error: "AI 修复超时（阿里云任务未在时限内完成）",
        result_key: resultKey,
        code: "ALIYUN_TASK_TIMEOUT",
      },
      { status: 504 }
    );
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

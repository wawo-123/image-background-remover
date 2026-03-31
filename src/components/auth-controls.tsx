"use client";

import { signIn, signOut, useSession } from "next-auth/react";

export function AuthControls() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <div className="text-sm text-slate-300">登录状态加载中…</div>;
  }

  if (!session?.user) {
    return (
      <button
        type="button"
        onClick={() => signIn("google")}
        className="rounded-full border border-white/15 bg-white px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-sky-100"
      >
        Google 登录
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm text-slate-100">
      {session.user.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={session.user.image} alt={session.user.name ?? "avatar"} className="h-9 w-9 rounded-full border border-white/20" />
      ) : null}
      <div className="text-right">
        <div className="font-medium">{session.user.name ?? "已登录"}</div>
        <div className="text-xs text-slate-300">{session.user.email ?? ""}</div>
      </div>
      <button
        type="button"
        onClick={() => signOut()}
        className="rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-white/5"
      >
        退出登录
      </button>
    </div>
  );
}

# image-background-remover 部署与迭代操作笔记

> 目的：把这次从开发、修复、推送、Cloudflare 部署、自定义域名接入过程中踩过的坑和有效流程沉淀下来。以后再做这个项目更新时，**优先按这份流程执行**，减少重复犯错。

---

# 一、项目当前关键信息

## 仓库与目录
- 本地项目目录：`D:\work\ai_work\image-background-remover`
- GitHub 仓库：`https://github.com/wawo-123/image-background-remover`
- GitHub 用户名：`wawo-123`
- Worker 名称：`image-background-remover`

## 线上地址
- Worker 默认域名：`https://image-background-remover.wangwei521456.workers.dev`
- 自定义域名：`https://image-process-online.xyz`

## 当前技术路线
- 前端：Next.js
- 后端：Next.js Route Handler
- 背景消除：remove.bg API
- 部署：OpenNext for Cloudflare + Wrangler
- 域名托管：Cloudflare

---

# 二、以后更新网站时的推荐标准流程

> **以后优先走这套顺序，不要跳步。**

## Step 1：先改本地代码
改动内容优先在本地完成，不要一边改一边发线上。

重点文件常见包括：
- `src/app/page.tsx`
- `src/app/layout.tsx`
- `src/app/api/remove-background/route.ts`
- `README.md`
- `wrangler.jsonc`
- `open-next.config.ts`
- `.env.local`（本地）
- `.dev.vars`（本地/预览）

---

## Step 2：本地构建检查
每次改完都先跑：

```powershell
npm run build
```

通过后再跑：

```powershell
npm run cf:build
```

### 原因
- `npm run build` 负责检查 Next.js 本地生产构建是否可通过
- `npm run cf:build` 负责检查 OpenNext + Cloudflare 产物是否能正确打出来

### 原则
**两个都过，再考虑 GitHub / Cloudflare。**

---

## Step 3：先推 GitHub，再决定是否发线上
建议使用：

```powershell
git status --short
git add .
git commit -m "your commit message"
git push origin main
```

### 注意
如果在 PowerShell 里串联命令，不要用 `&&`，可能报错。优先用分行，或者：

```powershell
git add .
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
git commit -m "message"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
git push origin main
```

---

## Step 4：确认是否允许部署线上
如果是需要先给人审阅的版本：
- 先停在 GitHub
- 等确认
- 再部署 Cloudflare

如果用户已明确授权自动继续推进：
- 可直接进入部署步骤

---

## Step 5：部署 Cloudflare
使用：

```powershell
npm run cf:deploy
```

部署完成后会看到类似：
- `Uploaded image-background-remover`
- `Deployed image-background-remover triggers`
- `Current Version ID: ...`

### 部署后要记录
- 当前 Version ID
- 部署时间
- 是否成功更新自定义域名访问内容

---

## Step 6：验证线上
至少验证这两个：

### 1. Worker 默认地址
- `https://image-background-remover.wangwei521456.workers.dev`

### 2. 正式域名
- `https://image-process-online.xyz`

验证内容：
- 页面标题是否已变成新版
- 首页文案是否已更新
- 新功能入口是否可见
- `/api/remove-background` 是否正常工作

---

# 三、这次踩过的关键坑

## 坑 1：Next.js 16 + OpenNext for Cloudflare + Windows 下，默认构建链路会炸
### 现象
线上出现：
- `ChunkLoadError`
- 页面 500
- SSR chunk 丢失

### 根因
`Next.js 16` 默认构建链路 + `OpenNext for Cloudflare` + Windows 环境组合下，容易出现 chunk 问题。

### 解决办法
把 `package.json` 的构建命令改成：

```json
"build": "next build --webpack"
```

### 以后规则
**这个项目后续构建一律优先走 webpack，不要回到默认链路。**

---

## 坑 2：Cloudflare 登录并不是一定要手填 API Token
### 现象
会误以为部署 Cloudflare 必须先手工找 API Token。

### 实际情况
这个项目当时是通过 **Wrangler OAuth 登录** 完成授权的。

验证命令：

```powershell
npx wrangler whoami
```

如果能看到账号信息，说明已登录可部署。

### 以后规则
先检查 `wrangler whoami`，不要一上来就怀疑没填 token。

---

## 坑 3：Cloudflare 自定义域名接入，不是先乱改 A 记录
### 正确逻辑
如果域名还在 GoDaddy：
1. 先把域名加到 Cloudflare
2. 拿到 Cloudflare 分配的 NS
3. 去 GoDaddy 把 Nameserver 改成 Cloudflare 的 NS
4. 等 NS 生效
5. 等 Cloudflare zone 激活
6. 再核对 DNS / 路由

### 这次已确认的 Cloudflare NS
- `olof.ns.cloudflare.com`
- `rihana.ns.cloudflare.com`

### 以后规则
**接入 Cloudflare 优先切 NS，不要先瞎改 A / CNAME。**

---

## 坑 4：Worker 路由创建时，可能只创建了“旁路路由”，不是真正绑定到 Worker
### 现象
Cloudflare 页面会显示：
- 路由存在
- 但 Worker 显示为“无”
- 或者提示 `Workers 已在此路由上禁用`

### 这次真实踩坑结果
第一次添加路由时，只建成了：
- `image-process-online.xyz/*`
- 但没有真正选中 Worker

后面必须进入“编辑路由”，手动把 Worker 选成：
- `image-background-remover`

### 以后规则
检查 Workers 路由时，必须确认：
- 路由：`image-process-online.xyz/*`
- Worker：`image-background-remover`

如果 Worker 不是它，就不算绑定完成。

---

## 坑 5：本地 `next dev` 退出，不一定是代码炸了，可能只是进程被回收/超时
### 现象
本地预览跑着跑着退出。

### 实际定位
这次日志里：
- `GET /` 正常
- `POST /api/remove-background` 正常 200
- 没有明确 fatal error
- 有 hydration mismatch 提示，但更像浏览器插件干扰

更大的可能是：
- dev 进程被执行超时回收了

### 以后规则
本地预览如果退出：
1. 先看日志里有没有真正的崩溃栈
2. 不要第一反应就认定代码炸了
3. 检查是不是会话超时 / 执行器结束了进程

---

## 坑 6：浏览器 hydration mismatch 不一定是项目逻辑本身的问题
### 现象
日志出现：
- hydration mismatch
- body 上带额外属性，如 `data-gr-ext-installed`

### 根因
通常可能是：
- 浏览器扩展（例如 Grammarly）注入 DOM 属性
- 开发态 SSR/客户端 hydration 差异

### 以后规则
看到这种告警：
- 先区分“警告”还是“真正导致站点不可用的错误”
- 不要把所有 mismatch 都当成主因

---

## 坑 7：Git 会报 `credential-manager-core` 不是命令，但 push 仍可能成功
### 现象
出现：

```powershell
git: 'credential-manager-core' is not a git command. See 'git --help'.
```

### 这次结果
虽然有这个提示，但最终：
- `git push origin main` 依然成功了

### 以后规则
看到这个提示时：
- 不要立刻误判 push 失败
- 继续看最终是否真的推送成功
- 以后如需彻底清理，再单独修正 git credential helper 配置

---

# 四、这次功能层面的经验

## 1. 背景消除（支持批量）
### 用户真正想要的不是“能多选”而已
这次一开始虽然支持多图思路，但用户指出一个关键问题：
- 上传一次之后，不能继续追加图片

### 经验
以后做“批量上传”时，要优先考虑：
- 是“替换整批”还是“继续追加”
- 用户通常更偏向“追加”

### 规则
以后类似批量上传功能，优先支持：
- 多图首传
- 后续继续追加
- 单个删除
- 整批清空

---

## 2. 证件照制作不能要求用户手动走两步
### 用户真实期待
用户点“证件照制作”时，期待的是：
- 上传人像
- 一键生成结果

而不是：
1. 先自己手动点背景消除
2. 再自己手动生成证件照

### 规则
以后类似复合工作流，优先做成：
- 一键链路
- 中间步骤自动完成
- 中间结果可选展示，但不要求用户手动点

---

## 3. 证件照风格切换不能“一次生成就锁死”
### 用户真实需求
生成完后，用户还会继续比较：
- 真实自然
- 更好看一点
- 海马体一点

### 规则
以后此类结果生成器，必须支持：
- 调参数
- 重新生成
- 多版本试错

不要做成一次输出后流程锁死。

---

## 4. AI 消除“能跑”不等于“够好”
### 这次经验
一开始为了先可用，做了本地可运行的版本；
但用户的真实期待是更像成熟商业产品。

### 规则
以后做这种功能时，优先区分两个层次：
1. **先可运行**
2. **再提升成更像产品级效果**

而且在对用户汇报时，要明确告诉对方现在属于哪一层。

---

# 五、以后再次部署这个项目的推荐 Checklist

## 开发前
- [ ] 先确认当前任务是“本地验证后再推 GitHub”，还是“允许自动推进到上线”
- [ ] 先确认是否涉及域名 / DNS / 路由 / secret 变更
- [ ] 先检查 `wrangler whoami`

## 改代码后
- [ ] `npm run build`
- [ ] `npm run cf:build`
- [ ] 本地页面快速验证关键入口
- [ ] 关键交互至少手测一遍

## 推 GitHub 前
- [ ] `git status --short`
- [ ] 确认没有无关文件被带上
- [ ] commit message 清楚表达本轮目的
- [ ] `git push origin main`

## 部署前
- [ ] 确认这轮代码已推到 GitHub（方便追溯）
- [ ] 确认用户是否允许直接上线
- [ ] 确认 `.dev.vars` / Cloudflare secret 没缺关键变量

## 部署后
- [ ] 记录 Version ID
- [ ] 检查 `workers.dev` 地址
- [ ] 检查正式域名 `https://image-process-online.xyz`
- [ ] 核对标题/文案/功能入口是否已更新
- [ ] 核对核心接口是否可用

---

# 六、以后默认优先策略（重要）

## 对这个项目，优先遵守下面三条

### 1. 构建优先策略
**优先 `next build --webpack`，不要回退默认链路。**

### 2. 发布优先策略
**优先：本地构建 → Cloudflare 构建 → GitHub → 部署 → 线上验证。**

### 3. 域名优先策略
**优先检查 Workers 路由是否真的绑定到了 `image-background-remover`，而不是只看“路由存在”。**

---

# 七、建议以后新增的固定文档
如果后面继续长期维护这个项目，建议保留这几份：

- `docs/deployment-playbook.md`（本文件）
- `docs/release-checklist.md`（上线前核对表）
- `docs/feature-notes.md`（每次功能变更摘要）

这样后面每次升级网站，就不需要重新靠回忆摸索。

---

# 八、一句话版结论

> 以后这个网站更新时，默认按：
> **改代码 → `npm run build` → `npm run cf:build` → 推 GitHub → `npm run cf:deploy` → 检查正式域名**
> 这条路径走。

并且重点避开这次已经踩过的坑：
- 不要回到默认构建链路
- 不要把“路由存在”误认为“Worker 已绑定”
- 不要把 dev 进程超时误判成代码崩溃
- 不要把浏览器插件导致的 hydration mismatch 误判成主故障

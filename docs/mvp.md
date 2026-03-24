# Image Background Remover 项目 MVP 文档

## 1. 项目基本信息

### 1.1 项目名称
**Image Background Remover**

### 1.2 项目类型
SEO 驱动的在线工具网站

### 1.3 项目目标
围绕关键词 **`image background remover`** 搭建一个工具型网站，让用户可以在线上传图片、自动去背景，并下载透明背景 PNG。

### 1.4 MVP 核心目标
在最短路径内验证以下几点：

1. 关键词是否能承接自然搜索流量
2. 用户是否愿意完成“上传 → 去背景 → 下载”的完整流程
3. 产品体验是否足够简单顺滑
4. 后续是否值得继续做付费、批量处理、API 等扩展

---

## 2. 产品定位

这是一个 **轻量、快速、直接可用** 的在线去背景工具，不做复杂编辑器，不做设计平台。

### 一句话定位
> Upload an image, remove background instantly, download transparent PNG.

### 产品关键词
- image background remover
- remove background from image
- background remover online
- free background remover

---

## 3. 目标用户

### 3.1 核心用户
1. **电商卖家**
   - 处理商品图
   - 生成透明图/白底图素材

2. **设计师/运营**
   - 快速抠图做海报、广告图、社媒素材

3. **普通用户**
   - 处理头像、人物照、生活照片

4. **内容创作者**
   - 抠出人物或物品用于封面和内容制作

### 3.2 用户核心诉求
- 简单
- 快速
- 在线可用
- 不用安装软件
- 结果干净
- 支持下载透明 PNG

---

## 4. MVP 范围

### 4.1 MVP 要做的功能

#### 功能 1：图片上传
用户可以上传一张本地图片。

**要求：**
- 支持点击上传
- 支持拖拽上传
- 支持格式：
  - JPG
  - JPEG
  - PNG
  - WEBP
- 文件大小限制：**10MB 以内**
- 单次仅处理 **1 张图**

#### 功能 2：调用 Remove.bg 去背景
上传成功后，系统自动调用 Remove.bg API 处理图片。

**要求：**
- 自动发起处理
- 显示处理中状态
- 处理失败时给出提示
- 支持重试

#### 功能 3：结果预览
展示原图与处理结果。

**要求：**
- 有 Before / After 展示
- 透明背景区域可用棋盘格背景显示
- 下载按钮明显

#### 功能 4：下载结果图
用户可以下载处理后的透明背景 PNG。

**要求：**
- 下载格式为 PNG
- 不强制登录
- 不做会员限制
- 不做水印

#### 功能 5：首页 SEO 承接
首页既是工具页，也是 SEO 落地页。

**要求：**
- 包含关键词相关文案
- 有核心功能说明
- 有 FAQ
- 有使用场景说明
- 有基础 Meta 信息

#### 功能 6：异常提示
对上传、处理、下载失败给出可理解提示。

**包括：**
- 格式不支持
- 文件过大
- 接口失败
- 网络失败
- 下载失败

### 4.2 MVP 不做的功能
以下明确不进入首版：

- 用户注册/登录
- 历史记录
- 图片云端存储
- 批量处理
- 复杂编辑器
- 手动修边
- API 平台
- 支付系统
- 会员体系
- 多语言
- 移动端 App

---

## 5. 用户流程

### 主流程
1. 用户进入首页
2. 用户上传图片
3. 前端校验格式和大小
4. 后端接收图片
5. 后端调用 Remove.bg API
6. 返回处理结果
7. 前端展示预览
8. 用户点击下载 PNG
9. 流程结束

### 异常流程
- 文件类型不支持 → 提示重新上传
- 文件超出大小限制 → 提示压缩或更换图片
- Remove.bg 调用失败 → 提示稍后重试
- 网络异常 → 提示刷新或重试

---

## 6. 页面规划

### 6.1 首页 / 主工具页
这是 MVP 唯一核心页面。

**模块结构：**

#### 1）Hero 区
- H1：Remove Image Background Instantly
- 副标题：Upload your image and get a transparent PNG in seconds.
- 主按钮：Upload Image

#### 2）上传区域
- 拖拽上传框
- 点击上传按钮
- 格式和大小说明

#### 3）处理状态区
- Uploading...
- Removing background...
- Done

#### 4）结果展示区
- 原图
- 去背景结果图
- 下载按钮
- 再上传按钮

#### 5）How it works
三步说明：
1. Upload image
2. AI removes background
3. Download PNG

#### 6）应用场景
- Product photos
- Portraits
- Logos
- Social media graphics

#### 7）SEO 内容区
围绕主关键词写一段说明文案，帮助页面承接搜索。

#### 8）FAQ
放 5~8 个常见问题。

### 6.2 法务页面
MVP 至少包含：

- `/privacy-policy`
- `/terms-of-service`

可选：
- `/contact`

---

## 7. 技术方案

### 7.1 技术栈

#### 前端
- **Next.js**
- **TypeScript**
- **Tailwind CSS**

#### 后端
- **Next.js Route Handlers / API Routes**

#### 第三方服务
- **Remove.bg API**

#### 部署
- **Cloudflare**

#### 统计
- **Google Analytics 4** 或 **Plausible**

#### 监控
- **Sentry**（可选）

### 7.2 技术架构
本项目采用 **Next.js 一体化架构**，前后端统一在同一个项目中开发与部署。

**架构流程：**
1. 前端页面接收用户上传的图片
2. 图片发送到 Next.js 后端接口
3. 后端在内存中接收并处理中转图片
4. 后端调用 Remove.bg API
5. Remove.bg 返回处理结果
6. 后端直接将结果返回给前端
7. 前端提供结果预览与下载

### 7.3 文件处理策略

**原则：**
- **不做持久化存储**
- **不落盘**
- **不接对象存储**
- **仅在请求生命周期内以内存处理**

**处理方式：**
- 用户上传的图片仅在请求过程中进入服务端内存
- 后端将图片转发给 Remove.bg
- 返回结果后立即结束处理
- 不保存原图，也不保存结果图

**优点：**
- 架构简单
- 隐私更友好
- 无需清理临时文件
- 更适合 MVP 快速上线

### 7.4 核心 API

#### `POST /api/remove-background`

**功能：**
接收前端上传图片，调用 Remove.bg API，返回结果图。

**请求：**
- `multipart/form-data`
- 字段：`file`

**校验：**
- 文件类型校验
- 文件大小校验
- 单图限制

**响应：**
- 成功：返回处理后的 PNG 数据或可下载响应
- 失败：返回统一错误信息

---

## 8. 交互与体验要求

### 上传体验
- 上传区域清晰
- 拖拽态反馈明显
- 文件校验及时

### 处理中体验
- 有 loading 状态
- 不让用户误以为卡死
- 显示简洁状态文案

### 结果体验
- Before / After 清楚
- 下载按钮突出
- 允许快速重新上传

### 异常体验
报错提示要简单直接，例如：

- Unsupported file format
- File is too large
- Failed to remove background
- Network error, please try again

---

## 9. SEO 需求

### 9.1 首页 SEO 目标
首页主要承接关键词：

- image background remover
- remove background from image
- background remover online

### 9.2 页面基础信息

#### Title
Image Background Remover – Remove Background from Images Online

#### Meta Description
Remove background from images online in seconds. Fast AI image background remover for transparent PNG downloads.

#### H1
Remove Image Background Instantly

### 9.3 SEO 内容模块
首页需要补充一段自然语言内容，说明：

- 这个工具是什么
- 适合谁使用
- 为什么方便
- 支持哪些图片类型
- 如何下载透明 PNG

---

## 10. 数据统计与监控

### 10.1 需要关注的指标
- 页面访问量
- 上传点击率
- 上传成功率
- 去背景成功率
- 下载点击率
- 下载完成率

### 10.2 推荐埋点事件
- `page_view`
- `upload_click`
- `upload_success`
- `upload_fail`
- `remove_bg_start`
- `remove_bg_success`
- `remove_bg_fail`
- `download_click`
- `download_success`

---

## 11. 非功能要求

### 性能
- 首页加载尽量快
- 上传响应及时
- 去背景处理时间尽量控制在用户可接受范围内

### 安全
- 校验文件类型和大小
- 不保存用户图片
- 不暴露 Remove.bg API Key 到前端

### 可维护性
- 前后端统一项目结构
- API 错误统一处理
- 环境变量规范管理

---

## 12. 风险与边界

### 风险 1：第三方 API 成本
如果流量上涨，Remove.bg 成本会增加。

### 风险 2：第三方 API 稳定性
接口失败会直接影响用户体验。

### 风险 3：Cloudflare 运行限制
需要注意上传大小、请求时间、内存限制等边界。

### 风险 4：复杂图片处理效果
发丝、透明物体、边缘复杂图像可能不够完美。

---

## 13. 成功标准

MVP 成功的判断标准：

1. 用户能稳定完成“上传 → 处理 → 下载”
2. 工具页体验足够顺滑
3. 首页能承接基础搜索流量
4. 去背景结果达到基本可用
5. 下载转化率达到预期

---

## 14. MVP 优先级

### P0
- 首页工具页
- 单图上传
- Remove.bg 接口调用
- 结果预览
- PNG 下载
- 错误处理
- Privacy / Terms 页面

### P1
- FAQ
- 基础埋点
- 再次上传
- 体验优化

### P2
- 长尾 SEO 页面
- 付费能力
- 批量处理
- API 平台
- 账户系统

---

## 15. 一句话结论

这个 MVP 不是要做一个复杂的图片编辑平台，而是要做一个：

> **围绕 `image background remover` 关键词的轻量工具网站，用 Next.js 一体化架构接入 Remove.bg，在 Cloudflare 上部署，并通过内存中转实现无存储去背景处理。**

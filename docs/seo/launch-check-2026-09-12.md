# Browlens 上线体检核实与修复

日期：2026-09-12。范围：公开页面、8 个语言版本、站点地图、旧域名重定向及 Google Search Console。

## 当天修复与核实

| 项目 | 实测结果 | 处理 |
| --- | --- | --- |
| 首页 Hero 初始 HTML | 修复前 H1 在隐藏的流式响应片段中，初始位置是空 Suspense 边界；完整响应并非没有 H1 | 移除首页与 /filter 整个工具外层的 Suspense，初始 HTML 直接包含 H1 和上传按钮 |
| 首屏上传入口 | 原首页上传按钮在 1366×768 桌面首屏下方 | 在副标题下显示现有上传按钮，复用原上传流程 |
| /filter 站点地图 | 当前线上 sitemap 已有全部 8 个语言的 /filter，共 88 个 URL；GSC 已成功读取 88 个 URL | 保留现有生成逻辑，增加逐语言 /filter 回归断言 |
| keywords meta | 页面实际存在；48 份语言元数据包含该字段 | 删除元数据输出及所有语言的 metadata.keywords，增加全页缺失检查 |
| 旧域名重定向 | 5 个旧文章路径及 /showcases × 8 个语言，共 48 个旧域名地址全部 301 到新域名同路径 | 已正确，无需修改重定向 |
| 旧文章目标页面 | 旧域名跳转成功后，已删除文章在新域名返回 404；/showcases 返回 200 | 保持此前删除旧 tint 文章的决定，不恢复文章或跳转到不相关内容 |
| /blog H1 | 原 H1 使用 sr-only | 将现有可见博客标题设为唯一 H1，复用同一份语言文案 |

## 保留的正确配置

| 项目 | 状态 | 核实值或范围 |
| --- | --- | --- |
| 首页 Title | 保留 | Brow App — AI Eyebrow Shape Analyzer & Filter \| Browlens；解码后 56 个字符 |
| 首页 Description | 保留 | 137 个字符，包含 AI 分析、六点编辑、眉毛平衡报告和滤镜预览 |
| hreflang | 保留并回归检查 | en、zh、ko、ja、de、es、it、pt + x-default，包含自身及对应页面链接 |
| canonical | 保留并回归检查 | 各语言页面指向 browlens.com 上自己的 URL |
| OG 标签 | 保留 | title、description、image、site_name；图片仍是 logo |
| Twitter Card | 保留 | summary_large_image |
| 结构化数据 | 保留 | 首页包含 Organization、WebApplication、FAQPage；/filter 另有 Product、BreadcrumbList 等，并非首页包含所有类型 |
| robots.txt | 保留 | 普通搜索抓取可用；保留当前列出的 AI 爬虫限制，不把它描述为覆盖所有 AI 爬虫 |
| sitemap hreflang | 保留并回归检查 | 88 个 URL，每个条目含 8 个语言及 x-default |
| 图片 Alt | 保留 | 现有眉形预览描述，如 Soft Arch eyebrow filter preview |
| 新博客文章 | 保留 | mapping、shapes、how to shape 三个主题，8 个语言版本 |
| 多语言路由 | 保留并回归检查 | 英文无前缀，另有 /zh、/ko、/ja、/de、/es、/it、/pt |

## 建议项

| 项目 | 当前状态 | 后续安排 |
| --- | --- | --- |
| 社交分享图 | 仍使用 logo.png | 按本周优先级制作 1200×630 的 Before/After 分享图；本次未生成 |
| /filter H1 | 线上已经是 Try Eyebrow Filters — See Your Face with Different Brow Shapes，含目标关键词 | 保留；体检引用的旧标题不符合当前线上状态 |
| /blog H1 | 已改成可见标题 | 纳入每种语言的回归检查 |

## 验证范围

- 现有 104 项单元测试通过。
- Next.js 16.3.5 webpack 生产构建通过；本地生产服务 104/104 个公开页面、88 个 sitemap URL 检查通过，无失败。
- 浏览器在 1366×768 桌面及 390×844 手机窗口、页面顶部验证：副标题下上传按钮完整可见；点击正常打开 Photo Guidelines 上传须知。
- 线上部署及 GSC 提交结果另附最终验收记录。
- 回归脚本：`node scripts/verify-multilingual-seo.mjs <origin>`；检查 canonical、hreflang、页面状态、初始 HTML、keywords 缺失、可见博客 H1 与 sitemap。
- AI 引擎未改动；本次没有消耗额度执行付费生图。

## 关于体检报告的两点校正

流式响应或 JavaScript 并不等于 Google 一定看不到页面。这里修复的是初始 HTML 内容缺失，降低对后续响应和渲染的依赖。[Google JavaScript SEO 文档](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)

Google 不使用 keywords meta 参与排名，删除它合理，但不能据此认定它本身会阻止收录。[Google 官方说明](https://developers.google.com/search/blog/2009/09/google-does-not-use-keywords-meta-tag)

已删除且没有相近替代内容的页面可以返回 404/410；不要为了消除 404 把旧文章全部重定向到无关页面。[Google 抓取错误排查](https://developers.google.com/search/docs/crawling-indexing/troubleshoot-crawling-errors)

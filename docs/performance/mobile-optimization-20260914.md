# Browlens 手机性能优化

## 基线

PSI 报告：https://pagespeed.web.dev/analysis/https-browlens-com/6jvqnnc6l8?form_factor=mobile

2026-09-14 13:25 EDT，Lighthouse 13.4.1，Moto G Power，Slow 4G。

| 指标 | 手机基线 |
| --- | ---: |
| Performance | 68 |
| FCP | 2.268 s |
| LCP | 7.293 s |
| TBT | 170 ms |
| CLS | 0 |
| Speed Index | 4.773 s |

同报告桌面 Performance 为 91。当前无 CrUX 真实用户数据，以上为实验室结果。PSI API 公共配额返回 429，因此通过报告网页读取并保留诊断正文。

## 首轮：图片和阻塞样式

LCP 是 `/imgs/cases/2.jpg`。图片虽在 HTML 内，但没有高优先级 preload。四个 30px 头像使用 600px 原图；眉型图也使用 R2 大 PNG。报告图片优化估计节省 525 KiB；阻塞 CSS 共约 149 KiB。

- 首页 showcase 的人像、头像和眉型图改为 Next Image 响应式交付。
- 人像按实际展示宽度 216px / 288px 提供 sizes，并使用 eager / high。通过 React SSR 实测会产生与 srcset 匹配的高优先级 preload。
- 头像用 32px sizes，点击样例仍使用原始照片 URL，不降低分析输入分辨率。
- 眉型图按断点提供 sizes，保留懒加载与原布局。
- 全局 Pro CSS 改为项目实际使用的 Sheet、Segment 两个样式导出；保留 HeroUI 基础样式、主题和原组件行为。

实际生产图片优化接口抽查（Accept 支持 AVIF）：

| 资源 | 原文件 | 优化交付 |
| --- | ---: | ---: |
| 示例人像，640px 候选 | 67,093 B | 14,612 B |
| 样例头像 1，96px 候选 | 25,752 B | 1,004 B |
| 眉型 PNG 样例，384px 候选 | 119,999 B（PSI） | 3,492 B |

均 HTTP 200。以上是文件体积变化，不是已达到的 PageSpeed 分数。

## 验证与发布流程

- TypeScript 检查通过。
- SSR 实验确认 Image 产生响应式 srcset、高优先级 preload 和 eager img。
- `node scripts/verify-mobile-assets.mjs https://browlens.com` 在未发布版本上按预期失败于缺少 LCP high priority；部署后需转为通过。
- 发布由既有 Rebrand homepage as Browlens 任务完成，使用已提交代码构建。
- 部署后检查图片、手机照片提示弹层、样例进入编辑器、样式切换；重跑 PSI 手机和桌面。若手机仍低于 90，继续按新诊断定位，不把局部改动等同于目标达成。

参考：https://web.dev/articles/optimize-lcp

# Browlens SEO 与页面策略

记录日期：2026-09-12。目标站点：https://browlens.com。只面向个人用户，不做 B2B。

## 功能对照表

Trybrows 一列来自用户提供的对照，尚未独立核验；不将其直接作为公开竞品结论。Browlens 一列已对照本地代码。勾选表示功能存在，不代表每次识别或生成都成功。

| 功能 | Trybrows（用户提供） | Browlens | 文案落点 |
| --- | --- | --- | --- |
| 自动识别人脸与眉毛关键点 | 支持 | 支持 | 首页：AI Shape Analysis |
| 叠加眉头、眉峰、眉尾辅助线 | 支持 | 支持 | 首页与 eyebrow mapping 指南 |
| 手动拖动 6 个控制点修正 | 不支持 | 支持 | 首页：Six points. Your choice. |
| 调整粗细、长度、角度、间距、高度 | 不支持 | 支持 | 首页：An eyebrow editor you control |
| 眉峰高度差与眉长差分析报告 | 不支持 | 支持 | 首页：Understand your brow balance |
| AI 换眉形图片预览 | 不支持生图 | 支持 | 首页与 /filter：AI photo previews |

三个核心卖点组：①六点修正与多维精细编辑；②左右差异分析报告；③真正生成眉形试用图片。公开文案突出自身能力，不写未经核验的“竞品做不到”。

代码依据：src/shared/blocks/brow/anchor-editor.tsx、workspace.tsx、mobile-editor.tsx；src/shared/lib/brow-mapping/report.ts；src/themes/default/blocks/brow-tint/use-brow-generation.ts。

## 关键词表

以下搜索量、趋势均原样来自用户；未提供来源工具、国家、日期范围或匹配方式，未独立验证。3,600 与 1,900 可能属于不同统计口径，不能合并视为同一时点搜索量。

| 关键词 | 用户提供月搜索量 | 用户提供趋势 | 策略 | 页面 |
| --- | ---: | --- | --- | --- |
| brow app | 5,400 | 上升 23% | 首页主词，覆盖完整功能 | / |
| eyebrow mapping tool | 3,600 | 下降 53%；另述一年内 6,600 → 1,900 | 相关性强，作为博客词，不作首页主词 | /blog/eyebrow-mapping-guide |
| brow filter | 320 | 波动大 | 工具页主词 | /filter |
| eyebrow editor | 90 | 平稳 | 首页辅助词，对应手动修正 | / |
| eyebrow simulator | 90 | 平稳 | 工具页辅助词，对应眉形模拟 | /filter |
| eyebrow mapping | 12,100 | 未提供 | 信息型指南 | /blog/eyebrow-mapping-guide |
| eyebrow shapes | 22,200 | 未提供 | 信息型指南 | /blog/eyebrow-shapes-guide |
| how to shape eyebrows | 4,400 | 未提供 | 新手方法指南 | /blog/how-to-shape-eyebrows |

## 页面与转化路径

| 页面 | 主任务 | 用户路径 | 内链 |
| --- | --- | --- | --- |
| / | brow app 完整体验 | 上传 → 自动定位 → 六点修正与参数编辑 → 差异报告 → 选样式 → AI 生成 | /filter 与三篇指南 |
| /filter | brow filter、eyebrow simulator | 上传 → 后台自动定位 → 直接选眉形 → 即时轮廓 → 点击生成 → 左右对比 → 下载 | 首页完整编辑器与眉形指南 |
| /blog/eyebrow-mapping-guide | What Is Eyebrow Mapping? A Beginner’s Guide | 学懂定位，再进入首页编辑器 | /、/filter、其余指南 |
| /blog/eyebrow-shapes-guide | Eyebrow Shapes: A Guide to Finding Your Look | 对比眉形，再进入 /filter | /filter、定位与修眉指南 |
| /blog/how-to-shape-eyebrows | How to Shape Eyebrows: A Beginner’s Guide | 先数字规划，再决定如何整理 | /、/filter、其余指南 |

## 发布事实边界

- 自动分析和本地轮廓免费、无须注册；照片级 AI 生图保持现有登录与每次 2 积分机制。
- 即时显示的是轮廓；生成后的照片需要等待，不能承诺实时 AI 生图。
- 当前 S-Shaped 没有对应引擎预设，暂不可用；已向用户提出是否允许扩展预设的问题。
- 报告显示照片中的像素差异，不是毫米测量、美貌评分或完美对称承诺。
- 不承诺未经验证的照片自动删除时限，不杜撰用户评价或竞品能力。

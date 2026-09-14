# Browlens SEO 修复与上线交接

日期：2026-09-14。范围：用户提供的哥飞 SEO 报告及后续 eyebrow mapping 优先级更新。搜索量、KD、DR 和 onpage 分数为用户提供的第三方快照，本轮未重跑或宣称独立验证这些分值。

## 实施内容

| 项目 | 改动与验收方式 |
| --- | --- |
| 博客 OG / Twitter | 24 篇语言版本（3 篇指南 × 8 语言）使用各自标题、描述、图片和语言 URL；不再继承首页分享内容 |
| BlogPosting | 每篇指南输出独立 JSON-LD，作者与发布日期取自 MDX；不虚构更新日期。Browlens Team 按 Organization 标注；分享图取文章 frontmatter |
| eyebrow mapping 内链 | 英文首页和 /filter 的正文中新增精确锚文本 `eyebrow mapping`，指向 `/blog/eyebrow-mapping-guide` |
| 首页内容 | 工具下方新增照片准备、六点测绘、逐项调整、报告解释、生成对比与下一步；内容区约 1,409 个英文单词 |
| /filter 内容 | 工具下方新增滤镜原理、照片选择、四种可用轮廓、定位检查、before/after、积分导出与使用局限；内容区约 1,501 个英文单词 |
| FAQ | 答案保留在服务端 HTML，折叠时仍隐藏，用户可展开；JSON-LD 与可读答案一致 |
| 图片 | 首页示例图使用实测 706×941 尺寸；示例头像 600×600；裁切样式卡与案例轮播声明显示尺寸，并保留现有固定容器与 object-fit |
| 标题 | 首屏 Find your brow style 由 H3 改为 H2，保持原有视觉样式 |
| 小屏上传入口 | 仅在宽度≤760px、高度≤700px时将示例相框从232px缩至200px，等比缩放图片和映射线，为首屏上传按钮留空间 |
| 外部链接 | 页眉、页脚与品牌公共入口为 `_blank` 添加 `noopener noreferrer`；正文外链原有 rel 保留 |
| Filter 标题 | `Eyebrow Filter — Virtual Brow Try-On \| Browlens`，47 字符 |
| sitemap lastmod | 首页和 /filter 记录本轮正文/模板更新 2026-09-14；pricing 使用 git 中内容更新日 2026-09-12；不使用每次构建或访问时间 |

本轮内容扩展针对美国关键词对应的英文页面。其余 7 种语言保留原有本地化正文，公共模板、文章元数据与结构化数据修复应用于全部 8 种语言。未更改 AI 模型、生成逻辑、支付或积分规则，未新建重复的 mapping 落地页，未提交目录或外链。

## 已核实的原报告误差与限制

- 指南并非孤岛。2026-09-14 在已登录 Chrome 中读取生产首页 DOM，已有 `eyebrow mapping guide` → `/blog/eyebrow-mapping-guide`，位于 FAQ 后。此次是在正文中强化入口，且为 /filter 补入口。
- Google 没有 1,200 词排名门槛。此次扩写用于补充用户可用的信息；字数、文本/代码比及第三方分数不是排名承诺。参考：[Google SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide)。
- 无 width/height 属性不能单独证明有实际 CLS：原样式卡、轮播已有固定尺寸/宽高比。本轮补声明及检查布局，不宣称获得新的 CrUX 分数。
- /filter 实际支持 Natural、Arched、Straight、Soft Angled 四种 outline，未按报告泛化成六种已实现功能。
- `lastmod` 应表示实际内容更新，未统一伪造为当前请求日期。其余没有可靠更新时间的动态路由继续省略此可选字段。
- Article 标记帮助搜索引擎理解文章，但不保证富媒体结果。参考：[Google Article 文档](https://developers.google.com/search/docs/appearance/structured-data/article)。

## Browlens 的真实 GSC 快照

数据源：当前已登录 Chrome，Google Search Console 的 `sc-domain:browlens.com`，搜索类型“网络”，选中“3 个月”，没有国家过滤。读取时间 2026-09-14；页面显示上次更新约 8.5 小时前，图表可用日期为 2026-09-11 至 2026-09-12。

| 指标 | 当前显示 |
| --- | --- |
| 总点击 | 1 |
| 总曝光 | 2 |
| 平均 CTR | 50% |
| 平均排名 | 39 |
| 查询表可见行 | eyebrow simulator：0 点击、1 曝光 |

数据量极小，无法据此判断 SEO 优化成效或 eyebrow mapping 已起量。查询表行并不等于全部聚合曝光。此处数据是所有国家，不能当成美国口径。专家工具中 aibarber.net 的历史数据已排除。

当前浏览器有 Browlens GSC 访问权限，未验证或修改哥飞工具自己的 OAuth/GSC 资源绑定；若该工具仍返回 aibarber.net，需要在它自己的 GSC 设置中选择/授权 Browlens。此项与网站源码修复分开。

同日读取 `/blog/eyebrow-mapping-guide` 的网址检查，显示“网址尚未收录到 Google”“Google 无法识别此网址”；未检测到引荐站点地图、引荐网页，上次抓取为不适用。该历史报告不证明网页当前不可抓取，也不推翻已核实的首页链接。部署后优先实测该网址并请求编入索引；请求成功不等于已收录。

## 验证与上线

- 回归测试：`node --import tsx --test src/shared/lib/blog-seo.test.ts src/shared/lib/seo-metadata.test.ts src/shared/lib/seo-paths.test.ts src/app/sitemap-routes.test.ts`，12 项通过。
- 独立只读代码审查：未发现新增缺陷；正文词数以 show_sections 对应可读字段统计，排除工具 UI、导航、JSON key 和 URL。
- 本地验收使用清空数据库配置的 standalone 生产构建，不进行付费生成。首页眉形库显示 unavailable 属于这个隔离预览状态；生产发布后需要复核有真实眉形列表时的布局、图片和首屏入口。本地初始 HTML 中首页 17 张、filter 2 张图片均有尺寸，实际生产数量应以公网脚本输出为准。
- 最终 `next build --webpack` 完整通过（含 TypeScript、36 个静态页面及 standalone 打包）。使用产物自带 server.js 验收；本机 `next start` 对 standalone 产物会重写循环，改用正确入口后 HTTP 正常，未因此更改生产路由。
- 最终 HTTP 验收：26/26 重点页面、24 个 sitemap 日期条目通过，记录见 `seo-content-verification-2026-09-14.json`。初始 HTML 的全部非脚本文字统计：首页 1,601 词，filter 1,671 词（包含导航、工具和折叠答案，区别于上表的内容区口径）。
- 最终多语言验收：112/112 页面，96 条 sitemap URL，0 失败，记录见 `seo-multilingual-verification-2026-09-14.json`。旧脚本未计入已上线的 About 8 语言页面，已补检查并将旧88条预期更新为96。
- 浏览器验收：桌面1440×900，FAQ默认只显示一项；点击第一项正确展开，再次点击后全部折叠。375×667下首页及filter正文无横向溢出；小屏修正后相框max-width为200px，上传按钮top≈609px、bottom≈645px（修正前bottom≈688px），完整处于667px首屏。新增正文的移动端截图已人工检查。独立审查确认该规则不影响较高/较宽视口，不裁切映射照片。
- 可复跑检查：`node scripts/verify-seo-content.mjs <origin>`，覆盖 26 个页面的分享标签/正文/内链/FAQ/图片/H1 和 24 个 sitemap 日期条目；`node scripts/verify-multilingual-seo.mjs <origin>` 覆盖原有多语言契约。
- 上线由用户指定的任务 **Rebrand homepage as Browlens** 执行，任务 ID `01a0947a-99c9-7260-b6d6-23ddf89481af`。交接时提供确切提交、验证结果与需复跑的公网检查。
- 清理：临时服务已停止，浏览器测试尺寸已恢复，临时链接/日志已删除，tsconfig 自动添加的预览类型目录已移除。`.next-seo-review` 的递归删除被工具自动审批阻止（只返回 blocked by policy），保留在工作区但不提交。

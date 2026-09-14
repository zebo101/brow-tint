# AITDK GEO 报告核验与处理

用户提供的首页报告为 90/100，25 项通过、7 项警告、0 项失败。该分数属于扩展的启发式检查，不代表已经被 AI 引用或获得排名。本轮优先保持 eyebrow mapping 文章的收录与排名目标。

## 已核验的线上事实

2026-09-14 通过普通 HTTP 请求核验：

- 首页与 `/blog/eyebrow-mapping-guide` 均返回 200。
- `/llms.txt` 返回 404，确实缺失。
- 首页已有 Organization、WebApplication、FAQPage。
- mapping 文章已有 BlogPosting，作者为 Browlens Team，datePublished 为 `2026-09-12T00:00:00.000Z`，文章图片与 URL 正确。文章正文已有对 Benefit 眉毛定位方法的来源链接。
- 线上 robots.txt 含 Cloudflare 注入的训练爬虫限制及应用的公开/私有路径规则。本轮未修改既有策略，也未声称已从真实搜索爬虫 IP 验证 CDN 放行情况。

## 七项警告如何处理

| 警告 | 判断与处理 |
| --- | --- |
| 缺 llms.txt | 新增精简站点说明，第一组内容优先列出 eyebrow mapping 指南，再列产品、定价和政策。没有复制整站正文。 |
| 缺 sameAs | 未核实品牌官方外部身份，不把开发者个人账号或随意挑选的站点当作品牌 sameAs。本轮为 Organization 增加稳定 @id 和 logo，并把应用及文章 publisher 关联到该实体。@id 关联不能冒充 sameAs 警告已消除。 |
| 缺作者和日期 schema | 产品首页不需要为了文章检查项伪装成 Article；真正的文章已有作者与发布日期。 |
| 数字较少 | 首页已有六个控制点、15 MB 上传上限等产品事实。不制造用户数量、准确率、成功率等统计。 |
| 缺引文/引用组合 | 产品能力的第一手说明无须每段套用外部名言；教学文章已有具名来源。后续有外部事实性主张时再提供对应来源。 |
| 缺署名 | About 页面已说明产品由独立开发者构建，文章已有 Browlens Team 署名。未给产品首页添加虚构专家资质。 |
| 缺新鲜度信号 | 保留已知文章发布日期。只有正文确实更新且日期可核实时才添加 dateModified，不使用每次请求时间刷新日期。 |

## 改动与验证

- 新增 `public/llms.txt`。其中 11 个目标 URL 均经线上请求确认返回 200。
- 根布局给 Organization 与 WebApplication 添加稳定实体 ID，并关联 publisher；博客 publisher 引用相同 Organization ID。
- TypeScript、Prettier、diff check 和 10 项现有 SEO 单元测试通过，独立只读审查未发现问题。
- 部署后仍需确认 `/llms.txt` 返回 200 和纯文本正文，并检查首页/文章实际 JSON-LD 中的实体引用；不预估扩展重新评分的结果。

## 官方资料与证据边界

- [Google：AI features and your website](https://developers.google.com/search/docs/appearance/ai-features)：普通 SEO 基础仍适用，页面必须已被索引且允许摘要；不要求额外 AI 文本文件或特殊 schema。结构化数据应匹配可见内容。
- [llms.txt 提案](https://llmstxt.org/)：精简背景与精选链接可帮助代理按需理解站点。它是提案，不能保证 AI 搜索收录或引用。
- [GEO 原论文](https://arxiv.org/abs/2311.09735)：报告的是实验中最高约 40% 的可见性改善，并说明效果因领域而异。不能据此承诺给本产品首页添加数字就会提升 40%；本轮也没有验证报告中“约 2 倍引用率”的出处。

结论：补齐低成本的机器阅读入口和实体关联即可，不为清空警告改写产品首页的真实身份。后续以文章收录、查询曝光、点击和可核实的引用为结果依据。

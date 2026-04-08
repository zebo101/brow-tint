# SPEC: AI 发型生成提示词优化 & 轮询稳定性修复

> **Status**: In Progress  
> **Date**: 2026-04-08  
> **Scope**: `src/config/img-prompt.ts`, `src/shared/blocks/generator/image.tsx`, `src/extensions/ai/kie.ts`, `src/extensions/ai/replicate.ts`, `src/extensions/ai/fal.ts`

---

## 一、Problem Statement（问题陈述）

### 问题 A：发型生成效果不自然

AI 发型更换功能生成的结果发型像是硬贴上去的假发，而不是从用户头皮自然生长出来的发型。

**根因分析（三层问题）：**

1. **图片角色未声明（架构级 — 最关键）**  
   Nano Banana Pro（Gemini 3）是对话式多图模型，依赖 prompt 文本指示每张输入图片的角色。原代码将用户照片和发型参考图一起塞进 `image_input` 数组，但 prompt 中未声明哪张是人脸、哪张是发型参考。

2. **角色声明写死 Image 1 / Image 2，不适配多图**  
   初版修复硬编码了 "Image 1 是本人, Image 2 是发型参考"。一旦用户上传多张照片，发型图不再是 Image 2，角色理解错位。

3. **prompt 措辞鼓励"复制"而非"适配"**  
   "match the hairstyle shown in image 2" 引导模型直接复制参考图的发型轮廓，而非根据用户的头型、发际线、脸型重建发型。

4. **text-to-image 模式误发参考图**  
   `text-to-image` 模式下仍会发送 `hairstyle_image`，但 prompt 按"无参考图"写法生成，模型收到未声明角色的额外图像。

5. **旧版 prompt 格式错误**  
   原 `HAIRSTYLE_SYSTEM_PROMPT` 使用 `JSON.stringify()` 生成结构化 JSON。图像生成模型期望自然语言描述，大部分 JSON 内容被忽略。

### 问题 B：`Query task failed: fetch failed` 频繁报错

修改后用户生成频率提高，暴露了已有的轮询脆弱性。

**根因分析：**

- 错误信息 `fetch failed` 来自**服务端 `fetch()` 抛出异常**（网络层），不是 Kie API 返回错误码
- 说明是 Kie `/jobs/recordInfo` 端点的**瞬态网络故障**（DNS/TLS/socket reset/upstream timeout）
- 如果是 prompt 被拒绝，应该在 `createTask` 阶段失败或返回 `state: fail`+`failMsg`
- 当前代码**一次轮询失败就终止整个任务**（`resetTaskState()`），过于激进
- 超时时间 3 分钟对异步图像生成过短

---

## 二、Proposed Solution（方案描述）

### 2.1 重写提示词引擎（`src/config/img-prompt.ts`）

`buildHairstylePrompt()` 接收 `subjectImageCount`（数字）替代 `hasReferenceImage`（布尔），实现 count-aware：

| 场景                    | 生成的角色声明                                                                |
| ----------------------- | ----------------------------------------------------------------------------- |
| 1 张人像 + 发型参考     | `Image 1 is the person's photo. Image 2 is a hairstyle reference.`            |
| 3 张人像 + 发型参考     | `Images 1–3 are photos of the same person. Image 4 is a hairstyle reference.` |
| text-to-image（无人像） | `Generate a person with a {name} hairstyle.`（不声明图片角色）                |

**核心措辞改变**：从 "match the hairstyle" → "use as style guide only"

```
Use the hairstyle reference as a style guide only — for the haircut shape,
length, texture, and styling direction.
Adapt the hairstyle to the person's own head shape, hairline, forehead,
temples, and face proportions. Do NOT transplant or paste the exact hair
silhouette from the reference.
```

**新增物理约束**（具体到位置，不再只是抽象词）：

- root transition（根部过渡）
- visible hairline（可见发际线）
- realistic parting（真实分缝）
- sideburn blend（鬓角融合）
- temple coverage（太阳穴覆盖）

**保留原发色**默认规则：

```
Keep the original hair color unless explicitly asked to change it.
```

### 2.2 text-to-image 模式修复（`src/shared/blocks/generator/image.tsx`）

- 选了发型库样式但处于 text-to-image 模式时：**不发送 `hairstyle_image`**，只用发型名称和 tags 生成纯文本描述
- prompt 使用 "Generate a person with..." 语气，不再出现 "the person in the photo" 这种 edit 语气

### 2.3 轮询稳定性修复（`image.tsx` + `kie.ts`）

#### 前端容错（`image.tsx`）：

- 新增 `pollErrorCount` 状态计数器
- 单次轮询失败不终止任务，累计 **3 次连续失败** 才放弃
- 超时时间从 `180s` → `600s`（10 分钟，适配 Kie 异步任务）

#### Kie query 重试（`kie.ts`）：

- `queryImage()` 和 `queryVideo()` 的 fetch 调用增加 **3 次重试 + 指数退避**（2s, 4s）
- 重试范围：网络异常、5xx、429
- 4xx（非 429）不重试，直接抛出

### 2.4 Negative Prompt 策略

- `HAIRSTYLE_NEGATIVE_PROMPT` 精简为最有价值的 10 项（移除了 `studio lighting`、`4k sharp focus` 等可能误伤正常照片的项）
- 仅在 image-to-image 模式下传递，text-to-image 不传
- Kie API 不支持 `negative_prompt` 字段（静默忽略），但 Replicate/Fal 支持，因此保留传递逻辑

### 2.5 Provider 层传参（维持现有策略）

- **Kie**: `image_input = [...userPhotos, hairstyleReference]`，prompt 中的角色索引与此顺序一一对应
- **Replicate**: 发型参考图追加到 `input_images` 末尾 + `negative_prompt` 独立参数
- **Fal**: 发型参考图走 `reference_image_url` + `negative_prompt` 独立参数

---

## 三、Technical Constraints（技术约束）

1. **图片顺序即语义**：Nano Banana Pro 通过 `image_input` 数组顺序对应 prompt 中的 "Image N"，顺序错乱 = 角色互换
2. **Kie API 不支持 `negative_prompt`**：传入后被静默忽略，不报错，但也不生效。核心自然度靠正向 prompt 解决
3. **`SYSTEM_PROMPT_MARKER` 机制**：系统 prompt 需通过 `|||SYSTEM_PROMPT|||` 标记，用户中心展示时过滤
4. **Kie 轮询端点不稳定**：`/jobs/recordInfo` 存在瞬态网络故障，必须在 server 端 + client 端双层容错
5. **超时窗口**：Kie 官方建议 10-15 分钟轮询窗口，3 分钟过短
6. **不引入新依赖**：所有改动在现有架构内完成

---

## 四、Non-goals（明确不做的事）

1. **不更换模型**：不切换到专门的 face swap / inpainting 模型
2. **不做用户照片预分析**：不新增 vision 模型调用分析用户照片光线/分辨率
3. **不做按模型分版本 prompt**：统一使用自然语言 prompt
4. **不修改前端 UI 组件**：不改动发型选择器、上传组件、结果展示
5. **不限制上传数量**：保留多图上传能力，通过 count-aware prompt 适配
6. **不修改 hairstyle-analyzer**：发型标注服务保持不变
7. **不改用 callback-first 架构**：保持当前轮询模式，通过重试 + 容错解决稳定性

---

## 五、Success Criteria（成功标准）

### 自然度验证

| #   | 验证项         | 预期结果                                                 |
| --- | -------------- | -------------------------------------------------------- |
| 1   | 发型融合自然度 | 发型从头皮自然生长，无拼接痕迹、无假发感、发际线可见     |
| 2   | 人脸保真度     | 面部特征、肤色、表情、姿势、服装、背景与原照片一致       |
| 3   | 适配性         | 发型根据用户头型/发际线/脸型自适应，非直接复制参考图轮廓 |
| 4   | 光照一致性     | 新发型高光/阴影方向与源照片匹配                          |
| 5   | 发色保持       | 默认保持原发色，不随参考图变色                           |

### 稳定性验证

| #   | 验证项                  | 预期结果                                       |
| --- | ----------------------- | ---------------------------------------------- |
| 6   | 单次轮询网络异常        | 不显示错误提示，继续轮询                       |
| 7   | 连续 3 次轮询失败       | 显示错误提示并终止任务                         |
| 8   | Kie query 重试          | 服务端自动重试 2 次（间隔 2s, 4s），用户无感知 |
| 9   | 长时间生成（5-10 分钟） | 不超时，持续轮询直到完成                       |

### 多场景回归

| #   | 验证项                   | 预期结果                                            |
| --- | ------------------------ | --------------------------------------------------- |
| 10  | 单张人像 + 发型参考      | prompt 为 `Image 1` 本人、`Image 2` 发型参考        |
| 11  | 多张人像 + 发型参考      | prompt 自动 `Images 1-N` 为本人，最后一张为发型参考 |
| 12  | text-to-image + 发型库   | 请求中**不发送** `hairstyle_image`，纯文本描述生成  |
| 13  | 不选发型的普通 img2img   | 流程正常，不附加发型系统 prompt                     |
| 14  | Replicate / Fal provider | 正常生成，无回归                                    |
| 15  | 用户中心历史记录         | 系统 prompt 被 MARKER 正确过滤                      |

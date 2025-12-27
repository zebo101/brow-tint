import { NextRequest } from 'next/server';
import { respData, respErr } from '@/shared/lib/resp';
import { getStorageService } from '@/shared/services/storage';
import { createHairstyles, type NewHairstyle } from '@/shared/models/hairstyle';
import { getAIService } from '@/shared/services/ai';
import { getUuid } from '@/shared/lib/uuid';
import { md5 } from '@/shared/lib/hash';
import { getAllConfigs } from '@/shared/models/config';

// 动态导入sharp（如果未安装会报错，需要用户安装）
let sharp: any = null;
try {
  sharp = require('sharp');
} catch (e) {
  console.warn('sharp not installed, thumbnail generation will be skipped');
}

const THUMBNAIL_SIZE = 150;

/**
 * 生成缩略图
 */
async function generateThumbnail(
  imageBuffer: Buffer,
  mimeType: string
): Promise<Buffer | null> {
  if (!sharp) {
    return null;
  }

  try {
    const thumbnail = await sharp(imageBuffer)
      .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }, // 透明背景
      })
      .png()
      .toBuffer();

    return thumbnail;
  } catch (error) {
    console.error('Failed to generate thumbnail:', error);
    return null;
  }
}

/**
 * 使用Vision API识别发型并生成名称和标签
 */
async function analyzeHairstyleWithAI(
  imageUrl: string
): Promise<{ name: string; tags: string[] }> {
  try {
    const aiService = await getAIService();
    const geminiProvider = aiService.getProvider('gemini');

    if (!geminiProvider) {
      throw new Error('Gemini provider not configured');
    }

    // 使用Gemini Vision API分析图片
    const prompt = `请分析这张发型图片，返回JSON格式：
{
  "name": "发型名称（简洁，2-6个字）",
  "tags": ["标签1", "标签2", "标签3"]（3-5个标签，描述发型特征，如：短发、卷发、中分等）
}

只返回JSON，不要其他文字。`;

    // 获取Gemini API Key
    const configs = await getAllConfigs();
    const geminiApiKey = configs.gemini_api_key;
    
    if (!geminiApiKey) {
      throw new Error('Gemini API key not configured');
    }

    // 调用Gemini Vision API
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`;

    // 获取图片并转换为base64
    const imageResp = await fetch(imageUrl);
    if (!imageResp.ok) {
      throw new Error('Failed to fetch image for analysis');
    }

    const arrayBuffer = await imageResp.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Image = buffer.toString('base64');
    const mimeType = imageResp.headers.get('content-type') || 'image/png';

    const payload = {
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: prompt,
            },
            {
              inlineData: {
                mimeType,
                data: base64Image,
              },
            },
          ],
        },
      ],
    };

    const resp = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const errorText = await resp.text();
      throw new Error(`Vision API failed: ${errorText}`);
    }

    const result = await resp.json();
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      throw new Error('No response from Vision API');
    }

    // 解析JSON响应
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Invalid JSON response');
    }

    const analysis = JSON.parse(jsonMatch[0]);

    return {
      name: analysis.name || '未命名发型',
      tags: Array.isArray(analysis.tags) ? analysis.tags : [],
    };
  } catch (error: any) {
    console.error('AI analysis failed:', error);
    // 如果AI分析失败，返回默认值
    return {
      name: '未命名发型',
      tags: [],
    };
  }
}

/**
 * 从文件名提取序号和分类
 */
function parseFilename(filename: string): {
  category: string;
  sequence: number;
} | null {
  // 支持格式: men(1).png, women(2).png, boys(3).png, girls(4).png
  // 或者: (1).png (需要从category参数获取)
  const match = filename.match(/^(men|women|boys|girls)?\((\d+)\)/i);
  if (match) {
    const category = match[1]?.toLowerCase() || null;
    const sequence = parseInt(match[2], 10);
    return { category: category || '', sequence };
  }

  // 尝试提取纯数字序号
  const numMatch = filename.match(/(\d+)/);
  if (numMatch) {
    return { category: '', sequence: parseInt(numMatch[1], 10) };
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll('files') as File[];
    const category = formData.get('category') as string; // men, women, boys, girls

    if (!files || files.length === 0) {
      return respErr('No files provided');
    }

    if (!category || !['men', 'women', 'boys', 'girls'].includes(category)) {
      return respErr('Invalid category. Must be: men, women, boys, or girls');
    }

    const storageService = await getStorageService();
    const newHairstyles: NewHairstyle[] = [];

    for (const file of files) {
      // 验证文件类型
      if (!file.type.startsWith('image/')) {
        console.warn(`Skipping non-image file: ${file.name}`);
        continue;
      }

      // 解析文件名获取序号
      const parsed = parseFilename(file.name);
      if (!parsed) {
        console.warn(`Cannot parse sequence from filename: ${file.name}`);
        continue;
      }

      const sequence = parsed.sequence;
      const fileCategory = parsed.category || category;

      // 转换为buffer
      const arrayBuffer = await file.arrayBuffer();
      const imageBuffer = Buffer.from(arrayBuffer);

      // 上传原始图片
      const digest = md5(imageBuffer);
      const ext = 'png'; // 强制使用PNG保持透明背景
      const imageKey = `hairstyle/${fileCategory}/${digest}.${ext}`;

      const imageUploadResult = await storageService.uploadFile({
        body: imageBuffer,
        key: imageKey,
        contentType: 'image/png',
        disposition: 'inline',
      });

      if (!imageUploadResult.success) {
        console.error(`Failed to upload image: ${file.name}`, imageUploadResult.error);
        continue;
      }

      const imageUrl = imageUploadResult.url;
      if (!imageUrl) {
        console.error(`Failed to get image url for file: ${file.name}`);
        continue;
      }

      // 生成缩略图
      let thumbnailUrl: string = imageUrl; // 默认使用原图
      const thumbnailBuffer = await generateThumbnail(imageBuffer, file.type);
      if (thumbnailBuffer) {
        const thumbnailKey = `hairstyle/${fileCategory}/thumb/${digest}.${ext}`;
        const thumbnailUploadResult = await storageService.uploadFile({
          body: thumbnailBuffer,
          key: thumbnailKey,
          contentType: 'image/png',
          disposition: 'inline',
        });

        if (thumbnailUploadResult.success && thumbnailUploadResult.url) {
          thumbnailUrl = thumbnailUploadResult.url;
        }
      }

      // 使用AI分析发型
      const analysis = await analyzeHairstyleWithAI(imageUrl);

      // 创建数据库记录
      const newHairstyle: NewHairstyle = {
        id: getUuid(),
        category: fileCategory,
        sequence,
        name: analysis.name,
        tags: JSON.stringify(analysis.tags),
        imageUrl,
        thumbnailUrl,
        status: 'active',
      };

      newHairstyles.push(newHairstyle);
    }

    if (newHairstyles.length === 0) {
      return respErr('No valid hairstyle images to upload');
    }

    // 批量插入数据库
    const createdHairstyles = await createHairstyles(newHairstyles);

    return respData({
      count: createdHairstyles.length,
      hairstyles: createdHairstyles,
    });
  } catch (e: any) {
    console.error('Upload hairstyles failed:', e);
    return respErr(`Upload failed: ${e.message || 'Unknown error'}`);
  }
}


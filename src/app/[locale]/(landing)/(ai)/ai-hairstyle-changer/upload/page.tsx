'use client';

import { useState } from 'react';
import { CheckCircle2, Loader2, Upload, XCircle } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/shared/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import { Label } from '@/shared/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';

export default function HairstyleUploadPage() {
  const [category, setCategory] = useState<string>('men');
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<
    Record<string, 'pending' | 'uploading' | 'success' | 'error'>
  >({});

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    setFiles(selectedFiles);

    // 初始化上传状态
    const progress: Record<string, 'pending'> = {};
    selectedFiles.forEach((file) => {
      progress[file.name] = 'pending';
    });
    setUploadProgress(progress);
  };

  const handleUpload = async () => {
    if (!category) {
      toast.error('请选择分类');
      return;
    }

    if (files.length === 0) {
      toast.error('请选择要上传的文件');
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('category', category);

      files.forEach((file) => {
        formData.append('files', file);
      });

      // 更新上传状态
      const progress: Record<string, 'uploading'> = {};
      files.forEach((file) => {
        progress[file.name] = 'uploading';
      });
      setUploadProgress(progress);

      const response = await fetch('/api/hairstyle/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.code !== 0) {
        throw new Error(result.message || '上传失败');
      }

      // 更新成功状态
      const successProgress: Record<string, 'success'> = {};
      files.forEach((file) => {
        successProgress[file.name] = 'success';
      });
      setUploadProgress(successProgress);

      toast.success(`成功上传 ${result.data.count} 个发型`);

      // 清空文件列表
      setFiles([]);
      setUploadProgress({});

      // 重置文件输入
      const fileInput = document.getElementById(
        'file-input'
      ) as HTMLInputElement;
      if (fileInput) {
        fileInput.value = '';
      }
    } catch (error: any) {
      console.error('Upload failed:', error);

      // 更新错误状态
      const errorProgress: Record<string, 'error'> = {};
      files.forEach((file) => {
        errorProgress[file.name] = 'error';
      });
      setUploadProgress(errorProgress);

      toast.error(`上传失败: ${error.message || '未知错误'}`);
    } finally {
      setIsUploading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'uploading':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>发型素材批量上传</CardTitle>
          <CardDescription>
            上传透明背景的PNG发型图片，系统会自动生成缩略图并使用AI识别发型名称
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 分类选择 */}
          <div className="space-y-2">
            <Label htmlFor="category">选择分类</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="category">
                <SelectValue placeholder="选择分类" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="men">男士发型</SelectItem>
                <SelectItem value="women">女士发型</SelectItem>
                <SelectItem value="boys">男童发型</SelectItem>
                <SelectItem value="girls">女童发型</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 文件选择 */}
          <div className="space-y-2">
            <Label htmlFor="file-input">选择图片文件</Label>
            <div className="flex items-center gap-4">
              <input
                id="file-input"
                type="file"
                multiple
                accept="image/png,image/jpeg"
                onChange={handleFileSelect}
                className="file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 flex-1 text-sm file:mr-4 file:rounded-md file:border-0 file:px-4 file:py-2 file:text-sm file:font-semibold"
                disabled={isUploading}
              />
            </div>
            <p className="text-muted-foreground text-xs">
              支持PNG和JPEG格式，建议使用透明背景PNG。文件名格式：men(1).png 或
              (1).png（序号会自动提取）
            </p>
          </div>

          {/* 文件列表 */}
          {files.length > 0 && (
            <div className="space-y-2">
              <Label>已选择的文件 ({files.length})</Label>
              <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border p-4">
                {files.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="flex-1 truncate">{file.name}</span>
                    <span className="text-muted-foreground ml-2">
                      {(file.size / 1024).toFixed(1)} KB
                    </span>
                    {uploadProgress[file.name] && (
                      <span className="ml-4">
                        {getStatusIcon(uploadProgress[file.name])}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 上传按钮 */}
          <Button
            onClick={handleUpload}
            disabled={isUploading || files.length === 0 || !category}
            className="w-full"
            size="lg"
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                上传中...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                开始上传
              </>
            )}
          </Button>

          {/* 使用说明 */}
          <div className="space-y-2 border-t pt-6">
            <h3 className="font-semibold">使用说明：</h3>
            <ul className="text-muted-foreground list-inside list-disc space-y-1 text-sm">
              <li>图片格式：建议使用透明背景的PNG格式</li>
              <li>文件命名：支持 men(1).png 或 (1).png 格式，序号会自动提取</li>
              <li>批量上传：可以一次选择多个文件同时上传</li>
              <li>自动处理：系统会自动生成150x150缩略图</li>
              <li>AI识别：使用Gemini Vision API自动识别发型名称和标签</li>
              <li>存储位置：图片会存储在云存储中，不会占用项目空间</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

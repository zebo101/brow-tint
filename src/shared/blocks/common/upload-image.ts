/**
 * 检查文件是否是图片类型
 */
export function isImageFile(file: File): boolean {
  return file.type?.startsWith('image/') ?? false;
}

/**
 * 上传图片文件到服务器
 * @param file 要上传的文件
 * @returns 上传成功后的图片 URL
 */
export async function uploadImageFile(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('files', file);

  const response = await fetch('/api/storage/upload-image', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Upload failed with status ${response.status}`);
  }

  const result = await response.json();
  if (result.code !== 0 || !result.data?.urls?.length) {
    throw new Error(result.message || 'Upload failed');
  }

  return result.data.urls[0] as string;
}







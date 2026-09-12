import translatedCopy from './copy-locales.json';
import editorTranslations from './editor-locales.json';

const originalBrowCopy = {
  en: {
    eyebrow: 'THE BROW STUDIO',
    title: 'Your brows. In balance.',
    intro:
      'Understand your brow placement, then choose a style that feels like you.',
    upload: 'Start with your portrait',
    uploadHint: 'One person, facing forward, with eyes and brows visible.',
    formats: 'JPG, PNG or WebP · up to 15 MB',
    choose: 'Choose a photo',
    replace: 'Change photo',
    privacy:
      'Photo analysis stays on your device. Images are uploaded only when you generate a preview.',
    preparing: 'Preparing your photo…',
    'loading-model': 'Loading the face analysis model…',
    detecting: 'Locating your facial features…',
    retry: 'Try analysis again',
    analysis: '01 / UNDERSTAND YOUR BROWS',
    direction: 'Explore the placement',
    directionHint:
      'Three geometry directions help you refine the fit. Choose your final style from the sample library below.',
    natural: 'Natural',
    soft: 'Soft',
    lifted: 'Lifted',
    naturalReason:
      'Follows your existing brow position with a balanced, moderate arch.',
    softReason: 'A gentler arch softens the transition from brow head to tail.',
    liftedReason:
      'A slightly higher arch adds definition while keeping your natural placement.',
    reasons: {
      elongated:
        'A softer direction is shown first to complement the measured face proportions.',
      'low-arch':
        'A lifted direction is shown first because the observed brow arch is relatively low.',
      balanced:
        'A natural direction is shown first to follow the measured brow balance.',
    },
    thickness: 'Brow thickness',
    arch: 'Arch height',
    lower: 'Lower',
    higher: 'Higher',
    confirm: 'Confirm analysis & choose a sample',
    confirmed: 'Analysis confirmed',
    original: 'View original',
    mapping: 'View mapping',
    download: 'Download analysis',
    pause: 'Pause',
    continue: 'Continue',
    skip: 'Show complete',
    replay: 'Replay',
    steps: [
      'Feature points',
      'Center line',
      'Brow heads',
      'Arch placement',
      'Brow tails',
      'Balance check',
      'Your brow contours',
    ],
    explanations: [
      'Eye corners and nose wings anchor the reference lines.',
      'An eye-aligned center line gives a reference for both sides.',
      'Nose-wing references guide the heads, bounded by your existing brows.',
      'Nose-to-iris lines inform arch placement alongside your existing shape.',
      'Nose-to-outer-eye lines help estimate the tail direction.',
      'Crossing lines link each arch to the opposite head reference above it, comparing the layout without forcing symmetry.',
      'These two contours describe the selected placement and adjustments.',
    ],
    catalog: '02 / CHOOSE YOUR STYLE',
    catalogTitle: 'The brow sample library',
    catalogHint:
      'Choose the brow design, hair direction and texture you want. Your confirmed placement stays in place.',
    catalogLocked: 'Confirm your analysis to choose a brow sample.',
    emptyCatalog:
      'The brow sample library is not connected yet. You can still refine and download your analysis.',
    search: 'Search brow samples',
    all: 'All categories',
    samples: 'samples',
    noMatches: 'No samples match your search.',
    selected: 'Selected sample',
    previous: 'Previous',
    next: 'Next',
    downloadError: 'Could not export your analysis. Please try again.',
    errors: {
      'file-type': 'Choose a JPG, PNG or WebP photo.',
      'file-size': 'Please choose a photo smaller than 15 MB.',
      decode: 'This photo could not be opened. Try another image.',
      'small-image': 'Choose a photo at least 256 pixels wide and tall.',
      browser:
        'Your browser could not start local analysis. Try a current browser.',
      'no-face': 'No face was found. Try a clear, front-facing portrait.',
      'multiple-faces': 'Please use a photo with only one person.',
      landmarks:
        'Facial features could not be read reliably. Try a clearer photo.',
      'small-face':
        'Move closer or choose a photo where your face fills more of the frame.',
      'front-facing':
        'Please face the camera directly for more reliable placement.',
      'eyes-open': 'Please use a photo with both eyes open.',
      'brows-visible': 'Make sure both eyebrows are clearly visible.',
      'model-timeout':
        'The analysis model took too long to load. Please retry.',
      'model-error': 'The analysis model could not load. Please retry.',
      unknown:
        'Analysis could not finish. Please retry or choose another photo.',
    },
  },
  zh: {
    eyebrow: '眉形工作室',
    title: '找到属于你的眉间平衡',
    intro: '先理解眉形定位，再选择你喜欢的款式。',
    upload: '从一张正面照片开始',
    uploadHint: '照片中只有你一人，正对镜头，露出双眼和眉毛。',
    formats: 'JPG、PNG 或 WebP · 不超过 15 MB',
    choose: '选择照片',
    replace: '更换照片',
    privacy: '照片分析在设备本地完成。只有点击生成预览时才上传图片。',
    preparing: '正在准备照片…',
    'loading-model': '正在加载人脸分析模型…',
    detecting: '正在定位面部特征…',
    retry: '重新分析',
    analysis: '01 / 理解眉形定位',
    direction: '调整适合你的定位',
    directionHint:
      '三个几何方向帮助微调贴合度。最终款式由你在下方样图库中选择。',
    natural: '自然眉',
    soft: '柔和眉',
    lifted: '微挑眉',
    naturalReason: '沿用现有眉部位置，以适中的眉峰保持平衡。',
    softReason: '较平缓的眉峰，让眉头到眉尾的过渡更柔和。',
    liftedReason: '略微抬高眉峰，保留自然位置的同时增加轮廓感。',
    reasons: {
      elongated: '根据测得的面部比例，优先展示较柔和的几何方向。',
      'low-arch': '原眉眉峰相对较低，优先展示微挑方向供你比较。',
      balanced: '优先展示自然方向，呼应测得的眉部平衡。',
    },
    thickness: '眉毛粗细',
    arch: '眉峰高低',
    lower: '降低',
    higher: '抬高',
    confirm: '确认分析，选择眉形样图',
    confirmed: '已确认分析',
    original: '查看原图',
    mapping: '查看分析图',
    download: '下载分析图',
    pause: '暂停',
    continue: '继续',
    skip: '显示完整结果',
    replay: '重新播放',
    steps: [
      '特征定位点',
      '面部中轴',
      '眉头参考',
      '眉峰定位',
      '眉尾方向',
      '平衡校对',
      '眉形轮廓',
    ],
    explanations: [
      '以眼角与鼻翼位置作为参考线的起点。',
      '建立与双眼对齐的中轴，作为左右布局的参照。',
      '鼻翼参考线辅助定位眉头，同时限制在原眉附近。',
      '鼻翼到虹膜外侧的连线，结合原眉形状辅助定位眉峰。',
      '鼻翼到外眼角的连线，帮助估计眉尾方向。',
      '从眉峰连向对侧上方的眉头参考线，配合高度线比较两侧布局，不强制完全对称。',
      '两条闭合轮廓展示当前几何方向与微调后的目标位置。',
    ],
    catalog: '02 / 选择喜欢的款式',
    catalogTitle: '眉形样图库',
    catalogHint: '选择喜欢的眉形、毛流与纹理，保留已确认的面部定位。',
    catalogLocked: '确认分析后，即可选择眉形样图。',
    emptyCatalog: '眉形样图库尚未接入。你仍可调整并下载当前分析图。',
    search: '搜索眉形样图',
    all: '所有分类',
    samples: '款样图',
    noMatches: '没有符合搜索条件的样图。',
    selected: '已选样图',
    previous: '上一页',
    next: '下一页',
    downloadError: '无法导出分析图，请重试。',
    errors: {
      'file-type': '请选择 JPG、PNG 或 WebP 照片。',
      'file-size': '请选择小于 15 MB 的照片。',
      decode: '无法打开这张照片，请更换图片。',
      'small-image': '请选择宽高均至少 256 像素的照片。',
      browser: '浏览器无法启动本地分析，请使用新版浏览器。',
      'no-face': '未检测到人脸，请使用清晰的正面照片。',
      'multiple-faces': '请使用只有一人的照片。',
      landmarks: '无法可靠读取面部特征，请换一张清晰照片。',
      'small-face': '脸部太小，请靠近镜头或选择脸部占比更大的照片。',
      'front-facing': '请正对镜头，以便更可靠地定位眉形。',
      'eyes-open': '请使用双眼睁开的照片。',
      'brows-visible': '请确保两侧眉毛清晰可见。',
      'model-timeout': '模型加载超时，请重试。',
      'model-error': '模型加载失败，请重试。',
      unknown: '分析未能完成，请重试或更换照片。',
    },
  },
};

export const browCopy = { ...originalBrowCopy, ...translatedCopy };

export function getBrowCopy(locale: string): typeof originalBrowCopy.en {
  const language = locale.split('-')[0] as keyof typeof browCopy;
  return browCopy[language] ?? browCopy.en;
}

// Original English and Chinese remain at call sites; other languages share this UI-only table.
export function browText(
  locale: string,
  english: string,
  chinese: string
): string {
  const language = locale.split('-')[0];
  if (language === 'zh') return chinese;
  if (language === 'en') return english;
  const index = ['ko', 'ja', 'de', 'es', 'it', 'pt'].indexOf(language);
  const values = editorTranslations[english as keyof typeof editorTranslations];
  return values?.[index] ?? english;
}

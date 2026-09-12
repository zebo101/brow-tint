import type { BrowStyleItem } from './types';

// Presentation only: keep catalog IDs, references and generation fields intact.
export function browShapeLabel(
  style: Pick<BrowStyleItem, 'shape'>,
  locale = 'en'
): string {
  const labels: Record<string, string[]> = {
    en: [
      'Natural',
      'Soft Angled',
      'Arched',
      'Straight',
      'Feathered',
      'Defined',
      'S-Shaped',
      'Brow shape',
    ],
    zh: [
      '自然眉',
      '柔角眉',
      '拱形眉',
      '平直眉',
      '羽毛眉',
      '立体眉',
      'S 形眉',
      '眉型',
    ],
    ko: [
      '자연형',
      '부드러운 각진형',
      '아치형',
      '일자형',
      '페더형',
      '또렷한 눈썹',
      'S자형',
      '눈썹 모양',
    ],
    ja: [
      'ナチュラル',
      'ソフトアングル',
      'アーチ',
      'ストレート',
      'フェザー',
      'くっきり眉',
      'S字型',
      '眉の形',
    ],
    de: [
      'Natürlich',
      'Sanft gewinkelt',
      'Geschwungen',
      'Gerade',
      'Fedrig',
      'Definiert',
      'S-förmig',
      'Augenbrauenform',
    ],
    es: [
      'Natural',
      'Ángulo suave',
      'Arqueadas',
      'Rectas',
      'Efecto pluma',
      'Definidas',
      'Forma de S',
      'Forma de cejas',
    ],
    it: [
      'Naturali',
      'Angolo morbido',
      'Arcuate',
      'Dritte',
      'Effetto piuma',
      'Definite',
      'Forma a S',
      'Forma delle sopracciglia',
    ],
    pt: [
      'Naturais',
      'Ângulo suave',
      'Arqueadas',
      'Retas',
      'Efeito pluma',
      'Definidas',
      'Formato de S',
      'Formato das sobrancelhas',
    ],
  };
  const index: Record<string, number> = {
    natural: 0,
    soft: 1,
    'soft-angled': 1,
    lifted: 2,
    arched: 2,
    straight: 3,
    feathered: 4,
    bold: 5,
    's-shaped': 6,
  };
  return (labels[locale.split('-')[0]] ?? labels.en)[
    index[style.shape.toLowerCase()] ?? 7
  ];
}

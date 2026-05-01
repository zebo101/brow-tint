'use client';

const SHADE_COLORS: Record<string, string> = {
  taupe: '#A89281',
  blonde: '#C9A879',
  auburn: '#9A5A3F',
  chestnut: '#6E3F2C',
  espresso: '#3A1F15',
  'soft-black': '#1F1410',
};

const INTENSITY_OPACITY: Record<string, number> = {
  sheer: 0.45,
  medium: 0.7,
  rich: 1,
};

// SVG path data for each brow shape
const SHAPE_PATHS: Record<string, string> = {
  natural:
    'M8 28 Q20 18, 38 16 Q56 14, 72 18 Q80 20, 84 24 Q80 18, 72 14 Q56 10, 38 12 Q20 14, 8 24 Z',
  soft:
    'M8 26 Q22 18, 40 16 Q58 15, 72 18 Q78 20, 82 22 Q78 17, 72 14 Q58 11, 40 12 Q22 14, 8 22 Z',
  feathered:
    'M6 28 Q18 16, 36 14 Q52 12, 70 16 Q80 18, 86 22 Q80 15, 70 12 Q52 8, 36 10 Q18 12, 6 24 Z',
  lifted:
    'M10 30 Q22 20, 38 16 Q54 12, 68 10 Q78 9, 86 14 Q78 7, 68 6 Q54 8, 38 12 Q22 16, 10 26 Z',
  straight:
    'M8 22 Q24 18, 42 17 Q60 16, 76 17 Q82 18, 86 20 Q82 15, 76 13 Q60 12, 42 13 Q24 14, 8 18 Z',
  bold:
    'M6 30 Q20 16, 38 12 Q56 8, 74 14 Q82 16, 88 22 Q82 12, 74 8 Q56 4, 38 8 Q20 12, 6 24 Z',
};

interface BrowSvgProps {
  shape: string;
  shade: string;
  intensity: string;
  mirror?: boolean;
  className?: string;
}

export function BrowSvg({
  shape,
  shade,
  intensity,
  mirror = false,
  className,
}: BrowSvgProps) {
  const color = SHADE_COLORS[shade] || SHADE_COLORS.taupe;
  const opacity = INTENSITY_OPACITY[intensity] || INTENSITY_OPACITY.medium;
  const path = SHAPE_PATHS[shape] || SHAPE_PATHS.natural;

  return (
    <svg
      viewBox="0 0 92 40"
      fill="none"
      className={className}
      style={{
        transform: mirror ? 'scaleX(-1)' : undefined,
        width: '100%',
        height: '100%',
      }}
    >
      <path d={path} fill={color} opacity={opacity} />
      {/* Hair strokes for texture */}
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="0.5"
        opacity={opacity * 0.4}
        strokeDasharray="3 5"
      />
    </svg>
  );
}

export { SHADE_COLORS };

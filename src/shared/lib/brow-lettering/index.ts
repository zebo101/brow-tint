import outlines from './glyphs.json';

// SVG text relies on container fonts. These bundled outlines keep server-side
// previews and downloads legible even in a fontless production image.
export function browLettering(
  text: string,
  {
    x,
    y,
    size,
    maxWidth,
    centered = false,
  }: {
    x: number;
    y: number;
    size: number;
    maxWidth: number;
    centered?: boolean;
  }
): string {
  const atlas: Record<string, { advance: number; path: string }> =
    outlines.glyphs;
  const glyphs = Array.from(
    text.slice(0, 60),
    (char) => atlas[char] ?? atlas['?']
  );
  const width = glyphs.reduce((sum, glyph) => sum + glyph.advance, 0);
  const scale = Math.min(
    size / outlines.unitsPerEm,
    maxWidth / Math.max(1, width)
  );
  let cursor = 0;
  const paths = glyphs
    .map((glyph) => {
      const result = glyph.path
        ? `<path transform="translate(${cursor} 0)" d="${glyph.path}"/>`
        : '';
      cursor += glyph.advance;
      return result;
    })
    .join('');
  return `<g transform="translate(${centered ? x - (width * scale) / 2 : x} ${y}) scale(${scale} ${-scale})">${paths}</g>`;
}

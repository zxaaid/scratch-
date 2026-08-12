import { Point, Stroke } from '../types';

/**
 * Generates beautiful handwritten cursive stroke paths for plain text strings
 * Used when converting typed OCR text or messy handwriting into Mode 3 Elegant Script
 */
export function generateHandwrittenScriptStrokes(
  text: string,
  startX: number,
  startY: number,
  baseSize = 24,
  color = '#1e1e1e'
): Stroke[] {
  const strokes: Stroke[] = [];
  let currentX = startX;
  let currentY = startY;

  const lines = text.split('\n');

  lines.forEach((lineText, lineIdx) => {
    currentX = startX;
    currentY = startY + lineIdx * (baseSize * 1.6);

    for (let charIdx = 0; charIdx < lineText.length; charIdx++) {
      const char = lineText[charIdx];

      if (char === ' ') {
        currentX += baseSize * 0.5;
        continue;
      }

      // Generate cursive-like vector stroke points for each character
      const charPoints: Point[] = [];
      const steps = 12;
      const charWidth = baseSize * 0.6;
      const charHeight = baseSize * 0.8;

      for (let s = 0; s < steps; s++) {
        const t = s / (steps - 1);

        // Organic handwritten jitter variations
        const jitterX = (Math.sin(s * 1.5 + charIdx) * 1.2);
        const jitterY = (Math.cos(s * 2.1 + lineIdx) * 1.2);

        // Character stroke curve template simulation
        let x = currentX + t * charWidth + jitterX;
        let y = currentY - Math.sin(t * Math.PI) * (charHeight * 0.4) + jitterY;

        // Cursive ascenders/descenders
        if ('bdfhklt'.includes(char.toLowerCase())) {
          y -= Math.sin(t * Math.PI) * (charHeight * 0.5);
        } else if ('gjpqy'.includes(char.toLowerCase())) {
          y += Math.sin(t * Math.PI) * (charHeight * 0.5);
        }

        const pressure = 0.3 + 0.6 * Math.sin(t * Math.PI);

        charPoints.push({
          x,
          y,
          pressure,
          time: Date.now() + s * 10,
        });
      }

      strokes.push({
        id: `script_${lineIdx}_${charIdx}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        tool: 'fountain',
        color,
        width: Math.max(2, baseSize * 0.08),
        opacity: 0.95,
        points: charPoints,
        smoothedPoints: charPoints,
        handwritingMode: 3,
        isBeautified: true,
      });

      currentX += charWidth * 0.85;
    }
  });

  return strokes;
}

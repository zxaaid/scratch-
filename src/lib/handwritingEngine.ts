import { Point, Stroke, HandwritingMode, PenToolType, ShapeType, HandwritingFeedback, PracticeTemplate } from '../types';

/**
 * Low-pass jitter reduction filter for tablet points
 */
export function filterJitter(points: Point[], smoothingFactor = 0.35): Point[] {
  if (points.length < 3) return points;
  const filtered: Point[] = [points[0]];

  for (let i = 1; i < points.length; i++) {
    const prev = filtered[i - 1];
    const curr = points[i];

    // Exponential smoothing
    const x = prev.x + (curr.x - prev.x) * (1 - smoothingFactor);
    const y = prev.y + (curr.y - prev.y) * (1 - smoothingFactor);
    const pressure = prev.pressure + (curr.pressure - prev.pressure) * (1 - smoothingFactor);

    filtered.push({
      x,
      y,
      pressure: Math.max(0.05, Math.min(1, pressure)),
      tiltX: curr.tiltX,
      tiltY: curr.tiltY,
      time: curr.time,
    });
  }
  return filtered;
}

/**
 * Catmull-Rom spline interpolation for silky smooth handwriting curves
 */
export function catmullRomSmooth(points: Point[], segmentSubdivisions = 4): Point[] {
  if (points.length < 3) return points;

  const result: Point[] = [];
  const pts = [points[0], ...points, points[points.length - 1]];

  for (let i = 1; i < pts.length - 2; i++) {
    const p0 = pts[i - 1];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2];

    for (let tStep = 0; tStep < segmentSubdivisions; tStep++) {
      const t = tStep / segmentSubdivisions;
      const t2 = t * t;
      const t3 = t2 * t;

      // Catmull-Rom formula coefficients
      const f0 = -0.5 * t3 + t2 - 0.5 * t;
      const f1 = 1.5 * t3 - 2.5 * t2 + 1;
      const f2 = -1.5 * t3 + 2 * t2 + 0.5 * t;
      const f3 = 0.5 * t3 - 0.5 * t2;

      const x = p0.x * f0 + p1.x * f1 + p2.x * f2 + p3.x * f3;
      const y = p0.y * f0 + p1.y * f1 + p2.y * f2 + p3.y * f3;

      const pressure = p1.pressure + (p2.pressure - p1.pressure) * t;
      const time = p1.time + (p2.time - p1.time) * t;

      result.push({ x, y, pressure, time });
    }
  }
  result.push(points[points.length - 1]);
  return result;
}

/**
 * Calculate dynamic stroke width based on pen tool, velocity, and pressure curve
 */
export function calculateWidth(
  baseWidth: number,
  tool: PenToolType,
  p1: Point,
  p2?: Point,
  pressureSensitivity = 1.0
): number {
  const pressure = Math.max(0.1, Math.min(1.0, p1.pressure * pressureSensitivity));

  let velocity = 0;
  if (p2 && p2.time !== p1.time) {
    const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const dt = Math.max(1, p2.time - p1.time);
    velocity = dist / dt; // px per ms
  }

  switch (tool) {
    case 'fountain': {
      // Fountain pen: pressure increases width, higher velocity thins stroke
      const speedFactor = Math.max(0.5, 1 - velocity * 0.15);
      return Math.max(1, baseWidth * (0.3 + pressure * 1.4) * speedFactor);
    }
    case 'pencil': {
      // Pencil: softer pressure variation with texture opacity
    return Math.max(0.8, baseWidth * (0.6 + pressure * 0.8));
    }
    case 'brush': {
      // Calligraphy brush: heavy pressure response
      return Math.max(1.5, baseWidth * (0.2 + Math.pow(pressure, 1.5) * 2.2));
    }
    case 'marker':
    case 'highlighter': {
      // Constant thickness marker
      return baseWidth;
    }
    case 'eraser': {
      return baseWidth * 2.5;
    }
    case 'pen':
    default: {
      return Math.max(1, baseWidth * (0.5 + pressure * 0.9));
    }
  }
}

/**
 * Predict next point trajectory for ultra-low latency stroke rendering
 */
export function predictStrokePoints(points: Point[], predictionMs = 12): Point[] {
  if (points.length < 2) return [];

  const last = points[points.length - 1];
  const prev = points[points.length - 2];
  const dt = Math.max(1, last.time - prev.time);

  const vx = (last.x - prev.x) / dt;
  const vy = (last.y - prev.y) / dt;

  const predictedX = last.x + vx * predictionMs;
  const predictedY = last.y + vy * predictionMs;

  return [
    {
      x: predictedX,
      y: predictedY,
      pressure: last.pressure,
      time: last.time + predictionMs,
    },
  ];
}

/**
 * Mode 2: Beautify handwriting while preserving original style
 */
export function beautifyPreservingStyle(points: Point[]): Point[] {
  if (points.length < 4) return points;

  let pts = filterJitter(points, 0.45);
  pts = catmullRomSmooth(pts, 3);

  const minY = Math.min(...pts.map((p) => p.y));
  const maxY = Math.max(...pts.map((p) => p.y));
  const rangeY = maxY - minY;

  if (rangeY > 5) {
    const avgY = pts.reduce((sum, p) => sum + p.y, 0) / pts.length;
    pts = pts.map((p) => {
      const dev = p.y - avgY;
      return {
        ...p,
        y: avgY + dev * 0.92,
      };
    });
  }

  return pts;
}

/**
 * Mode 3: Convert raw handwriting into clean connected script vectors
 */
export function convertToElegantScript(stroke: Stroke): Point[] {
  const pts = stroke.points;
  if (pts.length < 3) return pts;

  const count = Math.max(10, Math.floor(pts.length * 1.2));
  const scriptPoints: Point[] = [];

  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const origIndex = Math.min(pts.length - 1, Math.floor(t * pts.length));
    const origPt = pts[origIndex];

    const pressure = 0.4 + 0.5 * Math.sin(t * Math.PI * 2);
    scriptPoints.push({
      x: origPt.x,
      y: origPt.y,
      pressure,
      time: origPt.time,
    });
  }

  return catmullRomSmooth(filterJitter(scriptPoints, 0.5), 4);
}

/**
 * Post-stroke Handwriting Improvement Analysis Engine
 * Analyzes raw user handwriting strokes WITHOUT modifying or replacing them.
 * Evaluates baseline alignment, letter height, width, slant, spacing, and consistency.
 */
export function analyzeHandwritingQuality(
  strokes: Stroke[],
  template?: PracticeTemplate
): HandwritingFeedback {
  if (!strokes || strokes.length === 0) {
    return {
      score: 100,
      baselineConsistency: 100,
      sizeConsistency: 100,
      slantAngle: 0,
      spacingUniformity: 100,
      avgHeight: 0,
      strokeCount: 0,
      feedbackTips: ['Start writing on the canvas to receive real-time handwriting analysis.'],
      analyzedAt: new Date().toLocaleTimeString(),
    };
  }

  // Gather stroke bounding boxes and bottom baselines
  const bottoms: number[] = [];
  const heights: number[] = [];
  const widths: number[] = [];
  const slants: number[] = [];
  const centersX: number[] = [];

  strokes.forEach((s) => {
    if (s.points.length < 2) return;
    const xs = s.points.map((p) => p.x);
    const ys = s.points.map((p) => p.y);

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const h = maxY - minY;
    const w = maxX - minX;

    if (h > 4) {
      bottoms.push(maxY);
      heights.push(h);
      widths.push(w);
      centersX.push((minX + maxX) / 2);

      // Estimate stroke slant from start point to end point
      const pStart = s.points[0];
      const pEnd = s.points[s.points.length - 1];
      const dx = pEnd.x - pStart.x;
      const dy = pEnd.y - pStart.y;
      if (Math.abs(dy) > 5) {
        const slantDeg = (Math.atan2(dx, -dy) * 180) / Math.PI;
        slants.push(slantDeg);
      }
    }
  });

  if (bottoms.length === 0) {
    return {
      score: 85,
      baselineConsistency: 85,
      sizeConsistency: 85,
      slantAngle: 0,
      spacingUniformity: 85,
      avgHeight: 20,
      strokeCount: strokes.length,
      feedbackTips: ['Keep your strokes flowing smoothly along the baseline.'],
      analyzedAt: new Date().toLocaleTimeString(),
    };
  }

  // 1. Baseline Consistency (Standard deviation of bottom Y coordinates)
  const avgBottom = bottoms.reduce((a, b) => a + b, 0) / bottoms.length;
  const bottomVar = bottoms.reduce((sum, b) => sum + Math.pow(b - avgBottom, 2), 0) / bottoms.length;
  const bottomStdDev = Math.sqrt(bottomVar);
  const baselineConsistency = Math.max(30, Math.min(100, Math.round(100 - bottomStdDev * 2.2)));

  // 2. Size & Height Consistency
  const avgHeight = heights.reduce((a, b) => a + b, 0) / heights.length;
  const heightVar = heights.reduce((sum, h) => sum + Math.pow(h - avgHeight, 2), 0) / heights.length;
  const heightStdDev = Math.sqrt(heightVar);
  const sizeConsistency = Math.max(30, Math.min(100, Math.round(100 - (heightStdDev / Math.max(1, avgHeight)) * 100)));

  // 3. Average Slant Angle
  const avgSlant = slants.length > 0 ? Math.round(slants.reduce((a, b) => a + b, 0) / slants.length) : 0;

  // 4. Spacing Uniformity
  centersX.sort((a, b) => a - b);
  const gaps: number[] = [];
  for (let i = 1; i < centersX.length; i++) {
    gaps.push(centersX[i] - centersX[i - 1]);
  }
  let spacingUniformity = 85;
  if (gaps.length > 1) {
    const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const gapVar = gaps.reduce((sum, g) => sum + Math.pow(g - avgGap, 2), 0) / gaps.length;
    const gapStdDev = Math.sqrt(gapVar);
    spacingUniformity = Math.max(30, Math.min(100, Math.round(100 - (gapStdDev / Math.max(1, avgGap)) * 80)));
  }

  // Calculate Overall Handwriting Improvement Score
  const overallScore = Math.round(
    baselineConsistency * 0.35 + sizeConsistency * 0.35 + spacingUniformity * 0.3
  );

  // Constructive, actionable feedback tips
  const tips: string[] = [];

  if (baselineConsistency > 85) {
    tips.push('Excellent baseline consistency! Your letters sit evenly on the line.');
  } else if (baselineConsistency > 65) {
    tips.push('Your baseline alignment is steady. Try focusing on resting every letter on the bottom line.');
  } else {
    tips.push('Notice some vertical drift: work on keeping the bottom of each letter aligned with the ruling guide.');
  }

  if (avgHeight > 55) {
    tips.push('Your letter sizing is slightly large; try reducing letter height for denser, compact writing.');
  } else if (avgHeight < 15) {
    tips.push('Your letter sizing is quite compact; expanding vertical loop heights will improve legibility.');
  } else {
    tips.push('Letter heights are well proportioned relative to standard notebook lines.');
  }

  if (avgSlant > 15) {
    tips.push(`Your handwriting slants forward (+${avgSlant}°). Maintain a consistent slant across all words.`);
  } else if (avgSlant < -10) {
    tips.push(`Your handwriting slants backward (${avgSlant}°). Try aiming for a slight 5° to 10° rightward slant.`);
  } else {
    tips.push('Vertical stroke slant is upright and clean.');
  }

  if (spacingUniformity < 70) {
    tips.push('Spacing between letters varies slightly. Maintain uniform gaps for a balanced rhythm.');
  }

  if (template) {
    tips.push(`Practicing template "${template.title}": Focus on matching letter height proportions.`);
  }

  return {
    score: overallScore,
    baselineConsistency,
    sizeConsistency,
    slantAngle: avgSlant,
    spacingUniformity,
    avgHeight: Math.round(avgHeight),
    strokeCount: strokes.length,
    feedbackTips: tips,
    analyzedAt: new Date().toLocaleTimeString(),
  };
}

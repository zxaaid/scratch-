import { PageAspectRatio, PageAspectPreset } from '../types';

export const PAGE_ASPECT_PRESETS: Record<PageAspectRatio, PageAspectPreset> = {
  'flexible': {
    id: 'flexible',
    name: 'Flexible (Fit Working Area)',
    width: 0,
    height: 0,
    label: 'Flexible Edge-to-Edge (Auto-Fit)',
  },
  'infinite': {
    id: 'infinite',
    name: 'Infinite Canvas',
    width: 3840,
    height: 2560,
    label: 'Infinite Expansive Canvas (3840 × 2560 px)',
  },
  '4k-canvas': {
    id: '4k-canvas',
    name: '4K Ultra Canvas',
    width: 3840,
    height: 2160,
    label: '4K Ultra Canvas (3840 × 2160 px)',
  },
  'ultrawide': {
    id: 'ultrawide',
    name: '21:9 Ultra-Wide',
    width: 2560,
    height: 1080,
    label: '21:9 Ultra-Wide (2560 × 1080 px)',
  },
  'a4-portrait': {
    id: 'a4-portrait',
    name: 'A4 Portrait',
    width: 794,
    height: 1123,
    label: 'A4 Portrait (210 × 297 mm)',
  },
  'a4-landscape': {
    id: 'a4-landscape',
    name: 'A4 Landscape',
    width: 1123,
    height: 794,
    label: 'A4 Landscape (297 × 210 mm)',
  },
  'letter': {
    id: 'letter',
    name: 'US Letter',
    width: 816,
    height: 1056,
    label: 'US Letter (8.5 × 11 in)',
  },
  'a3': {
    id: 'a3',
    name: 'A3 Portrait',
    width: 1123,
    height: 1587,
    label: 'A3 Large Sheet (297 × 420 mm)',
  },
  'square': {
    id: 'square',
    name: 'Square',
    width: 1200,
    height: 1200,
    label: 'Square (1200 × 1200 px)',
  },
  'widescreen': {
    id: 'widescreen',
    name: 'Widescreen 16:9',
    width: 1920,
    height: 1080,
    label: 'Full HD 16:9 (1920 × 1080 px)',
  },
};

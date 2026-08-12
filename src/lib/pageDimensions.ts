import { PageAspectRatio, PageAspectPreset } from '../types';

export const PAGE_ASPECT_PRESETS: Record<PageAspectRatio, PageAspectPreset> = {
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
    label: 'A3 Portrait (297 × 420 mm)',
  },
  'square': {
    id: 'square',
    name: 'Square',
    width: 900,
    height: 900,
    label: 'Square (1 : 1)',
  },
  'widescreen': {
    id: 'widescreen',
    name: 'Widescreen 16:9',
    width: 1280,
    height: 720,
    label: 'Widescreen (16 : 9)',
  },
};

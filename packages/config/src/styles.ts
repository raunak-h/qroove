export const STYLE_PRESETS = [
  { id: 'salsa', label: 'Salsa' },
  { id: 'bachata', label: 'Bachata' },
  { id: 'chacha', label: 'Cha-cha-chá' },
  { id: 'kizomba', label: 'Kizomba' },
  { id: 'merengue', label: 'Merengue' },
  { id: 'other', label: 'Other' },
] as const;

export type StyleId = (typeof STYLE_PRESETS)[number]['id'];

export const DEFAULT_ENABLED_STYLES: readonly StyleId[] = ['salsa', 'bachata'];

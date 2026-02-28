import { darkTheme } from './dark';
import { lightTheme } from './light';

export const themes = {
  'ripsv-dark': darkTheme,
  'ripsv-light': lightTheme,
} as const;

export type ThemeName = keyof typeof themes;

export function getTheme(name: ThemeName) {
  return themes[name];
}

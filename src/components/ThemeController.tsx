import { useEffect } from 'react';
import { useFinanceStore } from '../store/useFinanceStore';

export function ThemeController() {
  const selectedTheme = useFinanceStore((state) => state.settings.theme);

  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const themeMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');

    const applyTheme = () => {
      const resolved = selectedTheme === 'system' ? (media.matches ? 'dark' : 'light') : selectedTheme;
      root.dataset.theme = resolved;
      root.style.colorScheme = resolved;
      themeMeta?.setAttribute('content', resolved === 'dark' ? '#06172f' : '#092144');
    };

    applyTheme();
    if (selectedTheme !== 'system') return undefined;

    media.addEventListener('change', applyTheme);
    return () => media.removeEventListener('change', applyTheme);
  }, [selectedTheme]);

  return null;
}

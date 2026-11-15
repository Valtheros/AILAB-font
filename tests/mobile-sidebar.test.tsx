import { useCallback, useRef, useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { MobileMenuButton, Sidebar } from '@/components/Sidebar';

const state = vi.hoisted(() => ({ language: 'en' }));
vi.mock('next/navigation', () => ({ usePathname: () => '/guide', useSearchParams: () => new URLSearchParams() }));
vi.mock('@/lib/auth-client', () => ({ authClient: { useSession: () => ({ data: null }) } }));
vi.mock('@/components/language-provider', () => ({ useLanguage: () => ({ language: state.language }) }));

beforeEach(() => { state.language = 'en'; });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

test.each(['en', 'th'])('desktop and mobile navigation omit About AILAB but retain the workspace links in %s', (language) => {
  state.language = language;
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  render(<Sidebar isOpen onClose={vi.fn()} menuButtonRef={{ current: null }} />);
  const menus = document.querySelectorAll('nav');
  expect(menus).toHaveLength(2);
  for (const menu of menus) {
    expect(menu.querySelector('a[href="/overview"]')).toBeNull();
    expect(within(menu).queryByText(/About AILAB|เกี่ยวกับ AILAB/)).toBeNull();
    for (const label of ['Annotation', 'Dashboard', 'Dataset', 'Tasks', 'Account']) {
      expect(within(menu).getByText(label).closest('a')).toBeTruthy();
    }
    const guide = within(menu).getByText(language === 'th' ? 'คู่มือ' : 'Guide').closest('a')!;
    expect(guide.getAttribute('href')).toBe('/guide');
    expect(guide.getAttribute('aria-current')).toBe('page');
  }
});

test('mobile menu closes with Escape and returns focus to its trigger', async () => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  function Menu() {
    const [open, setOpen] = useState(false);
    const button = useRef<HTMLButtonElement>(null);
    const close = useCallback(() => setOpen(false), []);
    return <><MobileMenuButton buttonRef={button} onClick={() => setOpen(true)} /><Sidebar isOpen={open} onClose={close} menuButtonRef={button} /></>;
  }
  render(<Menu />);
  const trigger = screen.getByRole('button', { name: 'Open menu' });
  fireEvent.click(trigger);
  expect(await screen.findByRole('dialog', { name: 'Menu' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Close menu' })).toBeTruthy();
  fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Menu' })).toBeNull());
  expect(document.activeElement).toBe(trigger);
});

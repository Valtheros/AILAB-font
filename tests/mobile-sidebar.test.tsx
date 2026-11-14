import { useCallback, useRef, useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { MobileMenuButton, Sidebar } from '@/components/Sidebar';

vi.mock('next/navigation', () => ({ usePathname: () => '/guide' }));
vi.mock('@/lib/auth-client', () => ({ authClient: { useSession: () => ({ data: null }) } }));
vi.mock('@/components/language-provider', () => ({ useLanguage: () => ({ language: 'en' }) }));

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

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

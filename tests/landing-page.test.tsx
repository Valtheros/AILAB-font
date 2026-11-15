import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { LandingPage } from '@/components/workspace/landing-page';
import { LanguageProvider } from '@/components/language-provider';
import OverviewPage from '@/app/overview/page';

const state = vi.hoisted(() => ({ session: null as object | null, pending: false }));
vi.mock('next/navigation', () => ({ usePathname: () => '/overview', useSearchParams: () => new URLSearchParams() }));
vi.mock('@/lib/auth-client', () => ({ authClient: { useSession: () => ({ data: state.session, isPending: state.pending }) } }));
vi.mock('@/components/theme-toggle', () => ({ ThemeToggle: () => <button>Toggle theme</button> }));
beforeEach(() => { state.session = null; state.pending = false; vi.stubGlobal('fetch', vi.fn()); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

test.each(['en', 'th'] as const)('landing uses the selected workflow artwork without a footer disclaimer in %s', (language) => {
  render(<LanguageProvider defaultLanguage={language}><LandingPage /></LanguageProvider>);
  const image = screen.getByRole('img');
  expect(image.getAttribute('src')).toContain('model-workflow.png');
  expect(image.getAttribute('alt')).toBe(language === 'en'
    ? 'Illustrated workflow from image data and labels to a trained model detecting a car and road in a new image'
    : 'ภาพขั้นตอนจากข้อมูลรูปภาพและการทำ Label สู่โมเดลที่ตรวจจับรถและถนนในภาพใหม่');
  expect(screen.getByRole('contentinfo').textContent).toBe('AILAB · Computer Vision');
  const header = within(screen.getByRole('banner'));
  expect(header.getAllByRole('link')).toHaveLength(1);
  expect(header.getByRole('link', { name: 'AILAB' }).getAttribute('href')).toBe('/overview');
  expect(header.getByRole('button', { name: 'Switch language to Thai' })).toBeTruthy();
  expect(header.getByRole('button', { name: 'Switch language to English' })).toBeTruthy();
  expect(header.getByRole('button', { name: 'Toggle theme' })).toBeTruthy();
});

test('landing has no workspace sidebar or private requests, with one hero entry link to Dashboard through login', () => {
  render(<LanguageProvider defaultLanguage="en"><LandingPage /></LanguageProvider>);
  expect(screen.getByRole('heading', { name: 'AILAB', level: 1 })).toBeTruthy();
  expect(document.querySelector('aside')).toBeNull();
  expect(screen.queryByRole('button', { name: /notifications/i })).toBeNull();
  const links = screen.getAllByRole('link', { name: 'Enter AILAB' });
  expect(links).toHaveLength(1);
  for (const link of links) expect(link.getAttribute('href')).toBe('/login?callbackURL=%2Fdashboard');
  expect(screen.getByRole('link', { name: 'Explore the guide' }).getAttribute('href')).toBe('/guide');
  expect(screen.getAllByRole('listitem')).toHaveLength(5);
  expect(fetch).not.toHaveBeenCalled();
});

test('overview stays available to members and its entry links go directly to Dashboard', () => {
  state.session = { user: { id: 'member' } };
  render(<LanguageProvider defaultLanguage="en"><OverviewPage /></LanguageProvider>);
  for (const link of screen.getAllByRole('link', { name: 'Enter AILAB' })) expect(link.getAttribute('href')).toBe('/dashboard');
  expect(fetch).not.toHaveBeenCalled();
});

test('session resolution does not mount a private workspace or present the wrong entry destination', () => {
  state.pending = true;
  render(<LanguageProvider defaultLanguage="en"><LandingPage /></LanguageProvider>);
  expect(screen.queryByRole('link', { name: 'Enter AILAB' })).toBeNull();
  for (const button of screen.getAllByRole('button', { name: 'Enter AILAB' })) expect((button as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByRole('heading', { name: 'AILAB' })).toBeTruthy();
});

test('language toggle translates the complete short introduction without changing the destination', () => {
  render(<LanguageProvider defaultLanguage="en"><LandingPage /></LanguageProvider>);
  fireEvent.click(screen.getByRole('button', { name: 'Switch language to Thai' }));
  expect(screen.getByText('สร้างและทดสอบโมเดล AI จากรูปภาพของคุณ โดยไม่ต้องเขียนโค้ด')).toBeTruthy();
  expect(screen.getByRole('banner').textContent).not.toContain('เข้าใช้งาน AILAB');
  for (const link of screen.getAllByRole('link', { name: 'เข้าใช้งาน AILAB' })) expect(link.getAttribute('href')).toBe('/login?callbackURL=%2Fdashboard');
  fireEvent.click(screen.getByRole('button', { name: 'Switch language to English' }));
  expect(screen.getByText('Build and test AI models from your own images. No coding needed.')).toBeTruthy();
});

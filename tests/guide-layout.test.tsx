import type { ReactNode } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import GuidePage from '@/app/guide/page';

const state = vi.hoisted(() => ({ session: null as null | { user: { emailVerified: boolean } } }));
vi.mock('@/lib/session', () => ({ getCurrentSession: async () => state.session }));
vi.mock('@/components/MainLayout', () => ({ MainLayout: ({ children }: { children: ReactNode }) => <><nav aria-label="Workspace" /><main>{children}</main></> }));
vi.mock('@/components/workspace/public-header', () => ({ PublicHeader: () => <header>Public header</header> }));
vi.mock('@/components/workspace/workspace-action', () => ({ WorkspaceAction: ({ children }: { children: ReactNode }) => <button>{children}</button> }));
vi.mock('@/components/language-provider', () => ({ useLanguage: () => ({ language: 'en', t: (key: string) => key }) }));

beforeEach(() => { state.session = null; });
afterEach(cleanup);

test.each([null, { user: { emailVerified: false } }])('guide remains public without a verified session: %j', async (session) => {
  state.session = session;
  render(await GuidePage({}));
  expect(screen.getByText('Public header')).toBeTruthy();
  expect(screen.queryByRole('navigation', { name: 'Workspace' })).toBeNull();
  expect(screen.getByRole('heading', { name: 'Training Guide' })).toBeTruthy();
  expect(screen.getAllByRole('main')).toHaveLength(1);
});

test.each(['workflow', 'models', 'datasets'])('verified guide uses the workspace layout and preserves the %s tab', async (tab) => {
  state.session = { user: { emailVerified: true } };
  render(await GuidePage({ searchParams: Promise.resolve({ tab }) }));
  expect(screen.getByRole('navigation', { name: 'Workspace' })).toBeTruthy();
  expect(screen.queryByText('Public header')).toBeNull();
  expect(screen.getByRole('heading', { name: 'Training Guide' })).toBeTruthy();
  expect(screen.getAllByRole('main')).toHaveLength(1);
  const label = { workflow: 'Workflow', models: 'Model Guide', datasets: 'Dataset Layouts' }[tab]!;
  expect(screen.getByRole('tab', { name: label }).getAttribute('aria-selected')).toBe('true');
});

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { ReactNode } from 'react';
import AnnotationPage from '@/app/annotate/page';

vi.mock('@/components/MainLayout', () => ({ MainLayout: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock('@/components/language-provider', () => ({ useLanguage: () => ({ language: 'en' }) }));
vi.mock('@/lib/api', () => ({ apiBaseUrl: () => '' }));
const fetchMock = vi.fn<typeof fetch>();
const response = (body: unknown) => new Response(JSON.stringify(body));

beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.history.replaceState({}, '', '/'); });

test('shows a loading state while checking the Label Studio account', () => {
  fetchMock.mockImplementation(() => new Promise<Response>(() => undefined));
  render(<AnnotationPage />);
  expect(screen.getByRole('status').textContent).toContain('Loading Annotation');
});

test('shows a waiting state for an import with an unknown total', async () => {
  window.history.replaceState({}, '', '/annotate?project=3&transfer=12345678-1234-1234-1234-123456789012');
  const operation = { id: 'operation', status: 'queued', processed: 0, total: 0 };
  fetchMock.mockImplementation(async (input) => String(input).endsWith('/account')
    ? response({ activated: true, url: '/label-studio/' }) : response({ operation }));
  render(<AnnotationPage />);
  expect(await screen.findByText('Waiting to start')).toBeTruthy();
  expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBeNull();
  expect(screen.queryByText(/0 \/ 0/)).toBeNull();
});

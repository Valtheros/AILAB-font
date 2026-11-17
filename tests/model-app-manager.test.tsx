import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { AppManager } from '@/components/model-apps/app-manager';
import { defaultConfig } from '@/lib/trainingConfig';

vi.mock('@/components/language-provider', () => ({ useLanguage: () => ({ language: 'en' }) }));
vi.mock('@/lib/api', () => ({ apiBaseUrl: () => '' }));
vi.mock('@/lib/auth-client', () => ({ authClient: { useSession: () => ({ data: { user: { id: 'alice' } } }) } }));
const fetchMock = vi.fn<typeof fetch>();
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
const tasks = [
  { ...defaultConfig, id: 'done', displayName: 'Road model', status: 'completed', runSlug: 'road-run', modelType: 'mask_rcnn', modelName: 'Mask R-CNN', taskType: 'segmentation' },
  { ...defaultConfig, id: 'other', displayName: 'Other model', status: 'completed', runSlug: 'other-run' },
  { ...defaultConfig, id: 'pending', displayName: 'Pending model', status: 'running', runSlug: 'pending-run' },
  { ...defaultConfig, id: 'failed', displayName: 'Failed model', status: 'failed', runSlug: 'failed-run' },
];
const existing = { id: 'existing', name: 'Road app', taskType: 'instance_segmentation', releases: [], path: '/apps/alice/road' };
beforeEach(() => {
  fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock);
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
  fetchMock.mockImplementation(async input => {
    const path = String(input);
    if (path === '/api/tasks') return response({ tasks });
    if (path.includes('/api/model-endpoints')) return response({ endpoints: [] });
    return response({ apps: [] });
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

async function openRuns() {
  const select = await screen.findByRole('combobox', { name: 'Completed run' });
  fireEvent.keyDown(select, { key: 'ArrowDown' });
}
async function selectRoad() {
  await openRuns();
  fireEvent.click(await screen.findByRole('option', { name: /Road model/ }));
}

test('creates an app from the hub using only completed runs and refreshes the list', async () => {
  let created = false;
  fetchMock.mockImplementation(async (input, init) => {
    if (String(input) === '/api/tasks') return response({ tasks });
    if (init?.method === 'POST') { created = true; return response(existing); }
    return response({ apps: created ? [existing] : [] });
  });
  render(<AppManager />);
  fireEvent.click(screen.getByRole('button', { name: 'Create Model App' }));
  await openRuns();
  expect(screen.queryByRole('option', { name: /Pending model/ })).toBeNull();
  expect(screen.queryByRole('option', { name: /Failed model/ })).toBeNull();
  fireEvent.click(await screen.findByRole('option', { name: /Road model/ }));
  fireEvent.change(await screen.findByLabelText('App name'), { target: { value: 'Road app' } });
  fireEvent.change(screen.getByLabelText('URL name (a-z, 0-9, -)'), { target: { value: 'road' } });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Create preview version' }).hasAttribute('disabled')).toBe(false));
  fireEvent.click(screen.getByRole('button', { name: 'Create preview version' }));
  expect(await screen.findByRole('heading', { name: 'Road app' })).toBeTruthy();
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(fetchMock.mock.calls.some(([url, init]) => String(url) === '/api/model-apps' && init?.method === 'POST' && JSON.parse(String(init.body)).runSlug === 'road-run')).toBe(true);
});

test('offers a compatible existing app when the run uses a segmentation model', async () => {
  fetchMock.mockImplementation(async input => String(input) === '/api/tasks' ? response({ tasks }) : response({ apps: [existing] }));
  render(<AppManager />);
  fireEvent.click(screen.getByRole('button', { name: 'Create Model App' }));
  await selectRoad();
  const app = await screen.findByRole('combobox', { name: 'App' });
  await waitFor(() => expect(app.hasAttribute('disabled')).toBe(false));
  fireEvent.keyDown(app, { key: 'ArrowDown' });
  expect(await screen.findByRole('option', { name: 'Road app' })).toBeTruthy();
});

test('API tab loads only the selected run and can create its endpoint', async () => {
  fetchMock.mockImplementation(async (input, init) => {
    if (String(input) === '/api/tasks') return response({ tasks });
    if (init?.method === 'POST') return response({ id: 'endpoint-1', enabled: true, checkpointSha256: 'hash' });
    if (String(input).includes('runSlug=')) return response({ endpoints: [] });
    if (String(input).endsWith('/keys')) return response({ keys: [] });
    return response({ apps: [] });
  });
  render(<AppManager />);
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'API' }), { button: 0 });
  await selectRoad();
  fireEvent.click(await screen.findByRole('button', { name: 'Enable Model API' }));
  expect(await screen.findByRole('button', { name: 'Create key' })).toBeTruthy();
  expect(fetchMock.mock.calls.some(([url, init]) => String(url) === '/api/model-endpoints' && JSON.parse(String(init?.body)).runSlug === 'road-run')).toBe(true);
  await openRuns(); fireEvent.click(await screen.findByRole('option', { name: /Other model/ }));
  expect(await screen.findByRole('button', { name: 'Enable Model API' })).toBeTruthy();
  expect(screen.queryByText('Model ID: endpoint-1')).toBeNull();
  expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('runSlug=')).map(([url]) => url)).toEqual(['/api/model-endpoints?runSlug=road-run', '/api/model-endpoints?runSlug=other-run']);
});

test('task load failure can be retried without creating an app', async () => {
  let failed = true;
  fetchMock.mockImplementation(async input => String(input) === '/api/tasks' ? failed ? response({}, 503) : response({ tasks: [] }) : response({ apps: [] }));
  render(<AppManager />); fireEvent.click(screen.getByRole('button', { name: 'Create Model App' }));
  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Create preview version' })).toBeNull();
  failed = false; fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(await screen.findByText('No completed training runs yet.')).toBeTruthy();
});

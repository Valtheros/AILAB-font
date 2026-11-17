import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { AdminUsersClient, type AdminUserRow } from '@/app/admin/users/admin-users-client';

const actions = vi.hoisted(() => ({
  impact: vi.fn(),
  remove: vi.fn(),
  cleanup: vi.fn(),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock('@/app/admin/users/actions', () => ({
  getUserResourceImpactAction: actions.impact,
  removeUserAction: actions.remove,
  deleteUserAndDataAction: actions.cleanup,
}));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

test('an otherwise empty account confirms storage cleanup and keeps failed removal visible for retry', async () => {
  const user: AdminUserRow = {
    id: 'owner', name: 'PSU member', email: 'member@psu.ac.th', emailVerified: true,
    role: 'user', banned: false, banReason: null, banExpires: null,
    createdAt: '2026-01-01', updatedAt: '2026-01-01', sessionCount: 1,
    workspaceMembershipCount: 0, projectCount: 0, datasetCount: 0,
    trainingRunCount: 0, labelStudioAccountCount: 0, legacyAnnotationCount: 0,
  };
  actions.remove.mockResolvedValueOnce({ ok: false, message: 'Storage accounting is not available.' })
    .mockResolvedValue({ ok: true, message: 'User and owned data removed.' });
  render(<AdminUsersClient currentUserId="admin" users={[user]} initialSearch="" limit={20} offset={0} total={1} />);
  fireEvent.click(screen.getAllByRole('button', { name: 'Remove' })[0]);
  const dialog = await screen.findByRole('alertdialog');
  expect(within(dialog).getByText(/Automatically allocated storage and temporary files/)).toBeTruthy();
  expect(actions.remove).not.toHaveBeenCalled();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Remove user' }));
  await waitFor(() => expect(actions.remove).toHaveBeenCalledExactlyOnceWith('owner'));
  expect((await within(dialog).findByRole('alert')).textContent).toContain('Storage accounting is not available.');
  await waitFor(() => expect((within(dialog).getByRole('button', { name: 'Remove user' }) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(within(dialog).getByRole('button', { name: 'Remove user' }));
  await waitFor(() => expect(actions.remove).toHaveBeenCalledTimes(2));
  expect(actions.cleanup).not.toHaveBeenCalled();
});

test('a Label Studio account requires explicit cleanup and errors appear in the dialog', async () => {
  const user: AdminUserRow = {
    id: 'owner', name: 'Owner', email: 'owner@example.test', emailVerified: true,
    role: 'user', banned: true, banReason: null, banExpires: null,
    createdAt: '2026-01-01', updatedAt: '2026-01-01', sessionCount: 0,
    workspaceMembershipCount: 0, projectCount: 0, datasetCount: 0,
    trainingRunCount: 0, labelStudioAccountCount: 1, legacyAnnotationCount: 0,
  };
  actions.impact.mockResolvedValue({ ok: true, workspaceMemberships: 0, projects: 0, datasets: 0, runs: 0, totalBytes: 0, activeJobs: [] });
  actions.cleanup.mockResolvedValue({ ok: false, message: 'Cancel active Label Studio operations first.' });
  render(<AdminUsersClient currentUserId="admin" users={[user]} initialSearch="" limit={20} offset={0} total={1} />);
  fireEvent.click(screen.getAllByRole('button', { name: 'Remove' })[0]);
  const dialog = await screen.findByRole('dialog');
  expect(within(dialog).getByText(/permanently deletes its Label Studio account/i)).toBeTruthy();
  const deleteButton = within(dialog).getByRole('button', { name: /delete account and data/i }) as HTMLButtonElement;
  await waitFor(() => expect(deleteButton.disabled).toBe(false));
  fireEvent.click(deleteButton);
  expect((await within(dialog).findByRole('alert')).textContent).toContain('Cancel active Label Studio operations');
  expect(actions.remove).not.toHaveBeenCalled();
});

test('dataset version metadata alone opens resource cleanup', async () => {
  const user: AdminUserRow = {
    id: 'owner', name: 'Owner', email: 'owner@example.test', emailVerified: true,
    role: 'user', banned: false, banReason: null, banExpires: null,
    createdAt: '2026-01-01', updatedAt: '2026-01-01', sessionCount: 0,
    workspaceMembershipCount: 0, projectCount: 0, datasetCount: 0, datasetVersionRecordCount: 1,
    trainingRunCount: 0, labelStudioAccountCount: 0, legacyAnnotationCount: 0,
  };
  actions.impact.mockResolvedValue({ ok: true, workspaceMemberships: 0, projects: 0, datasets: 0, runs: 0, totalBytes: 0, activeJobs: [] });
  render(<AdminUsersClient currentUserId="admin" users={[user]} initialSearch="" limit={20} offset={0} total={1} />);
  fireEvent.click(screen.getAllByRole('button', { name: 'Remove' })[0]);
  expect(await screen.findByText(/Manage data for owner@example.test/)).toBeTruthy();
  expect(actions.remove).not.toHaveBeenCalled();
});

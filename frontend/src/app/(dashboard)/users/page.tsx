'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiClient } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { formatDate } from '@/lib/utils';
import {
  Users,
  UserPlus,
  Trash2,
  ShieldCheck,
  Mail,
  X,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

export default function UsersManagementPage() {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAppStore();
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'org_admin' | 'kb_manager' | 'employee'>('employee');
  const [inviteResult, setInviteResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch Members
  const { data: members = [], isLoading } = useQuery({
    queryKey: ['org-members'],
    queryFn: () => ApiClient.get('/organizations/members'),
  });

  // Invite Mutation
  const inviteMutation = useMutation({
    mutationFn: (data: { email: string; role: string }) =>
      ApiClient.post('/organizations/members/invite', data),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['org-members'] });
      setInviteResult(`Invitation created: ${res.invitationUrl}`);
      setInviteEmail('');
    },
    onError: (err: any) => {
      setError(err.message || 'Invitation failed');
    },
  });

  // Update Role Mutation
  const updateRoleMutation = useMutation({
    mutationFn: (params: { userId: string; role: string }) =>
      ApiClient.patch(`/organizations/members/${params.userId}/role`, { role: params.role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-members'] });
    },
  });

  // Remove Member Mutation
  const removeMutation = useMutation({
    mutationFn: (userId: string) => ApiClient.delete(`/organizations/members/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-members'] });
    },
    onError: (err: any) => {
      alert(err.message || 'Failed to remove member');
    },
  });

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInviteResult(null);
    inviteMutation.mutate({ email: inviteEmail, role: inviteRole });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Team & Role Permissions</h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Enforce role-based access control (RBAC) across this organization
          </p>
        </div>

        <button
          onClick={() => {
            setError(null);
            setInviteResult(null);
            setIsInviteOpen(true);
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-brand-500/20 hover:bg-brand-500 transition-colors"
        >
          <UserPlus className="h-4 w-4" />
          Invite Team Member
        </button>
      </div>

      {/* Members Table */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 shadow-sm overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 uppercase font-semibold tracking-wider">
            <tr>
              <th className="py-3 px-4">Member Name</th>
              <th className="py-3 px-4">Email</th>
              <th className="py-3 px-4">Role</th>
              <th className="py-3 px-4">Joined Date</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 text-zinc-700 dark:text-zinc-300">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-zinc-400">
                  Loading members...
                </td>
              </tr>
            ) : members.length > 0 ? (
              members.map((m: any) => (
                <tr key={m.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-500/10 text-brand-500 font-bold text-xs">
                        {m.full_name?.charAt(0) || 'U'}
                      </div>
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                        {m.full_name}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4 font-mono text-zinc-500">{m.email}</td>
                  <td className="py-3 px-4">
                    <select
                      value={m.role}
                      onChange={(e) =>
                        updateRoleMutation.mutate({ userId: m.user_id, role: e.target.value })
                      }
                      className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 px-2 py-1 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none"
                    >
                      <option value="org_admin">Org Admin</option>
                      <option value="kb_manager">KB Manager</option>
                      <option value="employee">Employee / Viewer</option>
                    </select>
                  </td>
                  <td className="py-3 px-4 text-zinc-400">{formatDate(m.joined_at)}</td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => {
                        if (confirm(`Remove member "${m.full_name}" from organization?`)) {
                          removeMutation.mutate(m.user_id);
                        }
                      }}
                      className="text-zinc-400 hover:text-red-500 p-1 rounded transition-colors"
                      title="Remove member"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))
            ) : null}
          </tbody>
        </table>
      </div>

      {/* Invite Member Modal */}
      {isInviteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-200 dark:border-zinc-800">
              <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                Invite Team Member
              </h3>
              <button
                onClick={() => setIsInviteOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {error && (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {inviteResult && (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-400">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{inviteResult}</span>
              </div>
            )}

            <form onSubmit={handleInvite} className="space-y-4 pt-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-2.5 text-xs text-zinc-900 dark:text-zinc-100 focus:border-brand-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Role Assignment
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as any)}
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-2.5 text-xs text-zinc-900 dark:text-zinc-100 focus:border-brand-500 focus:outline-none"
                >
                  <option value="employee">Employee / Viewer (Can search and query)</option>
                  <option value="kb_manager">KB Manager (Can upload documents and manage KBs)</option>
                  <option value="org_admin">Organization Admin (Full workspace permissions)</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsInviteOpen(false)}
                  className="rounded-xl px-4 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={inviteMutation.isPending}
                  className="rounded-xl bg-brand-600 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
                >
                  {inviteMutation.isPending ? 'Sending...' : 'Send Invitation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

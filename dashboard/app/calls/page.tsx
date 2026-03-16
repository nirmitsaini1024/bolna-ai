'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { bolnaAPI, Call } from '../../lib/api';

export default function CallsPage() {
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadCalls = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await bolnaAPI.getCalls();
        setCalls(data);
      } catch (err) {
        console.error(err);
        setError('Failed to load calls');
      } finally {
        setLoading(false);
      }
    };

    loadCalls();
  }, []);

  const formatDuration = (durationMs?: number | null) => {
    if (!durationMs) return '-';
    const seconds = Math.floor(durationMs / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDateTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <nav className="border-b border-white/10 bg-black/20 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/" className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-pink-500">
                <span className="text-xl font-bold text-white">B</span>
              </Link>
              <h1 className="text-2xl font-bold text-white">Call History</h1>
            </div>
            <div className="flex gap-4">
              <Link href="/" className="rounded-lg bg-white/10 px-4 py-2 text-white transition hover:bg-white/20">
                Dashboard
              </Link>
              <Link href="/analytics" className="rounded-lg bg-white/10 px-4 py-2 text-white transition hover:bg-white/20">
                Analytics
              </Link>
              <Link href="/logs" className="rounded-lg bg-white/10 px-4 py-2 text-white transition hover:bg-white/20">
                Logs
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="mb-2 text-3xl font-bold text-white">Call Records</h2>
            <p className="text-gray-400">View and manage all voice call sessions</p>
          </div>
          <button className="rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 px-6 py-3 font-semibold text-white transition hover:from-purple-600 hover:to-pink-600">
            Export CSV
          </button>
        </div>

        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-purple-500 border-t-transparent"></div>
          </div>
        ) : error ? (
          <div className="flex h-64 items-center justify-center text-red-400 text-sm">
            {error}
          </div>
        ) : (
          <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-white/5">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Phone</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Agent</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Created At</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Duration</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {calls.map((call) => (
                    <tr key={call.id} className="transition hover:bg-white/5">
                      <td className="px-6 py-4">
                        <div className="font-mono text-sm text-white">{call.phone}</div>
                      </td>
                      <td className="px-6 py-4 text-gray-300">{call.agentId ?? '-'}</td>
                      <td className="px-6 py-4 text-gray-300">
                        {formatDateTime(call.createdAt)}
                      </td>
                      <td className="px-6 py-4 text-gray-300">
                        {formatDuration(call.durationMs)}
                      </td>
                      <td className="px-6 py-4">
                        <Link
                          href={`/calls/${call.id}`}
                          className="rounded-lg bg-purple-500/20 px-4 py-2 text-sm text-purple-400 transition hover:bg-purple-500/30"
                        >
                          View Transcript
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="mt-8 grid gap-6 md:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
            <div className="mb-2 text-sm font-medium text-gray-400">Total Calls</div>
            <div className="text-3xl font-bold text-white">{calls.length}</div>
            <div className="mt-2 text-sm text-green-400">↑ 12% from last week</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
            <div className="mb-2 text-sm font-medium text-gray-400">Avg Duration</div>
            <div className="text-3xl font-bold text-white">
              {formatDuration(
                Math.floor(
                  calls.reduce((acc, call) => acc + (call.durationMs || 0), 0) /
                    Math.max(1, calls.filter((c) => c.durationMs).length)
                )
              )}
            </div>
            <div className="mt-2 text-sm text-blue-400">Typical conversation</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
            <div className="mb-2 text-sm font-medium text-gray-400">Total Duration</div>
            <div className="text-3xl font-bold text-white">
              {formatDuration(
                calls.reduce((acc, call) => acc + (call.durationMs || 0), 0)
              )}
            </div>
            <div className="mt-2 text-sm text-green-400">Across all calls</div>
          </div>
        </div>
      </main>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { bolnaAPI, Call } from '../../lib/api';

export default function CallsPage() {
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

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

  const decodePhone = (value: string) => {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  };

  const formatPhone = (raw: string) => {
    const decoded = decodePhone(raw).trim();
    const compact = decoded.replace(/\s+/g, '');
    if (!compact.startsWith('+')) return decoded;

    const digits = compact.slice(1);
    if (!/^\d+$/.test(digits)) return decoded;

    // Simple readability formatting for common +91 numbers.
    if (digits.startsWith('91') && digits.length === 12) {
      const national = digits.slice(2); // 10 digits
      return `+91 ${national.slice(0, 5)} ${national.slice(5)}`;
    }

    return compact;
  };

  const filteredCalls = calls.filter((c) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      formatPhone(c.phone ?? '').toLowerCase().includes(q) ||
      (c.id ?? '').toLowerCase().includes(q) ||
      (c.callSid ?? '').toLowerCase().includes(q) ||
      (c.agentId ?? '').toLowerCase().includes(q)
    );
  });

  const totalExecutions = filteredCalls.length;
  const totalDurationMs = filteredCalls.reduce((acc, c) => acc + (c.durationMs ?? 0), 0);
  const avgDurationMs =
    filteredCalls.filter((c) => (c.durationMs ?? 0) > 0).length > 0
      ? Math.floor(
          totalDurationMs / Math.max(1, filteredCalls.filter((c) => (c.durationMs ?? 0) > 0).length)
        )
      : 0;
  const queuedCount = filteredCalls.filter((c) => !c.endedAt && !c.durationMs).length;

  return (
    <div className="min-h-screen bg-[#020817] text-white">
      <div className="mx-auto max-w-7xl px-6 py-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-gray-400">Agent Conversations</div>
            <h1 className="text-xl font-semibold">Call Logs</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/calls/live"
              className="rounded-md border border-green-800 bg-green-900/20 px-3 py-2 text-sm text-green-300 hover:bg-green-900/30"
            >
              <span className="inline-flex items-center gap-2">
                <span className="h-2 w-2 animate-pulse rounded-full bg-green-400" />
                Live Calls
              </span>
            </Link>
            <button className="rounded-md border border-gray-800 bg-[#0b1220] px-3 py-2 text-sm text-gray-200 hover:bg-[#0f1a2f]">
              Refresh
            </button>
            <button className="rounded-md border border-gray-800 bg-[#0b1220] px-3 py-2 text-sm text-gray-200 hover:bg-[#0f1a2f]">
              Download Records
            </button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-12 gap-4">
          <div className="col-span-9">
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-3 rounded-lg border border-gray-800 bg-[#0b1220] p-4">
                <div className="text-xs text-gray-400">Total Executions</div>
                <div className="mt-1 text-2xl font-semibold">{totalExecutions}</div>
                <div className="mt-1 text-[11px] text-gray-500">All call attempts</div>
              </div>
              <div className="col-span-3 rounded-lg border border-gray-800 bg-[#0b1220] p-4">
                <div className="text-xs text-gray-400">Total Cost</div>
                <div className="mt-1 text-2xl font-semibold">$0.00</div>
                <div className="mt-1 text-[11px] text-gray-500">Total campaign spend</div>
              </div>
              <div className="col-span-3 rounded-lg border border-gray-800 bg-[#0b1220] p-4">
                <div className="text-xs text-gray-400">Total Duration</div>
                <div className="mt-1 text-2xl font-semibold">{formatDuration(totalDurationMs)}</div>
                <div className="mt-1 text-[11px] text-gray-500">Total talk time</div>
              </div>
              <div className="col-span-3 rounded-lg border border-gray-800 bg-[#0b1220] p-4">
                <div className="text-xs text-gray-400">Status Breakdown</div>
                <div className="mt-2 inline-flex items-center gap-2 rounded-md border border-gray-700 bg-[#020817] px-2 py-1 text-xs text-gray-200">
                  <span className="h-2 w-2 rounded-full bg-yellow-400" />
                  Queued
                  <span className="ml-1 rounded bg-gray-800 px-1.5 py-0.5 text-[10px] text-gray-200">
                    {queuedCount}
                  </span>
                </div>
              </div>
              <div className="col-span-3 rounded-lg border border-gray-800 bg-[#0b1220] p-4">
                <div className="text-xs text-gray-400">Avg Cost</div>
                <div className="mt-1 text-2xl font-semibold">$0.00</div>
                <div className="mt-1 text-[11px] text-gray-500">Average cost per call</div>
              </div>
              <div className="col-span-3 rounded-lg border border-gray-800 bg-[#0b1220] p-4">
                <div className="text-xs text-gray-400">Avg Duration</div>
                <div className="mt-1 text-2xl font-semibold">{formatDuration(avgDurationMs)}</div>
                <div className="mt-1 text-[11px] text-gray-500">Average call length</div>
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-gray-800 bg-[#0b1220]">
              <div className="flex items-center justify-between gap-3 border-b border-gray-800 px-4 py-3">
                <input
                  className="w-full max-w-md rounded-md border border-gray-800 bg-[#020817] px-3 py-2 text-sm text-gray-200 placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Search by execution id / phone / agent id"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <div className="flex items-center gap-2">
                  <button className="rounded-md border border-gray-800 bg-[#020817] px-3 py-2 text-xs text-gray-300 hover:bg-[#0f1a2f]">
                    Group by
                  </button>
                  <button className="rounded-md border border-gray-800 bg-[#020817] px-3 py-2 text-xs text-gray-300 hover:bg-[#0f1a2f]">
                    Provider
                  </button>
                  <button className="rounded-md border border-gray-800 bg-[#020817] px-3 py-2 text-xs text-gray-300 hover:bg-[#0f1a2f]">
                    Call type
                  </button>
                  <button className="rounded-md border border-gray-800 bg-[#020817] px-3 py-2 text-xs text-gray-300 hover:bg-[#0f1a2f]">
                    Status
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="flex h-48 items-center justify-center text-sm text-gray-400">
                  Loading…
                </div>
              ) : error ? (
                <div className="flex h-48 items-center justify-center text-sm text-red-400">
                  {error}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="text-xs text-gray-400">
                      <tr className="border-b border-gray-800">
                        <th className="px-4 py-3">Execution ID</th>
                        <th className="px-4 py-3">User Number</th>
                        <th className="px-4 py-3">Conversation Type</th>
                        <th className="px-4 py-3">Duration (s)</th>
                        <th className="px-4 py-3">Timestamp</th>
                        <th className="px-4 py-3">Cost</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Conversation Data</th>
                        <th className="px-4 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {filteredCalls.map((call) => {
                        const durationSec = call.durationMs ? Math.floor(call.durationMs / 1000) : 0;
                        const status = call.endedAt ? 'Completed' : 'Queued';
                        return (
                          <tr key={call.id} className="hover:bg-white/5">
                            <td className="px-4 py-3 font-mono text-xs text-gray-200">
                              {call.id.slice(0, 6)}…
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-gray-200">
                              {formatPhone(call.phone)}
                            </td>
                            <td className="px-4 py-3 text-gray-300">voice</td>
                            <td className="px-4 py-3 text-gray-300">{durationSec}</td>
                            <td className="px-4 py-3 text-gray-300">{formatDateTime(call.createdAt)}</td>
                            <td className="px-4 py-3 text-gray-300">$0.00</td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${
                                  status === 'Completed'
                                    ? 'border-green-500/40 bg-green-500/10 text-green-300'
                                    : 'border-yellow-500/40 bg-yellow-500/10 text-yellow-300'
                                }`}
                              >
                                {status}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <Link
                                href={`/calls/${call.id}`}
                                className="inline-flex items-center rounded-md border border-gray-700 bg-[#020817] px-2 py-1 text-xs text-gray-200 hover:bg-[#0f1a2f]"
                              >
                                transcript
                              </Link>
                            </td>
                            <td className="px-4 py-3">
                              <Link
                                href={`/calls/${call.id}`}
                                className="rounded-md border border-gray-700 bg-[#020817] px-2 py-1 text-xs text-gray-200 hover:bg-[#0f1a2f]"
                              >
                                View
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="col-span-3">
            <div className="rounded-lg border border-gray-800 bg-[#0b1220] p-4">
              <div className="text-sm font-semibold">Navigation</div>
              <div className="mt-3 flex flex-col gap-2 text-sm">
                <Link href="/" className="text-gray-300 hover:text-white">
                  Dashboard
                </Link>
                <Link href="/analytics" className="text-gray-300 hover:text-white">
                  Analytics
                </Link>
                <Link href="/logs" className="text-gray-300 hover:text-white">
                  Logs
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

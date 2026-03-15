'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Call {
  id: string;
  callSid: string;
  streamSid: string;
  from: string;
  to: string;
  status: string;
  startTime: string;
  endTime?: string;
  duration?: number;
}

export default function CallsPage() {
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const mockCalls: Call[] = [
      {
        id: '1',
        callSid: 'CA123456789',
        streamSid: 'MZ987654321',
        from: '+1234567890',
        to: '+10000000000',
        status: 'completed',
        startTime: new Date(Date.now() - 3600000).toISOString(),
        endTime: new Date(Date.now() - 3000000).toISOString(),
        duration: 600,
      },
      {
        id: '2',
        callSid: 'CA987654321',
        streamSid: 'MZ123456789',
        from: '+9876543210',
        to: '+10000000000',
        status: 'completed',
        startTime: new Date(Date.now() - 7200000).toISOString(),
        endTime: new Date(Date.now() - 6900000).toISOString(),
        duration: 300,
      },
      {
        id: '3',
        callSid: 'CA456789123',
        streamSid: 'MZ456789123',
        from: '+1122334455',
        to: '+10000000000',
        status: 'in-progress',
        startTime: new Date(Date.now() - 120000).toISOString(),
      },
    ];

    setTimeout(() => {
      setCalls(mockCalls);
      setLoading(false);
    }, 500);
  }, []);

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '-';
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
        ) : (
          <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-white/5">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Call SID</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">From</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">To</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Status</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Start Time</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Duration</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {calls.map((call) => (
                    <tr key={call.id} className="transition hover:bg-white/5">
                      <td className="px-6 py-4">
                        <div className="font-mono text-sm text-white">{call.callSid}</div>
                      </td>
                      <td className="px-6 py-4 text-gray-300">{call.from}</td>
                      <td className="px-6 py-4 text-gray-300">{call.to}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${
                            call.status === 'completed'
                              ? 'bg-green-500/20 text-green-400'
                              : call.status === 'in-progress'
                              ? 'bg-blue-500/20 text-blue-400'
                              : 'bg-red-500/20 text-red-400'
                          }`}
                        >
                          {call.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-300">{formatDateTime(call.startTime)}</td>
                      <td className="px-6 py-4 text-gray-300">{formatDuration(call.duration)}</td>
                      <td className="px-6 py-4">
                        <button className="rounded-lg bg-purple-500/20 px-4 py-2 text-sm text-purple-400 transition hover:bg-purple-500/30">
                          View Details
                        </button>
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
                  calls.reduce((acc, call) => acc + (call.duration || 0), 0) / calls.filter((c) => c.duration).length
                )
              )}
            </div>
            <div className="mt-2 text-sm text-blue-400">Typical conversation</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
            <div className="mb-2 text-sm font-medium text-gray-400">Success Rate</div>
            <div className="text-3xl font-bold text-white">
              {Math.round((calls.filter((c) => c.status === 'completed').length / calls.length) * 100)}%
            </div>
            <div className="mt-2 text-sm text-green-400">Excellent performance</div>
          </div>
        </div>
      </main>
    </div>
  );
}

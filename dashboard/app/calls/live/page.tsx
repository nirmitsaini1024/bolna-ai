'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { bolnaAPI, ActiveCall } from '../../../lib/api';

export default function LiveCallsPage() {
  const [activeCalls, setActiveCalls] = useState<ActiveCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hangingUp, setHangingUp] = useState<Set<string>>(new Set());

  const loadActiveCalls = async () => {
    try {
      const data = await bolnaAPI.getActiveCalls();
      setActiveCalls(data);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Failed to load active calls');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadActiveCalls();

    // Poll every 2 seconds for live updates
    const interval = setInterval(() => {
      loadActiveCalls();
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const handleHangup = async (callSid: string) => {
    if (!confirm('Are you sure you want to hang up this call?')) {
      return;
    }

    setHangingUp((prev) => new Set(prev).add(callSid));

    try {
      await bolnaAPI.hangupCall(callSid);
      // Remove from list immediately
      setActiveCalls((prev) => prev.filter((call) => call.callSid !== callSid));
    } catch (err) {
      console.error(err);
      alert('Failed to hang up call');
    } finally {
      setHangingUp((prev) => {
        const next = new Set(prev);
        next.delete(callSid);
        return next;
      });
    }
  };

  const formatDuration = (startTime: string) => {
    const start = new Date(startTime);
    const now = new Date();
    const durationMs = now.getTime() - start.getTime();
    const seconds = Math.floor(durationMs / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatPhone = (phone: string | null) => {
    if (!phone) return 'Unknown';
    const decoded = phone.trim();
    const compact = decoded.replace(/\s+/g, '');
    if (!compact.startsWith('+')) return decoded;

    const digits = compact.slice(1);
    if (!/^\d+$/.test(digits)) return decoded;

    if (digits.startsWith('91') && digits.length === 12) {
      const national = digits.slice(2);
      return `+91 ${national.slice(0, 5)} ${national.slice(5)}`;
    }

    return compact;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'responding':
        return 'bg-blue-500/10 border-blue-500/40 text-blue-300';
      case 'speaking':
        return 'bg-green-500/10 border-green-500/40 text-green-300';
      case 'listening':
        return 'bg-yellow-500/10 border-yellow-500/40 text-yellow-300';
      default:
        return 'bg-gray-500/10 border-gray-500/40 text-gray-300';
    }
  };

  return (
    <div className="min-h-screen bg-[#020817] text-white">
      <div className="mx-auto max-w-7xl px-6 py-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-gray-400">Real-time Monitoring</div>
            <h1 className="text-xl font-semibold">Live Calls</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-md border border-gray-800 bg-[#0b1220] px-3 py-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-green-400" />
              <span className="text-sm text-gray-300">Live</span>
            </div>
            <button
              onClick={loadActiveCalls}
              className="rounded-md border border-gray-800 bg-[#0b1220] px-3 py-2 text-sm text-gray-200 hover:bg-[#0f1a2f]"
            >
              Refresh
            </button>
            <Link
              href="/calls"
              className="rounded-md border border-gray-800 bg-[#0b1220] px-3 py-2 text-sm text-gray-200 hover:bg-[#0f1a2f]"
            >
              View All Calls
            </Link>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-12 gap-4">
          <div className="col-span-12">
            <div className="rounded-lg border border-gray-800 bg-[#0b1220] p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">Active Calls</div>
                <div className="text-sm text-gray-400">{activeCalls.length} active</div>
              </div>
            </div>

            {loading && activeCalls.length === 0 ? (
              <div className="mt-4 flex h-48 items-center justify-center rounded-lg border border-gray-800 bg-[#0b1220] text-sm text-gray-400">
                Loading…
              </div>
            ) : error && activeCalls.length === 0 ? (
              <div className="mt-4 flex h-48 items-center justify-center rounded-lg border border-gray-800 bg-[#0b1220] text-sm text-red-400">
                {error}
              </div>
            ) : activeCalls.length === 0 ? (
              <div className="mt-4 flex h-48 items-center justify-center rounded-lg border border-gray-800 bg-[#0b1220] text-sm text-gray-400">
                No active calls
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                {activeCalls.map((call) => (
                  <div
                    key={call.callSid}
                    className="rounded-lg border border-gray-800 bg-[#0b1220] p-4"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <div className="text-sm font-semibold text-gray-200">
                            {call.agentName || 'Unknown Agent'}
                          </div>
                          <span
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${getStatusColor(
                              call.status
                            )}`}
                          >
                            {call.status}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-4 text-xs text-gray-400">
                          <span>Phone: {formatPhone(call.phone)}</span>
                          <span>Duration: {formatDuration(call.startTime)}</span>
                          <span className="font-mono">SID: {call.callSid.slice(0, 12)}…</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleHangup(call.callSid)}
                        disabled={hangingUp.has(call.callSid)}
                        className="rounded-md border border-red-800 bg-red-900/20 px-3 py-1.5 text-xs text-red-300 hover:bg-red-900/30 disabled:opacity-50"
                      >
                        {hangingUp.has(call.callSid) ? 'Hanging up…' : 'Hang Up'}
                      </button>
                    </div>

                    <div className="mt-4 rounded-md border border-gray-800 bg-[#020817] p-3">
                      <div className="mb-2 text-xs font-semibold text-gray-400">
                        Live Transcript
                      </div>
                      {call.currentTranscript.length === 0 ? (
                        <div className="text-xs text-gray-500">No transcript yet…</div>
                      ) : (
                        <div className="max-h-64 space-y-2 overflow-y-auto">
                          {call.currentTranscript.map((msg, idx) => (
                            <div
                              key={idx}
                              className={`rounded-md p-2 text-xs ${
                                msg.role === 'user'
                                  ? 'bg-blue-500/10 text-blue-200'
                                  : 'bg-green-500/10 text-green-200'
                              }`}
                            >
                              <div className="mb-1 font-semibold">
                                {msg.role === 'user' ? 'User' : 'Agent'}
                              </div>
                              <div className="whitespace-pre-wrap">{msg.content}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

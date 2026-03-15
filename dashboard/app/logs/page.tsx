'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface LogEntry {
  id: string;
  timestamp: string;
  level: 'INFO' | 'DEBUG' | 'WARN' | 'ERROR';
  component: string;
  message: string;
  data?: any;
}

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    const mockLogs: LogEntry[] = [
      {
        id: '1',
        timestamp: new Date().toISOString(),
        level: 'INFO',
        component: 'VoiceGateway',
        message: 'New WebSocket connection',
        data: { connectionId: 'uuid-123', activeConnections: 1 },
      },
      {
        id: '2',
        timestamp: new Date(Date.now() - 5000).toISOString(),
        level: 'DEBUG',
        component: 'StreamHandler',
        message: 'Audio chunk received',
        data: { callSid: 'CA123', track: 'inbound', sequenceNumber: 42 },
      },
      {
        id: '3',
        timestamp: new Date(Date.now() - 10000).toISOString(),
        level: 'INFO',
        component: 'TRANSCRIPT',
        message: 'User speech detected',
        data: { callSid: 'CA123', text: 'Hello, how are you?', isFinal: true },
      },
      {
        id: '4',
        timestamp: new Date(Date.now() - 15000).toISOString(),
        level: 'INFO',
        component: 'AI_RESPONSE',
        message: 'LLM response generated',
        data: { callSid: 'CA123', text: 'I am doing great! How can I help you today?' },
      },
      {
        id: '5',
        timestamp: new Date(Date.now() - 20000).toISOString(),
        level: 'INFO',
        component: 'TTS_START',
        message: 'Text-to-speech started',
        data: { callSid: 'CA123' },
      },
      {
        id: '6',
        timestamp: new Date(Date.now() - 25000).toISOString(),
        level: 'WARN',
        component: 'BARGE_IN',
        message: 'User interrupted AI',
        data: { callSid: 'CA123', reason: 'user_speech_detected' },
      },
      {
        id: '7',
        timestamp: new Date(Date.now() - 30000).toISOString(),
        level: 'INFO',
        component: 'TTS_ABORTED',
        message: 'TTS stream cancelled',
        data: { callSid: 'CA123' },
      },
      {
        id: '8',
        timestamp: new Date(Date.now() - 35000).toISOString(),
        level: 'ERROR',
        component: 'DeepgramSTT',
        message: 'Connection error',
        data: { error: 'WebSocket timeout', retrying: true },
      },
    ];

    setLogs(mockLogs);
  }, []);

  const filteredLogs = filter === 'all' ? logs : logs.filter((log) => log.level === filter);

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'INFO':
        return 'text-blue-400 bg-blue-500/20';
      case 'DEBUG':
        return 'text-gray-400 bg-gray-500/20';
      case 'WARN':
        return 'text-yellow-400 bg-yellow-500/20';
      case 'ERROR':
        return 'text-red-400 bg-red-500/20';
      default:
        return 'text-gray-400 bg-gray-500/20';
    }
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
              <h1 className="text-2xl font-bold text-white">System Logs</h1>
            </div>
            <div className="flex gap-4">
              <Link href="/" className="rounded-lg bg-white/10 px-4 py-2 text-white transition hover:bg-white/20">
                Dashboard
              </Link>
              <Link href="/calls" className="rounded-lg bg-white/10 px-4 py-2 text-white transition hover:bg-white/20">
                Calls
              </Link>
              <Link href="/analytics" className="rounded-lg bg-white/10 px-4 py-2 text-white transition hover:bg-white/20">
                Analytics
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="mb-2 text-3xl font-bold text-white">Real-time Logs</h2>
            <p className="text-gray-400">Monitor system events and debug information</p>
          </div>
          <div className="flex gap-3">
            <label className="flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-white">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
                className="rounded"
              />
              Auto-scroll
            </label>
            <button className="rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 px-6 py-2 font-semibold text-white transition hover:from-purple-600 hover:to-pink-600">
              Export Logs
            </button>
          </div>
        </div>

        <div className="mb-6 flex gap-2">
          {['all', 'INFO', 'DEBUG', 'WARN', 'ERROR'].map((level) => (
            <button
              key={level}
              onClick={() => setFilter(level)}
              className={`rounded-lg px-4 py-2 font-medium transition ${
                filter === level
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                  : 'bg-white/10 text-gray-300 hover:bg-white/20'
              }`}
            >
              {level.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-sm overflow-hidden">
          <div className="max-h-[600px] overflow-y-auto p-4 font-mono text-sm">
            {filteredLogs.length === 0 ? (
              <div className="flex h-32 items-center justify-center text-gray-500">
                No logs to display
              </div>
            ) : (
              <div className="space-y-2">
                {filteredLogs.map((log) => (
                  <div
                    key={log.id}
                    className="rounded-lg border border-white/5 bg-white/5 p-3 transition hover:bg-white/10"
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-xs text-gray-500">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${getLevelColor(log.level)}`}>
                        {log.level}
                      </span>
                      <span className="text-xs font-semibold text-purple-400">[{log.component}]</span>
                      <span className="flex-1 text-white">{log.message}</span>
                    </div>
                    {log.data && (
                      <div className="mt-2 rounded bg-black/40 p-2 text-xs text-gray-400">
                        <pre>{JSON.stringify(log.data, null, 2)}</pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
            <div className="mb-2 text-sm font-medium text-gray-400">Total Events</div>
            <div className="text-3xl font-bold text-white">{logs.length}</div>
            <div className="mt-2 text-sm text-gray-500">Last 24 hours</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
            <div className="mb-2 text-sm font-medium text-gray-400">Errors</div>
            <div className="text-3xl font-bold text-red-400">
              {logs.filter((l) => l.level === 'ERROR').length}
            </div>
            <div className="mt-2 text-sm text-gray-500">Requires attention</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
            <div className="mb-2 text-sm font-medium text-gray-400">Warnings</div>
            <div className="text-3xl font-bold text-yellow-400">
              {logs.filter((l) => l.level === 'WARN').length}
            </div>
            <div className="mt-2 text-sm text-gray-500">Monitor closely</div>
          </div>
        </div>
      </main>
    </div>
  );
}

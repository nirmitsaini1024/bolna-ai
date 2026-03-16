'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { bolnaAPI, CallMessage } from '../../../lib/api';

export default function CallTranscriptPage() {
  const params = useParams();
  const callId = params?.id as string;

  const [messages, setMessages] = useState<CallMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!callId) return;

    const loadMessages = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await bolnaAPI.getCallMessages(callId);
        setMessages(data);
      } catch (err) {
        console.error(err);
        setError('Failed to load call transcript');
      } finally {
        setLoading(false);
      }
    };

    loadMessages();
  }, [callId]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <nav className="border-b border-white/10 bg-black/20 backdrop-blur-sm">
        <div className="mx-auto max-w-5xl px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                href="/calls"
                className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-pink-500"
              >
                <span className="text-xl font-bold text-white">B</span>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-white">Call Transcript</h1>
                <p className="text-xs text-gray-400 truncate">
                  Call ID: {callId}
                </p>
              </div>
            </div>
            <Link
              href="/calls"
              className="rounded-lg bg-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/20"
            >
              Back to calls
            </Link>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-5xl px-6 py-6">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-purple-500 border-t-transparent" />
          </div>
        ) : error ? (
          <div className="flex h-64 items-center justify-center text-sm text-red-400">
            {error}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-64 items-center justify-center text-sm text-gray-400">
            No transcript available for this call.
          </div>
        ) : (
          <div className="space-y-3 rounded-xl border border-white/10 bg-black/40 p-4 backdrop-blur-sm">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.role === 'user' ? 'justify-start' : 'justify-end'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                    m.role === 'user'
                      ? 'bg-white/10 text-white rounded-tl-none'
                      : 'bg-purple-500/30 text-white rounded-tr-none'
                  }`}
                >
                  <div className="text-[10px] uppercase tracking-wide text-gray-400 mb-1">
                    {m.role === 'user' ? 'User' : 'Agent'}
                  </div>
                  <div>{m.content}</div>
                  <div className="mt-1 text-[10px] text-gray-500">
                    {new Date(m.createdAt).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}


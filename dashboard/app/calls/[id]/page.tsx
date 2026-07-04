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
    <div className="min-h-screen bg-[#020817] text-white">
      <div className="mx-auto max-w-5xl px-6 py-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-gray-400">Agent Conversations</div>
            <h1 className="text-xl font-semibold">Transcript</h1>
            <div className="mt-1 font-mono text-[11px] text-gray-500">Execution ID: {callId}</div>
          </div>
          <Link
            href="/calls"
            className="rounded-md border border-gray-800 bg-[#0b1220] px-3 py-2 text-sm text-gray-200 hover:bg-[#0f1a2f]"
          >
            Back to call logs
          </Link>
        </div>

        <div className="mt-4 rounded-lg border border-gray-800 bg-[#0b1220]">
        {loading ? (
          <div className="flex h-48 items-center justify-center text-sm text-gray-400">Loading…</div>
        ) : error ? (
          <div className="flex h-48 items-center justify-center text-sm text-red-400">{error}</div>
        ) : messages.length === 0 ? (
          <div className="flex h-48 items-center justify-center text-sm text-gray-400">
            No transcript available for this call.
          </div>
        ) : (
          <div className="space-y-3 p-4">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.role === 'user' ? 'justify-start' : 'justify-end'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl border px-4 py-2 text-sm ${
                    m.role === 'user'
                      ? 'border-gray-700 bg-[#020817] text-gray-100 rounded-tl-none'
                      : 'border-blue-500/30 bg-blue-500/10 text-gray-100 rounded-tr-none'
                  }`}
                >
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <div className="text-[10px] uppercase tracking-wide text-gray-400">
                      {m.role === 'user' ? 'User' : 'Agent'}
                    </div>
                    <div className="font-mono text-[10px] text-gray-500">
                      {new Date(m.createdAt).toLocaleTimeString()}
                    </div>
                  </div>
                  <div className="whitespace-pre-wrap">{m.content}</div>
                </div>
              </div>
            ))}
          </div>
        )}
        </div>
      </div>
    </div>
  );
}


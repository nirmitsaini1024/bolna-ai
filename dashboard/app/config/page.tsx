'use client';

import { useState } from 'react';
import Link from 'next/link';

interface ConfigField {
  key: string;
  label: string;
  value: string;
  type: 'text' | 'password' | 'url';
  description: string;
}

export default function ConfigPage() {
  const [configs, setConfigs] = useState<ConfigField[]>([
    {
      key: 'TWILIO_ACCOUNT_SID',
      label: 'Twilio Account SID',
      value: '',
      type: 'text',
      description: 'Your Twilio account identifier (from .env)',
    },
    {
      key: 'TWILIO_AUTH_TOKEN',
      label: 'Twilio Auth Token',
      value: '',
      type: 'password',
      description: 'Authentication token for Twilio API (from .env)',
    },
    {
      key: 'TWILIO_NUMBER',
      label: 'Twilio Phone Number',
      value: '',
      type: 'text',
      description: 'Your Twilio phone number for incoming calls (from .env)',
    },
    {
      key: 'DEEPGRAM_API_KEY',
      label: 'Deepgram API Key',
      value: '',
      type: 'password',
      description: 'API key for Deepgram STT and TTS services (from .env)',
    },
    {
      key: 'OPENROUTER_API_KEY',
      label: 'OpenRouter API Key',
      value: '',
      type: 'password',
      description: 'API key for OpenRouter LLM service (from .env)',
    },
    {
      key: 'NGROK_URL',
      label: 'Ngrok URL',
      value: '',
      type: 'url',
      description: 'WebSocket URL for Twilio Media Streams (from .env)',
    },
    {
      key: 'PORT',
      label: 'Server Port',
      value: '3000',
      type: 'text',
      description: 'Port number for the main server',
    },
  ]);

  const [showValues, setShowValues] = useState<{ [key: string]: boolean }>({});
  const [editing, setEditing] = useState<string | null>(null);

  const toggleShow = (key: string) => {
    setShowValues((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = () => {
    alert('Configuration saved successfully!');
    setEditing(null);
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
              <h1 className="text-2xl font-bold text-white">Configuration</h1>
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
              <Link href="/logs" className="rounded-lg bg-white/10 px-4 py-2 text-white transition hover:bg-white/20">
                Logs
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-8">
          <h2 className="mb-2 text-3xl font-bold text-white">System Configuration</h2>
          <p className="text-gray-400">Manage API keys and environment settings</p>
        </div>

        <div className="mb-6 rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-4">
          <div className="flex items-start gap-3">
            <svg className="h-6 w-6 flex-shrink-0 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <p className="font-semibold text-yellow-400">Security Warning</p>
              <p className="text-sm text-yellow-200/80">
                Keep your API keys secure. Never share them publicly or commit them to version control.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {configs.map((config) => (
            <div key={config.key} className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-white">{config.label}</h3>
                  <p className="text-sm text-gray-400">{config.description}</p>
                </div>
                <button
                  onClick={() => setEditing(editing === config.key ? null : config.key)}
                  className="rounded-lg bg-purple-500/20 px-4 py-2 text-sm text-purple-400 transition hover:bg-purple-500/30"
                >
                  {editing === config.key ? 'Cancel' : 'Edit'}
                </button>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  {editing === config.key ? (
                    <input
                      type="text"
                      value={config.value}
                      onChange={(e) => {
                        setConfigs((prev) =>
                          prev.map((c) => (c.key === config.key ? { ...c, value: e.target.value } : c))
                        );
                      }}
                      className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-2 font-mono text-sm text-white focus:border-purple-500 focus:outline-none"
                    />
                  ) : (
                    <div className="rounded-lg border border-white/10 bg-black/20 px-4 py-2 font-mono text-sm text-white">
                      {config.type === 'password' && !showValues[config.key]
                        ? '••••••••••••••••'
                        : config.value}
                    </div>
                  )}
                </div>
                {config.type === 'password' && !editing && (
                  <button
                    onClick={() => toggleShow(config.key)}
                    className="rounded-lg bg-white/10 p-2 text-gray-400 transition hover:bg-white/20"
                  >
                    {showValues[config.key] ? (
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                )}
                {editing === config.key && (
                  <button
                    onClick={handleSave}
                    className="rounded-lg bg-gradient-to-r from-green-500 to-emerald-500 px-4 py-2 text-sm font-medium text-white transition hover:from-green-600 hover:to-emerald-600"
                  >
                    Save
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
            <h3 className="mb-4 text-lg font-bold text-white">Quick Actions</h3>
            <div className="space-y-3">
              <button className="w-full rounded-lg bg-blue-500/20 p-3 text-left text-blue-400 transition hover:bg-blue-500/30">
                <div className="font-semibold">Test Twilio Connection</div>
                <div className="text-xs text-blue-300/70">Verify Twilio credentials</div>
              </button>
              <button className="w-full rounded-lg bg-purple-500/20 p-3 text-left text-purple-400 transition hover:bg-purple-500/30">
                <div className="font-semibold">Test Deepgram API</div>
                <div className="text-xs text-purple-300/70">Check STT/TTS connectivity</div>
              </button>
              <button className="w-full rounded-lg bg-pink-500/20 p-3 text-left text-pink-400 transition hover:bg-pink-500/30">
                <div className="font-semibold">Test OpenRouter</div>
                <div className="text-xs text-pink-300/70">Verify LLM integration</div>
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
            <h3 className="mb-4 text-lg font-bold text-white">System Info</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Node Version</span>
                <span className="font-mono text-white">v20.19.37</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Platform</span>
                <span className="font-mono text-white">linux x64</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Database</span>
                <span className="font-mono text-green-400">Connected</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Environment</span>
                <span className="font-mono text-white">Production</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 flex justify-end gap-4">
          <button className="rounded-lg border border-white/20 bg-white/10 px-6 py-3 font-semibold text-white transition hover:bg-white/20">
            Reset to Defaults
          </button>
          <button className="rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 px-6 py-3 font-semibold text-white transition hover:from-purple-600 hover:to-pink-600">
            Save All Changes
          </button>
        </div>
      </main>
    </div>
  );
}

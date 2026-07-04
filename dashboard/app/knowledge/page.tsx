'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { bolnaAPI, KnowledgeSource } from '../../lib/api';

type TabId = 'upload' | 'url';

export default function KnowledgeBasePage() {
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('upload');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await bolnaAPI.getKnowledgeSources('');
      setSources(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load knowledge sources');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const formatRelative = useMemo(() => {
    return (iso: string) => {
      const d = new Date(iso);
      const diffMs = Date.now() - d.getTime();
      const sec = Math.floor(diffMs / 1000);
      if (sec < 60) return `${sec}s ago`;
      const min = Math.floor(sec / 60);
      if (min < 60) return `${min}m ago`;
      const hr = Math.floor(min / 60);
      if (hr < 24) return `${hr}h ago`;
      const days = Math.floor(hr / 24);
      return `${days}d ago`;
    };
  }, []);

  const onDelete = async (id: string) => {
    if (!confirm('Delete this knowledge base and all its chunks?')) return;
    setBusy('Deleting…');
    try {
      await bolnaAPI.deleteKnowledgeSource(id);
      await refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to delete');
    } finally {
      setBusy(null);
    }
  };

  const onSubmit = async () => {
    if (activeTab === 'upload') {
      if (!selectedFile) {
        alert('Select a PDF first');
        return;
      }
      setBusy('Uploading…');
      try {
        await bolnaAPI.uploadKnowledgePdf('', selectedFile);
        setSelectedFile(null);
        setShowModal(false);
        await refresh();
      } catch (e) {
        alert(e instanceof Error ? e.message : 'Upload failed');
      } finally {
        setBusy(null);
      }
      return;
    }

    const trimmed = url.trim();
    if (!trimmed) {
      alert('Enter a URL');
      return;
    }
    setBusy('Processing URL…');
    try {
      await bolnaAPI.addKnowledgeUrl('', trimmed);
      setUrl('');
      setShowModal(false);
      await refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'URL ingest failed');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#020817] text-white">
      <div className="mx-auto max-w-7xl px-6 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Knowledge Base</h1>
            <p className="mt-1 text-sm text-gray-400">
              Manage knowledge base entries and upload PDFs.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button className="rounded-md border border-gray-800 bg-[#0b1220] px-3 py-2 text-sm text-gray-200 hover:bg-[#0f1a2f]">
              Add more funds
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
            >
              Add Knowledge Base
            </button>
          </div>
        </div>

        <div className="mt-6 rounded-lg border border-gray-800 bg-[#0b1220]">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-gray-800 text-xs text-gray-400">
                <tr>
                  <th className="px-4 py-3">RAG ID</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Delete</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="px-4 py-6 text-center text-xs text-gray-500" colSpan={6}>
                      Loading…
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td className="px-4 py-6 text-center text-xs text-red-400" colSpan={6}>
                      {error}
                    </td>
                  </tr>
                ) : sources.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-center text-xs text-gray-500" colSpan={6}>
                      No data available.
                    </td>
                  </tr>
                ) : (
                  sources.map((s) => (
                    <tr key={s.id} className="border-t border-gray-800 hover:bg-white/5">
                      <td className="px-4 py-3 font-mono text-xs text-gray-200">{s.id.slice(0, 6)}…</td>
                      <td className="px-4 py-3 text-gray-100">{s.title}</td>
                      <td className="px-4 py-3 text-gray-300">{s.type}</td>
                      <td className="px-4 py-3 text-gray-300">{formatRelative(s.createdAt)}</td>
                      <td className="px-4 py-3 text-gray-300">Ready</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => void onDelete(s.id)}
                          className="rounded-md border border-red-500/40 bg-red-500/10 px-2 py-1 text-xs text-red-200 hover:bg-red-500/20 disabled:opacity-60"
                          disabled={Boolean(busy)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-lg rounded-2xl border border-gray-800 bg-[#020817] shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-800 px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold">Add Knowledge Base</h2>
                <p className="mt-1 text-xs text-gray-400">
                  Upload a PDF or add a URL to create a knowledge source.
                </p>
              </div>
              <button
                className="h-7 w-7 inline-flex items-center justify-center rounded-full border border-gray-700 text-gray-400 hover:text-white hover:bg-gray-800"
                onClick={() => setShowModal(false)}
              >
                ×
              </button>
            </div>

            <div className="px-5 pt-4">
              <div className="inline-flex rounded-full border border-gray-800 bg-[#020817] p-1 text-xs text-gray-300">
                <button
                  onClick={() => setActiveTab('upload')}
                  className={`px-4 py-1 rounded-full ${
                    activeTab === 'upload' ? 'bg-blue-600 text-white' : ''
                  }`}
                >
                  Upload PDF
                </button>
                <button
                  onClick={() => setActiveTab('url')}
                  className={`px-4 py-1 rounded-full ${
                    activeTab === 'url' ? 'bg-blue-600 text-white' : ''
                  }`}
                >
                  Add URL
                </button>
              </div>
            </div>

            <div className="px-5 py-4 space-y-4">
              {activeTab === 'upload' ? (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                  />
                  <div
                    className="rounded-lg border border-dashed border-gray-700 bg-[#020817] px-4 py-8 text-center text-sm text-gray-400 cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Drag and drop your PDF here, or{' '}
                    <span className="text-blue-400 hover:underline">click to browse</span>.
                    <div className="mt-2 text-xs text-gray-500">Only .pdf files are supported.</div>
                    {selectedFile && (
                      <div className="mt-3 text-xs text-gray-200">Selected: {selectedFile.name}</div>
                    )}
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <label className="text-xs text-gray-400">Knowledge URL</label>
                  <input
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://example.com/docs"
                    className="w-full rounded-md border border-gray-800 bg-[#020817] px-3 py-2 text-sm text-gray-100 placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs text-gray-400">Language Support</label>
                <select className="w-full rounded-md border border-gray-800 bg-[#020817] px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500">
                  <option>English (Default)</option>
                </select>
              </div>

              <p className="text-[11px] text-gray-500">
                Refer to the Knowledge documentation for step-by-step guidance on how to use it.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-gray-800 px-5 py-3">
              <button
                className="rounded-md border border-gray-700 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-800"
                onClick={() => setShowModal(false)}
              >
                Cancel
              </button>
              <button
                className="rounded-md bg-blue-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-60"
                onClick={() => void onSubmit()}
                disabled={Boolean(busy)}
              >
                {activeTab === 'upload' ? 'Upload PDF' : 'Save URL'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


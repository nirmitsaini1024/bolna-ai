'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { bolnaAPI, KnowledgeSource } from '../../../../lib/api';

type ModalTab = 'pdf' | 'url';

function formatRelative(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  return `${days}d ago`;
}

export default function AgentKnowledgePage() {
  const params = useParams();
  const agentId = params?.agentId as string;

  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [modalTab, setModalTab] = useState<ModalTab>('pdf');

  const [urlInput, setUrlInput] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const title = useMemo(() => `Knowledge Base`, []);

  const refresh = async () => {
    if (!agentId) return;
    setLoading(true);
    setError(null);
    try {
      const list = await bolnaAPI.getKnowledgeSources(agentId);
      setSources(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load sources');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, [agentId]);

  const onDelete = async (sourceId: string) => {
    if (!confirm('Delete this knowledge source and all its chunks?')) return;
    setBusy('Deleting…');
    try {
      await bolnaAPI.deleteKnowledgeSource(sourceId);
      await refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to delete');
    } finally {
      setBusy(null);
    }
  };

  const onUploadPdf = async () => {
    if (!selectedFile) {
      alert('Select a PDF first');
      return;
    }
    setBusy('Uploading…');
    try {
      await bolnaAPI.uploadKnowledgePdf(agentId, selectedFile);
      setSelectedFile(null);
      setShowModal(false);
      await refresh();
      alert('Uploaded and indexed successfully');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to upload');
    } finally {
      setBusy(null);
    }
  };

  const onAddUrl = async () => {
    const url = urlInput.trim();
    if (!url) {
      alert('Enter a URL');
      return;
    }
    setBusy('Processing URL…');
    try {
      await bolnaAPI.addKnowledgeUrl(agentId, url);
      setUrlInput('');
      setShowModal(false);
      await refresh();
      alert('URL indexed successfully');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to add URL');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#020817] text-white">
      <div className="mx-auto max-w-7xl px-6 py-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-gray-400">Agent Setup</div>
            <h1 className="text-xl font-semibold">{title}</h1>
            <div className="mt-1 font-mono text-[11px] text-gray-500">Agent ID: {agentId}</div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="rounded-md border border-gray-800 bg-[#0b1220] px-3 py-2 text-sm text-gray-200 hover:bg-[#0f1a2f]"
            >
              Back
            </Link>
            <button
              onClick={() => {
                setModalTab('pdf');
                setShowModal(true);
              }}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-60"
              disabled={Boolean(busy)}
            >
              Upload PDF
            </button>
            <button
              onClick={() => {
                setModalTab('url');
                setShowModal(true);
              }}
              className="rounded-md border border-gray-800 bg-[#0b1220] px-4 py-2 text-sm text-gray-200 hover:bg-[#0f1a2f] disabled:opacity-60"
              disabled={Boolean(busy)}
            >
              Add URL
            </button>
          </div>
        </div>

        <div className="mt-6 rounded-lg border border-gray-800 bg-[#0b1220]">
          <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
            <div className="text-sm font-semibold text-gray-100">Documents</div>
            <button
              onClick={() => void refresh()}
              className="rounded-md border border-gray-800 bg-[#020817] px-3 py-1.5 text-xs text-gray-200 hover:bg-[#0f1a2f] disabled:opacity-60"
              disabled={loading}
            >
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="flex h-40 items-center justify-center text-sm text-gray-400">Loading…</div>
          ) : error ? (
            <div className="flex h-40 items-center justify-center text-sm text-red-400">{error}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-gray-800 text-xs text-gray-400">
                  <tr>
                    <th className="px-4 py-3">Document Name</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Uploaded</th>
                    <th className="px-4 py-3 text-right">Delete</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {sources.length === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-center text-xs text-gray-500" colSpan={4}>
                        No knowledge sources uploaded yet.
                      </td>
                    </tr>
                  ) : (
                    sources.map((s) => (
                      <tr key={s.id} className="hover:bg-white/5">
                        <td className="px-4 py-3 text-gray-100">{s.title}</td>
                        <td className="px-4 py-3 text-gray-300">{s.type}</td>
                        <td className="px-4 py-3 text-gray-300">{formatRelative(s.createdAt)}</td>
                        <td className="px-4 py-3 text-right">
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
          )}
        </div>

        {busy && (
          <div className="mt-3 text-xs text-gray-400">
            {busy}
          </div>
        )}
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
                  onClick={() => setModalTab('pdf')}
                  className={`px-4 py-1 rounded-full ${modalTab === 'pdf' ? 'bg-blue-600 text-white' : ''}`}
                >
                  Upload PDF
                </button>
                <button
                  onClick={() => setModalTab('url')}
                  className={`px-4 py-1 rounded-full ${modalTab === 'url' ? 'bg-blue-600 text-white' : ''}`}
                >
                  Add URL
                </button>
              </div>
            </div>

            <div className="px-5 py-4 space-y-4">
              {modalTab === 'pdf' ? (
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
                  <label className="text-xs text-gray-400">URL</label>
                  <input
                    type="text"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
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
                disabled={Boolean(busy)}
              >
                Cancel
              </button>
              <button
                className="rounded-md bg-blue-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-60"
                onClick={modalTab === 'pdf' ? () => void onUploadPdf() : () => void onAddUrl()}
                disabled={Boolean(busy)}
              >
                {modalTab === 'pdf' ? 'Upload PDF' : 'Save URL'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


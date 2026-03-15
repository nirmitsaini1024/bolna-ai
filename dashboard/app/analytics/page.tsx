'use client';

import Link from 'next/link';

export default function AnalyticsPage() {
  const stats = [
    { label: 'Total Calls Today', value: '47', change: '+8%', trend: 'up' },
    { label: 'Avg Response Time', value: '2.4s', change: '-12%', trend: 'down' },
    { label: 'Barge-In Events', value: '23', change: '+5%', trend: 'up' },
    { label: 'Success Rate', value: '98.5%', change: '+2%', trend: 'up' },
  ];

  const performanceMetrics = [
    { metric: 'STT Latency', value: '850ms', status: 'good' },
    { metric: 'LLM Response', value: '1.2s', status: 'good' },
    { metric: 'TTS Generation', value: '600ms', status: 'excellent' },
    { metric: 'End-to-End', value: '2.4s', status: 'good' },
  ];

  const hourlyData = [
    { hour: '00:00', calls: 5 },
    { hour: '03:00', calls: 2 },
    { hour: '06:00', calls: 8 },
    { hour: '09:00', calls: 15 },
    { hour: '12:00', calls: 23 },
    { hour: '15:00', calls: 18 },
    { hour: '18:00', calls: 12 },
    { hour: '21:00', calls: 9 },
  ];

  const maxCalls = Math.max(...hourlyData.map((d) => d.calls));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <nav className="border-b border-white/10 bg-black/20 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/" className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-pink-500">
                <span className="text-xl font-bold text-white">B</span>
              </Link>
              <h1 className="text-2xl font-bold text-white">Analytics</h1>
            </div>
            <div className="flex gap-4">
              <Link href="/" className="rounded-lg bg-white/10 px-4 py-2 text-white transition hover:bg-white/20">
                Dashboard
              </Link>
              <Link href="/calls" className="rounded-lg bg-white/10 px-4 py-2 text-white transition hover:bg-white/20">
                Calls
              </Link>
              <Link href="/logs" className="rounded-lg bg-white/10 px-4 py-2 text-white transition hover:bg-white/20">
                Logs
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-8">
          <h2 className="mb-2 text-3xl font-bold text-white">Performance Analytics</h2>
          <p className="text-gray-400">Detailed insights into system performance and usage</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
              <div className="mb-2 text-sm font-medium text-gray-400">{stat.label}</div>
              <div className="flex items-end justify-between">
                <div className="text-3xl font-bold text-white">{stat.value}</div>
                <div className={`text-sm font-medium ${stat.trend === 'up' ? 'text-green-400' : 'text-red-400'}`}>
                  {stat.change}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-2 mb-8">
          <div className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
            <h3 className="mb-6 text-xl font-bold text-white">Calls by Hour</h3>
            <div className="space-y-4">
              {hourlyData.map((data) => (
                <div key={data.hour} className="flex items-center gap-4">
                  <div className="w-16 text-sm text-gray-400">{data.hour}</div>
                  <div className="flex-1">
                    <div className="relative h-8 rounded-lg bg-white/5 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all"
                        style={{ width: `${(data.calls / maxCalls) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                  <div className="w-8 text-right text-sm font-medium text-white">{data.calls}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
            <h3 className="mb-6 text-xl font-bold text-white">Performance Metrics</h3>
            <div className="space-y-4">
              {performanceMetrics.map((metric) => (
                <div key={metric.metric} className="flex items-center justify-between rounded-lg bg-white/5 p-4">
                  <div>
                    <div className="font-medium text-white">{metric.metric}</div>
                    <div className="text-2xl font-bold text-white">{metric.value}</div>
                  </div>
                  <div
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      metric.status === 'excellent'
                        ? 'bg-green-500/20 text-green-400'
                        : metric.status === 'good'
                        ? 'bg-blue-500/20 text-blue-400'
                        : 'bg-yellow-500/20 text-yellow-400'
                    }`}
                  >
                    {metric.status}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3 mb-8">
          <div className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
            <h3 className="mb-4 text-lg font-bold text-white">API Usage</h3>
            <div className="space-y-3">
              <div>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-gray-400">Deepgram STT</span>
                  <span className="text-white">87%</span>
                </div>
                <div className="h-2 rounded-full bg-white/5">
                  <div className="h-full w-[87%] rounded-full bg-gradient-to-r from-blue-500 to-cyan-500"></div>
                </div>
              </div>
              <div>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-gray-400">OpenRouter</span>
                  <span className="text-white">72%</span>
                </div>
                <div className="h-2 rounded-full bg-white/5">
                  <div className="h-full w-[72%] rounded-full bg-gradient-to-r from-purple-500 to-pink-500"></div>
                </div>
              </div>
              <div>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-gray-400">Deepgram TTS</span>
                  <span className="text-white">65%</span>
                </div>
                <div className="h-2 rounded-full bg-white/5">
                  <div className="h-full w-[65%] rounded-full bg-gradient-to-r from-green-500 to-emerald-500"></div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
            <h3 className="mb-4 text-lg font-bold text-white">Call Distribution</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Completed</span>
                <span className="font-semibold text-green-400">85%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">In Progress</span>
                <span className="font-semibold text-blue-400">10%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Failed</span>
                <span className="font-semibold text-red-400">5%</span>
              </div>
            </div>
            <div className="mt-6 flex h-4 overflow-hidden rounded-full">
              <div className="bg-green-500" style={{ width: '85%' }}></div>
              <div className="bg-blue-500" style={{ width: '10%' }}></div>
              <div className="bg-red-500" style={{ width: '5%' }}></div>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
            <h3 className="mb-4 text-lg font-bold text-white">Top Features</h3>
            <div className="space-y-3">
              <div className="rounded-lg bg-white/5 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-300">Barge-In</span>
                  <span className="font-semibold text-purple-400">234 uses</span>
                </div>
              </div>
              <div className="rounded-lg bg-white/5 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-300">Voice Gateway</span>
                  <span className="font-semibold text-blue-400">567 calls</span>
                </div>
              </div>
              <div className="rounded-lg bg-white/5 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-300">AI Responses</span>
                  <span className="font-semibold text-pink-400">1,234 msgs</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
          <h3 className="mb-6 text-xl font-bold text-white">System Health</h3>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-lg bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/20 p-4">
              <div className="text-sm text-gray-400">CPU Usage</div>
              <div className="mt-2 text-2xl font-bold text-white">45%</div>
            </div>
            <div className="rounded-lg bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/20 p-4">
              <div className="text-sm text-gray-400">Memory</div>
              <div className="mt-2 text-2xl font-bold text-white">2.1GB</div>
            </div>
            <div className="rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/20 p-4">
              <div className="text-sm text-gray-400">Network</div>
              <div className="mt-2 text-2xl font-bold text-white">125 Mbps</div>
            </div>
            <div className="rounded-lg bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border border-yellow-500/20 p-4">
              <div className="text-sm text-gray-400">Disk I/O</div>
              <div className="mt-2 text-2xl font-bold text-white">34 MB/s</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

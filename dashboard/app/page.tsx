'use client';

import { useEffect, useState } from 'react';

interface Agent {
  id: string;
  name: string;
  status: 'draft' | 'active';
}

export default function Dashboard() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<Agent>({
    id: '1',
    name: '(v3) Cart Abandonment - E Comm',
    status: 'draft'
  });
  const [agentName, setAgentName] = useState('(v3) Cart Abandonment - E Commerce - copy');
  const [provider, setProvider] = useState('Azure');
  const [model, setModel] = useState('gpt-4.1-mini-cluster');
  const [temperature, setTemperature] = useState(0.75);
  const [tokens, setTokens] = useState(373);
  const [activeTab, setActiveTab] = useState('llm');
  const [showNewAgentModal, setShowNewAgentModal] = useState(false);

  const agents: Agent[] = [
    { id: '1', name: '(v3) Cart Abandonment - E Commerce - copy', status: 'draft' },
    { id: '2', name: 'New Agent', status: 'draft' }
  ];

  const tabs = [
    { id: 'agent', label: 'Agent' },
    { id: 'llm', label: 'LLM' },
    { id: 'audio', label: 'Audio' },
    { id: 'engine', label: 'Engine' },
    { id: 'call', label: 'Call' },
    { id: 'tools', label: 'Tools' },
    { id: 'analytics', label: 'Analytics' },
    { id: 'inbound', label: 'Inbound' }
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-[#020817]">
      {/* Left Sidebar - Agent List */}
      <div className="flex flex-col w-72 border-r border-[#111827] bg-[#020817]">
        <div className="px-5 py-4 border-b border-[#111827]">
          <h1 className="text-xl font-bold text-white mb-4">Your Agents</h1>
          <div className="flex gap-2">
            <button
              className="flex items-center gap-2 px-3 py-1.5 text-xs rounded-md bg-[#020617] border border-[#1f2937] hover:bg-[#020617]/90 text-gray-200 cursor-pointer"
            >
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-4 w-4">
                <path d="M7.50005 1.04999C7.74858 1.04999 7.95005 1.25146 7.95005 1.49999V8.41359L10.1819 6.18179C10.3576 6.00605 10.6425 6.00605 10.8182 6.18179C10.994 6.35753 10.994 6.64245 10.8182 6.81819L7.81825 9.81819C7.64251 9.99392 7.35759 9.99392 7.18185 9.81819L4.18185 6.81819C4.00611 6.64245 4.00611 6.35753 4.18185 6.18179C4.35759 6.00605 4.64251 6.00605 4.81825 6.18179L7.05005 8.41359V1.49999C7.05005 1.25146 7.25152 1.04999 7.50005 1.04999ZM2.5 10C2.77614 10 3 10.2239 3 10.5V12C3 12.5539 3.44565 13 3.99635 13H11.0012C11.5529 13 12 12.5528 12 12V10.5C12 10.2239 12.2239 10 12.5 10C12.7761 10 13 10.2239 13 10.5V12C13 13.1041 12.1062 14 11.0012 14H3.99635C2.89019 14 2 13.103 2 12V10.5C2 10.2239 2.22386 10 2.5 10Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"/>
              </svg>
              Import
            </button>
            <button
              className="flex items-center gap-2 px-3 py-1.5 text-xs rounded-md bg-[#020617] border border-[#1f2937] hover:bg-[#020617]/90 text-gray-200 cursor-pointer"
              onClick={() => setShowNewAgentModal(true)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <path d="M5 12h14"/>
                <path d="M12 5v14"/>
              </svg>
              New Agent
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto px-4 py-3">
          <div className="relative mb-3">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500">
              <circle cx="11" cy="11" r="8"/>
              <path d="m21 21-4.3-4.3"/>
            </svg>
            <input
              type="text"
              placeholder="Search agents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-3 py-2 bg-[#020617] border border-[#1f2937] rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {agents.map((agent) => (
            <button
              key={agent.id}
              onClick={() => setSelectedAgent(agent)}
              className={`w-full text-left px-3 py-2.5 rounded-lg border mb-2 transition-colors ${
                selectedAgent.id === agent.id
                  ? 'bg-[#111827] border-[#1f2937]'
                  : 'bg-[#020617] border-[#020617] hover:bg-[#111827]'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="font-semibold text-white text-sm truncate">{agent.name}</div>
                <div className="ml-2 text-xs text-gray-400 capitalize shrink-0">{agent.status}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#020817]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-[#020817]">
          <div>
            <h1 className="text-2xl font-bold text-white">Agent Setup</h1>
            <p className="text-sm text-gray-400">Fine tune your agents</p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-800 hover:border-gray-700 transition-colors">
              <div className="flex items-center justify-center w-7 h-7 rounded-md bg-blue-500/10">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 text-blue-500">
                  <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/>
                  <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>
                </svg>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-medium text-gray-500 uppercase">Balance</span>
                <span className="text-sm font-bold text-white">$5.00</span>
              </div>
            </div>
            
            <button className="flex items-center gap-2 px-3 py-2 border border-gray-800 rounded-lg hover:bg-gray-800 transition-colors text-sm text-white">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <circle cx="12" cy="12" r="10"/>
                <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/>
                <path d="M12 18V6"/>
              </svg>
              Add more funds
            </button>
            
            <button className="flex items-center gap-2 px-3 py-2 border border-gray-800 rounded-lg hover:bg-gray-800 transition-colors">
              <div className="flex items-center justify-center w-7 h-7 rounded-md bg-blue-500/10">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 text-blue-500">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                  <path d="M12 17h.01"/>
                </svg>
              </div>
              <span className="text-sm font-medium text-white">Help</span>
            </button>
          </div>
        </div>

        {/* Agent Title and Actions */}
        <div className="px-6 py-4 border-b border-gray-800 bg-[#020817]">
          <div className="grid grid-cols-12 gap-3 items-start">
            <div className="col-span-9">
              <div className="flex items-center gap-2 mb-4">
                <input
                  type="text"
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  className="text-2xl font-bold bg-transparent border-0 text-white focus:outline-none focus:ring-0 p-0"
                />
                <button className="px-3 py-2 text-xs border border-gray-700 rounded-md hover:bg-white hover:text-blue-500 hover:ring-1 hover:ring-blue-500 transition-colors flex items-center gap-2">
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-4 w-4"><path d="M1 9.50006C1 10.3285 1.67157 11.0001 2.5 11.0001H4L4 10.0001H2.5C2.22386 10.0001 2 9.7762 2 9.50006L2 2.50006C2 2.22392 2.22386 2.00006 2.5 2.00006L9.5 2.00006C9.77614 2.00006 10 2.22392 10 2.50006V4.00002H5.5C4.67158 4.00002 4 4.67159 4 5.50002V12.5C4 13.3284 4.67158 14 5.5 14H12.5C13.3284 14 14 13.3284 14 12.5V5.50002C14 4.67159 13.3284 4.00002 12.5 4.00002H11V2.50006C11 1.67163 10.3284 1.00006 9.5 1.00006H2.5C1.67157 1.00006 1 1.67163 1 2.50006V9.50006ZM5 5.50002C5 5.22388 5.22386 5.00002 5.5 5.00002H12.5C12.7761 5.00002 13 5.22388 13 5.50002V12.5C13 12.7762 12.7761 13 12.5 13H5.5C5.22386 13 5 12.7762 5 12.5V5.50002Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"/></svg>
                  Agent ID
                </button>
                <button className="px-3 py-2 text-xs border border-gray-700 rounded-md hover:bg-white hover:text-blue-500 hover:ring-1 hover:ring-blue-500 transition-colors flex items-center gap-2">
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-4 w-4"><path d="M5 7.50003C5 8.32845 4.32843 9.00003 3.5 9.00003C2.67157 9.00003 2 8.32845 2 7.50003C2 6.6716 2.67157 6.00003 3.5 6.00003C4.32843 6.00003 5 6.6716 5 7.50003ZM5.71313 8.66388C5.29445 9.45838 4.46048 10 3.5 10C2.11929 10 1 8.88074 1 7.50003C1 6.11931 2.11929 5.00003 3.5 5.00003C4.46048 5.00003 5.29445 5.54167 5.71313 6.33616L9.10424 4.21671C9.03643 3.98968 9 3.74911 9 3.50003C9 2.11932 10.1193 1.00003 11.5 1.00003C12.8807 1.00003 14 2.11932 14 3.50003C14 4.88074 12.8807 6.00003 11.5 6.00003C10.6915 6.00003 9.97264 5.61624 9.51566 5.0209L5.9853 7.22738C5.99502 7.31692 6 7.40789 6 7.50003C6 7.59216 5.99502 7.68312 5.9853 7.77267L9.51567 9.97915C9.97265 9.38382 10.6915 9.00003 11.5 9.00003C12.8807 9.00003 14 10.1193 14 11.5C14 12.8807 12.8807 14 11.5 14C10.1193 14 9 12.8807 9 11.5C9 11.2509 9.03643 11.0104 9.10425 10.7833L5.71313 8.66388ZM11.5 5.00003C12.3284 5.00003 13 4.32846 13 3.50003C13 2.6716 12.3284 2.00003 11.5 2.00003C10.6716 2.00003 10 2.6716 10 3.50003C10 4.32846 10.6716 5.00003 11.5 5.00003ZM13 11.5C13 12.3285 12.3284 13 11.5 13C10.6716 13 10 12.3285 10 11.5C10 10.6716 10.6716 10 11.5 10C12.3284 10 13 10.6716 13 11.5Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"/></svg>
                  Share
                </button>
              </div>
              {/* Cost Info - moved inside col-span-9 */}
              <div className="grid grid-cols-12 gap-5">
                <div className="col-span-6">
                  <div className="flex items-center gap-1 text-xs text-gray-400 mb-2">
                    <span>Cost per min: <span className="text-white font-semibold">~ $0.104</span></span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-800/40 flex">
                    <div className="h-full rounded-l-full" style={{ width: '14.4%', backgroundColor: 'hsl(217, 91%, 60%)' }} title="Transcriber: $0.015/min" />
                    <div className="h-full" style={{ width: '8.7%', backgroundColor: 'hsl(348, 83%, 47%)' }} title="LLM: $0.009/min" />
                    <div className="h-full" style={{ width: '48.1%', backgroundColor: 'hsl(32, 95%, 55%)' }} title="Voice: $0.05/min" />
                    <div className="h-full" style={{ width: '9.6%', backgroundColor: 'hsl(280, 61%, 60%)' }} title="Telephony: $0.01/min" />
                    <div className="h-full rounded-r-full" style={{ width: '19.2%', backgroundColor: 'hsl(207, 89%, 45%)' }} title="Platform: $0.02/min" />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-500">
                    <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ backgroundColor: 'hsl(217, 91%, 60%)' }} /><span>Transcriber</span></div>
                    <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ backgroundColor: 'hsl(348, 83%, 47%)' }} /><span>LLM</span></div>
                    <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ backgroundColor: 'hsl(32, 95%, 55%)' }} /><span>Voice</span></div>
                    <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ backgroundColor: 'hsl(280, 61%, 60%)' }} /><span>Telephony</span></div>
                    <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ backgroundColor: 'hsl(207, 89%, 45%)' }} /><span>Platform</span></div>
                  </div>
                </div>
                <div className="col-span-6 flex items-center">
                  <span className="inline-flex items-center gap-1 rounded-md border border-green-500 px-2.5 py-0.5 text-xs font-semibold bg-green-50 text-green-700">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                    India Routing
                  </span>
                </div>
              </div>
            </div>
            
            <div className="col-span-3 flex flex-col items-end">
              <div className="flex w-full flex-col rounded-xl border border-[#1e293b] bg-[#020817] px-4 py-3 shadow-sm gap-2">
                  <button className="w-full justify-center px-4 py-2 bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                    <polyline points="22 8 22 2 16 2"/><line x1="16" x2="22" y1="8" y2="2"/>
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                  </svg>
                  Get call from agent
                </button>
                <button className="w-full justify-center px-4 py-2 bg-[#020617] hover:bg-[#020617]/90 text-white text-sm font-medium rounded-lg border border-[#1f2937] transition-colors flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                    <polyline points="16 2 16 8 22 8"/><line x1="22" x2="16" y1="2" y2="8"/>
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                  </svg>
                  Set inbound agent
                </button>
              </div>
              <a href="/calls" className="mt-2 text-[11px] text-blue-300 hover:text-blue-200 hover:underline flex items-center justify-end gap-0.5">
                Purchase phone numbers
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-2 w-2">
                  <path d="M3 2C2.44772 2 2 2.44772 2 3V12C2 12.5523 2.44772 13 3 13H12C12.5523 13 13 12.5523 13 12V8.5C13 8.22386 12.7761 8 12.5 8C12.2239 8 12 8.22386 12 8.5V12H3V3L6.5 3C6.77614 3 7 2.77614 7 2.5C7 2.22386 6.77614 2 6.5 2H3ZM12.8536 2.14645C12.9015 2.19439 12.9377 2.24964 12.9621 2.30861C12.9861 2.36669 12.9996 2.4303 13 2.497L13 2.5V2.50049V5.5C13 5.77614 12.7761 6 12.5 6C12.2239 6 12 5.77614 12 5.5V3.70711L6.85355 8.85355C6.65829 9.04882 6.34171 9.04882 6.14645 8.85355C5.95118 8.65829 5.95118 8.34171 6.14645 8.14645L11.2929 3H9.5C9.22386 3 9 2.77614 9 2.5C9 2.22386 9.22386 2 9.5 2H12.4999H12.5C12.5678 2 12.6324 2.01349 12.6914 2.03794C12.7504 2.06234 12.8056 2.09851 12.8536 2.14645Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"/>
                </svg>
              </a>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6 border-b border-gray-800 bg-[#020817]">
          <div className="flex gap-1 p-1 rounded-lg bg-gray-800/40">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2 flex-grow ${
                  activeTab === tab.id
                    ? 'bg-[#0a0a0f] text-blue-500 shadow'
                    : 'text-gray-400 hover:text-blue-500'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-auto">
          <div className="grid grid-cols-12 gap-6 p-6">
            {/* Left Content */}
            <div className="col-span-8 space-y-6">
              {activeTab === 'agent' ? (
                <div className="space-y-6">
                  <div className="rounded-lg border border-gray-800 bg-[#020817] p-6">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-white tracking-wide">Agent Welcome Message</h3>
                    </div>
                    <div className="space-y-2">
                      <textarea
                        className="w-full rounded-md border border-gray-800 bg-[#020817] px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none min-h-[72px]"
                        defaultValue={`Hello from Bolna\nYou can define variables using {variable_name}`}
                      />
                    </div>
                  </div>

                  <div className="rounded-lg border border-gray-800 bg-[#020817] p-6">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-white tracking-wide">Agent Prompt</h3>
                      <button className="inline-flex items-center gap-1 rounded-md border border-gray-700 px-2 py-1 text-xs font-medium text-gray-200 hover:bg-gray-800">
                        AI Edit
                      </button>
                    </div>
                    <textarea
                      className="w-full rounded-md border border-gray-800 bg-[#020817] px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none min-h-[132px]"
                      defaultValue={
                        'You are a helpful agent. You will help the customer with their queries and doubts. You will never speak more than 2 sentences. Keep your responses concise.'
                      }
                    />
                    <div className="mt-3">
                      <label className="mb-1 block text-xs font-medium text-gray-400">
                        You can fill in your following prompt variables for testing
                      </label>
                      <div className="inline-flex items-center gap-2 rounded-md border border-gray-800 bg-[#020817] px-3 py-1.5 text-xs text-gray-200">
                        <span>Asia/Kolkata</span>
                        <span className="text-gray-500">UTC+05:30</span>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between text-xs">
                      <button className="inline-flex items-center text-blue-400 hover:text-blue-300">
                        Hangup using a prompt
                      </button>
                      <button className="inline-flex items-center text-gray-400 hover:text-gray-300">
                        View Docs
                      </button>
                    </div>
                  </div>
                </div>
              ) : activeTab === 'audio' ? (
                <div className="space-y-6">
                  {/* Configure Language */}
                  <div className="rounded-lg border border-gray-800 bg-[#020817] p-6">
                    <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-500/10 text-blue-400 text-xs">
                        🗣
                      </span>
                      Configure Language
                    </h3>
                    <div className="space-y-2">
                      <label className="block text-sm text-gray-400">Language</label>
                      <select className="w-64 px-3 py-2 bg-[#020817] border border-gray-800 rounded-md text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500">
                        <option>Hindi</option>
                        <option>English</option>
                        <option>Spanish</option>
                      </select>
                    </div>
                  </div>

                  {/* Speech-to-Text */}
                  <div className="rounded-lg border border-gray-800 bg-[#020817] p-6">
                    <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-500/10 text-blue-400 text-xs">
                        🎙
                      </span>
                      Speech-to-Text
                    </h3>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">Provider</label>
                        <select className="w-full px-3 py-2 bg-[#020817] border border-gray-800 rounded-md text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500">
                          <option>Deepgram</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">Model</label>
                        <select className="w-full px-3 py-2 bg-[#020817] border border-gray-800 rounded-md text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500">
                          <option>nova-3</option>
                        </select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm text-gray-400">
                        Keywords <span className="text-gray-500 text-xs">i</span>
                      </label>
                      <input
                        type="text"
                        defaultValue="Bruce:100"
                        className="w-full px-3 py-2 bg-[#020817] border border-gray-800 rounded-md text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  {/* Text-to-Speech */}
                  <div className="rounded-lg border border-gray-800 bg-[#020817] p-6 space-y-4">
                    <h3 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-500/10 text-blue-400 text-xs">
                        🔊
                      </span>
                      Text-to-Speech
                    </h3>

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">Provider</label>
                        <select className="w-full px-3 py-2 bg-[#020817] border border-gray-800 rounded-md text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500">
                          <option>Elevenlabs</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">Model</label>
                        <select className="w-full px-3 py-2 bg-[#020817] border border-gray-800 rounded-md text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500">
                          <option>eleven_turbo_v2_5</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">Voice</label>
                        <div className="flex gap-2">
                          <button className="flex-1 px-3 py-2 bg-[#020817] border border-gray-800 rounded-md text-white text-sm text-left">
                            Raju - Human-like Customer
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6 mt-4">
                      <div className="space-y-4">
                        {/* Buffer Size */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-white">Buffer Size</span>
                            <span className="text-xs text-gray-300 px-2 py-1 rounded-md border border-gray-700 bg-[#020817]">
                              230
                            </span>
                          </div>
                          <div className="relative flex w-full items-center">
                            <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-blue-500/20">
                              <div className="absolute h-full bg-blue-500 w-1/2" />
                            </div>
                            <div className="absolute inset-0">
                              <input
                                type="range"
                                min={50}
                                max={500}
                                defaultValue={230}
                                className="w-full h-4 bg-transparent appearance-none cursor-pointer accent-blue-500"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Similarity Boost */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-white">Similarity Boost</span>
                            <span className="text-xs text-gray-300 px-2 py-1 rounded-md border border-gray-700 bg-[#020817]">
                              0.75
                            </span>
                          </div>
                          <div className="relative flex w-full items-center">
                            <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-blue-500/20">
                              <div className="absolute h-full bg-blue-500 w-3/4" />
                            </div>
                            <div className="absolute inset-0">
                              <input
                                type="range"
                                min={0}
                                max={1}
                                step={0.01}
                                defaultValue={0.75}
                                className="w-full h-4 bg-transparent appearance-none cursor-pointer accent-blue-500"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Style Exaggeration */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-white">Style Exaggeration</span>
                            <span className="text-xs text-gray-300 px-2 py-1 rounded-md border border-gray-700 bg-[#020817]">
                              0
                            </span>
                          </div>
                          <div className="relative flex w-full items-center">
                            <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-blue-500/20">
                              <div className="absolute h-full bg-blue-500 w-0" />
                            </div>
                            <div className="absolute inset-0">
                              <input
                                type="range"
                                min={0}
                                max={5}
                                defaultValue={0}
                                className="w-full h-4 bg-transparent appearance-none cursor-pointer accent-blue-500"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        {/* Speed rate */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-white">Speed rate</span>
                            <span className="text-xs text-gray-300 px-2 py-1 rounded-md border border-gray-700 bg-[#020817]">
                              1
                            </span>
                          </div>
                          <div className="relative flex w-full items-center">
                            <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-blue-500/20">
                              <div className="absolute h-full bg-blue-500 w-1/2" />
                            </div>
                            <div className="absolute inset-0">
                              <input
                                type="range"
                                min={0.5}
                                max={2}
                                step={0.05}
                                defaultValue={1}
                                className="w-full h-4 bg-transparent appearance-none cursor-pointer accent-blue-500"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Stability */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-white">Stability</span>
                            <span className="text-xs text-gray-300 px-2 py-1 rounded-md border border-gray-700 bg-[#020817]">
                              0.5
                            </span>
                          </div>
                          <div className="relative flex w-full items-center">
                            <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-blue-500/20">
                              <div className="absolute h-full bg-blue-500 w-1/2" />
                            </div>
                            <div className="absolute inset-0">
                              <input
                                type="range"
                                min={0}
                                max={1}
                                step={0.01}
                                defaultValue={0.5}
                                className="w-full h-4 bg-transparent appearance-none cursor-pointer accent-blue-500"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : activeTab === 'call' ? (
                <div className="space-y-6">
                  {/* Call Configuration */}
                  <div className="rounded-lg border border-gray-800 bg-[#020817] p-6 space-y-4">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-500/10 text-blue-400 text-xs">
                        ☎
                      </span>
                      Call Configuration
                    </h3>
                    <div className="space-y-2">
                      <label className="block text-sm text-gray-400">Telephony Provider</label>
                      <select className="w-64 px-3 py-2 bg-[#020817] border border-gray-800 rounded-md text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500">
                        <option>Twilio</option>
                      </select>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-6 text-sm text-white">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-2 text-gray-200">
                            <span className="text-base">🌀</span>
                            Noise Cancellation
                          </span>
                          <button className="relative inline-flex h-5 w-9 items-center rounded-full border border-gray-700 bg-[#020817]">
                            <span className="inline-block h-4 w-4 translate-x-0 rounded-full bg-gray-500 transition-transform" />
                          </button>
                        </div>
                        <div className="flex items-center justify-between text-gray-500">
                          <span className="flex items-center gap-2">
                            <span className="text-base">⌨</span>
                            Keypad Input (DTMF)
                          </span>
                          <button className="relative inline-flex h-5 w-9 items-center rounded-full border border-gray-700 bg-[#020817] opacity-60 cursor-not-allowed">
                            <span className="inline-block h-4 w-4 translate-x-0 rounded-full bg-gray-500 transition-transform" />
                          </button>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-2 text-gray-200">
                            <span className="text-base">🔗</span>
                            Voicemail Detection
                          </span>
                          <button className="relative inline-flex h-5 w-9 items-center rounded-full border border-gray-700 bg-[#020817]">
                            <span className="inline-block h-4 w-4 translate-x-0 rounded-full bg-gray-500 transition-transform" />
                          </button>
                        </div>
                        <div className="flex items-center justify-between text-gray-200">
                          <span className="flex items-center gap-2">
                            <span className="text-base">⏱</span>
                            Auto Reschedule
                          </span>
                          <button className="relative inline-flex h-5 w-9 items-center rounded-full border border-gray-700 bg-[#020817]">
                            <span className="inline-block h-4 w-4 translate-x-0 rounded-full bg-gray-500 transition-transform" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Outbound call timing restrictions */}
                  <div className="rounded-lg border border-gray-800 bg-[#020817] p-4 flex items-center justify-between text-sm text-gray-200">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🛡</span>
                      <span>Outbound call timing restrictions</span>
                      <span className="text-xs text-gray-500">i</span>
                    </div>
                    <button className="relative inline-flex h-5 w-9 items-center rounded-full border border-gray-700 bg-[#020817]">
                      <span className="inline-block h-4 w-4 translate-x-0 rounded-full bg-gray-500 transition-transform" />
                    </button>
                  </div>

                  {/* Final Call Message */}
                  <div className="rounded-lg border border-gray-800 bg-[#020817] p-6 space-y-4">
                    <div className="flex items-center justify-between text-sm text-white">
                      <div className="flex items-center gap-2">
                        <span className="text-base">💬</span>
                        <span>Final Call Message</span>
                        <span className="text-xs text-gray-500">i</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button className="px-3 py-1.5 rounded-md bg-blue-600 text-xs font-medium text-white">
                        English
                      </button>
                      <button className="px-3 py-1.5 rounded-md border border-gray-700 text-xs font-medium text-white hover:bg-gray-800">
                        + Add
                      </button>
                    </div>

                    <div className="relative">
                      <textarea
                        className="w-full rounded-md border border-gray-800 bg-[#020817] px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 min-h-[96px]"
                        placeholder="e.g. Thank you for your time. Goodbye!"
                      />
                      <span className="absolute bottom-2 right-3 text-xs text-gray-500">0 chars</span>
                    </div>
                  </div>

                  {/* Call Management */}
                  <div className="rounded-lg border border-gray-800 bg-[#020817] p-6 space-y-4">
                    <div className="flex items-center justify-between text-sm text-white">
                      <div className="flex items-center gap-2">
                        <span className="text-base">📞</span>
                        <span>Call Management</span>
                        <span className="text-xs text-gray-500">i</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6 mt-2">
                      {/* Hangup on User Silence */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm text-gray-200">
                          <span>Hangup on User Silence</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex-1 relative flex w-full items-center">
                            <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-blue-500/20">
                              <div className="absolute h-full bg-blue-500 w-1/3" />
                            </div>
                            <div className="absolute inset-0">
                              <input
                                type="range"
                                min={0}
                                max={60}
                                defaultValue={12}
                                className="w-full h-4 bg-transparent appearance-none cursor-pointer accent-blue-500"
                              />
                            </div>
                          </div>
                          <span className="px-2 py-1 rounded-md border border-gray-700 bg-[#020817] text-xs text-gray-200">
                            12 s
                          </span>
                        </div>
                      </div>

                      {/* Total Call Timeout */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm text-gray-200">
                          <span>Total Call Timeout</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex-1 relative flex w-full items-center">
                            <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-blue-500/20">
                              <div className="absolute h-full bg-blue-500 w-2/3" />
                            </div>
                            <div className="absolute inset-0">
                              <input
                                type="range"
                                min={60}
                                max={900}
                                defaultValue={390}
                                className="w-full h-4 bg-transparent appearance-none cursor-pointer accent-blue-500"
                              />
                            </div>
                          </div>
                          <span className="px-2 py-1 rounded-md border border-gray-700 bg-[#020817] text-xs text-gray-200">
                            390 s
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* Choose LLM Model */}
                  <div className="rounded-lg border border-gray-800 bg-[#020817] p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Choose LLM model</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">Provider</label>
                        <select
                          value={provider}
                          onChange={(e) => setProvider(e.target.value)}
                          className="w-full px-3 py-2 bg-[#020817] border border-gray-800 rounded-md text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="Azure">Azure</option>
                          <option value="OpenAI">OpenAI</option>
                          <option value="Anthropic">Anthropic</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">Model</label>
                        <select
                          value={model}
                          onChange={(e) => setModel(e.target.value)}
                          className="w-full px-3 py-2 bg-[#020817] border border-gray-800 rounded-md text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="gpt-4.1-mini-cluster">gpt-4.1-mini cluster</option>
                          <option value="gpt-4-turbo">gpt-4-turbo</option>
                          <option value="gpt-3.5-turbo">gpt-3.5-turbo</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Model Parameters */}
                  <div className="rounded-lg border border-gray-800 bg-[#020817] p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Model Parameters</h3>
                    
                    {/* Tokens & Temperature side by side */}
                    <div className="mb-6 grid grid-cols-2 gap-4">
                      {/* Tokens Generated */}
                      <div className="rounded-md border border-gray-800 bg-[#020817] px-4 py-3">
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <h4 className="text-sm font-medium leading-none text-white">
                              Tokens generated on each LLM output
                            </h4>
                          </div>
                          <div className="shrink-0 flex items-center gap-1.5">
                            <input
                              type="number"
                              min={1}
                              max={4096}
                              step={1}
                              value={tokens}
                              onChange={(e) =>
                                setTokens(Math.min(4096, Math.max(1, parseInt(e.target.value) || 1)))
                              }
                              className="flex h-9 min-w-[6.5ch] rounded-md border border-gray-700 bg-transparent px-2 py-1 text-sm text-right text-white tabular-nums shadow-sm transition-colors placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              style={{ width: "4.5ch" }}
                            />
                          </div>
                        </div>
                        <div className="mt-2 relative flex w-full items-center">
                          <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-blue-500/20">
                            <div
                              className="absolute h-full bg-blue-500"
                              style={{
                                left: "0%",
                                right: `${100 - (tokens / 4096) * 100}%`,
                              }}
                            />
                          </div>
                          <div className="absolute inset-0">
                            <input
                              type="range"
                              min={1}
                              max={4096}
                              value={tokens}
                              onChange={(e) => setTokens(parseInt(e.target.value))}
                              className="w-full h-4 bg-transparent appearance-none cursor-pointer accent-blue-500"
                            />
                          </div>
                        </div>
                        <p className="mt-1 text-xs text-gray-500">
                          Increasing tokens enables longer responses to be queued for speech generation but increases latency
                        </p>
                      </div>

                      {/* Temperature */}
                      <div className="rounded-md border border-gray-800 bg-[#020817] px-4 py-3">
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <h4 className="text-sm font-medium leading-none text-white">Temperature</h4>
                          </div>
                          <div className="shrink-0 flex items-center gap-1.5">
                            <input
                              type="number"
                              min={0.01}
                              max={1}
                              step={0.01}
                              value={temperature}
                              onChange={(e) =>
                                setTemperature(
                                  Math.min(1, Math.max(0.01, parseFloat(e.target.value) || 0.5)),
                                )
                              }
                              className="flex h-9 min-w-[6.5ch] rounded-md border border-gray-700 bg-transparent px-2 py-1 text-sm text-right text-white tabular-nums shadow-sm transition-colors placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              style={{ width: "4.5ch" }}
                            />
                          </div>
                        </div>
                        <div className="mt-2 relative flex w-full items-center">
                          <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-blue-500/20">
                            <div
                              className="absolute h-full bg-blue-500"
                              style={{
                                left: "0%",
                                right: `${100 - temperature * 100}%`,
                              }}
                            />
                          </div>
                          <div className="absolute inset-0">
                            <input
                              type="range"
                              min={0.01}
                              max={1}
                              step={0.01}
                              value={temperature}
                              onChange={(e) => setTemperature(parseFloat(e.target.value))}
                              className="w-full h-4 bg-transparent appearance-none cursor-pointer accent-blue-500"
                            />
                          </div>
                        </div>
                        <p className="mt-1 text-xs text-gray-500">
                          Increasing temperature enables heightened creativity, but increases chance of deviation from prompt.
                        </p>
                      </div>
                    </div>

                    {/* Knowledge Base */}
                    <div>
                      <label className="block text-sm font-medium text-white mb-2">
                        Add knowledge base (Multi-select)
                      </label>
                      <button className="w-full px-4 py-2 flex items-center justify-between rounded-md border border-gray-700 bg-[#020817] text-gray-400 text-sm hover:bg-[#0f172a] transition-colors">
                        <span>Select knowledge bases</span>
                        <svg
                          width="15"
                          height="15"
                          viewBox="0 0 15 15"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4 opacity-50"
                        >
                          <path
                            d="M4.18179 6.18181C4.35753 6.00608 4.64245 6.00608 4.81819 6.18181L7.49999 8.86362L10.1818 6.18181C10.3575 6.00608 10.6424 6.00608 10.8182 6.18181C10.9939 6.35755 10.9939 6.64247 10.8182 6.81821L7.81819 9.81821C7.73379 9.9026 7.61934 9.95001 7.49999 9.95001C7.38064 9.95001 7.26618 9.9026 7.18179 9.81821L4.18179 6.81821C4.00605 6.64247 4.00605 6.35755 4.18179 6.18181Z"
                            fill="currentColor"
                            fillRule="evenodd"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Right Sidebar - Actions */}
            <div className="col-span-4 flex flex-col gap-5 p-3 rounded-lg border border-gray-700">
              <a href="/calls" className="w-full">
                <button className="w-full px-4 py-2 border border-gray-700 rounded-md text-sm font-medium hover:bg-gray-800 hover:text-blue-400 hover:ring-1 hover:ring-blue-500 transition-colors flex items-center justify-center gap-1">
                  See all call logs
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                    <path d="M7 7h10v10"/><path d="M7 17 17 7"/>
                  </svg>
                </button>
              </a>

              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-9">
                  <button className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                      <path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/>
                      <path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/>
                      <path d="M7 3v4a1 1 0 0 0 1 1h7"/>
                    </svg>
                    Save agent
                  </button>
                  <p className="mt-1 text-xs text-gray-500 italic flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3">
                      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>
                    </svg>
                    Updated 7 minutes ago
                  </p>
                </div>
                <div className="col-span-3 flex justify-end">
                  <button className="h-9 w-9 flex items-center justify-center rounded-md border border-gray-700 hover:bg-red-500/10 hover:border-red-500 hover:text-red-500 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                      <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                      <line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>
                    </svg>
                  </button>
                </div>
              </div>

              <div className="shrink-0 h-px w-full bg-gray-800" />

              <div className="flex flex-col gap-2">
                <button className="w-full px-4 py-2 bg-gray-800 hover:bg-gray-700 text-blue-400 font-medium rounded-lg transition-colors flex items-center justify-center gap-2 border border-gray-700">
                  Chat with agent
                </button>
                <p className="text-xs text-gray-500 text-center flex items-center justify-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3">
                    <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/>
                    <path d="M9 18h6"/><path d="M10 22h4"/>
                  </svg>
                  Chat is the fastest way to test and refine.
                </p>
              </div>

              <div className="shrink-0 h-px w-full bg-gray-800" />

              <div className="flex flex-col gap-2">
                <button className="w-full px-4 py-2 bg-blue-600 text-white font-medium rounded-lg text-center border border-gray-700">
                  Connecting...
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showNewAgentModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60">
          <div className="relative max-h-screen w-full max-w-3xl overflow-y-auto rounded-2xl border border-gray-800 bg-[#020817] shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-800 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Select your use case and let AI build your agent
                </h2>
                <p className="mt-1 text-sm text-gray-400">
                  You can always modify &amp; edit it later.
                </p>
              </div>
              <button
                className="h-8 w-8 inline-flex items-center justify-center rounded-full border border-gray-700 text-gray-400 hover:text-white hover:bg-gray-800"
                onClick={() => setShowNewAgentModal(false)}
              >
                ×
              </button>
            </div>

            <div className="px-6 pt-4 pb-2 border-b border-gray-800 flex gap-3">
              <button className="flex-1 rounded-lg border border-blue-500 bg-blue-600 px-4 py-2 text-sm font-semibold text-white text-center">
                Auto Build Agent
              </button>
              <button className="flex-1 rounded-lg border border-gray-700 bg-[#020817] px-4 py-2 text-sm font-semibold text-white text-center hover:bg-gray-900">
                Pre built Agents
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto px-6 py-4 space-y-4 text-sm">
              <p className="text-gray-400">
                Tell us about your ideal agent and we&apos;ll help you build it step by step.
              </p>

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-300">
                  Name of Agent <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Enter agent name"
                  className="w-full rounded-md border border-gray-800 bg-[#020817] px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-300">
                  Languages <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-3">
                  <label className="inline-flex items-center gap-2 text-sm text-gray-200">
                    <input type="checkbox" defaultChecked className="h-4 w-4 rounded border-gray-700 bg-[#020817]" />
                    English
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm text-gray-200">
                    <input type="checkbox" className="h-4 w-4 rounded border-gray-700 bg-[#020817]" />
                    Hindi
                  </label>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-300">
                  What do you want to achieve in this call? <span className="text-red-500">*</span>
                </label>
                <textarea
                  className="w-full rounded-md border border-gray-800 bg-[#020817] px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 min-h-[72px]"
                  placeholder="Be descriptive as you would to a human who you are asking to lead the call..."
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-300">
                  Ideal Next Steps after this call <span className="text-red-500">*</span>
                </label>
                <textarea
                  className="w-full rounded-md border border-gray-800 bg-[#020817] px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 min-h-[72px]"
                  placeholder="Describe what should happen after the call is completed..."
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-300">
                  FAQs / Business Documents / Any information
                </label>
                <textarea
                  className="w-full rounded-md border border-gray-800 bg-[#020817] px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 min-h-[72px]"
                  placeholder="Add any relevant FAQs, business documents, or additional information..."
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-300">Sample Transcript</label>
                <textarea
                  className="w-full rounded-md border border-gray-800 bg-[#020817] px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 min-h-[72px]"
                  placeholder="Provide a sample conversation transcript to help guide the agent..."
                />
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-gray-800 px-6 py-4">
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span>Or</span>
                <button className="underline underline-offset-2 hover:text-gray-200">
                  I want to create an agent from scratch
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  className="px-4 py-2 rounded-md border border-gray-700 text-sm text-gray-200 hover:bg-gray-800"
                  onClick={() => setShowNewAgentModal(false)}
                >
                  Cancel
                </button>
                <button className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-sm font-semibold text-white">
                  Generate Agent
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
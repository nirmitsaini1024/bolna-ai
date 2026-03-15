# Dashboard Visual Guide

## Color Scheme

**Primary Gradient**: Purple (#8B5CF6) to Pink (#EC4899)
**Background**: Dark gradient from Slate-900 via Purple-900 to Slate-900
**Accent Colors**:
- Blue: #3B82F6 to Cyan #06B6D4
- Green: #10B981 to Emerald #059669
- Yellow: #F59E0B
- Red: #EF4444

## Page Previews

### 1. Main Dashboard (/)

**Layout**:
```
┌─────────────────────────────────────────────────────┐
│ [B] Bolna Dashboard        [Calls][Analytics][Logs] │
├─────────────────────────────────────────────────────┤
│                                                      │
│  System Overview                                     │
│  Real-time monitoring of your Voice AI Platform     │
│                                                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│  │ Status   │ │ Uptime   │ │ Active   │ │ Active   │
│  │ ● Healthy│ │ 2h 15m   │ │ Conns: 5 │ │ Sess: 5  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘
│                                                      │
│  ┌─────────────────────┐  ┌────────────────────────┐
│  │ Features            │  │ Quick Actions          │
│  │ ✓ Voice Gateway     │  │ [Test Call]           │
│  │ ✓ Deepgram STT      │  │ [View Logs]           │
│  │ ✓ OpenRouter LLM    │  │ [Configuration]       │
│  │ ✓ Deepgram TTS      │  │                        │
│  │ ✓ Barge-In Support  │  │                        │
│  └─────────────────────┘  └────────────────────────┘
│                                                      │
│  System Architecture                                 │
│  [Caller] → [Twilio] → [Gateway] → [STT] → [LLM] →  │
│  [TTS] → [Response]                                  │
└─────────────────────────────────────────────────────┘
```

**Visual Elements**:
- Gradient background (slate-900 → purple-900 → slate-900)
- Glass-morphism cards (white/5 with backdrop blur)
- Status indicators with colored dots
- Gradient buttons (purple → pink)
- SVG icons for each metric

### 2. Call History (/calls)

**Layout**:
```
┌─────────────────────────────────────────────────────┐
│ [B] Call History      [Dashboard][Analytics][Logs]  │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Call Records                          [Export CSV] │
│  View and manage all voice call sessions            │
│                                                      │
│  ┌──────────────────────────────────────────────────┐
│  │ Call SID    │From      │To       │Status │Time  │
│  ├──────────────────────────────────────────────────┤
│  │ CA123...    │+1234...  │+1213... │●Comp  │12:30│
│  │ CA987...    │+9876...  │+1213... │●Comp  │11:15│
│  │ CA456...    │+1122...  │+1213... │●Prog  │13:45│
│  └──────────────────────────────────────────────────┘
│                                                      │
│  ┌─────────────┐ ┌──────────────┐ ┌────────────────┐
│  │ Total Calls │ │ Avg Duration │ │ Success Rate   │
│  │     47      │ │    7:23      │ │      98%       │
│  │ ↑ 12%       │ │ Typical      │ │ Excellent      │
│  └─────────────┘ └──────────────┘ └────────────────┘
└─────────────────────────────────────────────────────┘
```

**Visual Elements**:
- Table with hover effects
- Status badges (green, blue, red)
- Monospace font for Call SIDs
- Statistics cards at bottom
- Responsive table layout

### 3. Analytics (/analytics)

**Layout**:
```
┌─────────────────────────────────────────────────────┐
│ [B] Analytics         [Dashboard][Calls][Logs]      │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Performance Analytics                               │
│  Detailed insights into system performance           │
│                                                      │
│  ┌──────┐ ┌─────────┐ ┌──────────┐ ┌──────────────┐
│  │Calls │ │Response │ │Barge-In  │ │Success Rate  │
│  │  47  │ │  2.4s   │ │   23     │ │    98.5%     │
│  │ +8%  │ │  -12%   │ │   +5%    │ │    +2%       │
│  └──────┘ └─────────┘ └──────────┘ └──────────────┘
│                                                      │
│  ┌─────────────────────┐  ┌────────────────────────┐
│  │ Calls by Hour       │  │ Performance Metrics    │
│  │ [Bar Chart]         │  │ STT Latency:    850ms ●│
│  │ 00:00 ████ 5        │  │ LLM Response:  1.2s  ●│
│  │ 03:00 ██ 2          │  │ TTS Generation: 600ms●│
│  │ 06:00 ████████ 8    │  │ End-to-End:    2.4s  ●│
│  │ ...                 │  │                        │
│  └─────────────────────┘  └────────────────────────┘
│                                                      │
│  ┌──────────┐ ┌────────────────┐ ┌─────────────────┐
│  │API Usage │ │Call Distrib.   │ │Top Features     │
│  │ ████ 87% │ │ ████████ 85%   │ │ Barge-In: 234   │
│  │ ███  72% │ │ ██ 10%         │ │ Gateway:  567   │
│  │ ██   65% │ │ █  5%          │ │ AI Resp:  1234  │
│  └──────────┘ └────────────────┘ └─────────────────┘
└─────────────────────────────────────────────────────┘
```

**Visual Elements**:
- Horizontal bar charts
- Performance status badges
- Progress bars for API usage
- Gradient fills for metrics
- Multi-color distribution bars

### 4. Logs Viewer (/logs)

**Layout**:
```
┌─────────────────────────────────────────────────────┐
│ [B] System Logs    [Dashboard][Calls][Analytics]    │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Real-time Logs                    [✓Auto][Export]  │
│  Monitor system events and debug information         │
│                                                      │
│  [ALL] [INFO] [DEBUG] [WARN] [ERROR]                │
│                                                      │
│  ┌──────────────────────────────────────────────────┐
│  │ 12:30:45 [INFO] [VoiceGateway] New connection   │
│  │   { connectionId: "uuid-123", active: 1 }       │
│  │                                                  │
│  │ 12:30:40 [DEBUG] [StreamHandler] Audio chunk    │
│  │   { callSid: "CA123", track: "inbound" }        │
│  │                                                  │
│  │ 12:30:35 [INFO] [TRANSCRIPT] User speech        │
│  │   { text: "Hello, how are you?", final: true }  │
│  │                                                  │
│  │ 12:30:30 [WARN] [BARGE_IN] User interrupted     │
│  │   { callSid: "CA123", reason: "speech" }        │
│  │                                                  │
│  │ 12:30:25 [ERROR] [DeepgramSTT] Connection error │
│  │   { error: "WebSocket timeout", retry: true }   │
│  └──────────────────────────────────────────────────┘
│                                                      │
│  ┌──────────────┐ ┌────────────┐ ┌─────────────────┐
│  │ Total Events │ │   Errors   │ │   Warnings      │
│  │     156      │ │     3      │ │       8         │
│  └──────────────┘ └────────────┘ └─────────────────┘
└─────────────────────────────────────────────────────┘
```

**Visual Elements**:
- Terminal-style log display
- Monospace font (Geist Mono)
- Color-coded log levels (blue, gray, yellow, red)
- Collapsible JSON data
- Auto-scroll indicator
- Dark background for log area

### 5. Configuration (/config)

**Layout**:
```
┌─────────────────────────────────────────────────────┐
│ [B] Configuration    [Dashboard][Calls][Analytics]  │
├─────────────────────────────────────────────────────┤
│                                                      │
│  System Configuration                                │
│  Manage API keys and environment settings            │
│                                                      │
│  ⚠️ Security Warning                                 │
│  Keep your API keys secure. Never share publicly.    │
│                                                      │
│  ┌──────────────────────────────────────────────────┐
│  │ Twilio Account SID                        [Edit]│
│  │ Your Twilio account identifier                  │
│  │ [TWILIO_ACCOUNT_SID]                            │
│  └──────────────────────────────────────────────────┘
│                                                      │
│  ┌──────────────────────────────────────────────────┐
│  │ Deepgram API Key                          [Edit]│
│  │ API key for STT and TTS                    [👁️] │
│  │ [••••••••••••••••]                              │
│  └──────────────────────────────────────────────────┘
│                                                      │
│  ┌─────────────────────┐  ┌────────────────────────┐
│  │ Quick Actions       │  │ System Info            │
│  │ [Test Twilio]       │  │ Node: v20.19.37        │
│  │ [Test Deepgram]     │  │ Platform: linux x64    │
│  │ [Test OpenRouter]   │  │ Database: ● Connected  │
│  └─────────────────────┘  └────────────────────────┘
│                                                      │
│                   [Reset] [Save All Changes]         │
└─────────────────────────────────────────────────────┘
```

**Visual Elements**:
- Expandable configuration cards
- Show/hide toggle for passwords
- Yellow warning banner
- Edit mode with input fields
- Action buttons with gradients
- System info panel

## Common UI Elements

### Navigation Bar
- Logo: Gradient purple-pink circle with "B"
- Title: White bold text
- Links: White/10 background, hover white/20
- Consistent across all pages

### Card Style
- Border: white/10
- Background: white/5 with backdrop blur
- Rounded corners: xl (0.75rem)
- Padding: 6 (1.5rem)

### Buttons
- Primary: Gradient purple-500 to pink-500
- Secondary: white/10 with hover white/20
- Action: Gradient variations (blue, green)

### Status Indicators
- Healthy/Success: Green-400
- In-Progress: Blue-400
- Warning: Yellow-400
- Error: Red-400

### Typography
- Headings: Bold, white
- Body: Gray-300/400
- Code: Monospace (Geist Mono), white
- Links: Hover effect with color change

## Responsive Behavior

### Desktop (1280px+)
- 4-column grid for metrics
- 2-column grid for larger cards
- Full navigation visible

### Tablet (768px - 1279px)
- 2-column grid for metrics
- Single column for larger cards
- Compact navigation

### Mobile (< 768px)
- Single column layout
- Stacked cards
- Hamburger menu (if implemented)
- Horizontal scroll for tables

## Animation & Interactions

- **Hover Effects**: Cards brighten on hover
- **Loading**: Spinning circle (purple gradient border)
- **Transitions**: All state changes animated (200ms)
- **Backdrop Blur**: Glass-morphism effect
- **Button Clicks**: Slight scale effect (optional)

## Accessibility

- Color contrast ratios meet WCAG AA
- Focus states visible
- Semantic HTML structure
- ARIA labels where needed
- Keyboard navigation support

---

This dashboard provides a professional, modern interface for monitoring and managing the Bolna Voice AI Platform with a cohesive design language across all pages.

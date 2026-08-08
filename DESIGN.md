# Design Specification Document

**Product:** TeamOS (Nexus)
**Version:** 1.0
**Date:** August 2026
**Author:** Shivam
**Status:** Draft

---

## Table of Contents

1. [Design Philosophy](#1-design-philosophy)
2. [Design System](#2-design-system)
3. [Layout & Navigation](#3-layout--navigation)
4. [Screen Specifications](#4-screen-specifications)
5. [Component Library](#5-component-library)
6. [Responsive Design](#6-responsive-design)
7. [Accessibility](#7-accessibility)
8. [Motion & Animation](#8-motion--animation)
9. [Dark Mode](#9-dark-mode)
10. [Figma File Structure](#10-figma-file-structure)

---

## 1. Design Philosophy

### Core Principles

**1. Clarity over cleverness**
Every UI element should have an obvious purpose. No hidden menus or mystery icons. If a user needs a tooltip to understand something, the design has failed.

**2. Density with breathing room**
Productivity apps need information density. But cramming everything together creates anxiety. TeamOS aims for the density of Linear with the calm of Notion.

**3. Context-aware navigation**
The sidebar should reflect where you are. Inside a project → show project views. Inside a channel → show channel tools. No global navigation that forgets your context.

**4. Speed as a feature**
Optimistic UI updates everywhere. Messages appear instantly, tasks update without spinners, documents save silently. The app should feel instant.

**5. One notification, many surfaces**
A task being assigned shouldn't bombard you with 5 different alerts. One clean notification, surfaced in the right place at the right time.

---

## 2. Design System

### 2.1 Color Palette

#### Brand Colors
```
Primary:     #6366F1  (Indigo 500)  — buttons, links, active states
Primary Dark: #4F46E5  (Indigo 600)  — hover state
Primary Light: #EEF2FF  (Indigo 50)  — backgrounds, pills
```

#### Semantic Colors
```
Success:   #22C55E  (Green 500)
Warning:   #F59E0B  (Amber 500)
Danger:    #EF4444  (Red 500)
Info:      #3B82F6  (Blue 500)
```

#### Neutral Scale (Light Mode)
```
neutral-50:  #FAFAFA  — page background
neutral-100: #F4F4F5  — sidebar background
neutral-200: #E4E4E7  — borders, dividers
neutral-300: #D4D4D8  — disabled elements
neutral-400: #A1A1AA  — placeholder text
neutral-500: #71717A  — secondary text
neutral-600: #52525B  — body text
neutral-700: #3F3F46  — headings
neutral-800: #27272A  — strong headings
neutral-900: #18181B  — near black
```

#### Neutral Scale (Dark Mode)
```
bg-primary:   #0F0F10  — main background
bg-secondary: #18181B  — sidebar background
bg-elevated:  #1F1F23  — cards, panels
bg-hover:     #27272A  — hover states
border:       #2D2D31  — all borders
text-primary: #FAFAFA  — headings
text-secondary: #A1A1AA — body, secondary
text-muted:   #52525B  — captions, timestamps
```

#### Priority Colors (for tasks)
```
Critical: #EF4444  (Red)
High:     #F97316  (Orange)
Medium:   #F59E0B  (Amber)
Low:      #6366F1  (Indigo)
```

#### Status Colors (for tasks)
```
To Do:       #A1A1AA  (Gray)
In Progress: #3B82F6  (Blue)
Review:      #8B5CF6  (Purple)
Done:        #22C55E  (Green)
Blocked:     #EF4444  (Red)
```

---

### 2.2 Typography

**Font Family:** Inter (Google Fonts)
- Fallback: -apple-system, BlinkMacSystemFont, sans-serif
- Monospace (code blocks): JetBrains Mono

**Type Scale:**
```
Display:    36px / 700 weight / -0.02em tracking  — onboarding hero
Heading 1:  24px / 700 weight / -0.01em tracking  — page titles
Heading 2:  20px / 600 weight / -0.01em tracking  — section headers
Heading 3:  16px / 600 weight / 0em tracking      — card titles, subheads
Body Large: 16px / 400 weight / 0em tracking      — primary readable text
Body:       14px / 400 weight / 0em tracking      — default UI text
Body Small: 13px / 400 weight / 0em tracking      — metadata, captions
Caption:    12px / 400 weight / 0.01em tracking   — timestamps, labels
Code:       13px / 400 weight / JetBrains Mono    — code blocks
```

**Line Heights:**
```
Headings:  1.25
Body:      1.5
Code:      1.6
```

---

### 2.3 Spacing System

Base unit: 4px

```
space-0:  0px
space-1:  4px
space-2:  8px
space-3:  12px
space-4:  16px
space-5:  20px
space-6:  24px
space-8:  32px
space-10: 40px
space-12: 48px
space-16: 64px
space-20: 80px
```

---

### 2.4 Border Radius
```
radius-sm:  4px   — buttons, inputs, badges
radius-md:  8px   — cards, dropdowns, modals
radius-lg:  12px  — large panels, sidebars
radius-xl:  16px  — sheets, feature cards
radius-full: 9999px — pills, avatars
```

---

### 2.5 Shadows
```
shadow-sm:  0 1px 2px rgba(0,0,0,0.08)                           — subtle lift
shadow-md:  0 4px 6px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.06)  — cards
shadow-lg:  0 10px 15px rgba(0,0,0,0.1), 0 4px 6px rgba(0,0,0,0.05) — dropdowns
shadow-xl:  0 20px 25px rgba(0,0,0,0.1), 0 8px 10px rgba(0,0,0,0.04) — modals
```

---

### 2.6 Iconography

**Icon Library:** Lucide React (consistent with shadcn/ui)
- Default size: 16px for inline, 20px for nav items, 24px for featured
- Stroke width: 1.5px (Lucide default)
- Color: inherit from text color

---

## 3. Layout & Navigation

### 3.1 Overall Shell

```
┌────────────────────────────────────────────────────────────────┐
│  App Bar (48px)                                                │
│  [Logo] [Org Switcher ▾]         [Search] [Notif] [Avatar]    │
├──────────┬─────────────────────────────────────────────────────┤
│          │                                                      │
│  Side-   │   Main Content Area                                 │
│  bar     │                                                      │
│  (240px) │                                                      │
│          │                                                      │
│          │                                                      │
│          │                                                      │
│          │                                                      │
└──────────┴─────────────────────────────────────────────────────┘
```

### 3.2 App Bar (48px height)

Left:
- TeamOS logo (24px) + wordmark
- Organization switcher dropdown (shows org name + chevron)

Center:
- Global search bar (Cmd+K shortcut) — searches everything (messages, docs, tasks, files)

Right:
- Help icon
- Notification bell (with unread count badge)
- User avatar (click → profile menu)

---

### 3.3 Sidebar (240px, collapsible to 56px)

**Structure:**

```
┌────────────────────────┐
│ 🏠 Home                │  ← Dashboard
│ 📅 My Tasks            │
│ 📬 Inbox               │
├────────────────────────┤
│ TEAMS                  │  ← Section header
│ ▾ Engineering          │  ← Collapsible team
│   # general            │
│   # frontend           │
│   📁 Documents         │
│   ✓ Tasks              │
│   📂 Files             │
│ ▾ Marketing            │
│   ...                  │
├────────────────────────┤
│ WORKSPACE              │
│ 🗂 Projects            │
│ 📅 Calendar            │
│ 📹 Meetings            │
│ 🗄 File Drive          │
│ 📚 Knowledge Base      │
│ 👥 Directory           │
│ 📊 Analytics           │
├────────────────────────┤
│ ⚙ Settings             │
│ ✦ Upgrade Plan         │
└────────────────────────┘
```

**Sidebar Behaviors:**
- Active item: indigo background pill, indigo text
- Hover: neutral-100 background
- Unread channel: bold text + unread count badge
- Collapsible sections with animated chevron
- Drag-and-drop to reorder teams
- Right-click context menu on channels (Settings, Mute, Leave)

---

### 3.4 Right Panel (Context Panel)

Some screens open a right panel (320px) for:
- Task details (click a task on Kanban)
- Thread view (click on a message reply)
- File preview
- Notification details

This avoids full-page navigation for quick peek interactions.

---

## 4. Screen Specifications

### 4.1 Dashboard / Home

```
┌──────────────────────────────────────────────────┐
│  Good morning, Shivam 👋          Tuesday, Aug 4 │
├─────────────────────┬────────────────────────────┤
│  MY TASKS (5)       │  TODAY'S MEETINGS           │
│  ○ Fix auth bug     │  ┌──────────────────────┐  │
│    Due today · High │  │ 🎥 Sprint Standup     │  │
│  ○ Review PR #42    │  │    10:00 AM · 30 min  │  │
│    Due tomorrow     │  │    [Join Meeting]     │  │
│  + 3 more           │  └──────────────────────┘  │
├─────────────────────┼────────────────────────────┤
│  RECENT DOCUMENTS   │  TEAM ACTIVITY             │
│  📄 Sprint 12 Notes │  Priya updated API Docs    │
│  📄 API Design Spec │  Ravi completed Task #56   │
│  📄 Onboarding Wiki │  Neha joined Engineering   │
├─────────────────────┴────────────────────────────┤
│  PROJECT PROGRESS                                 │
│  TeamOS MVP         ████████░░  78%  Due Aug 30  │
│  Marketing Site     ████░░░░░░  42%  Due Sep 15  │
└──────────────────────────────────────────────────┘
```

**Quick Actions Bar (top right of dashboard):**
`[+ New Task]  [+ New Doc]  [📹 Start Meeting]`

---

### 4.2 Chat — Channel View

```
┌──────────────────────────────────────────────────────────┐
│  # frontend  ·  42 members  [🔍] [📌] [👥] [⚙]          │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  — Today —                                               │
│                                                          │
│  [S] Shivam  10:32 AM                                    │
│      Hey team, PR #89 is ready for review               │
│      👀 3   ✅ 1                                          │
│                                                          │
│  [P] Priya  10:45 AM                                     │
│      Looking at it now. Looks good overall!             │
│      ↳ 2 replies  View thread →                         │
│                                                          │
│  [R] Ravi  11:02 AM                                      │
│      @Shivam one small nit on line 42                   │
│      [attachment: screenshot.png] 📷                    │
│                                                          │
│  [You are up to date]                                    │
│                                                          │
├──────────────────────────────────────────────────────────┤
│  Shivam is typing...                                     │
├──────────────────────────────────────────────────────────┤
│  [😊] [📎] [🎙]   Message #frontend          [Send ▸]   │
└──────────────────────────────────────────────────────────┘
```

**Message Hover Actions (appear on hover, right side of message):**
`😊 React  ↳ Reply  📌 Pin  ✏️ Edit  🗑 Delete  ···`

**Message Types:**
- Text message
- File attachment (image shows inline preview, others show name+size pill)
- Voice message (waveform + play button + duration)
- System message (italic, muted — "Shivam added Priya to the channel")

---

### 4.3 Projects — Kanban Board

```
┌─────────────────────────────────────────────────────────────────┐
│  TeamOS MVP  ›  Sprint 12  [Kanban ▾]  [Filter] [Group by] [+] │
├──────────────┬───────────────┬───────────────┬──────────────────┤
│  TO DO (8)   │ IN PROGRESS(4)│  REVIEW (2)   │  DONE (15)       │
│  ─────────── │ ─────────────-│ ──────────────│ ────────────     │
│  ┌─────────┐ │ ┌──────────┐  │ ┌──────────┐  │ ┌──────────┐    │
│  │Fix login│ │ │Auth API  │  │ │PR Review │  │ │DB schema │    │
│  │bug      │ │ │integr... │  │ │#42       │  │ │complete  │    │
│  │         │ │ │          │  │ │          │  │ │          │    │
│  │🔴 High  │ │ │[S][P]    │  │ │[R]       │  │ │✅        │    │
│  │Due today│ │ │Due Aug 8 │  │ │Due Aug 6 │  │ │          │    │
│  └─────────┘ │ └──────────┘  │ └──────────┘  │ └──────────┘    │
│  ┌─────────┐ │               │               │                  │
│  │Write    │ │               │               │                  │
│  │API docs │ │               │               │                  │
│  │🟡 Med   │ │               │               │                  │
│  └─────────┘ │               │               │                  │
│  + Add task  │               │               │                  │
└──────────────┴───────────────┴───────────────┴──────────────────┘
```

**Task Card Design:**
- Task title (2 lines max, truncate)
- Priority badge (colored dot + label)
- Assignee avatars (stacked, max 3 shown)
- Due date (red if overdue, orange if today)
- Label pills
- Subtask count (e.g. "3/5 subtasks")
- Comment count

**Task Detail Panel (right side drawer):**
- Full title (editable inline)
- Status dropdown
- Priority selector
- Assignee picker
- Due date calendar picker
- Description (rich text)
- Labels
- Checklist
- Attachments
- Activity log (chronological)
- Comment thread at bottom

---

### 4.4 Documents — Editor View

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Docs   Sprint 12 Planning Notes      [Share] [···]          │
│                                Saved ✓    Priya editing · 2    │
├─────────────────────────────────────────────────────────────────┤
│         [B] [I] [U] [H1] [H2] [•] [1.] [<>] [🖼] [Table] [··] │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│           Sprint 12 Planning Notes                              │
│           Last edited by Shivam · Aug 4, 2026                  │
│                                                                  │
│   ## Goals                                                       │
│                                                                  │
│   Ship the authentication flow and organization creation        │
│   by end of sprint. Secondary goal is to complete the chat     │
│   service WebSocket integration.                                │
│                                                                  │
│   ## Tasks                                                       │
│   ☑ Design auth service schema                                  │
│   ☑ Implement JWT generation                                    │
│   ☐ Google OAuth integration                   [Priya cursor]  │
│   ☐ WebSocket connection setup                                  │
│                                                                  │
│   ## Notes                                                       │
│   | Column 1     | Column 2     | Column 3    |                 │
│   |-------------|-------------|-------------|                   │
│   | Data        | Data        | Data        |                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Collaborative Cursors:**
- Each collaborator gets a distinct color
- Cursor shows name label on hover
- Selection highlights in that user's color

**Slash Command Menu (type `/`):**
```
/heading1   → H1 heading
/heading2   → H2 heading
/todo       → Checklist
/code       → Code block
/table      → Insert table
/image      → Upload image
/divider    → Horizontal rule
/mention    → @mention a user
/task       → Create linked task
```

---

### 4.5 Calendar View

```
┌────────────────────────────────────────────────────────────────┐
│  Calendar  [Day] [Week] [Month]    < August 2026 >  [+ Event] │
├────┬───────┬───────┬───────┬───────┬───────┬───────┬──────────┤
│    │  Mon  │  Tue  │  Wed  │  Thu  │  Fri  │  Sat  │  Sun     │
│    │   4   │   5   │   6   │   7   │   8   │   9   │   10     │
├────┼───────┼───────┼───────┼───────┼───────┼───────┼──────────┤
│ 9  │       │Standup│       │       │Standup│       │          │
│    │       │10:00  │       │       │10:00  │       │          │
├────┼───────┼───────┼───────┼───────┼───────┼───────┼──────────┤
│ 11 │Design │       │       │Sprint │       │       │          │
│    │Review │       │       │Review │       │       │          │
├────┼───────┼───────┼───────┼───────┼───────┼───────┼──────────┤
│ 14 │       │       │       │       │       │       │          │
│    │🔴Task │       │       │       │       │       │          │
│    │Due    │       │       │       │       │       │          │
└────┴───────┴───────┴───────┴───────┴───────┴───────┴──────────┘
```

**Event Types shown on calendar:**
- Meetings: Indigo filled pill
- Task deadlines: Red dot + task name
- Leaves: Orange background on day cell
- Birthdays: Purple dot

---

### 4.6 File Drive

```
┌────────────────────────────────────────────────────────────────┐
│  File Drive  ›  Engineering  ›  Assets      [🔍] [📤 Upload] │
│  [Grid ▾]  Sort: Modified ▾                  3.2 GB / 50 GB   │
├────────────────────────────────────────────────────────────────┤
│  📁 Designs                📁 Backend Docs    📁 Logos         │
│  12 files · 3 days ago     8 files · 1 hr ago  3 files         │
│                                                                  │
│  📄 API_Spec_v2.pdf       🖼 wireframe.png    📹 demo.mp4      │
│  2.1 MB · Yesterday       854 KB · Today     48 MB · Aug 1    │
│                                                                  │
│  📊 analytics_q3.xlsx                                          │
│  340 KB · Aug 3                                                 │
└────────────────────────────────────────────────────────────────┘
```

**File Hover State:**
- Checkbox appears (for multi-select)
- Action bar: Download | Share | Rename | Move | Delete

**File Context Menu (right click):**
- Open
- Preview
- Download
- Share → (Anyone with link / Specific people)
- Copy link
- Move to folder
- Rename
- View versions
- Move to trash

---

### 4.7 Analytics Dashboard

```
┌────────────────────────────────────────────────────────────────┐
│  Analytics  ·  August 2026     [Engineering ▾]  [Export CSV]  │
├──────────┬──────────┬──────────┬──────────────────────────────┤
│ 127      │ 43 hrs   │ 89%      │ 4.2 GB                       │
│ Tasks    │ Meetings │ On-time  │ Storage Used                 │
│ Completed│ This Mo  │ Delivery │                              │
├──────────┴──────────┴──────────┴──────────────────────────────┤
│                                                                │
│  Tasks Completed (Last 30 days)          Velocity             │
│  ▁▂▃▅▆▇█▇▆▅▄▃▂▁▂▃▅▆▇█▇▆▅             Sprint 10: 42 pts      │
│                                          Sprint 11: 38 pts     │
│                                          Sprint 12: 51 pts     │
├──────────────────────────────────────────────────────────────┤
│  Most Active Members                Document Activity          │
│  1. Shivam     89 tasks            48 docs edited today       │
│  2. Priya      67 tasks            12 new documents            │
│  3. Ravi       45 tasks                                        │
└──────────────────────────────────────────────────────────────┘
```

---

### 4.8 Settings Pages

**Settings Sidebar:**
```
Account
├── Profile
├── Notifications
├── Appearance
└── Security & Devices

Organization
├── General
├── Members & Roles
├── Teams
├── Billing & Plan
├── Integrations
└── Audit Logs
```

---

### 4.9 Onboarding Flow

**Step 1: Create account**
Clean centered card, minimal form (Name, Email, Password), Google/GitHub OAuth buttons at top.

**Step 2: Verify email**
"Check your inbox" illustration, resend button, auto-redirect on verification.

**Step 3: Create or join organization**
Two large cards:
- "Create a new workspace" (enter name, upload logo, choose plan)
- "Join an existing workspace" (enter invite code)

**Step 4: Invite your team**
Email input with +Add button, skip option clearly visible.

**Step 5: Set up your first team**
Suggested team names with one-click creation (Engineering, Marketing, Design, etc.)

**Step 6: Dashboard**
Welcome tour overlay highlighting key features.

---

## 5. Component Library

### 5.1 Button Variants

```
Primary:   Indigo background, white text, hover darken
Secondary: White background, indigo border, indigo text
Ghost:     Transparent, text color, hover neutral-100 bg
Danger:    Red background, white text
Icon-only: Square, ghost style, icon centered
```

Sizes: `sm (32px) | md (36px) | lg (40px)`

States: `default | hover | focus | loading (spinner) | disabled`

---

### 5.2 Input Fields

```
Height: 36px
Border: 1px solid neutral-200, radius-sm
Focus:  Indigo border + subtle indigo shadow ring
Error:  Red border + error message below in red-500
Label:  13px, neutral-600, 4px above input
```

---

### 5.3 Avatar

```
Sizes:    xs(20) | sm(24) | md(32) | lg(40) | xl(56)
Shape:    Circle (radius-full)
Fallback: Initials on colored background
           Color generated from name hash (consistent per user)
Stack:    Overlap -8px, max 3 shown + "+N" overflow badge
```

---

### 5.4 Badge / Pill

```
Default:  neutral-100 bg, neutral-600 text
Primary:  indigo-50 bg, indigo-600 text
Success:  green-50 bg, green-600 text
Warning:  amber-50 bg, amber-700 text
Danger:   red-50 bg, red-600 text
Size:     height 20px, px 8px, radius-full, 12px font
```

---

### 5.5 Modal

```
Overlay:    rgba(0,0,0,0.5), full screen
Container:  White, radius-lg, shadow-xl, max-w 520px
Header:     Title (heading-3) + X close button
Body:       Scrollable if content overflows, px-6 py-4
Footer:     Cancel + Primary action buttons, right-aligned
```

---

### 5.6 Toast Notifications

```
Position:   Bottom-right, stack upward
Width:      360px
Variants:   success (green left border) | error (red) | info (blue) | warning (amber)
Duration:   4 seconds auto-dismiss
Anatomy:    Icon + Title + Description (optional) + X button
```

---

### 5.7 Empty States

Every list view must have an empty state:

```
┌──────────────────────────────┐
│                              │
│      [Illustration SVG]      │
│                              │
│   No tasks yet               │
│   Create your first task     │
│   to get started.            │
│                              │
│      [+ Create Task]         │
│                              │
└──────────────────────────────┘
```

---

### 5.8 Loading States

- **Skeleton screens** (not spinners) for list and card loading
- **Optimistic updates** for message sends, task status changes
- **Spinner** only for form submissions and file uploads
- **Progress bar** at top of page for navigation

---

## 6. Responsive Design

### Breakpoints
```
Mobile:   0 – 767px
Tablet:   768px – 1023px
Desktop:  1024px – 1279px
Wide:     1280px+
```

### Responsive Behavior

| Element | Desktop | Tablet | Mobile |
|---------|---------|--------|--------|
| Sidebar | 240px fixed | Collapsible overlay | Hidden (hamburger) |
| Chat list | Always visible | Always visible | Full screen |
| Chat + Thread | Side by side | Thread as overlay | Thread as overlay |
| Kanban | All columns | Scroll horizontally | Single column |
| Dashboard widgets | 2-column grid | 2-column grid | 1-column stack |
| Analytics charts | Full width | Full width | Simplified |

---

## 7. Accessibility

### Requirements

- All interactive elements keyboard navigable (Tab order logical)
- Focus ring visible on all focusable elements (2px indigo ring)
- All images have meaningful `alt` text
- Color not used as the sole indicator of meaning (always paired with icon or text)
- Minimum contrast ratio: 4.5:1 for body text, 3:1 for large text (WCAG AA)
- ARIA labels on icon-only buttons
- Screen reader announcements for real-time updates (new messages, notifications)
- Reduced motion support: `prefers-reduced-motion` disables animations

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + K` | Open global search |
| `Cmd/Ctrl + /` | Open keyboard shortcut help |
| `Cmd/Ctrl + N` | New task |
| `Cmd/Ctrl + Shift + D` | New document |
| `Alt + Shift + M` | Start meeting |
| `Esc` | Close modal / panel |
| `J / K` | Navigate list items up/down |
| `E` | Mark task done (when focused) |

---

## 8. Motion & Animation

### Principles
- Duration: 150ms for micro (hover), 200ms for panel, 300ms for modal
- Easing: `ease-out` for enter, `ease-in` for exit
- Never animate layout-triggering properties (use transform/opacity only)

### Specific Animations

| Element | Animation |
|---------|-----------|
| Modal open | Scale 0.95→1 + opacity 0→1, 200ms |
| Sidebar collapse | Width transition, 200ms ease |
| Toast appear | Slide in from right, 200ms |
| New message | Fade in + slide up 4px, 150ms |
| Typing indicator | 3-dot bounce loop |
| Kanban drag | Card lifts (shadow + scale 1.02) |
| Page transition | Fade, 100ms |

---

## 9. Dark Mode

System preference detection via `prefers-color-scheme: dark`.
Manual toggle in Settings → Appearance.

**Dark mode token mapping:**
```
Light bg-primary    → Dark: #0F0F10
Light bg-secondary  → Dark: #18181B
Light border        → Dark: #2D2D31
Light text-primary  → Dark: #FAFAFA
Light text-muted    → Dark: #52525B

Brand colors (indigo, green, etc.) remain the same but
bg tints change:
  indigo-50 bg    → indigo-900/30 in dark
  green-50 bg     → green-900/30 in dark
```

---

## 10. Figma File Structure

Organize your Figma file as follows:

```
📁 TeamOS Design System
  📄 Page 1: Foundations
      → Colors, Typography, Spacing, Icons, Shadows

  📄 Page 2: Components
      → Buttons, Inputs, Badges, Avatars, Modals,
        Cards, Toasts, Dropdowns, Tooltips, Tables

  📄 Page 3: Layouts
      → App Shell, Sidebar states, Mobile Nav

📁 TeamOS Screens
  📄 Page 1: Onboarding
      → Sign Up, Login, Email Verify, Create Org, Invite Team

  📄 Page 2: Dashboard
      → Home, Notification Center

  📄 Page 3: Chat
      → Channel view, DM view, Thread view, Search

  📄 Page 4: Projects
      → Kanban, Sprint Board, Backlog, Roadmap, Task Detail

  📄 Page 5: Documents
      → Folder view, Editor (empty), Editor (content), Comment panel

  📄 Page 6: Calendar
      → Month view, Week view, Event detail

  📄 Page 7: Files
      → Grid view, List view, File preview, Upload modal

  📄 Page 8: Meetings
      → Meeting room, Schedule modal

  📄 Page 9: Analytics
      → Org dashboard, Team view

  📄 Page 10: Settings
      → Profile, Notifications, Members, Billing

  📄 Page 11: Mobile
      → Mobile versions of all key screens
```

### Figma Best Practices for this Project

- Use **Auto Layout** everywhere — no fixed frames
- Create **components** for every repeated element
- Use **variables** for all colors (so dark mode toggle works instantly)
- Name layers semantically (`Button/Primary/Default`, not `Rectangle 42`)
- Use **component properties** for variants (size, state, type)
- Prototype the onboarding flow and main chat flow for demos

---

*End of Design Specification v1.0*

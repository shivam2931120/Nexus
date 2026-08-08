# Product Requirements Document (PRD)

**Product Name:** TeamOS *(see name suggestions at the end)*
**Version:** 1.0
**Date:** August 2026
**Author:** Shivam
**Status:** Draft

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Goals & Success Metrics](#3-goals--success-metrics)
4. [Target Users & Personas](#4-target-users--personas)
5. [Feature Requirements](#5-feature-requirements)
6. [Non-Functional Requirements](#6-non-functional-requirements)
7. [Pricing & Monetization](#7-pricing--monetization)
8. [Constraints & Assumptions](#8-constraints--assumptions)
9. [Out of Scope](#9-out-of-scope)
10. [Name Suggestions](#10-name-suggestions)

---

## 1. Executive Summary

TeamOS is a unified SaaS workspace platform that consolidates team communication, project management, document collaboration, file storage, video meetings, and analytics into a single product. The goal is to eliminate tool fragmentation — where a team of 20 people operates across Slack, Notion, Jira, Google Drive, Zoom, Trello, and Confluence simultaneously — and replace it with one coherent operating system for modern teams.

---

## 2. Problem Statement

### The Problem

Modern teams suffer from **tool sprawl**. A typical software startup uses:

| Tool | Purpose | Avg Cost/user/month |
|------|---------|---------------------|
| Slack | Chat | $7.25 |
| Notion | Docs & Wiki | $10 |
| Jira | Project Tracking | $8.15 |
| Google Drive | File Storage | $6 |
| Zoom | Video Meetings | $13.32 |
| Confluence | Knowledge Base | $5.75 |
| Calendly | Scheduling | $10 |
| **Total** | | **~$60.47/user/month** |

This leads to:
- **Context switching** — people lose 23 minutes of focus per context switch
- **Data silos** — task mentioned in Slack, doc in Notion, ticket in Jira, meeting in Zoom — no single source of truth
- **Integration hell** — third-party Zapier/Make automations break constantly
- **Onboarding overhead** — new employees must learn 7+ tools
- **High cost** — $60+ per user per month for mid-size companies

### The Opportunity

One workspace. One login. One notification center. One search. One billing line.

---

## 3. Goals & Success Metrics

### Business Goals

- Become the go-to workspace for startups and small teams (< 200 members)
- Achieve product-market fit within 6 months of launch
- Reach 1,000 active organizations within Year 1

### Success Metrics (KPIs)

| Metric | Target (6 months) | Target (12 months) |
|--------|-------------------|---------------------|
| Registered Organizations | 200 | 1,000 |
| Monthly Active Users | 2,000 | 15,000 |
| Messages sent/day | 50,000 | 500,000 |
| Documents created/day | 5,000 | 50,000 |
| Avg session duration | 45 min | 60 min |
| Free → Paid conversion | 8% | 15% |
| Churn rate | < 10%/month | < 5%/month |

---

## 4. Target Users & Personas

### Persona 1 — Arjun, CTO of a 30-person startup
- **Pain:** Paying for Slack + Notion + Jira + Zoom separately; engineers context-switch constantly
- **Goal:** One tool where engineers can chat, track tasks, write docs, and have standups
- **Key features:** Chat, Projects (Kanban/Sprint), Docs, Meetings

### Persona 2 — Priya, Project Manager at a software agency
- **Pain:** Clients ask for status updates; she manually copy-pastes from Jira to email
- **Goal:** A workspace she can share with clients with controlled access
- **Key features:** Project dashboards, guest access, approval workflows, analytics

### Persona 3 — Ravi, Head of a college coding club
- **Pain:** WhatsApp groups for communication, Google Docs for notes, no task tracking
- **Goal:** A free, organized workspace for a 40-member club
- **Key features:** Free plan, chat, tasks, documents, calendar

### Persona 4 — Neha, HR Manager at an NGO
- **Pain:** Leave requests via email, no centralized employee directory, no policy wiki
- **Goal:** Digitize HR workflows without enterprise pricing
- **Key features:** Employee directory, approval workflows, knowledge base, forms

---

## 5. Feature Requirements

### 5.1 Authentication

**Priority:** P0 (Must Have)

| ID | Requirement | Notes |
|----|------------|-------|
| AUTH-01 | Email + password login | bcrypt hashing |
| AUTH-02 | Google OAuth 2.0 | |
| AUTH-03 | GitHub OAuth 2.0 | |
| AUTH-04 | Microsoft OAuth 2.0 | |
| AUTH-05 | Two-Factor Authentication (TOTP) | Google Authenticator compatible |
| AUTH-06 | JWT-based session management | Access + Refresh token pattern |
| AUTH-07 | Password reset via email | Token expires in 15 minutes |
| AUTH-08 | Device management (view/revoke active sessions) | |
| AUTH-09 | Account lockout after 5 failed attempts | |

**User Flow:**
```
Landing Page → Sign Up → Email Verification → Onboarding (Create/Join Org) → Dashboard
```

---

### 5.2 Organization Dashboard

**Priority:** P0

| ID | Requirement |
|----|------------|
| DASH-01 | Personalized greeting with user's name and current time |
| DASH-02 | Today's meetings widget |
| DASH-03 | Pending tasks widget (sorted by deadline) |
| DASH-04 | Unread notifications feed |
| DASH-05 | Recently viewed documents |
| DASH-06 | Recent chat messages |
| DASH-07 | Upcoming deadlines across all projects |
| DASH-08 | Project progress bars |
| DASH-09 | Team activity feed (who did what) |
| DASH-10 | Quick action buttons (New Task, New Doc, New Meeting) |

---

### 5.3 Teams

**Priority:** P0

| ID | Requirement |
|----|------------|
| TEAM-01 | Create teams within an organization |
| TEAM-02 | Assign members to teams |
| TEAM-03 | Each team has its own: Chat, Documents, Tasks, Calendar, Files |
| TEAM-04 | Team settings (name, avatar, description, visibility) |
| TEAM-05 | Team-level permissions (who can add/remove members) |

---

### 5.4 Team Chat

**Priority:** P0

| ID | Requirement | Notes |
|----|------------|-------|
| CHAT-01 | Create public/private channels | e.g. #general, #frontend |
| CHAT-02 | Direct messages (1:1) | |
| CHAT-03 | Group direct messages | |
| CHAT-04 | Voice messages | WebAudio API + file upload |
| CHAT-05 | Emoji reactions | Unicode emoji set |
| CHAT-06 | GIF support | Via Giphy API or Tenor |
| CHAT-07 | File sharing in chat | Images, PDFs, docs |
| CHAT-08 | Typing indicators | Via WebSocket presence |
| CHAT-09 | Read receipts | |
| CHAT-10 | Threaded replies | |
| CHAT-11 | Pinned messages per channel | |
| CHAT-12 | Message search | PostgreSQL Full-Text Search |
| CHAT-13 | @mentions (users and channels) | |
| CHAT-14 | Announcements channel (admin-only post) | |
| CHAT-15 | Scheduled messages | |
| CHAT-16 | Message edit and delete | With edit history |
| CHAT-17 | Message forward to another channel | |
| CHAT-18 | Reply to specific message (quote) | |
| CHAT-19 | Link preview (Open Graph) | |
| CHAT-20 | Real-time delivery via WebSocket | STOMP over Spring WebSocket |

---

### 5.5 Video Meetings

**Priority:** P1

| ID | Requirement |
|----|------------|
| MEET-01 | Create/schedule meetings |
| MEET-02 | Join via meeting link |
| MEET-03 | Camera on/off toggle |
| MEET-04 | Mic mute/unmute |
| MEET-05 | Screen sharing |
| MEET-06 | In-meeting text chat |
| MEET-07 | Collaborative whiteboard during meeting |
| MEET-08 | Raise hand feature |
| MEET-09 | Meeting recording (saved to file drive) |
| MEET-10 | Live captions |
| MEET-11 | Auto-generated meeting notes |
| MEET-12 | Attendance tracking |
| MEET-13 | Meeting lobby / waiting room |

**Technical Note:** Use WebRTC with a TURN/STUN server. Consider LiveKit as a managed WebRTC backend to avoid raw WebRTC complexity.

---

### 5.6 Documents

**Priority:** P0

| ID | Requirement |
|----|------------|
| DOC-01 | Create documents (Notes, Meeting Minutes, SOPs, Wikis, Specs) |
| DOC-02 | Rich text editor (Bold, Italic, Underline, Headings, Lists) |
| DOC-03 | Tables |
| DOC-04 | Code blocks with syntax highlighting |
| DOC-05 | Image embeds |
| DOC-06 | Checklists |
| DOC-07 | Comments on selected text |
| DOC-08 | Live multi-user collaborative editing | CRDT or OT algorithm |
| DOC-09 | Version history (restore previous versions) | |
| DOC-10 | @mentions inside documents | |
| DOC-11 | Document templates | |
| DOC-12 | Organize docs in folders | |
| DOC-13 | Document sharing (view/edit/comment permissions) | |
| DOC-14 | Export to PDF / Markdown | |
| DOC-15 | Full-text search across all documents | PostgreSQL FTS |

---

### 5.7 Projects

**Priority:** P0

| ID | Requirement |
|----|------------|
| PROJ-01 | Create projects within teams |
| PROJ-02 | Project dashboard (overview, progress, members) |
| PROJ-03 | Sprint board (Scrum workflow) |
| PROJ-04 | Kanban board |
| PROJ-05 | Backlog view |
| PROJ-06 | Roadmap / timeline view |
| PROJ-07 | Milestones |
| PROJ-08 | Epics → Stories → Tasks → Subtasks hierarchy |
| PROJ-09 | Task dependencies (blocks/blocked by) |
| PROJ-10 | Labels and tags |
| PROJ-11 | Priority levels (Critical, High, Medium, Low) |
| PROJ-12 | Assignee (single or multiple) |
| PROJ-13 | Time tracking (log hours per task) |
| PROJ-14 | Burndown charts |
| PROJ-15 | Velocity charts |

---

### 5.8 Calendar

**Priority:** P1

| ID | Requirement |
|----|------------|
| CAL-01 | Daily / Weekly / Monthly views |
| CAL-02 | Create events (title, description, time, attendees, location) |
| CAL-03 | Show task deadlines on calendar |
| CAL-04 | Show scheduled meetings on calendar |
| CAL-05 | Show leave requests on calendar |
| CAL-06 | Birthday reminders |
| CAL-07 | Recurring events |
| CAL-08 | Calendar sharing across team |
| CAL-09 | iCal export / Google Calendar sync |

---

### 5.9 Task Manager

**Priority:** P0

| ID | Requirement |
|----|------------|
| TASK-01 | Create tasks with: Title, Description, Priority, Deadline, Labels, Assignee, Attachments |
| TASK-02 | Task comments |
| TASK-03 | Task checklist |
| TASK-04 | Activity log on each task |
| TASK-05 | Task status workflow (To Do → In Progress → Review → Done) |
| TASK-06 | Kanban view |
| TASK-07 | Calendar view |
| TASK-08 | Table view |
| TASK-09 | Timeline view |
| TASK-10 | My Tasks (personal task inbox) |
| TASK-11 | Task notifications (assigned, commented, deadline) |

---

### 5.10 Whiteboard

**Priority:** P2

| ID | Requirement |
|----|------------|
| WB-01 | Infinite canvas |
| WB-02 | Sticky notes |
| WB-03 | Shapes (rectangle, circle, arrow, line) |
| WB-04 | Flowchart connectors |
| WB-05 | Mind map nodes |
| WB-06 | Freehand drawing |
| WB-07 | Text boxes |
| WB-08 | Real-time multi-user collaboration |
| WB-09 | Export as PNG/SVG |
| WB-10 | Embed whiteboard inside documents |

---

### 5.11 File Drive

**Priority:** P1

| ID | Requirement |
|----|------------|
| FILE-01 | Upload files (drag & drop or browse) |
| FILE-02 | Folder organization |
| FILE-03 | File permissions (view / edit / share) |
| FILE-04 | File versioning |
| FILE-05 | Large file upload support (up to 5 GB) |
| FILE-06 | Image preview |
| FILE-07 | Video preview |
| FILE-08 | PDF viewer (in-browser) |
| FILE-09 | Recycle bin with 30-day retention |
| FILE-10 | File search |
| FILE-11 | Storage quota per plan |
| FILE-12 | File stored on Cloudflare R2 |

---

### 5.12 Knowledge Base

**Priority:** P1

| ID | Requirement |
|----|------------|
| KB-01 | Company wiki (top-level knowledge hub) |
| KB-02 | Policies section |
| KB-03 | FAQs section |
| KB-04 | Technical documentation section |
| KB-05 | Architecture & runbooks section |
| KB-06 | Training materials section |
| KB-07 | Full-text search across knowledge base |
| KB-08 | Nested page structure (parent/child pages) |
| KB-09 | Public sharing (share KB page externally) |

---

### 5.13 Employee Directory

**Priority:** P1

| ID | Requirement |
|----|------------|
| DIR-01 | Employee profile (name, photo, role, department, bio) |
| DIR-02 | Skills & expertise tags |
| DIR-03 | Manager/reports-to hierarchy |
| DIR-04 | Current projects |
| DIR-05 | Availability status |
| DIR-06 | Contact details |
| DIR-07 | Filter by department, team, skill, location |
| DIR-08 | Org chart view |

---

### 5.14 Notifications

**Priority:** P0

| ID | Requirement |
|----|------------|
| NOTIF-01 | Real-time in-app notifications via WebSocket |
| NOTIF-02 | Push notifications (browser) |
| NOTIF-03 | Email notifications (configurable) |
| NOTIF-04 | Daily/weekly digest email |
| NOTIF-05 | Notification for: task assigned, mentioned, meeting reminder, doc shared, comment added |
| NOTIF-06 | Notification preferences per user |
| NOTIF-07 | Mark all as read |
| NOTIF-08 | Notification center (bell icon with history) |
| NOTIF-09 | Do Not Disturb mode |

---

### 5.15 Analytics

**Priority:** P2

| ID | Requirement |
|----|------------|
| ANALY-01 | Organization-level dashboard |
| ANALY-02 | Tasks completed over time (chart) |
| ANALY-03 | Project velocity |
| ANALY-04 | Meeting hours per team |
| ANALY-05 | Document activity (views, edits) |
| ANALY-06 | Team productivity scores |
| ANALY-07 | Average response times in chat |
| ANALY-08 | Storage usage per team |
| ANALY-09 | Export analytics as PDF/CSV |

---

### 5.16 AI Assistant (Premium)

**Priority:** P2

| ID | Requirement |
|----|------------|
| AI-01 | Summarize meeting recordings |
| AI-02 | Auto-generate meeting minutes |
| AI-03 | Task suggestions from documents |
| AI-04 | Natural language search across workspace |
| AI-05 | Draft email/message |
| AI-06 | Sprint summary generator |
| AI-07 | Daily digest summary |

---

### 5.17 Approval Workflows

**Priority:** P1

| ID | Requirement |
|----|------------|
| APPR-01 | Leave request workflow |
| APPR-02 | Purchase request workflow |
| APPR-03 | Expense approval workflow |
| APPR-04 | Document approval workflow |
| APPR-05 | Custom workflow builder (define stages, approvers) |
| APPR-06 | Approval notifications |
| APPR-07 | Approval history log |

---

### 5.18 Company Directory

**Priority:** P1

| ID | Requirement |
|----|------------|
| CDIR-01 | List of departments |
| CDIR-02 | Office locations |
| CDIR-03 | Organizational hierarchy tree |
| CDIR-04 | Team listings |
| CDIR-05 | Manager and employee mapping |

---

### 5.19 Forms Builder

**Priority:** P2

| ID | Requirement |
|----|------------|
| FORM-01 | Drag-and-drop form builder |
| FORM-02 | Field types: text, textarea, dropdown, checkbox, radio, date, file upload |
| FORM-03 | Conditional logic (show/hide fields based on answers) |
| FORM-04 | Form responses dashboard |
| FORM-05 | Response analytics |
| FORM-06 | Export responses as CSV |
| FORM-07 | Share form via link |
| FORM-08 | Embed form in documents |

---

### 5.20 Internal App Store / Integrations

**Priority:** P2

| ID | Requirement |
|----|------------|
| INT-01 | GitHub integration (link commits/PRs to tasks) |
| INT-02 | GitLab integration |
| INT-03 | Google Drive import |
| INT-04 | Jira import (migrate existing projects) |
| INT-05 | Figma embed |
| INT-06 | Outlook calendar sync |
| INT-07 | Webhook support (outgoing) |
| INT-08 | Plugin marketplace UI |

---

### 5.21 Permissions & Roles

| Role | Capabilities |
|------|-------------|
| Super Admin | Full access, billing, delete org |
| Admin | Manage members, settings, integrations |
| Manager | Manage team, projects, approve workflows |
| Lead | Manage tasks, assign work |
| Employee | Standard access per team |
| Guest | Read-only or limited access to shared content |

All permissions are customizable at org level.

---

## 6. Non-Functional Requirements

| Category | Requirement |
|----------|------------|
| Performance | Page load < 2s; API response < 200ms (P95) |
| Availability | 99.9% uptime SLA |
| Scalability | Support 10,000 concurrent users per org |
| Security | OWASP Top 10 compliance; data encrypted at rest and in transit |
| Data Residency | User data stored in chosen region |
| Accessibility | WCAG 2.1 AA compliance |
| Browser Support | Chrome, Firefox, Safari, Edge (latest 2 versions) |
| Mobile | Responsive web app; native apps in roadmap |
| Backup | Daily database backups; 30-day retention |
| Compliance | GDPR-ready (data export, deletion, consent) |

---

## 7. Pricing & Monetization

### Free Plan
- Up to 10 members
- 5 GB storage
- Chat, Tasks, Basic Documents

### Starter — $9/user/month
- Everything in Free
- Documents, Meetings, Calendar
- 50 GB storage

### Business — $19/user/month
- Everything in Starter
- Analytics, Automation, SSO, Advanced Permissions
- Unlimited storage

### Enterprise — Custom
- On-premise deployment
- Audit logs
- Custom integrations
- SLA + dedicated support

---

## 8. Constraints & Assumptions

- Initial build targets web only (no native mobile apps in v1)
- Video meetings rely on WebRTC + LiveKit (not built from scratch)
- AI features require third-party LLM API (OpenAI / Claude API)
- File storage uses Cloudflare R2 (not self-hosted MinIO)
- Real-time messaging uses PostgreSQL LISTEN/NOTIFY + STOMP WebSockets
- Search powered by PostgreSQL Full-Text Search (not Elasticsearch)
- Team size for v1: optimized for 2–500 member organizations

---

## 9. Out of Scope (v1)

- Native iOS / Android apps
- SMS notifications
- On-premise self-hosting (Enterprise roadmap)
- Built-in email client
- CRM or sales pipeline features
- Time zone auto-scheduling (Calendly-style)

---

## 10. Name Suggestions

| Name | Vibe | Domain Likely? |
|------|------|----------------|
| **Nexus** | Central hub, connected | nexus.so / usenexus.io |
| **Flowspace** | Smooth workflows, one space | flowspace.io |
| **Hive** | Collaborative, team-first | hive.so (taken — use hivespace.io) |
| **Orbit** | Teams revolving around one center | orbitwrk.io |
| **Forge** | Build things together | forgehq.io |
| **Plane** | Flat, clean, everything in view | plane.so (taken — use getplane.io) |
| **Lynk** | Everything linked, no silos | lynkhq.io |
| **Basecamp** | Home base for teams (taken — use as inspiration) | — |
| **Cohere** | Coherent teams, cohesive work | coherehq.io |
| **Stackr** | Stack your work in one place | stackrhq.io |

**Top Pick: Nexus** — short, memorable, implies connectivity, available as nexus.so / usenexus.io. Works for both technical and non-technical audiences.

---

*End of PRD v1.0*

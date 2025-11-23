# JSON Converter Design Guidelines

## Design Approach

**Hybrid Approach**: Combine Linear's clean professionalism with Stripe's trustworthy payment UX. This converter tool must feel premium enough to justify paid tiers while maintaining developer-tool efficiency.

**Key Principles**:
- Clarity over decoration
- Instant visual feedback for all actions
- Trust-building through polish and professionalism
- Frictionless conversion workflow

---

## Typography

**Font Family**: Inter (Google Fonts) for entire application
- Headings: 600-700 weight
- Body: 400-500 weight
- Code/JSON: JetBrains Mono for all code blocks

**Scale**:
- App title: text-2xl (24px)
- Section headers: text-lg (18px)
- Body text: text-base (16px)
- Small labels: text-sm (14px)
- Code blocks: text-sm with monospace

---

## Layout System

**Spacing Primitives**: Tailwind units of 2, 4, 6, 8, 12, 16
- Component padding: p-6 or p-8
- Section gaps: gap-6 or gap-8
- Button padding: px-6 py-3
- Card spacing: p-6

**Container Strategy**:
- Main app container: max-w-7xl mx-auto px-4
- Two-column workspace: 50/50 split on desktop, stacked on mobile
- Pricing modal: max-w-4xl centered overlay

---

## Application Structure

### Header
Top navigation bar with:
- Logo/brand name (left)
- "Upgrade" button (right, visible when on free tier)
- Clean single-line layout, py-4 with border-bottom

### Main Workspace (Two-Column Layout)

**Left Panel - Input**:
- Tab switcher: "Paste JSON" | "Upload File"
- Large textarea for paste (min-h-96)
- File drop zone with drag-and-drop visual feedback
- Line counter display showing usage (e.g., "23/50 lines used")
- Clear visual indicator when approaching/exceeding limit

**Right Panel - Output**:
- Format selector: "SQL" | "CSV" (prominent toggle/tabs)
- Live preview area with syntax highlighting
- Download button (primary action, large and obvious)
- Copy to clipboard secondary action

### Payment Gate Modal
Appears when exceeding 50-line limit:
- Overlay with backdrop blur
- Centered card (max-w-4xl)
- Three pricing tiers in grid (grid-cols-3 on desktop)
- Each tier card includes: name, price, billing period, feature list, CTA button
- Powered by Stripe badge for trust
- Close button (X) in top-right

---

## Component Library

### Input Components
- **Textarea**: Rounded corners (rounded-lg), monospace font, line numbers in gutter, syntax highlighting for JSON
- **File Upload Zone**: Dashed border, hover state shows darker border, icon + text centered
- **Tab Navigation**: Underline indicator for active tab, smooth transition

### Buttons
- **Primary**: Solid fill, rounded-lg, px-6 py-3, medium weight text
- **Secondary**: Outlined, same sizing as primary
- **Icon Buttons**: Square, p-2, for copy/clear actions

### Cards
- **Pricing Cards**: Rounded-xl, border, p-8, vertical layout with clear hierarchy
- **Feature Cards**: If needed for landing section, rounded-lg with icon + title + description

### Indicators
- **Progress**: Circular progress indicator during file processing
- **Line Counter**: Badge-style component showing current/max lines
- **Success/Error**: Toast notifications (top-right) for file downloads, errors

### Code Display
- **Preview Panels**: Dark background with light text, rounded-lg, p-4, scrollable
- **Syntax Highlighting**: Distinct treatment for JSON keys, values, SQL keywords

---

## Interaction Patterns

### File Processing Flow
1. User inputs JSON → instant validation feedback
2. Nested level indicator shows complexity (e.g., "4 levels deep")
3. Real-time line count updates
4. When 50-line limit reached → gentle warning banner appears
5. When limit exceeded → conversion disabled + payment modal trigger button appears
6. Post-payment → instant unlock, processing continues

### Conversion Workflow
- One-click conversion (no multi-step forms)
- Progress indicator during processing (spinner or percentage)
- Automatic preview generation
- Download button becomes available immediately after conversion
- Clear success state confirmation

### Payment Experience
- Modal slides in from center with fade
- Pricing tiers clearly differentiated
- Selected tier highlights before proceeding to Stripe
- Seamless Stripe Checkout redirect
- Return shows "Processing unlocked" success state

---

## Images

**No hero image needed** - This is a utility application, not a marketing page.

**Optional Graphics**:
- Subtle background pattern (dots or grid) in empty states
- Icon illustrations for file upload drop zone
- Simple iconography for features/benefits in pricing modal

---

## Key Differentiators

**Professional Polish**:
- Smooth micro-transitions (200-300ms) on interactive elements
- Consistent rounded corners throughout (rounded-lg standard)
- Generous whitespace prevents cluttered feeling
- Monospace fonts for all code/data displays

**Trust Elements**:
- Stripe branding visible in payment flow
- Security badges if applicable
- Clear pricing, no hidden fees
- Line count transparency

**Developer Experience**:
- Keyboard shortcuts supported (Cmd/Ctrl+V for paste, Cmd/Ctrl+S for download)
- Error messages with helpful guidance
- Format validation before conversion
- Export file naming includes timestamp
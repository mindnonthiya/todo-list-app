# Design

## Foundation

A modern cute productivity planner with a warm cream canvas, soft sage primary UI, pastel yellow accents, muted blue supporting cards, and sticker-like hand-drawn SVG doodle characters. The application is a product surface, so decorative details must support standard todo interactions.

## Color Palette

- Background: `#F8F4EC` warm cream paper.
- Primary: `#A8B58A` soft sage green.
- Accent: `#F7D36B` pastel yellow.
- Supporting blue: `#A9D4DC` muted planner blue.
- Ink: `#2D302A` dark warm green-gray.
- Muted text: `#696F61` readable sage-gray.
- Surface: translucent warm white and cream cards.

## Typography

Use a single system sans stack for performance and product clarity. Headings use heavier weights and slight negative tracking; body text stays readable and compact. Avoid display fonts in controls.

## Components

- Rounded planner cards with 24px–32px radii, soft shadows, and subtle borders.
- Calendar dashboard with rounded day cells and a highlighted current day.
- Doodle mood stickers built from inline SVG with uneven blob shapes and cartoon faces.
- Task cards with category chips, priority pills, progress/status affordances, and CRUD action buttons.
- Floating add button that focuses the existing task input.
- Empty states that teach the user to add tasks and include custom SVG illustration.

## Motion

Use 150–250ms transitions for hover, focus, completion, card lift, and progress bars. Respect `prefers-reduced-motion` by disabling decorative animation.

## Responsive Layout

Mobile-first single-column planner stack. Tablet uses two-column card sections where space permits. Desktop expands to dashboard/sidebar plus task board while preserving comfortable spacing and touch targets.

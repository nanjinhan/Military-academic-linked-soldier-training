# Design and code sources

## React Bits CountUp

- Source: https://github.com/DavidHDev/react-bits/blob/main/src/ts-default/TextAnimations/CountUp/CountUp.tsx
- Documentation: https://reactbits.dev/text-animations/count-up
- Local copy: `components/third-party/CountUp.tsx`
- License: MIT + Commons Clause, preserved in `licenses/reactbits.md`.
- Integration: activity counters; the wrapper bypasses animation for reduced-motion preferences. No other React Bits components are implied to be used.

## Cult UI Hero Color Panels

- Source: https://github.com/nolly-studio/cult-ui/blob/main/apps/www/registry/default/ui/hero-color-panel.tsx
- Documentation: https://www.cult-ui.com/docs/components/hero-color-panels
- Local copy: `components/third-party/HeroColorPanels.tsx`
- License: MIT, preserved in `licenses/cult-ui.md`.
- Initial integration: Root and Visual primitives for the training card. The 2026-09-29 user-supplied charcoal/lime redesign uses a photograph instead; the component and license remain preserved but are not rendered in the current screens.
- Underlying renderer: `@paper-design/shaders-react` (package license included by dependency).

## Other assets

- The athlete image in `public/fitness-athlete.png` was generated for the initial prototype and is not displayed in the current design.
- Icons: Lucide React. Components: starter-provided Shadcn/Radix primitives. Graph: Recharts.
- User-supplied HTML and reference images informed information structure and visual direction; originals were not modified or published.

## User-supplied 군학연계 design (2026-09-29)

- Reference: the supplied folder's `src/App.tsx`, `src/index.css`, and UI specification under `src/imports/`.
- Integrated: charcoal/lime tokens, mobile home ordering, photo cards, large progress numbers, routine/session/rest/result layouts, growth and ranking presentation.
- `public/assets/pushup-workout.jpg` is copied from the supplied folder's same path, without altering the source file. This is a user-provided asset, not a newly generated image.
- Existing API, stored demo data, approval requirements and ranking calculation remain the source of displayed values. The reference's hardcoded results and simulated automatic approvals are not copied.
- This is a local source-based design update; it does not claim the remote Figma file was accessed or synchronized.

## Pretendard

- Author: Kil Hyung-jin / orioncactus. Version 1.3.9 variable WOFF2, served locally from `public/fonts/PretendardVariable.woff2`.
- Source: https://github.com/orioncactus/pretendard
- License: SIL Open Font License 1.1, preserved in `licenses/pretendard.txt`.

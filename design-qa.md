# Design QA - карта маршрута

## Evidence

- Source visual truth: `references/map.jpg`
- Implementation desktop: `screenshots/route-map-desktop.png`
- Implementation mobile: `screenshots/route-map-mobile.png`
- Combined comparison: `screenshots/route-map-comparison.png`
- Desktop viewport: 1440 x 900 CSS px, device scale 1
- Mobile viewport: 390 x 844 CSS px, device scale 1
- Source dimensions: 1000 x 465 px
- Desktop implementation crop: 1360 x 820 px
- Mobile implementation capture: 390 x 844 px
- Normalization: source resized proportionally to 1360 px width and placed above the 1360 px implementation crop in one comparison image
- State: route revealed, route flow and node pulses active

## Full-view comparison

- Route topology matches the reference: Москва and Санкт-Петербург connect to Архангельск; the sea route continues through Тикси to the eastern Chukotka cluster.
- All named points from the reference are preserved: Москва, Санкт-Петербург, Архангельск, Мурманск, Тикси, Якутск, Черский, Билибино, Певек.
- The explanatory paragraph from the upper-left of the source is not reproduced.
- The route remains an illustrative scheme and is explicitly marked as non-navigational.

## Required fidelity surfaces

- Fonts and typography: Geologica is used consistently with the site; map labels are readable and retain clear hierarchy.
- Spacing and layout rhythm: labels do not overlap at 1440 px; the eastern cluster remains legible; mobile uses a compact waypoint list.
- Colors and visual tokens: cold graphite map, ice-white route and amber signal use the existing site palette.
- Image quality and asset fidelity: geography uses the existing vector land asset; route geometry and labels are vector-based and remain sharp.
- Copy and content: point names match the source spelling.

## Focused region

A separate focused crop was not required because the desktop evidence is already a map-only 1360 px crop. The eastern cluster Певек - Черский - Билибино is readable at that scale.

## Findings

- No actionable P0, P1 or P2 findings remain.

## Comparison history

- Iteration 1 - P2: the mobile SVG minimum height created excessive vertical letterboxing.
- Fix: removed the mobile minimum height and kept the complete waypoint list below the map.
- Post-fix evidence: `screenshots/route-map-mobile.png`.

## Verification

- Desktop 1440 x 900: passed.
- Mobile 390 x 844: passed.
- Minimum width 320 px: no horizontal overflow.
- Route dash offset and point transform values change over time.
- Browser console errors and warnings: none.
- Reduced motion: route and points remain static.

final result: passed

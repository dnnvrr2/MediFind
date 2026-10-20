# Custom SVG assets

24 original interface icons plus one empty-cart illustration, created for the Online Medicine Search and Ordering System. These are code-authored vectors, not traced stock graphics.

## Design

- Icons: 24 x 24 viewBox, 1.8-unit strokes, rounded caps and joins.
- Default color: #10796F, matching the current application teal.
- Transparent canvas; delivery wheel centers deliberately use white to separate overlapping outlines.
- Main icons suit 20-24 px usage. Preview includes 16 px checks; prefer 20-24 px for detailed pharmacy and delivery icons.
- Use a 44-48 px touch target around interactive icons.

Open preview.html to inspect the entire set. manifest.json lists icon files. Illustrations are in their own folder and do not share the icon grid.

## Integration

The customer preview uses these assets through frontend/src/components/icon.tsx and react-native-svg on mobile and web. The source SVG files remain editable here. Run node scripts/sync-icons.mjs from frontend after editing the source SVGs to update the typed registry. Avoid loading SVGs as if they were PNGs on native.

The root color attribute sets the standalone default. For inline web SVG, override color with CSS; when rendering through a native component, pass the desired color to the SVG root. Outline strokes reference currentColor.

Keep labels beside unfamiliar actions. Decorative SVGs should be hidden from accessibility; icon-only buttons need accessible names on the button itself. Status information should also have a text label.
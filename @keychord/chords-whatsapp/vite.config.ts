import { config } from "@keychord/config";

const base = config();

// Keep the handler and its native addon at this package's root. Chord resolves
// one vendoring layer, so nesting chords-menu would break when WhatsApp itself
// is vendored into another chord package.
export default {
  ...base,
  pack: [
    {
      ...base.pack[0],
      copy: [
        { from: "node_modules/@keychord/chords-menu/js/menu.js", to: "js" },
        { from: "node_modules/@keychord/chords-menu/target", to: "." },
      ],
    },
    ...base.pack.slice(1),
  ],
};

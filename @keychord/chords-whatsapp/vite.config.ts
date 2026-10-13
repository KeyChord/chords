import { config } from "@keychord/config";

const base = config();

// Keep the menu bundle's native/ directory beside menu.js when flattening this dependency.
// Its relative asset URLs continue to work if WhatsApp is vendored again.
export default {
  ...base,
  pack: [
    {
      ...base.pack[0],
      copy: [
        { from: "node_modules/@keychord/chords-menu/js/menu.js", to: "js" },
        { from: "node_modules/@keychord/chords-menu/js/native", to: "js" },
      ],
    },
    ...base.pack.slice(1),
  ],
};

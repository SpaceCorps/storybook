export type EmojiEntry = {
  src: string;
};

/** Custom emoji by shortcode, for example `":party:": { src: "/party.svg" }`. */
export const emojiMap: Record<string, EmojiEntry> = {};

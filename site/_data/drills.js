import { readFileSync } from "node:fs";

const load = (f) => JSON.parse(readFileSync(new URL(`../../data/${f}`, import.meta.url), "utf8")).items;

export default {
  flashcards: load("flashcards.json"),
  cloze: load("cloze.json"),
  tasks: load("tasks.json"),
  mnemonics: load("mnemonics.json"),
};

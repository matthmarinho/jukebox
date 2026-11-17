"use client";

const LETTERS = [
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M",
  "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z", "#",
];

export type FilterMode = "album" | "artist";

export function getFirstLetter(text: string): string {
  const clean = text
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
  if (!clean) return "#";
  const ch = clean[0];
  return ch >= "A" && ch <= "Z" ? ch : "#";
}

type Props = {
  letter: string | null;
  onChangeLetter: (letter: string | null) => void;
  mode: FilterMode;
  onChangeMode: (mode: FilterMode) => void;
  availableLetters: Set<string>;
};

export default function LetterFilter({
  letter,
  onChangeLetter,
  mode,
  onChangeMode,
  availableLetters,
}: Props) {
  return (
    <div className="mb-4 flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="inline-flex rounded-lg border border-[#2c3036] bg-[#1b1d20] p-0.5">
          <button
            type="button"
            onClick={() => onChangeMode("album")}
            className={`rounded-md px-3 py-1 text-xs font-extrabold uppercase tracking-wider transition ${
              mode === "album"
                ? "bg-[#f5b316] text-[#131416]"
                : "text-[#9ca3af] hover:text-white"
            }`}
          >
            Álbuns
          </button>
          <button
            type="button"
            onClick={() => onChangeMode("artist")}
            className={`rounded-md px-3 py-1 text-xs font-extrabold uppercase tracking-wider transition ${
              mode === "artist"
                ? "bg-[#f5b316] text-[#131416]"
                : "text-[#9ca3af] hover:text-white"
            }`}
          >
            Artistas
          </button>
        </div>

        {letter !== null && (
          <button
            type="button"
            onClick={() => onChangeLetter(null)}
            className="text-xs font-extrabold uppercase tracking-wider text-[#f5b316] hover:underline"
          >
            Ver todos
          </button>
        )}
      </div>

      <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
        {LETTERS.map((l) => {
          const active = letter === l;
          const hasItems = availableLetters.has(l);
          return (
            <button
              key={l}
              type="button"
              onClick={() => onChangeLetter(active ? null : l)}
              className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border text-xs font-extrabold transition ${
                active
                  ? "border-[#f5b316] bg-[#f5b316] text-[#131416]"
                  : hasItems
                    ? "border-[#2c3036] bg-[#1b1d20] text-white hover:border-[#f5b316] hover:text-[#f5b316]"
                    : "border-[#2c3036]/40 bg-[#131416] text-[#9ca3af]/30 hover:border-[#2c3036] hover:text-[#9ca3af]"
              }`}
            >
              {l}
            </button>
          );
        })}
      </div>
    </div>
  );
}

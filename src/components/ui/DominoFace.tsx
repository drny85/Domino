import { PIP_LAYOUT } from "@/lib/pips";

function Half({ value }: { value: number }) {
  return (
    <div className="relative aspect-square w-full">
      {PIP_LAYOUT[value].map(([c, r], i) => (
        <span
          key={i}
          className="absolute size-[18%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-pip shadow-[inset_0_1px_1px_rgba(0,0,0,0.6)]"
          style={{ left: `${50 + c * 27}%`, top: `${50 + r * 27}%` }}
        />
      ))}
    </div>
  );
}

/** Flat ivory domino face (vertical: `a` on top, `b` below). */
export function DominoFace({ a, b, className = "" }: { a: number; b: number; className?: string }) {
  return (
    <div
      className={`flex flex-col rounded-[14%/7%] bg-gradient-to-b from-ivory to-ivory-dark p-[6%] shadow-[0_2px_0_#c9bc9c,0_4px_8px_rgba(0,0,0,0.35)] ${className}`}
    >
      <Half value={a} />
      <div className="relative mx-[8%] my-[4%] h-[2px] rounded bg-stone-500/70">
        <span className="absolute left-1/2 top-1/2 size-[5px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brass" />
      </div>
      <Half value={b} />
    </div>
  );
}

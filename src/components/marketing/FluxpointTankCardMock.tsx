import { Activity } from "lucide-react";

type FluxpointTankCardMockProps = {
  tank: {
    name: string;
    mood: string;
    meta: string;
    gradient: string;
    readings: readonly string[];
  };
};

export function FluxpointTankCardMock({ tank }: FluxpointTankCardMockProps) {
  return (
    <article className="min-w-0 overflow-hidden rounded-lg border border-[#cfded5] bg-white/75 shadow-[0_12px_40px_rgba(11,43,49,0.08)]">
      <div className={`min-h-44 bg-gradient-to-br ${tank.gradient} p-5 text-white`}>
        <div className="flex items-center justify-between gap-3">
          <span className="rounded-full border border-white/35 bg-white/20 px-3 py-1 text-xs font-bold">Aquarium</span>
          <Activity className="h-5 w-5 opacity-80" aria-hidden="true" />
        </div>
        <div className="mt-16">
          <h3 className="font-display text-4xl font-normal leading-none">{tank.name}</h3>
          <p className="mt-1 font-sans text-sm text-white/80">{tank.mood}</p>
        </div>
      </div>
      <div className="space-y-4 p-5">
        <p className="text-sm font-semibold text-[#123f46]">{tank.meta}</p>
        <div className="grid grid-cols-2 gap-2">
          {tank.readings.map((reading) => (
            <div key={reading} className="rounded-md bg-[#edf2e7] px-3 py-2 font-mono text-sm font-semibold text-[#123f46]">
              {reading}
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}

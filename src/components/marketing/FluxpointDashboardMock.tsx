import { dashboardTanks } from "@/components/marketing/marketing-data";
import { FluxpointTankCardMock } from "@/components/marketing/FluxpointTankCardMock";

export function FluxpointDashboardMock() {
  return (
    <div className="rounded-lg border border-[#cfded5] bg-white/65 p-4 shadow-[0_18px_60px_rgba(11,43,49,0.12)] backdrop-blur">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#5e794e]">Current waterline</p>
          <h2 className="mt-1 font-display text-3xl font-normal leading-none text-[#103f48]">Tank dashboard</h2>
        </div>
        <div className="rounded-md bg-[#123f46] px-3 py-2 font-mono text-sm font-bold text-white">3 active tanks</div>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {dashboardTanks.map((tank) => (
          <FluxpointTankCardMock key={tank.name} tank={tank} />
        ))}
      </div>
    </div>
  );
}

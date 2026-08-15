import { useState } from 'react';
import { Shield } from 'lucide-react';

export interface PlayerStats {
  maxHp: number;
  currentHp: number;
  damageMin: number;
  damageMax: number;
  defense: number;
  agility: number;
  luck: number;
  level: number;
}

interface StatsPanelProps {
  stats: PlayerStats;
}

export default function StatsPanel({ stats }: StatsPanelProps) {
  const [open, setOpen] = useState(false);
  const hpFraction = stats.currentHp / stats.maxHp;

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 font-bold text-sm border shadow-xl ${
          open
            ? 'bg-red-900 border-red-500 text-white'
            : 'bg-[#0d0804]/90 border-red-900/40 text-red-400 hover:border-red-500/70 hover:bg-[#1a0808]/90'
        }`}
        title="Stats"
      >
        <Shield size={16} />
      </button>

      {open && (
        <div className="bg-[#0d0804]/97 border border-red-900/40 rounded-xl shadow-2xl overflow-hidden backdrop-blur-sm min-w-[210px]">
          <div className="px-4 pt-3 pb-2 border-b border-red-900/20">
            <div className="flex items-center gap-2">
              <Shield size={12} className="text-red-400" />
              <span className="text-red-400 text-xs uppercase tracking-widest">Combat Stats</span>
              <span className="text-red-900/80 text-xs ml-1">Lv.{stats.level}</span>
            </div>
          </div>

          <div className="p-3 flex flex-col gap-2.5">
            {/* HP bar */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-red-300 text-[10px] uppercase tracking-wider font-bold">HP</span>
                <span className="text-[#f0e8d8] text-[10px] tabular-nums">{stats.currentHp}/{stats.maxHp}</span>
              </div>
              <div className="h-2.5 bg-[#1a0808] rounded-full border border-red-900/40 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-red-800 to-red-500 rounded-full transition-all duration-500"
                  style={{ width: `${hpFraction * 100}%` }}
                />
              </div>
            </div>

            {/* Stat rows */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 pt-0.5">
              <StatRow label="DMG" value={`${stats.damageMin}–${stats.damageMax}`} color="text-amber-400" />
              <StatRow label="DEF" value={String(stats.defense)} color="text-blue-400" />
              <StatRow label="AGI" value={String(stats.agility)} color="text-green-400" />
              <StatRow label="LUCK" value={String(stats.luck)} color="text-purple-400" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[#8b6914]/80 text-[10px] uppercase tracking-wider">{label}</span>
      <span className={`${color} text-xs font-bold font-mono`}>{value}</span>
    </div>
  );
}

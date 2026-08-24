import { Crosshair, Shield, Zap, Package } from 'lucide-react';
import { PlayerStats } from './StatsPanel';
import { useLanguage } from '../i18n';

type CombatPhase = 'intro' | 'player_turn' | 'enemy_turn' | 'victory';

interface CombatPanelProps {
  combatPhase: CombatPhase;
  playerHp: number;
  playerMaxHp: number;
  enemyHp: number;
  enemyMaxHp: number;
  combatLog: string[];
  stats: PlayerStats;
  onAttack: () => void;
  onParry: () => void;
  parryReady: boolean;
}

const ENEMY_MAX_HP = 20;

// HP bar above a character — positioned using % coordinates over the scene
function FloatingHpBar({
  label,
  hp,
  maxHp,
  x,
  y,
  width,
  height,
  barColor,
  labelColor,
}: {
  label: string;
  hp: number;
  maxHp: number;
  x: number;
  y: number;
  width: number;
  height: number;
  barColor: string;
  labelColor: string;
}) {
  const fraction = Math.max(0, Math.min(1, hp / maxHp));
  return (
    <div
      className="absolute pointer-events-none z-25"
      style={{ left: `${x}%`, top: `${y}%`, width: `${width}%`, height: `${height}%` }}
    >
      <div className="w-full h-full flex flex-col justify-center gap-0.5 px-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: labelColor }}>
            {label}
          </span>
          <span className="text-[9px] font-mono tabular-nums" style={{ color: labelColor }}>
            {hp}/{maxHp}
          </span>
        </div>
        <div className="w-full rounded-full overflow-hidden" style={{ height: 9, background: 'rgba(10,4,2,0.8)', border: '1px solid rgba(139,105,20,0.3)' }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${fraction * 100}%`, background: barColor }}
          />
        </div>
      </div>
    </div>
  );
}

export default function CombatPanel({
  combatPhase,
  playerHp,
  playerMaxHp,
  enemyHp,
  enemyMaxHp,
  combatLog,
  stats,
  onAttack,
  onParry,
  parryReady,
}: CombatPanelProps) {
  const { isChinese } = useLanguage();
  const isPlayerTurn = combatPhase === 'player_turn';

  // Bounding box provided: x:57 y:10.4 width:19.6 height:8.6
  // Points: player [57,11.2]→[76.6,10.4], [57.8,19]→[76.3,18.6]
  // Player HP bar occupies that bounding box
  // Stranger HP bar: same width/height, positioned above the stranger figure
  // Stranger figure is left side of the combat image — place above them at ~x:2, same size
  const playerHpBar = { x: 57, y: 10.4, width: 19.6, height: 8.6 };
  const enemyHpBar = { x: 2, y: 10.4, width: 19.6, height: 8.6 };

  if (combatPhase === 'intro') {
    return null;
    return (
      <>
        {/* Floating HP bars even in intro */}
        <FloatingHpBar
          label={isChinese ? '他' : 'You'}
          hp={playerHp} maxHp={playerMaxHp}
          {...playerHpBar}
          barColor="linear-gradient(to right, #991b1b, #ef4444)"
          labelColor="#fca5a5"
        />
        <FloatingHpBar
          label={isChinese ? '陌生人' : 'Stranger'}
          hp={enemyHp} maxHp={ENEMY_MAX_HP}
          {...enemyHpBar}
          barColor="linear-gradient(to right, #7f1d1d, #dc2626)"
          labelColor="#f87171"
        />
        <div className="absolute bottom-0 left-0 right-0 z-30">
          <div className="bg-[#050302]/97 border-t-2 border-red-900/60 backdrop-blur-md">
            <div className="px-6 py-5">
              <div className="text-red-500 text-[10px] uppercase tracking-[0.2em] font-bold mb-3">
                {isChinese ? '入侵——战斗即将开始' : 'Intrusion — Combat Imminent'}
              </div>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0 mt-1.5" />
                  <div>
                    <span className="text-[#8b6914]/70 text-xs">{isChinese ? '陌生人：' : 'Stranger:'}</span>
                    <p className="text-[#f0e8d8] text-sm font-mono italic mt-0.5">
                      {isChinese ? '“他醒了！杀了他！”' : '“Hey! He is awake! Kill him!”'}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-[#c4942a] flex-shrink-0 mt-1.5" />
                  <div>
                    <span className="text-[#8b6914]/70 text-xs">{isChinese ? '他：' : 'You:'}</span>
                    <p className="text-[#f0e8d8] text-sm font-mono italic mt-0.5">
                      ""
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                <span className="text-red-400/70 text-[10px] uppercase tracking-widest">{isChinese ? '战斗开始…' : 'Combat beginning...'}</span>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (combatPhase === 'victory') {
    return (
      <>
        <FloatingHpBar
          label={isChinese ? '他' : 'You'}
          hp={playerHp} maxHp={playerMaxHp}
          {...playerHpBar}
          barColor="linear-gradient(to right, #991b1b, #ef4444)"
          labelColor="#fca5a5"
        />
        <FloatingHpBar
          label={isChinese ? '陌生人' : 'Stranger'}
          hp={0} maxHp={ENEMY_MAX_HP}
          {...enemyHpBar}
          barColor="linear-gradient(to right, #7f1d1d, #dc2626)"
          labelColor="#f87171"
        />
        <div className="absolute bottom-0 left-0 right-0 z-30">
          <div className="bg-[#050302]/97 border-t-2 border-[#c4942a]/60 backdrop-blur-md">
            <div className="px-6 py-5 text-center">
              <div className="text-[#c4942a] text-xs uppercase tracking-[0.2em] font-bold mb-2">{isChinese ? '胜利' : 'Victory'}</div>
              <p className="text-[#f0e8d8] text-sm">{isChinese ? '陌生人倒下了，咖啡馆再次恢复安静。' : 'The stranger falls. The café is silent again.'}</p>
              <p className="text-[#e8d5a3] text-sm font-bold mt-2">+200 XP</p>
              <p className="text-[#8b6914]/60 text-xs mt-3 italic">{isChinese ? '正在返回场景…' : 'Returning to the scene...'}</p>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Floating HP bars above each character */}
      <FloatingHpBar
        label={isChinese ? '他' : 'You'}
        hp={playerHp} maxHp={playerMaxHp}
        {...playerHpBar}
        barColor={
          playerHp / playerMaxHp > 0.5
            ? 'linear-gradient(to right, #991b1b, #ef4444)'
            : playerHp / playerMaxHp > 0.25
            ? 'linear-gradient(to right, #92400e, #f97316)'
            : 'linear-gradient(to right, #7f1d1d, #fca5a5)'
        }
        labelColor="#fca5a5"
      />
      <FloatingHpBar
        label={isChinese ? '陌生人' : 'Stranger'}
        hp={enemyHp} maxHp={ENEMY_MAX_HP}
        {...enemyHpBar}
        barColor="linear-gradient(to right, #7f1d1d, #dc2626)"
        labelColor="#f87171"
      />

      {/* Bottom panel — combat log + actions (no HP bars here) */}
      <div className="absolute bottom-0 left-0 right-0 z-30" style={{ maxHeight: '45%' }}>
        <div className="bg-[#050302]/97 border-t-2 border-red-900/60 backdrop-blur-md">

          {/* Combat log */}
          <div className="px-5 py-3 min-h-[56px] max-h-[80px] overflow-y-auto">
            {combatLog.length === 0 ? (
              <p className="text-[#8b6914]/50 text-xs italic">{isChinese ? '陌生人正在靠近…' : 'The stranger advances toward you...'}</p>
            ) : (
              <div className="flex flex-col gap-0.5">
                {combatLog.slice(-4).map((entry, i) => (
                  <p
                    key={i}
                    className={`text-xs font-mono ${
                      entry.includes('You hit') ? 'text-[#c4942a]' :
                      entry.includes('stranger strikes') || entry.includes('hits you') ? 'text-red-400' :
                      entry.includes('falls') || entry.includes('victorious') ? 'text-green-400' :
                      'text-[#d4c090]'
                    }`}
                  >
                    &gt; {entry}
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="px-5 pb-4 pt-1 border-t border-red-900/15">
            <div className="text-[#8b6914]/60 text-[10px] uppercase tracking-widest mb-2">
              {isPlayerTurn ? (isChinese ? '轮到他了——选择一个动作：' : 'Your turn — choose an action:') : (isChinese ? '敌人正在攻击…' : 'Enemy attacking...')}
            </div>
            {isPlayerTurn && <p className="mb-2 text-xs text-yellow-200">Click the yellow Parry bubble before the enemy attacks: it reduces their 10 damage hit to 3.</p>}
            <div className="flex gap-2">
              <button
                onClick={onAttack}
                disabled={!isPlayerTurn}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                  isPlayerTurn
                    ? 'bg-red-900/40 border-red-600/60 text-red-200 hover:bg-red-800/60 hover:border-red-500 cursor-pointer'
                    : 'bg-[#1a0808]/50 border-red-900/20 text-red-900/50 cursor-not-allowed'
                }`}
              >
                <Crosshair size={13} />
                <span>{isChinese ? '射击' : 'Shoot'}</span>
                <span className="text-[10px] opacity-60 ml-1">{stats.damageMin}–{stats.damageMax} dmg</span>
              </button>

              <button
                onClick={onParry}
                disabled={!isPlayerTurn}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-extrabold border-2 transition-all ${
                  isPlayerTurn
                    ? 'bg-yellow-300 border-yellow-100 text-slate-950 shadow-[0_0_20px_rgba(250,204,21,.7)] hover:bg-yellow-200 cursor-pointer'
                    : 'bg-yellow-900/30 border-yellow-900/30 text-yellow-900/50 cursor-not-allowed'
                }`}
                title="Parry the next hit: 10 damage becomes 3"
              >
                <Shield size={14} />
                <span>{parryReady ? 'Parry ready' : 'Parry'}</span>
              </button>

              <button
                disabled
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs border bg-[#0d0804]/50 border-[#8b6914]/10 text-[#8b6914]/30 cursor-not-allowed"
              >
                <Zap size={13} />
                <span>{isChinese ? '技能' : 'Ability'}</span>
              </button>

              <button
                disabled
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs border bg-[#0d0804]/50 border-[#8b6914]/10 text-[#8b6914]/30 cursor-not-allowed"
              >
                <Package size={13} />
                <span>{isChinese ? '物品' : 'Items'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

import { useState } from 'react';
import { Sword, Key, Package, ScrollText } from 'lucide-react';
import { INVENTORY_LABELS } from '../gameData';
import { englishTerm } from '../learningLanguage';
import { useLanguage } from '../i18n';

function toTitleCase(str: string): string {
  return str.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

interface InventoryPanelProps {
  items: string[];
}

const ICONS: Record<string, React.ReactNode> = {
  knife: <Sword size={18} />,
  key: <Key size={18} />,
  note: <ScrollText size={18} />,
  baguette: <Package size={18} />,
};

export default function InventoryPanel({ items }: InventoryPanelProps) {
  const { isChinese } = useLanguage();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-center gap-2">
      {/* Toggle button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 font-bold text-sm border shadow-xl ${
          open
            ? 'bg-[#8b6914] border-[#c4942a] text-[#0d0804]'
            : 'bg-[#0d0804]/90 border-[#8b6914]/40 text-[#c4942a] hover:border-[#c4942a]/70 hover:bg-[#1a1008]/90'
        } ${items.length > 0 ? 'ring-1 ring-[#c4942a]/40' : ''}`}
        title={isChinese ? '物品栏 (I)' : 'Inventory (I)'}
      >
        I
      </button>

      {/* Panel */}
      {open && (
        <div className="bg-[#0d0804]/95 border border-[#8b6914]/40 rounded-xl shadow-2xl overflow-hidden backdrop-blur-sm">
          <div className="px-4 pt-3 pb-2 border-b border-[#8b6914]/20">
            <div className="flex items-center gap-2">
              <Package size={12} className="text-[#8b6914]/80" />
              <span className="text-[#c4942a] text-xs uppercase tracking-widest">{isChinese ? '物品栏' : 'Inventory'}</span>
            </div>
          </div>

          <div className="p-3 min-w-[170px]">
            {items.length === 0 ? (
              <div className="text-[#a09070] text-xs italic px-1 py-2">
                {isChinese ? '暂时没有物品。' : 'Nothing for now.'}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {items.map((item) => {
                  const label = INVENTORY_LABELS[item];
                  return (
                    <div
                      key={item}
                      className="flex items-center gap-3 bg-[#1a1008] border border-[#8b6914]/25 rounded-lg px-3 py-2.5"
                    >
                      <span className="text-[#c4942a]">{ICONS[item] ?? <Sword size={18} />}</span>
                      <div>
                        <div className="text-[#f0e8d8] text-xs font-bold">{toTitleCase(englishTerm(label?.french ?? item))}</div>
                        <div className="text-[#b09060] text-xs">{toTitleCase(label?.english ?? item)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

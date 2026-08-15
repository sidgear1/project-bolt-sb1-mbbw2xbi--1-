import { useState } from 'react';
import { HotspotData } from '../types';
import { englishTerm } from '../learningLanguage';
import { chineseTerm } from '../learningLanguage';
import { useLanguage } from '../i18n';

function toTitleCase(str: string): string {
  return str.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

interface HotspotProps {
  hotspot: HotspotData;
  onClick: () => void;
  isActive: boolean;
  onHover: (hovered: boolean) => void;
}

export default function Hotspot({ hotspot, onClick, isActive, onHover }: HotspotProps) {
  const [hovered, setHovered] = useState(false);
  const { isChinese } = useLanguage();
  const { x, y, width, height } = hotspot.region;

  // Default tooltip for hotspots without labelPosition
  const defaultTooltip = hovered && !hotspot.labelPosition && (
    <div
      className="absolute pointer-events-none z-30"
      style={{ bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: '6px' }}
    >
      <div className="bg-[#0d0804]/95 border border-[#8b6914]/50 text-[#e8d5a3] text-xs px-3 py-1.5 rounded-lg font-medium shadow-xl whitespace-nowrap">
        <span className="font-display">{toTitleCase(englishTerm(hotspot.frenchName))}</span>
        <span className="text-[#6a4a2a] ml-2">— {toTitleCase(isChinese ? chineseTerm(hotspot.frenchName, hotspot.english) : hotspot.english)}</span>
      </div>
    </div>
  );

  return (
    <div
      style={{
        position: 'absolute',
        left: `${x}%`,
        top: `${y}%`,
        width: `${width}%`,
        height: `${height}%`,
      }}
      className="cursor-pointer z-10"
      onMouseEnter={() => { setHovered(true); onHover(true); }}
      onMouseLeave={() => { setHovered(false); onHover(false); }}
      onClick={onClick}
    >
      {/* Fully invisible region — no box, no border, no outline */}
      <div
        className="absolute inset-0 rounded-sm"
        style={{ background: 'transparent', border: 'none', outline: 'none' }}
      />
      {defaultTooltip}
    </div>
  );
}

// Exported tooltip component to render at scene level for hotspots with labelPosition
export function HotspotTooltip({ hotspot }: { hotspot: HotspotData }) {
  const { isChinese } = useLanguage();
  return (
    <div
      className="pointer-events-none z-30 whitespace-nowrap"
      style={{
        position: 'absolute',
        left: `${hotspot.labelPosition!.x}%`,
        top: `${hotspot.labelPosition!.y}%`,
        transform: 'translate(-50%, -50%)',
      }}
    >
      <div className="bg-[#0d0804]/95 border border-[#8b6914]/50 text-[#e8d5a3] text-xs px-3 py-1.5 rounded-lg font-medium shadow-xl">
        <span className="font-display">{toTitleCase(englishTerm(hotspot.frenchName))}</span>
        <span className="text-[#6a4a2a] ml-2">— {toTitleCase(isChinese ? chineseTerm(hotspot.frenchName, hotspot.english) : hotspot.english)}</span>
      </div>
    </div>
  );
}

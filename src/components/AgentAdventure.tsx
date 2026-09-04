import { useEffect, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { assetUrl } from '../utils/assetUrl';
import { useSpeech } from '../hooks/useSpeech';
import SmoothSceneImage from './SmoothSceneImage';
import { preloadSceneWindow } from '../utils/imagePreloader';

type Props = { onMenu: () => void; audioMuted?: boolean; onToggleAudio?: () => void };

const OPENING = "That's right, we got him. Boss is going to be very pleased at last. That's right, all exits are being covered. Don't worry, I'm on it now.";

export default function AgentAdventure({ onMenu, audioMuted = false, onToggleAudio }: Props) {
  const [image, setImage] = useState(1);
  const [message, setMessage] = useState(OPENING);
  const { speak } = useSpeech();
  const isRoom = image === 2;
  useEffect(() => {
    preloadSceneWindow([1, 2, 3].map(index => assetUrl(`scenes/bond/${index}.png`)), image - 1, 12);
  }, [image]);
  return <main className="fixed inset-0 overflow-hidden bg-black text-white" onClick={() => !isRoom && image < 3 && setImage(current => current + 1)}>
    <SmoothSceneImage src={assetUrl(`scenes/bond/${image}.png`)} alt={`Agent story image ${image}`} className="absolute inset-0 h-full w-full object-cover" draggable={false} />
    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-black/35" />
    <header className="absolute left-0 right-0 top-0 z-10 flex items-start justify-between p-5" onClick={event => event.stopPropagation()}><div><p className="text-[10px] font-semibold uppercase tracking-[.25em] text-white/60">Adventure</p><h1 className="mt-1 text-lg font-bold tracking-wide">THE AGENT</h1></div><div className="flex gap-2"><button title={audioMuted ? "Turn sound on" : "Mute sound"} onClick={onToggleAudio} className="rounded-full border border-white/20 bg-black/55 p-2.5">{audioMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}</button><button onClick={onMenu} className="rounded-full border border-white/20 bg-black/55 px-4 py-2 text-xs uppercase tracking-wider">Menu</button></div></header>
    {isRoom && <button aria-label="Work station" onClick={event => { event.stopPropagation(); setImage(3); setMessage('You search the work station for the clue that will lead to him.'); }} className="tammy-hotspot" style={{ left: '53%', top: '57%' }}><span className="hotspot-tooltip">Work station</span></button>}
    <section className="story-dialogue-panel absolute z-10"><div className="story-dialogue-content"><div className="scene-eyebrow">Narrator</div><p className="story-dialogue-text">{message}</p><div className="cop-narration-footer"><span>{isRoom ? "explore the glowing point" : "click anywhere to continue"}</span><button onClick={event => { event.stopPropagation(); speak(message, 'adventure'); }}><Volume2 size={12} /> Listen</button></div></div></section>
  </main>;
}

import { useState } from 'react';
import { ArrowLeftRight } from 'lucide-react';

interface BeforeAfterSliderProps {
  beforeUrl: string;
  afterUrl?: string | null;
}

export function BeforeAfterSlider({ beforeUrl, afterUrl }: BeforeAfterSliderProps) {
  const [sliderPosition, setSliderPosition] = useState(50);

  if (!afterUrl) {
    return (
      <div className="relative w-full aspect-video rounded-xl overflow-hidden group">
        <img src={beforeUrl} alt="Reported Issue" className="w-full h-full object-cover" />
        <div className="absolute bottom-3 left-3 px-2.5 py-1 bg-black/70 backdrop-blur-sm text-white text-[10px] font-black tracking-widest uppercase rounded">
          Reported Condition
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full aspect-video rounded-xl overflow-hidden group">
      {/* Before Image (Left side) */}
      <img src={beforeUrl} alt="Before" className="absolute inset-0 w-full h-full object-cover" />
      
      {/* After Image (Right side - clipped) */}
      <img 
        src={afterUrl} 
        alt="After" 
        className="absolute inset-0 w-full h-full object-cover" 
        style={{ clipPath: `polygon(${sliderPosition}% 0, 100% 0, 100% 100%, ${sliderPosition}% 100%)` }} 
      />
      
      {/* Slider Line */}
      <div 
        className="absolute top-0 bottom-0 w-1 bg-white/90 shadow-[0_0_15px_rgba(0,0,0,0.8)] z-10 pointer-events-none"
        style={{ left: `${sliderPosition}%`, transform: 'translateX(-50%)' }}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-xl border border-slate-200">
          <ArrowLeftRight className="w-4 h-4 text-indigo-600" />
        </div>
      </div>
      
      {/* Invisible Input for dragging */}
      <input
        type="range"
        min="0"
        max="100"
        value={sliderPosition}
        onChange={(e) => setSliderPosition(Number(e.target.value))}
        className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-20"
      />
      
      {/* Labels */}
      <div className="absolute top-3 left-3 px-2.5 py-1 bg-rose-600/90 shadow-lg text-white text-[10px] font-black tracking-widest uppercase rounded pointer-events-none">
        BEFORE
      </div>
      <div className="absolute top-3 right-3 px-2.5 py-1 bg-emerald-500/90 shadow-lg text-white text-[10px] font-black tracking-widest uppercase rounded pointer-events-none">
        AFTER
      </div>
    </div>
  );
}

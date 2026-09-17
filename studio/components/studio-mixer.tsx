'use client';

import { Slider as SliderPrimitive } from 'radix-ui';
import { activeTrack, VOICES, type Mix, type Score } from '@/lib/music';

export function StudioMixer({ score, mix, position, playing, onMix }: {
  score: Score; mix: Mix; position: number; playing: boolean; onMix: (mix: Mix) => void;
}) {
  const beat = Math.min(score.beats, position * score.bpm / 60);
  const progress = beat / score.beats * 100;
  return <section className={`mix-console${playing ? ' is-playing' : ''}`} aria-label="四轨混音台">
    <div className="mix-console-heading"><span>SESSION / 4 TRACKS</span><span>{playing ? `播放中 · 第 ${Math.min(16, Math.floor(beat / 4) + 1)} 小节` : '16 BARS / 4/4'}</span></div>
    <div className="mix-bar-ruler" aria-hidden="true">{[1, 5, 9, 13, 16].map(bar => <span key={bar}>{String(bar).padStart(2, '0')}</span>)}</div>
    <div className="mix-track-stack">{score.tracks.map((track, index) => {
      const audible = activeTrack(mix, index) && mix[index].volume > 0;
      const sounding = playing && audible && track.notes.some(note => beat >= note.beat && beat < note.beat + note.duration);
      const pitches = track.notes.map(note => note.pitch);
      const minPitch = Math.min(...pitches) - 2, maxPitch = Math.max(...pitches) + 2;
      return <article key={track.id} className={`mix-channel${audible ? '' : ' is-muted'}${sounding ? ' is-sounding' : ''}`} data-track={track.id}>
        <div className="mix-channel-heading"><span className="mix-channel-index">0{index + 1}</span><h3>{track.name}</h3><span className="mix-channel-state">{mix[index].mute ? '已静音' : mix.some(item => item.solo) && !mix[index].solo ? '独奏排除' : mix[index].volume === 0 ? '音量为零' : sounding ? '发声中' : mix[index].solo ? '独奏' : playing ? '间奏' : '待播放'}</span><span className="mix-channel-voice">{VOICES[track.voice]}</span></div>
        <div className="mix-channel-body"><div className="mix-piano-roll" role="img" aria-label={`${track.name}，16小节音符预览`}>
          {playing && audible && <span className="mix-played-area" style={{ width: `${progress}%` }} />}
          {track.notes.map((note, i) => <i key={i} className={playing && audible && beat >= note.beat && beat < note.beat + note.duration ? 'is-active' : undefined} style={{ left: `${note.beat / score.beats * 100}%`, width: `${Math.max(.25, note.duration / score.beats * 100)}%`, top: `${12 + (maxPitch - note.pitch) / (maxPitch - minPitch) * 66}%` }} />)}
          {playing && <span className="mix-playhead" style={{ left: `${progress}%` }} />}
        </div><div className="mix-channel-controls"><div className="mix-channel-toggles"><button aria-label={`静音${track.name}`} aria-pressed={mix[index].mute} onClick={() => onMix(mix.map((item, i) => i === index ? { ...item, mute: !item.mute } : item))}>M</button><button aria-label={`独奏${track.name}`} aria-pressed={mix[index].solo} onClick={() => onMix(mix.map((item, i) => i === index ? { ...item, solo: !item.solo } : item))}>S</button></div>
          <div className="mix-channel-level"><span>音量</span><output>{Math.round(mix[index].volume * 100)}%</output></div>
          <SliderPrimitive.Root className="mix-gain-control" value={[mix[index].volume * 100]} onValueChange={value => onMix(mix.map((item, i) => i === index ? { ...item, volume: value[0] / 100 } : item))} min={0} max={100} step={1}><SliderPrimitive.Track className="mix-gain-track"><SliderPrimitive.Range className="mix-gain-range" /></SliderPrimitive.Track><SliderPrimitive.Thumb className="mix-gain-thumb" aria-label={`${track.name}音量`} aria-valuetext={`${Math.round(mix[index].volume * 100)}%`} /></SliderPrimitive.Root>
        </div></div>
      </article>;
    })}</div>
    <p className="mix-console-note">M 静音 · S 独奏 <span>音符亮起跟随播放进度</span></p>
  </section>;
}

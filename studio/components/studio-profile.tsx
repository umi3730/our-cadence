'use client';

import { useId } from 'react';
import { ChevronDown, ImagePlus, LoaderCircle, Music2, Shuffle, SlidersHorizontal } from 'lucide-react';
import { Slider as SliderPrimitive } from 'radix-ui';
import { MUSIC_DIMENSIONS, MUSIC_DIMENSION_EFFECTS, musicProfileMeta, type MusicProfile, type Profile } from '@/lib/music';
import { musicWithStory } from '@/lib/character-story';

type Dimension = keyof Omit<MusicProfile, 'hue' | 'aggression'>;
const CHANNEL_NAMES: Record<Dimension, string> = {
  energy: 'ENERGY', warmth: 'WARMTH', tension: 'TENSION', mystery: 'MYSTERY',
  brightness: 'BRIGHTNESS', elegance: 'ELEGANCE',
};
type ProfileProps = {
  profile: Profile;
  previewUrl: string;
  analyzing: boolean;
  busy: boolean;
  needsGeneration: boolean;
  visionState: 'idle' | 'loading' | 'ready' | 'fallback';
  onUpload: () => void;
  onDimension: (key: Dimension, value: number) => void;
  onApply: () => void;
};

export function StudioProfile({ profile, previewUrl, analyzing, busy, visionState, needsGeneration, onUpload, onDimension, onApply }: ProfileProps) {
  const id = useId();
  const { music, image } = profile;
  const understanding = image?.understanding;
  const meta = music ? musicProfileMeta(music, profile.mood) : null;
  const strongest = music ? [...MUSIC_DIMENSIONS].sort((a, b) => music[b.key] - music[a.key]).slice(0, 3) : [];
  const status = analyzing ? '正在读图' : understanding ? '语义分析' : image ? '本地分析' : '参考图片';
  const storyClues = music ? musicWithStory(image?.musicBaseline ?? music, profile.description).clues : [];

  return <section className={`sound-profile ${music ? 'is-ready' : 'is-empty'}`} aria-label="图片与音乐性格">
    <div className="sound-profile-main">
      <div className="sound-reference">
        <div className="sound-eyebrow"><span>01 / REFERENCE</span><span className="sound-status">{status}</span></div>
        <button className="sound-image" onClick={onUpload} disabled={analyzing || busy} aria-label={image ? '更换参考图片' : '上传参考图片'}>
          {(previewUrl || image?.thumbnail) ? <img src={previewUrl || image?.thumbnail} alt="当前角色参考图片" /> : <span className="sound-image-empty"><ImagePlus size={28} strokeWidth={1.25} aria-hidden="true" /><b>让灵感有个起点</b><small>点击上传图片</small></span>}
          {analyzing && <span className="sound-image-loading" role="status"><LoaderCircle size={22} className="spin" aria-hidden="true" />正在分析图片…</span>}
          {image && !analyzing && <span className="sound-image-change"><ImagePlus size={14} aria-hidden="true" />换一张</span>}
        </button>
        {image ? <>
          <div className="sound-image-caption"><span>{understanding?.identity.name || profile.name || '当前参考'}</span><div className="sound-swatches" aria-label="图片主色">{image.palette.map(color => <i key={color} style={{ backgroundColor: color }} title={color} />)}</div></div>
          {!!image.semantics?.length && <div className="sound-tags">{image.semantics.slice(0, 3).map(tag => <span key={tag.label + tag.source}>{tag.label}</span>)}</div>}
          {profile.description.trim() && <div className="sound-story-source"><span>背景故事已参与</span><small>{understanding && image.storyAnalyzed ? '图像与故事联合理解' : image.musicBaseline && storyClues.length ? `关键词线索：${storyClues.join(' / ')}` : '作为主题创作种子，可重新理解图像与故事'}</small></div>}
        </> : <p className="sound-image-note">JPG / PNG / WebP / AVIF · 最大 20 MB</p>}
      </div>

      <div className="sound-personality">
        <div className="sound-eyebrow"><span>02 / MUSIC PROFILE</span>{music && <SlidersHorizontal size={15} aria-hidden="true" />}</div>
        <div className="sound-profile-title"><h3>{music ? '你的音乐性格' : '从画面，到旋律。'}</h3><p>{music ? strongest.map(item => item.high).join(' · ') : '上传角色、插画或风景，找到属于它的声音。'}</p></div>
        {music && meta ? <>
          <div className="sound-meter-deck">
          <div className="sound-meter-caption" aria-hidden="true"><span>CHARACTER / MIX</span><span>00 — 100</span></div>
          <div className="sound-bars" aria-label="音乐参数，范围 0 至 100">
            {MUSIC_DIMENSIONS.map(dimension => <div className="sound-bar-row" data-dimension={dimension.key} key={dimension.key}>
              <div className="sound-bar-label"><span id={`${id}-${dimension.key}`}>{dimension.name}</span><small aria-hidden="true">{CHANNEL_NAMES[dimension.key]}</small></div>
              <SliderPrimitive.Root className="sound-bar" disabled={analyzing || busy} value={[music[dimension.key]]} min={0} max={100} step={1} onValueChange={value => onDimension(dimension.key, value[0])}>
                <SliderPrimitive.Track data-slot="slider-track"><SliderPrimitive.Range data-slot="slider-range" /></SliderPrimitive.Track>
                <SliderPrimitive.Thumb data-slot="slider-thumb" aria-labelledby={`${id}-${dimension.key}`} aria-valuetext={`${music[dimension.key]}，${dimension.low}到${dimension.high}`} />
              </SliderPrimitive.Root>
              <output className="sound-bar-value" aria-label={`${dimension.name}数值`}>{String(music[dimension.key]).padStart(2, '0')}</output>
            </div>)}
          </div>
          <div className="sound-chart-legend"><span>拖动条形图微调</span><span>弱 0 — 100 强</span></div>
          </div>
        </> : <div className="sound-empty-guide"><div className="sound-empty-bars" aria-hidden="true">{[62, 84, 42, 70, 52].map((width, index) => <i key={index}><span style={{ width: `${width}%` }} /></i>)}</div><p>六项参数，一眼读懂。<br />上传后可自由调整，再生成主题。</p></div>}
      </div>
    </div>

    {music && <>
      <div className="sound-profile-footer">
        <div className="sound-compose-ticket"><span className="sound-compose-number" aria-hidden="true">03</span><div className="sound-compose-copy"><span className="sound-compose-eyebrow">NEXT / COMPOSE</span><h4>把性格，谱成旋律。</h4><p>{visionState === 'loading' ? <><LoaderCircle size={14} className="spin" aria-hidden="true" />正在补充语义理解…</> : needsGeneration ? '参数同步中，稍候即可试听' : '参数停下即更新 · 4 小节 / 三种演绎'}</p></div></div>
        <button className="sound-compose-button" onClick={onApply} disabled={busy || analyzing || needsGeneration}><span>{analyzing ? '分析中' : needsGeneration ? '同步中' : '换一组灵感'}</span><span className="sound-compose-icon"><Shuffle size={18} strokeWidth={1.8} aria-hidden="true" /></span></button>
      </div>
      <details className="sound-disclosure">
        <summary><span>图片解读与参数说明<small>{understanding ? '主体、场景与配乐线索' : '本地视觉分析'}</small></span><ChevronDown size={16} aria-hidden="true" /></summary>
        <div className="sound-details-body">
          {meta && <div className="sound-meta" aria-label="音乐建议"><span><b>{meta.bpm}</b> BPM</span><span>{meta.scaleName}</span><span>{meta.texture}</span></div>}
          {understanding ? <>
            <p className="sound-summary">{understanding.summary}</p>
            <div className="sound-reading-grid"><article><span>主体</span><h4>{understanding.identity.name || '画面主角'}</h4><p>{understanding.subject.description || '暂无主体描述'}</p><div className="sound-tags">{understanding.subject.elements.map((item, index) => <span key={index}>{item}</span>)}</div></article><article><span>背景</span><h4>{image?.backgroundMode === 'transparent' ? '透明背景' : '场景氛围'}</h4><p>{understanding.background.description || '暂无场景描述'}</p><div className="sound-tags">{[...understanding.background.elements, ...understanding.background.setting].slice(0, 6).map((item, index) => <span key={index}>{item}</span>)}</div></article></div>
            {understanding.memeContext && <p className="sound-summary">{understanding.memeContext}</p>}
            {!!understanding.musicAssociations.length && <div className="sound-associations"><span>配乐线索</span>{understanding.musicAssociations.map((item, index) => <p key={index}><Music2 size={14} aria-hidden="true" /><b>{item.title}</b>{item.artist && <span>{item.artist}</span>}</p>)}</div>}
          </> : <p className="sound-summary">当前结合图片特征与故事关键词进行本地规则分析，不等于完整的语义理解。故事仍会作为主题创作种子，你可以继续调整音乐参数。</p>}
          {image && <dl className="sound-visual-data"><div><dt>亮度</dt><dd>{image.visual.brightness}</dd></div><div><dt>饱和度</dt><dd>{image.visual.saturation}</dd></div><div><dt>对比度</dt><dd>{image.visual.contrast}</dd></div><div><dt>复杂度</dt><dd>{image.visual.complexity}</dd></div><div><dt>色温</dt><dd>{image.visual.warmth}</dd></div></dl>}
          <div className="sound-dimension-guide">{MUSIC_DIMENSIONS.map(dimension => <p key={dimension.key}><b>{dimension.name}</b><span>{dimension.low} → {dimension.high}。{MUSIC_DIMENSION_EFFECTS[dimension.key].hint}</span></p>)}</div>
        </div>
      </details>
    </>}
  </section>;
}

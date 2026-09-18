import { DoodleAnimation } from './doodle-animation';

/** Original Lordicon Doodle Motif artwork, downloaded through the official editor. */
export function CelestialDecorations({ paused = false }: { paused?: boolean }) {
  return <div className="celestial-decorations" aria-hidden="true">
    <span className="celestial-piece celestial-moon"><DoodleAnimation name="moon-stars" animated paused={paused} /></span>
    <span className="celestial-piece celestial-music"><DoodleAnimation name="music-note" animated paused={paused} /></span>
    <span className="celestial-piece celestial-comet"><DoodleAnimation name="shooting-stars" animated paused={paused} /></span>
    <span className="celestial-piece celestial-stars"><DoodleAnimation name="cloud" animated paused={paused} /></span>
    <span className="celestial-piece celestial-sparkle celestial-sparkle-top"><DoodleAnimation name="star" /></span>
  </div>;
}

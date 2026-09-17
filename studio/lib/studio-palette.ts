type Color = [number, number, number];

const DEFAULT_MIST = {
  '--studio-mist-primary': 'rgb(226 195 144 / 38%)',
  '--studio-mist-secondary': 'rgb(236 190 165 / 30%)',
  '--studio-mist-base': 'rgb(235 214 175 / 24%)',
  '--studio-panel': '#f7f6f0',
};

/** Reuse the saved image palette; music controls never change the backdrop. */
export function studioMist(palette?: string[]): Record<string, string> {
  const colors: Color[] = (palette ?? [])
    .filter(color => /^#[\da-f]{6}$/i.test(color))
    .map(color => [1, 3, 5].map(start => parseInt(color.slice(start, start + 2), 16)) as Color);
  if (!colors.length) return { ...DEFAULT_MIST };

  // Prefer an existing chromatic swatch over white backgrounds or dark outlines.
  // Keep palette order so the selected color still represents a prevalent color.
  const chromatic = colors.filter(color => Math.max(...color) - Math.min(...color) >= 28);
  const candidates = chromatic.length ? chromatic : colors;
  const primary = candidates[0];
  const distance = (color: Color) => color.reduce((sum, channel, i) => sum + (channel - primary[i]) ** 2, 0);
  const secondary = candidates.reduce((best, color) => distance(color) > distance(best) ? color : best, primary);
  const separation = (color: Color) => Math.min(distance(color), color.reduce((sum, channel, i) => sum + (channel - secondary[i]) ** 2, 0));
  const third = candidates.reduce((best, color) => separation(color) > separation(best) ? color : best, primary);
  const tint = (color: Color, white: number, opacity: number) => {
    const blend = (amount: number) => color.map(channel => Math.round(channel * (1 - amount) + 255 * amount));
    const luminance = (channels: number[]) => channels.reduce((sum, channel, i) => {
      const value = channel / 255;
      return sum + (value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4) * [.2126, .7152, .0722][i];
    }, 0);
    // Bound dark/strongly saturated uploads to a light working background.
    while (luminance(blend(white)) < .7 && white < 1) white = Math.min(1, white + .025);
    return `rgb(${blend(white).join(' ')} / ${opacity}%)`;
  };

  return {
    '--studio-mist-primary': tint(primary, .08, 80),
    '--studio-mist-secondary': tint(secondary, .2, 66),
    '--studio-mist-base': tint(third, .15, 62),
    // Fully opaque, with just enough image color to connect the working surface.
    '--studio-panel': tint(primary, .86, 100),
  };
}

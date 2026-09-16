'use client';
type Tool = { name: string; description: string; inputSchema: object; annotations?: { readOnlyHint: boolean }; execute(input: unknown): unknown | Promise<unknown> };
type Registry = { registerTool(tool: Tool, options?: { signal?: AbortSignal }): void | Promise<void> };
export function registerMusicTools(actions: {
  read: () => unknown;
  configure: (input: unknown) => Promise<unknown>;
  play: () => Promise<unknown>;
  exportWav: () => Promise<unknown>;
  stop: () => unknown;
}) {
  const context = (document as Document & { modelContext?: Registry }).modelContext;
  if (!context?.registerTool) return () => {};
  const life = new AbortController();
  const empty = { type: 'object', properties: {}, additionalProperties: false };
  const tools: Tool[] = [
    { name: 'get_music_project', description: 'Read the current character, theme candidates, arrangement settings and playback status.', inputSchema: empty, annotations: { readOnlyHint: true }, execute: actions.read },
    { name: 'configure_arrangement', description: 'Select an existing theme candidate and scene in the visible music workspace. A previous selected theme is preserved as a revision. Does not play audio.', inputSchema: { type: 'object', properties: { themeId: { type: 'string' }, scene: { type: 'string', enum: ['daily', 'memory', 'battle'] } }, required: ['themeId', 'scene'], additionalProperties: false }, execute: actions.configure },
    { name: 'play_arrangement', description: 'Render and play the selected arrangement using the current track mix. Requires an adopted theme. Returns audio render measurements, not subjective quality.', inputSchema: empty, execute: actions.play },
    { name: 'export_current_wav', description: 'Render and download a stereo WAV file of the current arrangement and mix. Returns file size and actual render measurements.', inputSchema: empty, execute: actions.exportWav },
    { name: 'stop_playback', description: 'Stop current music playback without changing the saved arrangement.', inputSchema: empty, execute: actions.stop },
  ];
  for (const tool of tools) {
    try { void Promise.resolve(context.registerTool(tool, { signal: life.signal })).catch(e => console.warn('Music tool registration unavailable', e)); }
    catch (e) { console.warn('Music tool registration unavailable', e); }
  }
  return () => life.abort();
}

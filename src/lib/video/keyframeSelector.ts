type Sport = 'hockey' | 'fencing';

const INTERVAL_BY_SPORT: Record<Sport, number> = {
  hockey: 0.5,
  fencing: 0.25,
};

export function selectKeyframeTimestamps(duration: number, sport: Sport): number[] {
  const interval = INTERVAL_BY_SPORT[sport];
  const timestamps: number[] = [];
  for (let t = 0; t < duration; t = Math.round((t + interval) * 1000) / 1000) {
    timestamps.push(t);
  }
  return timestamps;
}

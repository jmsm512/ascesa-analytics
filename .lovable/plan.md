# Benchmarks redesign — action-clip library per fencer

Restructure the Benchmarks tab so each benchmark fencer holds a library of short, action-labeled clips instead of one long bout video. Comparison becomes apples-to-apples per action.

## Data model

Reuse the existing `benchmarks` table (one row per fencer). Move clips into `speed_analysis` as a nested structure — no schema migration required.

```text
benchmarks.speed_analysis = {
  clips: [
    {
      id: string,
      action: "Lunge" | "Attack" | "Retreat" | "Advance" | "Parry" | "Riposte" | "General",
      video_path: string,          // storage path in `videos` bucket
      thumbnail_data_url: string,  // small JPEG of first frame, inline
      created_at: ISO string,
      readings: [{ time, speed, direction }],
      tags: [{ action, success, time }],   // still supported for "General" clips
      peak_speed: number,
      avg_speed: number,
    },
    ...
  ]
}
```

Backward compatibility: existing rows whose `speed_analysis` has `{ periods: [...] }` or `{ readings, tags }` shape are migrated on read into a single synthetic clip with `action: "General"`. Old data keeps showing up; tagged actions inside "General" clips still feed the comparison table.

## UI — Benchmarks tab

- Each fencer renders as a collapsible card (Radix Collapsible already in repo).
- Card header: fencer name, notes, clip count, expand chevron, "Add Clip" button, delete fencer.
- Expanded body: responsive grid of clip tiles. Each tile shows:
  - first-frame thumbnail
  - action label badge
  - peak speed / avg speed
  - click → opens a Dialog with the clip's video player + speed AreaChart (reuses existing chart code)
  - small delete button
- "Add Clip" opens the existing calibration → athlete-select → analyze flow, but first asks the user to pick an action type from a Select. On completion, append a new clip object to `speed_analysis.clips` and persist.
- A bar/area "fencer-level" comparison chart below the cards keeps working by aggregating across that fencer's clips (max peak, avg of avgs).

## Action Comparison table

For each action in `["Lunge","Attack","Retreat","Advance","Parry","Riposte"]`:
- Rie side: average speed across all her tagged instances of that action (from her sessions' `speed_analysis`, using existing `flattenSpeedAnalysis` + tag lookup).
- Benchmark side: average of avg_speed across that fencer's clips whose `action` matches. Tags inside "General" clips also contribute (treat each tag's instantaneous speed as a sample) so legacy data still participates.
- Show row only when BOTH sides have data. Gap shown as m/s and %, color-coded: green ≤10%, amber 10–30%, red >30%.

## Implementation steps

1. Add helpers in `src/routes/athletes.$id.tsx`:
   - `normalizeBenchmark(row)` → `{ id, name, notes, clips: Clip[] }` handling all three legacy shapes.
   - `summarizeClip(clip)` → `{ peak, avg }`.
   - `benchmarkActionAvg(clips, action)` for the comparison table.
2. Replace the current single-video Benchmarks tab content with the new collapsible-cards UI. Keep the existing calibration/analysis state machine but parameterize it with `{ benchmarkId, action }` so the same flow writes into `clips[]` instead of replacing `speed_analysis`.
3. Update the comparison section: keep stat cards, replace existing Action Comparison aggregation with the new per-clip logic.
4. Capture the first-frame thumbnail as a small JPEG data URL during analysis (canvas.toDataURL at ~160px wide) and store on the clip.
5. Persist with `supabase.from('benchmarks').update({ speed_analysis: { clips } }).eq('id', benchmarkId)`.
6. No DB migration, no edge-function change, no new files required — all changes scoped to `src/routes/athletes.$id.tsx` (+ minor reuse of existing `poseTracking.ts` and chart components).

## Notes

- Action choices are surfaced via the existing shadcn `Select` component.
- Clip player Dialog reuses `<video>` + the same AreaChart used for session speed profile.
- Tag buttons stay available inside the clip Dialog so a "General" clip can still be tagged after analysis.

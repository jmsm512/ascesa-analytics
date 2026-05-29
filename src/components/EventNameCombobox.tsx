import { useQuery } from "@tanstack/react-query";
import { listFencingEventNames } from "@/lib/data";

export function EventNameCombobox({
  value,
  onChange,
  placeholder = "e.g. Kaizen Spring Open",
  className,
  listId = "fencing-event-names",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  listId?: string;
}) {
  const { data: names } = useQuery({
    queryKey: ["fencing-event-names"],
    queryFn: listFencingEventNames,
    staleTime: 60_000,
  });
  return (
    <>
      <input
        list={listId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={
          className ??
          "w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
        }
      />
      <datalist id={listId}>
        {(names ?? []).map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
    </>
  );
}

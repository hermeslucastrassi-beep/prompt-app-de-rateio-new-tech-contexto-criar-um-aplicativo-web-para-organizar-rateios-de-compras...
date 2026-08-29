type Props = {
  units: number;
  confirmed: number;
  pending: number;
};

export function VialTray({ units, confirmed, pending }: Props) {
  const slots = Array.from({ length: units }, (_, i) => {
    if (i < confirmed) return "filled" as const;
    if (i < confirmed + pending) return "pending" as const;
    return "empty" as const;
  });

  return (
    <div className="flex flex-wrap items-end gap-1.5" aria-hidden="true">
      {slots.map((state, i) => (
        <span
          key={i}
          className={
            state === "filled" ? "vial vial-filled" : state === "pending" ? "vial vial-pending" : "vial"
          }
        />
      ))}
    </div>
  );
}

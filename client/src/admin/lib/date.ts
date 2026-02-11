export function toDateInputValue(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function startOfMonthISO(d = new Date()) {
  return toDateInputValue(new Date(d.getFullYear(), d.getMonth(), 1));
}


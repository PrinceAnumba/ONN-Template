export type ClassMethod = "quantile" | "equal" | "jenks";

export const CLASS_COUNT = 5;

/** Class edges: CLASS_COUNT + 1 ascending values from the minimum to the maximum. */
export function classify(input: number[], method: ClassMethod, k = CLASS_COUNT): number[] {
  const values = [...input].sort((a, b) => a - b);
  if (values.length === 0) return [];
  const min = values[0]!;
  const max = values[values.length - 1]!;
  if (min === max) return [min, max];
  // Quantiles and natural breaks can't make more classes than there are distinct values.
  const distinct = new Set(values).size;
  const classes = method === "equal" ? k : Math.min(k, distinct);

  if (method === "equal") {
    const step = (max - min) / classes;
    return Array.from({ length: classes + 1 }, (_, i) => (i === classes ? max : min + step * i));
  }
  if (method === "quantile") {
    const edges = [min];
    for (let i = 1; i < classes; i++) {
      const position = (values.length - 1) * (i / classes);
      const lower = Math.floor(position);
      const fraction = position - lower;
      edges.push(values[lower]! + (values[lower + 1]! - values[lower]!) * fraction);
    }
    edges.push(max);
    return edges;
  }
  return jenks(values, classes);
}

/** Fisher-Jenks natural breaks on sorted values. */
function jenks(values: number[], classes: number): number[] {
  const n = values.length;
  const lower: number[][] = Array.from({ length: n + 1 }, () => new Array(classes + 1).fill(0));
  const variance: number[][] = Array.from({ length: n + 1 }, () =>
    new Array(classes + 1).fill(Infinity),
  );
  for (let j = 1; j <= classes; j++) {
    lower[1]![j] = 1;
    variance[1]![j] = 0;
  }
  for (let l = 2; l <= n; l++) {
    let sum = 0;
    let sumSquares = 0;
    let count = 0;
    let v = 0;
    for (let m = 1; m <= l; m++) {
      const index = l - m + 1;
      const value = values[index - 1]!;
      sumSquares += value * value;
      sum += value;
      count += 1;
      v = sumSquares - (sum * sum) / count;
      if (index > 1) {
        for (let j = 2; j <= classes; j++) {
          const candidate = v + variance[index - 1]![j - 1]!;
          if (variance[l]![j]! >= candidate) {
            lower[l]![j] = index;
            variance[l]![j] = candidate;
          }
        }
      }
    }
    lower[l]![1] = 1;
    variance[l]![1] = v;
  }
  const edges = new Array(classes + 1).fill(0);
  edges[classes] = values[n - 1];
  edges[0] = values[0];
  let k = n;
  for (let j = classes; j >= 2; j--) {
    const index = lower[k]![j]! - 1;
    edges[j - 1] = values[index];
    k = lower[k]![j]! - 1;
  }
  return edges;
}

/** Class index for a value, or -1 for missing data. */
export function classIndex(value: number | null | undefined, edges: number[]) {
  if (value === null || value === undefined || edges.length < 2) return -1;
  for (let i = 1; i < edges.length - 1; i++) {
    if (value < edges[i]!) return i - 1;
  }
  return edges.length - 2;
}

export interface LegendClass {
  from: number;
  to: number;
  color: string;
  count: number;
}

/** Fills per area code plus legend classes; null marks no data (hatched). */
export function choropleth(
  values: Record<string, number | null>,
  method: ClassMethod,
  colors: string[],
) {
  const known = Object.values(values).filter((value): value is number => value !== null);
  const edges = classify(known, method, colors.length);
  const classes: LegendClass[] = edges.slice(0, -1).map((from, i) => ({
    from,
    to: edges[i + 1]!,
    // Fewer classes than colours (tiny datasets) still use the darkest end of the scale.
    color: colors[colors.length - (edges.length - 1) + i]!,
    count: 0,
  }));
  const fills: Record<string, string | null> = {};
  let noData = 0;
  for (const [code, value] of Object.entries(values)) {
    const index = classIndex(value, edges);
    if (index < 0) {
      fills[code] = null;
      noData += 1;
    } else {
      fills[code] = classes[index]!.color;
      classes[index]!.count += 1;
    }
  }
  return { fills, classes, noData };
}

import type { Activity, Block } from "@/data/schema";

export const blockColor = (block: Pick<Block, "color">, activity: Activity | null | undefined) =>
  block.color ?? activity?.color ?? "#93a6bd";

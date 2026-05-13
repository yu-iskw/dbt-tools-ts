/** Graph / manifest shapes used only inside snapshot construction. */

export interface GraphLike {
  getGraph: () => {
    forEachNode: (fn: (id: string, attrs: Record<string, unknown>) => void) => void;
    getNodeAttributes: (id: string) => Record<string, unknown> | undefined;
    hasNode: (id: string) => boolean;
  };
  getUpstream: (id: string, maxDepth?: number) => Array<{ nodeId: string; depth: number }>;
  getDownstream: (id: string, maxDepth?: number) => Array<{ nodeId: string; depth: number }>;
}

export type GraphologyAttrsGraph = {
  hasNode(nodeId: string): boolean;
  getNodeAttributes(nodeId: string): Record<string, unknown> | undefined;
};

export type ManifestEntryLookup = Map<string, Record<string, unknown>>;

export interface NeighborGraph {
  hasNode(id: string): boolean;
  inboundNeighbors(id: string): Iterable<string>;
  outboundNeighbors(id: string): Iterable<string>;
}

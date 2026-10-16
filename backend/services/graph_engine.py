"""Graph Intelligence Engine using NetworkX for ownership and entity relationship analysis."""
from typing import Any, Optional
import networkx as nx
import pandas as pd

from backend.models.schemas import (
    ConnectedComponentInfo,
    EntityEdge,
    EntityNode,
    GraphNeighborhood,
    GraphPathResponse,
)


class GraphEngine:
    def __init__(self) -> None:
        self.directed_graph = nx.MultiDiGraph()
        self.undirected_graph = nx.Graph()
        self._nodes_dict: dict[str, dict[str, Any]] = {}
        self._edges_list: list[dict[str, Any]] = []

    def build_graph(self, nodes_df: pd.DataFrame, edges_df: pd.DataFrame) -> None:
        """Construct the NetworkX graphs from ownership nodes and edges DataFrames."""
        self.directed_graph.clear()
        self.undirected_graph.clear()
        self._nodes_dict.clear()
        self._edges_list.clear()

        # Add Nodes
        for _, row in nodes_df.iterrows():
            nid = str(row["node_id"]).strip()
            attrs = {
                "node_id": nid,
                "name": str(row["name"]).strip() if pd.notna(row["name"]) else nid,
                "kind": str(row["kind"]).strip() if pd.notna(row["kind"]) else "unknown",
                "jurisdiction": str(row["jurisdiction"]).strip() if pd.notna(row.get("jurisdiction")) else None,
                "reg_date": str(row["reg_date"]).strip() if pd.notna(row.get("reg_date")) else None,
                "flagged_status": str(row["flagged_status"]).strip() if pd.notna(row.get("flagged_status")) else None,
                "source": str(row["source"]).strip() if pd.notna(row.get("source")) else None,
            }
            self.directed_graph.add_node(nid, **attrs)
            self.undirected_graph.add_node(nid, **attrs)
            self._nodes_dict[nid] = attrs

        # Add Edges
        for _, row in edges_df.iterrows():
            eid = str(row["edge_id"]).strip()
            u = str(row["start_id"]).strip()
            v = str(row["end_id"]).strip()
            rel_type = str(row["rel_type"]).strip() if pd.notna(row.get("rel_type")) else "related_to"
            since = str(row["since"]).strip() if pd.notna(row.get("since")) else None

            # Add placeholder node if edge references a missing node
            for endpoint in (u, v):
                if endpoint not in self.directed_graph:
                    placeholder = {
                        "node_id": endpoint,
                        "name": endpoint,
                        "kind": "unknown",
                        "jurisdiction": None,
                        "reg_date": None,
                        "flagged_status": None,
                        "source": "inferred_from_edge",
                    }
                    self.directed_graph.add_node(endpoint, **placeholder)
                    self.undirected_graph.add_node(endpoint, **placeholder)
                    self._nodes_dict[endpoint] = placeholder

            edge_attrs = {
                "edge_id": eid,
                "start_id": u,
                "end_id": v,
                "rel_type": rel_type,
                "since": since,
            }
            self.directed_graph.add_edge(u, v, key=eid, **edge_attrs)
            # Undirected edge stores relationship type
            if self.undirected_graph.has_edge(u, v):
                # append to rel_types if multiple
                existing = self.undirected_graph[u][v].get("rel_type", "")
                if rel_type not in existing:
                    self.undirected_graph[u][v]["rel_type"] = f"{existing}; {rel_type}"
            else:
                self.undirected_graph.add_edge(u, v, **edge_attrs)

            self._edges_list.append(edge_attrs)

        # Update degree counts
        degrees = dict(self.undirected_graph.degree())
        for nid, deg in degrees.items():
            if nid in self._nodes_dict:
                self._nodes_dict[nid]["degree"] = deg

    def get_node(self, node_id: str) -> Optional[EntityNode]:
        """Fetch node details by ID."""
        attrs = self._nodes_dict.get(node_id)
        if not attrs:
            return None
        return EntityNode(**attrs)

    def search_nodes(
        self,
        query: str = "",
        kind: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[EntityNode], int]:
        """Search entities by name or node ID, optionally filtering by kind."""
        q = query.strip().lower()
        results: list[EntityNode] = []

        for nid, attrs in self._nodes_dict.items():
            if kind and attrs["kind"].lower() != kind.strip().lower():
                continue
            if q:
                if q not in nid.lower() and q not in attrs["name"].lower():
                    continue
            results.append(EntityNode(**attrs))

        total = len(results)
        # Sort by degree descending, then name
        results.sort(key=lambda x: (-(x.degree or 0), x.name.lower()))
        return results[offset : offset + limit], total

    def get_neighborhood(
        self,
        node_id: str,
        hops: int = 1,
        max_nodes: int = 40,
    ) -> Optional[GraphNeighborhood]:
        """Extract ego subgraph around a node up to specified hops."""
        if node_id not in self.undirected_graph:
            return None

        center_attrs = self._nodes_dict[node_id]
        center_node = EntityNode(**center_attrs)

        hops_clamped = min(max(1, hops), 3)
        sub_graph = nx.ego_graph(self.undirected_graph, node_id, radius=hops_clamped)

        # If too large, keep nearest neighbors up to max_nodes
        sub_nodes_ids = list(sub_graph.nodes())
        if len(sub_nodes_ids) > max_nodes:
            # Sort by shortest path distance from center, then degree
            distances = nx.single_source_shortest_path_length(sub_graph, node_id)
            sub_nodes_ids = sorted(
                sub_nodes_ids,
                key=lambda n: (distances.get(n, 99), -self._nodes_dict.get(n, {}).get("degree", 0)),
            )[:max_nodes]
            sub_graph = self.undirected_graph.subgraph(sub_nodes_ids)

        nodes: list[EntityNode] = []
        for nid in sub_graph.nodes():
            if nid in self._nodes_dict:
                nodes.append(EntityNode(**self._nodes_dict[nid]))

        # Collect directed edges matching this subgraph
        node_set = set(sub_nodes_ids)
        edges: list[EntityEdge] = []
        for e in self._edges_list:
            if e["start_id"] in node_set and e["end_id"] in node_set:
                edges.append(EntityEdge(**e))

        return GraphNeighborhood(
            center_node=center_node,
            nodes=nodes,
            edges=edges,
            total_nodes=len(nodes),
            total_edges=len(edges),
        )

    def find_shortest_path(self, source_id: str, target_id: str) -> GraphPathResponse:
        """Find recorded connection path between two entities using NetworkX."""
        if source_id not in self.undirected_graph or target_id not in self.undirected_graph:
            return GraphPathResponse(
                source_id=source_id,
                target_id=target_id,
                path_found=False,
                message="One or both entity IDs were not found in the ownership graph.",
            )

        if source_id == target_id:
            node = self.get_node(source_id)
            return GraphPathResponse(
                source_id=source_id,
                target_id=target_id,
                path_found=True,
                node_path=[source_id],
                nodes=[node] if node else [],
                edges=[],
                hops=0,
                message="Source and target refer to the same entity.",
            )

        try:
            path = nx.shortest_path(self.undirected_graph, source=source_id, target=target_id)
        except (nx.NetworkXNoPath, nx.NodeNotFound):
            return GraphPathResponse(
                source_id=source_id,
                target_id=target_id,
                path_found=False,
                node_path=[],
                nodes=[],
                edges=[],
                hops=0,
                message="No recorded relationship path connects these two entities.",
            )

        nodes: list[EntityNode] = []
        for nid in path:
            if nid in self._nodes_dict:
                nodes.append(EntityNode(**self._nodes_dict[nid]))

        edges: list[EntityEdge] = []
        for i in range(len(path) - 1):
            u, v = path[i], path[i + 1]
            # Find edge attributes in either direction
            for e in self._edges_list:
                if (e["start_id"] == u and e["end_id"] == v) or (e["start_id"] == v and e["end_id"] == u):
                    edges.append(EntityEdge(**e))
                    break

        return GraphPathResponse(
            source_id=source_id,
            target_id=target_id,
            path_found=True,
            node_path=path,
            nodes=nodes,
            edges=edges,
            hops=len(path) - 1,
            message=f"Found recorded connection path of {len(path) - 1} hops.",
        )

    def get_connected_components(self, min_size: int = 2, limit: int = 20) -> list[ConnectedComponentInfo]:
        """Identify connected components in the ownership graph."""
        components = list(nx.connected_components(self.undirected_graph))
        components.sort(key=len, reverse=True)

        res: list[ConnectedComponentInfo] = []
        for idx, comp in enumerate(components):
            if len(comp) < min_size:
                continue
            if len(res) >= limit:
                break

            sub = self.undirected_graph.subgraph(comp)
            kinds: dict[str, int] = {}
            sample_nodes: list[str] = []
            for nid in comp:
                k = self._nodes_dict.get(nid, {}).get("kind", "unknown")
                kinds[k] = kinds.get(k, 0) + 1
                if len(sample_nodes) < 5:
                    name = self._nodes_dict.get(nid, {}).get("name", nid)
                    sample_nodes.append(f"{name} ({nid})")

            res.append(
                ConnectedComponentInfo(
                    component_id=idx + 1,
                    node_count=len(comp),
                    edge_count=sub.number_of_edges(),
                    sample_nodes=sample_nodes,
                    kinds=kinds,
                )
            )

        return res

    def get_graph_stats(self) -> dict[str, Any]:
        """Calculate graph-wide structural statistics."""
        return {
            "total_nodes": self.undirected_graph.number_of_nodes(),
            "total_edges": len(self._edges_list),
            "connected_components_count": nx.number_connected_components(self.undirected_graph),
            "isolated_nodes_count": len(list(nx.isolates(self.undirected_graph))),
        }

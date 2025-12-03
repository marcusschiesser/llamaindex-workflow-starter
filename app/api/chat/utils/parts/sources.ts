import { workflowEvent } from "@llamaindex/workflow-core";
import {
  MetadataMode,
  type JSONValue,
  type Metadata,
  type NodeWithScore,
} from "llamaindex";

export const SOURCE_EVENT_TYPE = `data-sources` as const;

export type SourceEventNode = {
  id: string;
  metadata: Metadata;
  score: number | null;
  url: string;
  text: string;
  fileName: string;
  filePath: string;
};

export type SourceEvent = {
  nodes: SourceEventNode[];
};

export type SourceEventPart = {
  id?: string;
  type: typeof SOURCE_EVENT_TYPE;
  data: SourceEvent;
};

export const sourceEvent = workflowEvent<SourceEventPart>();

export function getSourceNodesFromToolOutput(
  toolOutput: JSONValue,
): NodeWithScore<Metadata>[] {
  if (
    toolOutput != null &&
    typeof toolOutput === "object" &&
    "sourceNodes" in toolOutput &&
    Array.isArray(toolOutput.sourceNodes)
  ) {
    return toolOutput.sourceNodes as unknown as NodeWithScore<Metadata>[];
  }
  return [];
}

export function toSourceEvent(sourceNodes: NodeWithScore<Metadata>[] = []) {
  const nodes: SourceEventNode[] = sourceNodes.map((node) =>
    toSourceEventNode(node),
  );
  return sourceEvent.with({
    type: SOURCE_EVENT_TYPE,
    data: { nodes },
  });
}

export function toSourceEventNode(node: NodeWithScore<Metadata>) {
  const { file_name } = node.node.metadata;

  const filePath = `data/${file_name}`;

  return {
    id: node.node.id_,
    fileName: file_name,
    filePath,
    url: `/api/files/${filePath}`,
    metadata: node.node.metadata,
    score: node.score ?? null,
    text:
      "text" in node.node && typeof node.node.text === "string"
        ? node.node.text
        : node.node.getContent(MetadataMode.NONE),
  };
}

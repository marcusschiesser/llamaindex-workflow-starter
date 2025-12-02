import { agent } from "@llamaindex/workflow";
import { getIndex } from "./data";

export const workflowFactory = async (reqBody: any) => {
  const index = await getIndex(reqBody?.data);

  const queryEngineTool = index.queryTool({
    metadata: {
      name: "query_document",
      description: `This tool can retrieve information about letter standards`,
    },
    includeSourceNodes: true,
  });

  return agent({ tools: [queryEngineTool] });
};

import {
	type AgentInputData,
	startAgentEvent,
	type Workflow,
	type WorkflowContext,
} from "@llamaindex/workflow";

/**
 * Run a workflow with user input and return a workflow context
 */
export async function runWorkflow({
	workflow,
	input,
}: {
	workflow: Workflow;
	input: AgentInputData;
}): Promise<WorkflowContext> {

	// otherwise, create a new empty context and run the workflow with startAgentEvent
	const context = workflow.createContext();
	context.sendEvent(
		startAgentEvent.with({
			userInput: input.userInput,
			chatHistory: input.chatHistory,
		}),
	);

	return context;
}

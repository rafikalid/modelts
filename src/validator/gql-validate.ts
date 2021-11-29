import { InputObject, InputList } from "./model";

/** Validate GraphQL Inputs */
export function pipeInputGQL(input: any, schema: InputObject | InputList) {
	return input;
}
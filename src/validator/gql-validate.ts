import { InputObject, InputList } from "./model";

/** Validate GraphQL Inputs */
export function pipeInputGQL(schema: InputObject | InputList, parent: any, args: any, ctx: any, info: any) {
	return args;
}
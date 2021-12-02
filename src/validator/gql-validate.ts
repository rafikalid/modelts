import { Kind } from "..";
import { InputObject, InputList } from "./model";

/** Validate GraphQL Inputs */
export function pipeInputGQL(schema: InputObject | InputList, parent: any, args: any, ctx: any, info: any) {
	var stack: (InputObject | InputList)[] = [schema];
	while (true) {
		let node = stack.pop();
		if (node == null) break;
		switch (node.kind) {
			case Kind.INPUT_OBJECT: {
				node.
					break;
			}
			case Kind.INPUT_LIST: {
				break;
			}
			default: {
				let n: never = node;
			}
		}
	}
	return args;
}
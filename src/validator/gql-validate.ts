import { Kind } from "..";
import { InputObject, InputList } from "./model";

/** Validation result */
export interface ValidationResult {
	value: any,
	errors: string[]
}

/**
 * Validate GraphQL Inputs
 * Schema and types are already validated by GraphQL
 */
export async function pipeInputGQL(schema: InputObject | InputList, parent: any, args: any, ctx: any, info: any): Promise<ValidationResult> {
	var result: any[] = [];
	/** Stack: schema, parent, value, [validation for parent], [validation values from child] */
	var stack: any[] = [schema, parent, args, result, []];
	/** State: 0: down, 1: up */
	var states: (0 | 1)[] = [1, 0];
	var errors = [];
	while (true)
		try {
			//* State
			let state = states.pop();
			if (state == null) break;
			else if (state === 0) {
				//* DOWN
				let ln = stack.length;
				let resultsFromChildren = stack[--ln] as any[];
				let resultsToParent = stack[--ln] as any[];
				let args = stack[--ln] as any;
				let parent = stack[--ln] as any;
				let node = stack[--ln] as InputObject | InputList;
				// Do validation
				switch (node.kind) {
					case Kind.INPUT_OBJECT: {
						// Pre-validation
						if (node.before != null) {
							if (node.beforeAsync) args = await node.before(parent, args, ctx, info);
							else args = node.before(parent, args, ctx, info);
						}
						// Validate fields
						// for (let i = 0, fields = node.fields, len = fields.length; i < len; ++i) {
						for (let fields = node.fields, i = fields.length - 1; i >= 0; --i) {
							let field = fields[i];
							let data = args[field.alias];
							// Assert
							if (field.assert != null) field.assert(data);
							// Go through sub type
							if (data != null && field.type != null) {
								states.push(1, 0); // up, down
								// Stack: schema, parent, value, [validation values from child]
								stack.push(field.type, args, data, resultsFromChildren, []);
							}
						}
						break;
					}
					case Kind.INPUT_LIST: {
						let type = node.type;
						if (type != null) {
							// for (let i = 0, len = args.length; i < len; ++i) {
							for (let i = args.length - 1; i >= 0; --i) {
								states.push(1, 0); // up, down
								// Stack: schema, parent, value, [validation values from child]
								stack.push(type, args, args[i], resultsFromChildren, []);
							}
						}
						break;
					}
					default: {
						let n: never = node;
					}
				}
			} else {
				//* UP
				let resultsFromChildren = stack.pop() as any[];
				let resultsToParent = stack.pop() as any[];
				let args = stack.pop() as any;
				let parent = stack.pop() as any;
				let node = stack.pop() as InputObject | InputList;
				// Do validation
				switch (node.kind) {
					case Kind.INPUT_OBJECT: {
						// Validate fields
						let data: Record<string, any> = {};
						for (let i = 0, fields = node.fields, len = fields.length; i < len; ++i) {
							let field = fields[i];
							let v = resultsFromChildren[i];
							if (field.pipe != null) {
								if (field.pipeAsync) v = await field.pipe(args, v, ctx, info);
								else v = field.pipe(args, v, ctx, info);
							}
							data[field.name] = v;
						}
						// Post validation
						if (node.after != null) {
							if (node.afterAsync) data = await node.after(parent, data, ctx, info);
							else data = node.after(parent, data, ctx, info);
						}
						resultsToParent.push(data);
						break;
					}
					case Kind.INPUT_LIST: {
						resultsToParent.push(resultsFromChildren);
						break;
					}
					default: {
						let n: never = node;
					}
				}
			}
		} catch (err) {
			if (typeof err === 'string') errors.push(err);
			else throw err;
		}
	return {
		value: result[0],
		errors
	};
}
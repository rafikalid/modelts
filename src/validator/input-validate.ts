import type {
	GqlField,
	GqlListNode,
	GqlNode,
	GqlObjectNode,
} from './gql-model';
import { ModelKind } from '@src/parser/model';
import type { GraphQLFieldResolver } from 'graphql';

const _isArray = Array.isArray;

// /** Validate input data */
// export function inputValidationWrapper(
// 	config: GqlObjectNode,
// 	method: GraphQLFieldResolver<any, any, any>
// ): GraphQLFieldResolver<any, any, any> {
// 	return async function (parent: any, args: any, ctx: any, info: any) {
// 		args = await validateObj(config, args, parent, ctx, info);
// 		return method(parent, args, ctx, info);
// 	};
// }

/** Validate data */
export async function validateObj(
	config: GqlObjectNode,
	parent: any,
	data: Record<string, any>,
	ctx: any,
	info: any
) {
	var fields = config.fields;
	var result: Record<string, any> = {};
	// Validate obj: before
	if (config.inputBefore != null) {
		data = await config.inputBefore(parent, data, ctx, info) as Record<string, any>;
	}
	// Validate fields
	for (let i = 0, len = fields.length; i < len; ++i) {
		let field = fields[i];
		let fieldData = data[field.targetName];
		if (fieldData != null) {
			// Child type
			let subType = field.type;
			if (subType != null) {
				if (subType.kind === ModelKind.LIST) {
					if (_isArray(fieldData) === false) fieldData = [fieldData];
					fieldData = await validateList(
						subType,
						data,
						fieldData,
						ctx,
						info
					);
				} else if (subType.kind === ModelKind.PLAIN_OBJECT) {
					fieldData = await validateObj(
						subType,
						data,
						fieldData,
						ctx,
						info
					);
				}
			}
			// Asserts
			field.assert?.(fieldData);
			// Input validator
			if (field.input != null)
				fieldData = await field.input(data, fieldData, ctx, info);
			// Save data
			result[field.name] = fieldData;
		}
	}
	// Validate obj: after
	if (config.inputAfter != null) {
		result = await config.inputAfter(parent, result, ctx, info) as Record<string, any>;
	}
	return result;
}
/** Validate List */
export async function validateList(
	config: GqlListNode,
	parent: any,
	data: any[],
	ctx: any,
	info: any
) {
	var result: any[] = [];
	var len = data.length;
	//* Go through items
	var childType = config.type;
	if (childType.kind === ModelKind.LIST) {
		for (let i = 0; i < len; ++i) {
			result[i] = await validateList(childType, data, result[i], ctx, info);
		}
	} else if (childType.kind === ModelKind.PLAIN_OBJECT) {
		for (let i = 0; i < len; ++i) {
			result[i] = await validateObj(childType, data, result[i], ctx, info);
		}
	}
	//* Asserts
	var assert = config.assert;
	if (assert != null) {
		for (let i = 0; i < len; ++i) {
			assert(data[i]);
		}
	}
	//* Input validation
	var inputCb = config.input;
	if (inputCb != null) {
		for (let i = 0; i < len; ++i) {
			result.push(inputCb(data, data[i], ctx, info));
		}
	}
	return result;
}

interface QueueItem {
	node: GqlObjectNode | GqlField | GqlListNode;
	parentData: any;
	data: any;
	result: any;
	index: number;
}

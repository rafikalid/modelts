import type {
	GqlField,
	GqlListNode,
	GqlNode,
	GqlObjectNode,
} from './gql-model';
import { ModelKind } from '@src/parser/model';
import type { GraphQLFieldResolver } from 'graphql';

const _isArray = Array.isArray;

/** Validate input data */
export function inputValidationWrapper(
	config: GqlObjectNode,
	method: GraphQLFieldResolver<any, any, any>
): GraphQLFieldResolver<any, any, any> {
	return async function (parent: any, args: any, ctx: any, info: any) {
		args = await validateObj(config, args, ctx, info);
		return method(parent, args, ctx, info);
	};
}

/** Validate data */
export async function validateObj(
	config: GqlObjectNode,
	data: Record<string, any>,
	ctx: any,
	info: any
) {
	var fields = config.fields;
	var result: Record<string, any> = {};
	for (let i = 0, len = fields.length; i < len; ++i) {
		let field = fields[i];
		let fieldData = data[field.targetName];
		if (fieldData != null) {
			// Asserts
			field.assert?.(fieldData);
			// Input validator
			if (field.input != null)
				fieldData = await field.input(data, fieldData, ctx, info);
			// Child type
			let subType = field.type;
			if (subType != null) {
				if (subType.kind === ModelKind.LIST) {
					if (_isArray(fieldData) === false) fieldData = [fieldData];
					fieldData = await validateList(
						subType,
						fieldData,
						ctx,
						info
					);
				} else if (subType.kind === ModelKind.PLAIN_OBJECT) {
					fieldData = await validateObj(
						subType,
						fieldData,
						ctx,
						info
					);
				}
			}
			// Save data
			result[field.name] = fieldData;
		}
	}
	return result;
}
/** Validate List */
export async function validateList(
	config: GqlListNode,
	data: any[],
	ctx: any,
	info: any
) {
	var result: any[] = [];
	// Asserts
	var assert = config.assert;
	var len = data.length;
	if (assert != null) {
		for (let i = 0; i < len; ++i) {
			assert(data[i]);
		}
	}
	// Input validation
	var inputCb = config.input;
	if (inputCb != null) {
		for (let i = 0; i < len; ++i) {
			result.push(inputCb(data, data[i], ctx, info));
		}
	}
	//* Go through items
	var childType = config.type;
	if (childType.kind === ModelKind.LIST) {
		for (let i = 0; i < len; ++i) {
			result[i] = await validateList(childType, result[i], ctx, info);
		}
	} else if (childType.kind === ModelKind.PLAIN_OBJECT) {
		for (let i = 0; i < len; ++i) {
			result[i] = await validateObj(childType, result[i], ctx, info);
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

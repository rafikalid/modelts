import { InputResolver } from "@src/helpers/interfaces";
import { ModelKind } from "@src/schema/model";

export type GqlNode=  GqlObjectNode | GqlListNode;
/** Graphql validation plain object */
export interface GqlObjectNode{
	kind:	ModelKind.PLAIN_OBJECT
	fields: GqlField[]
}

/** Graphql validation field */
export interface GqlField{
	name:		string
	kind:		ModelKind.FIELD
	type?:		GqlNode
	/** Input validator */
	input?:		InputResolver<unknown, unknown>
	/** Asserts */
	assert?:	(value: unknown)=> unknown
}

/** List */
export interface GqlListNode{
	kind: ModelKind.LIST
	/** items type */
	type: GqlNode
	/** Input validator */
	input?:		InputResolver<unknown, unknown>
	/** Asserts */
	assert?:	(value: unknown)=> unknown
}
import { InputResolver, Resolver } from "@src/helpers/interfaces";
import { ModelKind } from "@src/schema/model";
import { JsonTypes } from "@src/schema/types";

/** Basic node */
export type Node= ObjectNode|EnumNode|UnionNode|ListNode|ScalarNode<unknown>;

/** Plain object */
export interface ObjectNode{
	kind:	ModelKind.PLAIN_OBJECT
	fields: Field[]
}

/** Plain object field */
export interface Field{
	name:		string
	required:	boolean
	type:		Node
	/** Resolver method */
	resolver?:	Resolver<unknown, unknown>
	/** Input validator */
	input?:		InputResolver<unknown, unknown>
	/** Asserts */
	assert?:	(value: unknown)=> unknown
}

/** List */
export interface ListNode{
	kind: ModelKind.LIST
	/** items type */
	type: Node
	/** Input validator */
	input?:		InputResolver<unknown, unknown>
	/** Asserts */
	assert?:	(value: unknown)=> unknown
}
/** Enum */
export interface EnumNode{
	kind: ModelKind.ENUM
	/** Enum values */
	values: Set<unknown>
}

/** Union */
export interface UnionNode{
	kind: ModelKind.UNION
	/** types */
	types: Node
	/** Resolve type */
	resolve: (data: unknown)=> Node
}


/** Scalar */
export interface ScalarNode<T>{
	kind: ModelKind.SCALAR
	/** Parse value */
	parse?: (value: JsonTypes)=> T
	/** Stringify value */
	serialize?: (value: T)=> JsonTypes|undefined|null
	/** Load from Database */
	fromDB?: (value:unknown)=> T
	/** Save into database */
	toDB?: (value:T)=> unknown
}
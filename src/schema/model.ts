import { Model } from "@src/model/model";
import ts from "typescript";
import { JsonTypes } from "./types";

/** Model kinds */
export enum ModelKind{
	PLAIN_OBJECT,

	/** Enumeration */
	ENUM,

	/** Enum member */
	ENUM_MEMBER,

	/** List of sub entries */
	LIST,

	/** Multiple possible kinds */
	UNION,

	/** Reference to an other Model node */
	REF,

	/** Field */
	FIELD,

	/** Method */
	METHOD,

	/** PARAM */
	PARAM,

	/** Const, used as values for ENUM */
	CONST,

	/** Scalar */
	SCALAR
}

/** Model node */
export type ModelNode= ModelObjectNode | ConstNode | ModelEnumNode | EnumMember | ModelListNode | ModelRefNode | ModelUnionNode | ObjectField | ModelMethod | ModelParam | ModelScalarNode<any>

/** Model node AST */
export interface ModelBaseNode{
	name:		string | undefined
	kind:		ModelKind
	/** Comment */
	jsDoc:		string | undefined
}

/** Const value */
export interface ConstNode extends ModelBaseNode{
	kind: ModelKind.CONST
	value: string
}

/** Nodes with childs */
export interface ModelNodeWithChilds extends ModelBaseNode{
	children:	ModelNode[]
}

/** Object node */
export interface ModelObjectNode extends ModelNodeWithChilds{
	kind:		ModelKind.PLAIN_OBJECT
	mapChilds:	Record<string, ObjectField|ModelMethod>
	isClass:	boolean
}

/** Enum */
export interface ModelEnumNode extends ModelNodeWithChilds{
	kind:		ModelKind.ENUM,
	mapChilds:	Record<string, EnumMember>
}

/** List kinds */
export interface ModelListNode extends ModelNodeWithChilds{
	kind:		ModelKind.LIST
}

/** Union of multiple kinds */
export interface ModelUnionNode extends ModelNodeWithChilds{
	kind:		ModelKind.UNION
}

/** Reference */
export interface ModelRefNode extends ModelBaseNode{
	kind:		ModelKind.REF
	/** Reference name */
	value:		string
}

/** Object fields */
export interface ObjectField extends ModelNodeWithChilds{
	kind: ModelKind.FIELD,
	/** Is required */
	required:	boolean
}

/** Enum member */
export interface EnumMember extends ModelNodeWithChilds{
	kind: ModelKind.ENUM_MEMBER
	/** Is required */
	required:	boolean
}

export const MethodAttr= Symbol('method');
/**
 * Method
 * ::childs[0] result type
 * ::childs[1] arg type
 */
export interface ModelMethod extends ModelBaseNode{
	kind:	ModelKind.METHOD
	// method:	ts.MethodDeclaration // method declaration
	method: string,
	children: [ModelNode|undefined, ModelNode|undefined]
}


/** Model base class */
export interface RootModel{
	children:	ModelNode[],
	mapChilds:	Record<string, ModelNode>
	/** Name of "Model" factory function */
	modelFx:	string|undefined
}

/** Param */
export interface ModelParam extends ModelNodeWithChilds{
	kind:	ModelKind.PARAM
}

/** Scalar node */
export interface ModelScalarNode<T> extends ModelBaseNode{
	kind:	ModelKind.SCALAR
	/** Parse value */
	parse: (value: JsonTypes)=> T
	/** Stringify value */
	serialize: (value: T)=> JsonTypes
}
import { Model } from "@src/model/model";
import ts from "typescript";

/** Model kinds */
export enum ModelKind{
	PLAIN_OBJECT,

	/** Enumeration */
	ENUM,

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
	PARAM
}

/** Model node */
export type ModelNode= ModelObjectNode | ModelEnumNode | ModelListNode | ModelRefNode | ModelUnionNode | ObjectField | ModelMethod | ModelParam

/** Model node AST */
export interface ModelBaseNode{
	name:		string | undefined
	kind:		ModelKind
	/** Comment */
	jsDoc:		string | undefined
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
	mapChilds:	Record<string, ObjectField>
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
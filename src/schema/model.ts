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
	SCALAR,

	/** jsDoc directive */
	DIRECTIVE
}

/** Model node */
export type ModelNode= ModelObjectNode | ConstNode | ModelEnumNode | EnumMember | ModelListNode | ModelRefNode | ModelUnionNode | ObjectField | ModelMethod | ModelParam | ModelScalarNode<any> | ModelJsDocDirective

/** Model node AST */
export interface ModelBaseNode{
	name:		string | undefined
	kind:		ModelKind
	/** Comment */
	jsDoc:		string | undefined
	/** jsDoc directives */
	directives:	ts.Expression[] | undefined
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
export interface ModelUnionNode extends ModelBaseNode{
	kind:		ModelKind.UNION
	resolveType:	ts.ObjectLiteralExpression
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
export interface EnumMember extends ModelBaseNode{
	kind: ModelKind.ENUM_MEMBER
	/** Is required */
	required:	boolean
	/** value */
	value: string | undefined
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

/** jsDoc directive */
export interface ModelJsDocDirective extends ModelBaseNode{
	kind:		ModelKind.DIRECTIVE
	resolver:	ts.ObjectLiteralExpression
}


/** Model base class */
export interface RootModel{
	children:	ModelNode[],
	mapChilds:	Record<string, ModelNode>
	/** jsDoc custom directives  */
	directives: Record<string, ModelJsDocDirective>
	/** Name of "Model" factory function */
	modelFx:	string|undefined
	/** Name of "ModelScalar" */
	_importScalar?: string
	/** Name of "UNION" */
	_importUnion?: string
	/** Name of "JsDocDirective" */
	_importDirective?: string
	/** Ignore annotation */
	_ignoreAnnotation?: string
	/** Assert annotation */
	_assertAnnotation?: string
	/** tsmodel */
	_tsmodel?: string
}

/** Param */
export interface ModelParam extends ModelNodeWithChilds{
	kind:	ModelKind.PARAM
}

/** Scalar node */
export interface ModelScalarNode<T> extends ModelBaseNode{
	kind:	ModelKind.SCALAR
	parser: ts.ObjectLiteralExpression
}

/** Model kinds */
export enum ModelKind{
	/** Root node */
	ROOT,
	/** Plain object */
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

	/** Promise */
	PROMISE,

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
export type ModelNode = ModelRoot| ModelObjectNode | ConstNode | ModelEnumNode | EnumMember | ModelListNode | ModelRefNode | ModelUnionNode | ObjectField | ModelMethod | ModelParam | ModelScalarNode<any> | ModelPromiseNode | RootModel

/** Model node AST */
export interface ModelBaseNode{
	name:		string | undefined
	kind:		ModelKind
	/** Comment */
	jsDoc:		string | undefined
	/** jsDoc directives */
	directives:	string[] | undefined
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

/** Promise node */
export interface ModelPromiseNode extends ModelNodeWithChilds{
	kind: ModelKind.PROMISE
}

/** Object node */
export interface ModelObjectNode extends ModelNodeWithChilds{
	kind:		ModelKind.PLAIN_OBJECT
	/** Original class name */
	oName?:		string
	mapChilds:	Record<string, ObjectField>
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
	resolveType:	string
}

/** Reference */
export interface ModelRefNode extends ModelBaseNode{
	kind:		ModelKind.REF
}

/** Object fields */
export interface ObjectField extends ModelNodeWithChilds{
	kind: ModelKind.FIELD,
	/** Is required */
	required:	boolean
	/** Output Resolver */
	resolver:	ModelMethod|undefined
	/** Input resolver */
	input:		string|undefined
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

// /** jsDoc directive */
// export interface ModelJsDocDirective extends ModelBaseNode{
// 	kind:		ModelKind.DIRECTIVE
// 	resolver:	ts.ObjectLiteralExpression
// }


/** Import tokens */
export interface ImportTokens{
	tsModel:			string|undefined
	Model:				string|undefined
	ModelScalar:		string|undefined
	UNION:				string|undefined
	ignore:				string|undefined
	assert:				string|undefined
	ResolversOf:		string|undefined
	InputResolversOf:	string|undefined
};

/** Model base class @deprecated */
export interface RootModel extends ModelBaseNode{
	kind:		ModelKind.ROOT
	children:	ModelNode[],
	mapChilds:	Record<string, ModelNode>
	/** Import tokens */
	_tokens: ImportTokens
}

/** Root model */
export interface ModelRoot extends ModelBaseNode{
	kind:		ModelKind.ROOT
	children:	ModelNode[],
	mapChilds:	Record<string, ModelNode>
}

/** Param */
export interface ModelParam extends ModelNodeWithChilds{
	kind:	ModelKind.PARAM
}

/** Scalar node */
export interface ModelScalarNode<T> extends ModelBaseNode{
	kind:	ModelKind.SCALAR
	parser: string
}

/** Simplified node with childs */
export interface SimplifiedNode{
	name:		ModelNodeWithChilds['name'],
	kind:		ModelNodeWithChilds['kind'],
	children:	ModelNodeWithChilds['children']
}
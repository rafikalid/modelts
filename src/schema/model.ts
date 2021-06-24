/** Model kinds */
export enum ModelKind{
	PLAIN_OBJECT,

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
export type ModelNode= ModelObjectNode | ModelListNode | ModelRefNode | ModelUnionNode | ObjectField | ModelMethod | ModelParam

/** Model node AST */
export interface ModelBaseNode{
	name:		string | undefined
	kind:		ModelKind
	/** Comment */
	jsDoc:		string | undefined
}

/** Object node */
export interface ModelObjectNode extends ModelBaseNode{
	kind:		ModelKind.PLAIN_OBJECT
	fields:		(ObjectField|ModelMethod)[]
	fieldMap:	Record<string, ObjectField|ModelMethod>
}

/** List kinds */
export interface ModelListNode extends ModelBaseNode{
	kind:		ModelKind.LIST
	value:		ModelNode|undefined
}

/** Union of multiple kinds */
export interface ModelUnionNode extends ModelBaseNode{
	kind:		ModelKind.UNION
	/** Reference name */
	items:		ModelNode[]
}

/** Reference */
export interface ModelRefNode extends ModelBaseNode{
	kind:		ModelKind.REF
	/** Reference name */
	value:		string
}

/** Object fields */
export interface ObjectField extends ModelBaseNode{
	kind: ModelKind.FIELD,
	/** Is required */
	required:	boolean
	/** field value */
	value:	ModelNode | undefined
}

/** Method */
export interface ModelMethod extends ModelBaseNode{
	kind:		ModelKind.METHOD
	value:		ModelNode | undefined,
	argParam:	ModelNode | undefined
}


/** Model base class */
export interface RootModel{
	models: ModelNode[]
	map:	Record<string, ModelNode>
}

/** Param */
export interface ModelParam extends ModelBaseNode{
	kind:	ModelKind.PARAM
	value:	ModelNode|undefined
}
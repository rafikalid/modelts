/** Model kinds */
export enum ModelKind{
	PLAIN_OBJECT,

	/** List of sub entries */
	LIST,

	/** Multiple possible kinds */
	UNION,

	/** Reference to an other Model node */
	REF
}

/** Model node */
export type ModelNode= ModelObjectNode | ModelListNode | ModelRefNode | ModelUnionNode

/** Model node AST */
export interface ModelBaseNode{
	name?:		string
	kind:		ModelKind
	required:	boolean
}

/** Object node */
export interface ModelObjectNode extends ModelBaseNode{
	kind:		ModelKind.PLAIN_OBJECT
	fields:		ObjectField[]
	fieldMap:	Record<string, ObjectField>
}

/** List kinds */
export interface ModelListNode extends ModelBaseNode{
	kind:		ModelKind.LIST
	value:		ModelNode
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
export interface ObjectField{
	/** Field name */
	name:	string
	/** Field value */
	value:	ModelNode
}
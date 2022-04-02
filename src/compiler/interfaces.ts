/** Node kind */
export enum Kind {
	/** Object */
	OBJECT,
	/** Object field */
	FIELD,
	/** List */
	LIST,
	/** Scalar */
	SCALAR
}

/** Node */
export type Node = ObjectNode | FieldNode | ListNode | ScalarNode;

/** Abstract root node */
export interface _Node {
	kind: Kind;
	/** JS DOCS */
	jsDoc: string[];
	/** Deprecation message when exists */
	deprecated: string | undefined;
	/** Files where this entity found */
	fileNames: String[]
}

/** Named node */
export interface _NamedNode {
	/** Node's name: may contains special chars like | and <> */
	name: string;
}

/** Object */
export interface ObjectNode extends _NamedNode {
	kind: Kind.OBJECT
	/** inherited classes and interfaces */
	inherit: string[] | undefined;
	/** Do order fields by name */
	orderByName: boolean | undefined;
	/** Fields */
	fields: Map<string, FieldNode>;
}

/** Field */
export interface FieldNode extends _NamedNode {
	kind: Kind.FIELD
	/** Field index inside it's parent object */
	idx: number;
	/** Field alias */
	alias: string | undefined;
	/** If field is required */
	required: boolean;
	/** Default value */
	defaultValue: any;
}

/** List */
export interface ListNode extends _Node {
	kind: Kind.LIST
	required: boolean
}

/** Scalar */
export interface ScalarNode extends _NamedNode {
	kind: Kind.SCALAR
}
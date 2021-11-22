/** Kinds */
export enum Kind {
	/** Input object */
	INPUT_OBJECT,
	/** Output object */
	OUTPUT_OBJECT,
	/** List */
	LIST
}

/** Input Object */
export interface InputObject {
	kind: Kind.INPUT_OBJECT
	fields: 
}
/** */
/** List */
export interface List {
	kind: Kind.LIST
}
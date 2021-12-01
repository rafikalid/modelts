/** Kinds */
export enum Kind {
	/** Input object */
	INPUT_OBJECT,
	/** Output object */
	OUTPUT_OBJECT,
	/** List */
	INPUT_LIST
}

/** Input Object */
export interface InputObject {
	kind: Kind.INPUT_OBJECT
	name: string
	fields: InputField[]
	/** Before executing validation on this field */
	before: undefined | ResolverMethod;
	/** If "before" is async, used to improve performance */
	beforeAsync: boolean;
	/** After executing validation on this field */
	after: undefined | ResolverMethod;
	/** If "before" is async, used to improve performance */
	afterAsync: boolean;
	/** Wrappers */
	wrap: undefined | ResolverMethodWrapper;
}
/** Input fields */
export interface InputField {
	name: string; // target name
	alias: string; // received name
	required: boolean;
	/** Link to type */
	type: InputList | InputObject;
	/** Pipe input data */
	pipe: (value: any) => any
	/** If "pipe" is async, used to improve performance */
	pipeAsync: boolean;
}
/** List */
export interface InputList {
	kind: Kind.INPUT_LIST
	required: boolean;
	/** Link to type */
	type: InputList | InputObject;
}

export type ResolverMethod = (parent: any, value: any, ctx: any, info: any) => any
export type ResolverMethodWrapper = (parent: any, value: any, ctx: any, info: any, next: () => any) => any
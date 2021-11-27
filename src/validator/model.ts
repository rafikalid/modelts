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
	fields: InputField[]
}
/** Input fields */
export interface InputField {
	name: string;
	required: boolean;
	/** Before executing validation on this field */
	before?: () => void;
	/** After executing validation on this field */
	after?: () => void;
	/** Wrappers */
	wrappers?: (() => void)[];
	/** Link to type */
	type: InputList | InputObject;
}
/** List */
export interface InputList extends Omit<InputField, 'name'> {
	kind: Kind.INPUT_LIST
}
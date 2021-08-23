import { InputField, ModelKind, OutputField, _Node } from "./model";

/** Formated node */
// export type FormatedNode= FormatedObject;


/** Output Plain object */
export interface FormatedOutputObject extends _Node{
	kind:		ModelKind.PLAIN_OBJECT
	/** Fields */
	fields:		OutputField[]
}

/** Input Plain object */
export interface FormatedInputObject extends _Node{
	kind:		ModelKind.PLAIN_OBJECT
	/** Fields */
	fields:		InputField[]
}
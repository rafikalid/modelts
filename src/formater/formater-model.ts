import { BasicScalar, Enum, InputField, ModelKind, OutputField, Scalar, Union, _Node } from "../parser/model";

/** Formated node */
export type FormatedInputNode=	FormatedInputObject | Enum | Union | Scalar | BasicScalar;
export type FormatedOutputNode=	FormatedOutputObject | Enum | Union | Scalar | BasicScalar;


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
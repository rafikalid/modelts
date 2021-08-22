//* AST Parser

import ts from "typescript";

/** Kinds */
export enum ModelKind{
	/** Plain object */
	PLAIN_OBJECT,
	/** Object literal */
	OBJECT_LITERAL,
	/** Method param */
	PARAM,

	/** Enumeration */
	ENUM,

	/** Enum member */
	ENUM_MEMBER,

	/** List of sub entries */
	LIST,

	/** Multiple possible kinds */
	UNION,
	/** Field */
	OUTPUT_FIELD,
	INPUT_FIELD,
	/** Scalar */
	SCALAR,
	/** Basic scalar */
	BASIC_SCALAR,
	/** Reference */
	REF
}

export type Node= PlainObject | Enum | Union | Scalar | BasicScalar | ObjectLiteral;
export type AllNodes= Node | InputField | OutputField | List | Reference | Param;

export interface _Node{
	kind:		ModelKind
	name:		string
	jsDoc:		string|undefined
	deprecated:	string | undefined
}

/** Field possible types (string means reference) */
export type FieldType= List | Reference

/** Plain object */
export interface PlainObject extends _Node{
	kind:			ModelKind.PLAIN_OBJECT
	/** Fields */
	fields:			Map<string, Field>
	/** Visible own and inhireted fields with their flags */
	visibleFields:	Map<string, ts.SymbolFlags>
	/** inheritance */
	inherit:		Reference[]
	/** In case of generic: Generic kies */
	generics: string[] | undefined
}

/** Object literal */
export interface ObjectLiteral extends Omit<_Node, 'name'>{
	kind:		ModelKind.OBJECT_LITERAL
	/** Fields */
	fields:			Map<string, Field>
}

/** Field */
export interface Field{
	input: InputField|undefined
	output: OutputField|undefined
}

/** Object field */
export interface OutputField  extends _Node{
	kind:	ModelKind.OUTPUT_FIELD
	required:	boolean
	/** Content type: List or type name */
	type:		FieldType
	/** Resolver method */
	method:		MethodDescriptor|undefined
	/** Method main parameter */
	param:		Param|undefined // Param is a reference, could not be array or any else.
}

/** Input field */
export interface InputField extends _Node{
	kind:	ModelKind.INPUT_FIELD
	required:	boolean
	/** Content type: List or type name */
	type:		FieldType
	/** Default value */
	defaultValue: any
	/** Input Assert */
	asserts:	AssertOptions | undefined
	/** Input validator */
	validate:	MethodDescriptor|undefined
}

/** Method descriptor */
export interface MethodDescriptor{
	/** File name */
	fileName:	string
	/** class name */
	className:	string
	/** Field name */
	name:		string|undefined
	/** is prototype or static method */
	isStatic:	boolean
}

/** List */
export interface List extends Omit<_Node, 'name'>{
	kind:		ModelKind.LIST
	required:	boolean
	type:		FieldType
}

/** ENUM */
export interface Enum extends _Node{
	kind:		ModelKind.ENUM
	members:	EnumMember[]
}

/** ENUM member */
export interface EnumMember extends _Node{
	kind:		ModelKind.ENUM_MEMBER
	value:		string|number
}

/** UNION */
export interface Union extends _Node{
	kind:		ModelKind.UNION
	/** TODO convert this to references to plain objects */
	types:		FieldType[]
	parser:		MethodDescriptor
}

/** Assert options */
export interface AssertOptions{
	/** Min value, arr.length or string.length */
	min?:		number
	/** Max value, arr.length or string.length */
	max?:		number
	/** less than value, arr.length or string.length */
	lt?:		number
	/** greater than value, arr.length or string.length */
	gt?:		number
	/** less than or equals value, arr.length or string.length */
	lte?:		number
	/** greater than or equals value, arr.length or string.length */
	gte?:		number
	/** Value equals */
	eq?:		number|string
	/** Value not equals */
	ne?:		number|string
	/** arr.length or string.length */
	length?:	number
	/** Regular expression */
	regex?:		RegExp
}

/** Scalar definition */
export interface Scalar extends _Node {
	kind:	ModelKind.SCALAR
	parser:	MethodDescriptor
}
/** Basic scalar */
export interface BasicScalar {
	kind:	ModelKind.BASIC_SCALAR
	name:	string
}

/** Generic reference or operation: Exmaple: Page<User>, Partial<Booking> */
export interface Reference{
	kind:	ModelKind.REF
	name: string
	/** source file name. Used for debuger */
	fileName: string
	/** Params in case of generic type */
	params: FieldType[] | undefined
}

/** Method parameter */
export interface Param extends _Node{
	kind:	ModelKind.PARAM
	type:	Reference
}
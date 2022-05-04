import ts from "typescript"

/** Default parser */
export interface ParserResponse {
	/** Additional imports or any root statement */
	root?: string | ts.Statement | ts.Statement[],
	/** Default value generator */
	value: string | ts.Statement | undefined
}

/** Annotation options */
export interface Annotation {
	/** Annotation type: jsDoc or decorator */
	type: 'JSDOC_TAG' | 'DECORATOR'
	/** Annotation name */
	name: string
	/** Annotation args */
	args: AnnotationArg[]
	/** Element information */
	element: ObjectElement | PropertyElement
}

/** Element */
export interface Element {
	name: string
	annotations: Annotation[]
	/** Check if has annotation */
	hasAnnotation: (name: string) => boolean
	/** Get annotation */
	getAnnotation: (name: string) => Annotation[]
}

/** Class element */
export interface ObjectElement extends Element {
	type: 'object'
	/**
	 * Check if has a property
	 * @example has('inputArg')
	 * @example has('inputArg.id')
	 * @example has('inputArg\\.name.id') to escape "." add "\\"
	 * @example has('inputArg.list.[].id') "[]" means list. to escape it add "\\"
	 */
	has: (path: string) => boolean
}

/** Annotated element */
export interface PropertyElement extends Element {
	type: 'Field' | 'Method'
	//* Type info
	typeName: string
	/** If field is required */
	required: boolean;
	/** If is asynchronous method */
	isAsync: boolean;
	/** Alias to typeName */
	outputTypeName: string
	parentTypeName: string
	inputTypeName: string | undefined
	//* Has
	/**
	 * Check if has a param
	 * @example hasParam('inputArg')
	 * @example hasParam('inputArg.id')
	 * @example hasParam('inputArg\\.name.id') to escape "." add "\\"
	 * @example hasParam('inputArg.list.[].id') "[]" means list. to escape it add "\\"
	 */
	hasParam: (path: string) => boolean
	/**
	 * Check if has an output
	 * @example hasOutput('inputArg')
	 * @example hasOutput('inputArg.id')
	 * @example hasOutput('inputArg\\.name.id') to escape "." add "\\"
	 * @example hasOutput('inputArg.list.[].id') "[]" means list. to escape it add "\\"
	 */
	hasOutput: (path: string) => boolean
	/**
	 * Check if has sibling property
	 */
	hasSibling: (path: string) => boolean
}

/** Annotation arguments */
export interface AnnotationArg {
	/** Name found at annotation level */
	name: string
	/** Original arg name */
	nativeName: string | undefined
	/** value */
	value: StaticValue
}

/** Static values */
export type StaticValue = string | number | boolean | undefined | object | StaticValue[];
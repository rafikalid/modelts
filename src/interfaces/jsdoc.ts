/** Jsdoc format */
export interface JsDocInterface {
	[k: string]: (arg: string) => jsDocAnnotationResult
}

/** JsDoc annotation result */
export interface jsDocAnnotationResult {
	/** Additional imports */
	imports?: {
		name: string

		lib: string
	}[],
	/** Insert code before execution */
	before?: string | string[]
	/** Insert code after execution */
	after?: string | string[]
}

/** JsDoc annotations */
export class JsDocAnnotations implements JsDocInterface {
	[k: string]: (arg: string) => jsDocAnnotationResult;

	/** Parse assertions */
	assert(arg: string) {
		return {};
	}

	/** Pase default value */
	default(arg: string) {
		return {};
	}
}
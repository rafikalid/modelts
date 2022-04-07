/** Errors */
export class ModelError extends Error {
	code: ModelErrorCode;
	constructor(code: ModelErrorCode, message?: string) {
		super(message ?? _errMessages[code]);
		this.code = code;
	}
}

/** Error Codes */
export enum ModelErrorCode {
	/** Code not compiled using "typescript-model-compiler" */
	NOT_COMPILED,
	/** Parser error: Wrong value format */
	WRONG_VALUE,
	/** Wrong annotation arguments */
	WRONG_ANNOTATION_VALUE,
	/** Wrong annotation use */
	WRONG_ANNOTATION_USE
}

/** Predefined Error Messages */
const _errMessages = [
	/* NOT_COMPILED */			'Please compile your code using "tt-model-compiler" or similar',
	/* WRONG_VALUE */			'Wrong value',
	/* WRONG_ANNOTATION_VALUE */'Wrong annotation value',
	/* WRONG_ANNOTATION_USE */	'Wrong annotation use'
]
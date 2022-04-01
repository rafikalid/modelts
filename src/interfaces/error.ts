/** Errors */
export class ModelError extends Error {
	code: ModelErrorCode;
	constructor(code: ModelErrorCode, message: string) {
		super(message);
		this.code = code;
	}
}

/** Error Codes */
export enum ModelErrorCode {
	/** Code not compiled using "typescript-model-compiler" */
	NOT_COMPILED,
	/** Parser error: Wrong value format */
	WRONG_VALUE,
}
/**
 * Validation errors
 */
export class ModelError extends Error {
	code: ErrorCodes;
	constructor(errCode: ErrorCodes, message: string) {
		super(message);
		this.code = errCode;
	}
}


/** Errors */
export enum ErrorCodes {
	VALIDATION_ERRORS
}
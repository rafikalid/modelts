import { ModelError, ModelErrorCode } from "./error";

/**
 * Create Object from Model, ignore optional params
 */
export function create<T>(fields?: Partial<T>): T {
	throw new ModelError(ModelErrorCode.NOT_COMPILED);
}

/** create object, set missing fields to undefined */
export function createAll<T>(fields?: Partial<T>): T {
	throw new ModelError(ModelErrorCode.NOT_COMPILED);
}
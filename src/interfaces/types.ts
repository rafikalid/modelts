import { ModelError, ModelErrorCode } from "@src";

/**
 * Resolve type name
 */
export function getTypeName<Type>(): string {
	throw new ModelError(ModelErrorCode.NOT_COMPILED);
}
/** Resolve escaped type name */
export function getEscapedTypeName<Type>(): string {
	throw new ModelError(ModelErrorCode.NOT_COMPILED);
}

/** Extract properties of a type or interface */
export function getOwnProperties<Type>(): string[] {
	throw new ModelError(ModelErrorCode.NOT_COMPILED);
}

/** Extract all type/interface properties */
export function getAllProperties<Type>(): string[] {
	throw new ModelError(ModelErrorCode.NOT_COMPILED);
}

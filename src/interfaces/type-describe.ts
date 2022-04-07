import { ModelError, ModelErrorCode } from "@src";

/** Describe type */
export function describeType<T>() {
	throw new ModelError(ModelErrorCode.NOT_COMPILED);
}


/**
 * Type descriptor
 */
export interface TypeDescriptor {
	/** Type name */
	name: string
	/** Type escaped name */
	escapedName: string
	/** properties */
	properties: PropertyDescriptor
}

/** Property descriptor */
export interface PropertyDescriptor {
	/** Type name */
	name: string
	/** Type escaped name */
	escapedName: string
	/** Field type */
	type: string //TODO maybe do better
}
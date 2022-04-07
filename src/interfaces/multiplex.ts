/**
 * Generate two object from the same input object
 */
export interface Dual<T, T2> {
	a: T
	b: T2
}

/**
 * Generate two object from the same input object
 * @alias Dual
 */
export type Duplex<T, T2> = Dual<T, T2>;

/**
 * Generate multiple objects from the same input object
 * Need to extends this interface and define own schema
 */
export interface Multiplex { }
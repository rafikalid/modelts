/** Integers */
export type Int= number;

/** Double precesion flotting point */
export type Float= number;

/** Scalar define options */
export type JsonTypes= string|number|boolean|null|undefined

/** Create new Scalar */
export interface ModelScalar<T>{
	/** Parse value */
	parse?: (value: JsonTypes)=> T
	/** Stringify value */
	serialize?: (value: T)=> JsonTypes
	/** Load from Database */
	fromDB?: (value:any)=> T
	/** Save into database */
	toDB?: (value:T)=> any
}

/** Unions */
export interface UNION<Types>{
	// Return the index of target type
	resolveType: (value: Types, info?: any)=> number
}

//* Custom scalars
export type uInt= number;
/** Unsigned integer */
export const uIntScalar: ModelScalar<uInt>= {
	parse(value){
		if(typeof value === 'number' && Number.isSafeInteger(value) && value>=0)
			return value;
		else
			throw new Error(`Illegal unsigned int: ${value}`);
	}
};

/** Unsinged Float */
export type uFloat= number;
export const uFloatScalar: ModelScalar<uInt>= {
	parse(value){
		if(typeof value === 'number' && value>=0)
			return value;
		else
			throw new Error(`Illegal unsigned float: ${value}`);
	}
};

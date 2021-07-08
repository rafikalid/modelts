/** Ignore field or method (do not add theme as fields or resolvers) */
export function ignore(target: any, propertyKey?: string, descriptor?: PropertyDescriptor){}

/** Desclar a class as Model */
export function tsModel(target: any, propertyKey?: string, descriptor?: PropertyDescriptor){}


/** Assert options */
export interface AssertOptions{
	/** Min value, arr.length or string.length */
	min?:		number
	/** Max value, arr.length or string.length */
	max?:		number
	/** less than value, arr.length or string.length */
	lt?:		number
	/** greater than value, arr.length or string.length */
	gt?:		number
	/** less than or equals value, arr.length or string.length */
	lte?:		number
	/** greater than or equals value, arr.length or string.length */
	gte?:		number
	/** arr.length or string.length */
	length?:	number
	/** Regular expression */
	regex?:		RegExp
}
/** @throws Error when assertpion fails */
export type AssertCb= (value:any)=> void
/** Assertions */
export function assert(assertions: AssertOptions|AssertCb, errorMessage?: string){
	return function(target: any, propertyKey: string, descriptor: PropertyDescriptor){}
}
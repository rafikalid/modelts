import { Int, JsonTypes, Model, ModelScalar, UNION, ResolversOf, assert, ignore } from "@src/index.js";

/**
 * @tsmodel
 * Create Model using interfaces
 */
export interface UserModel {
	id: ID,
	/** This is firstname */
	firstName?: string,
	lastName?: string,
	/**
	 * This field is required!
	 * Oh yeah, required :D
	 */
	fullName: string,

	/** Custom type Email */
	email: Email,
	newsletter: boolean,

	/** Those are bookings */
	Bookings?: Booking[]

	message: string,

	history:
		{
			ar1: string
		}[]
}

/** @tsmodel */
export type Email= `/$Email regex^/`;

/** @tsmodel */
export type ID= string;

/** @tsmodel */
export class UserResolvers implements ResolversOf<UserModel>{
	private ignoreThisfield?: number= 5225;
	/** Overriding booking comment */
	@assert({max:55})
	Bookings(parent: any, args: string[], context: any, infos: any):void{
		// this is a resolver
	}

	/** a message */
	message(parent: any, args: Booking, context: any, infos: any): string{
		var s: string= 'hello';
		return s;
	}

	/** Custom method */
	@ignore
	customMethod(){
		return 'this is not a resolver!';
	}
}

/**
 * @tsmodel
 * Bookings
 */
export interface Booking{
	id: ID,
	name: string
}

/**
 * User interface
 * @tsmodel
 */
export interface User{
	id:		ID,
	/**
	 * User's name
	 * @assert {max: 20, min: 17} - Expected value between 20 and 17
	 * @assert {lt: 17, gt: 58} - Expected between 17 and 58
	 * @type {string} - string type
	 * @deprecated use anyting instead :D
	 */
	name:	string,
	/**
	 * User's age
	 * @assert {gte: 66, lte: 88} - Expected value between 15 and 66
	 * @has {EDIT_STAFF} - Excepected permission Edit staff
	 */
	age?:	Int
}

/**
 * @tsmodel
 * Enum
 */
export enum roles{
	/** A basic employee role */
	basicEmployee,
	/** Normal employee role */
	employee=5825,
	/** Store manager */
	manager='managerValue',
	/** Store owner */
	owner='ownerValue'
}

/** Model */
export const model= new Model();

/** type example */
export type ObjectId= ``;

/** Object id scalar */
export const ObjectIdScalar: ModelScalar<ObjectId>= {
	parse(value: JsonTypes){
		return value as ObjectId;
	},
	serialize(value){
		return String(value);
	}
};

/** Union */
export const UnionExample: UNION<User|Booking>= {
	resolveType(value, info: any){
		var s: number= 1522
		return s;
	}
}
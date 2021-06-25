import { Model, resolver } from "@src/index.js";
import { Model as ModelSASA } from "@src/index.js";
import { ResolversOf } from "@src/index.js";

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
	/** Overriding booking comment */
	@resolver
	Bookings(parent: any, args: string[], context: any, infos: any):void{
		// this is a resolver
	}

	/** a message */
	@resolver
	message(parent: any, args: Booking, context: any, infos: any): string{
		return 'hello'
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

/** Model */
export const model= new Model();
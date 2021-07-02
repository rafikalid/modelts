import { Model, Model as ccModel } from "@src/index.js";
import { User } from "./model-test.js";

/** @tsmodel */
export interface UserProfile extends Partial<Omit<User, 'name'>>{
	/**
	 * this is a phone number
	 * @assert {regex: /^0[1-9]+$/}, "hello every body"
	 */
	phoneNumber?: string,
	age: 855
}

export const test2Model= new ccModel();
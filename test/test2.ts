import { Model } from "@src/index.js";
import { User } from "./model-test.js";

/** @tsmodel */
export interface UserProfile extends Partial<User>{
	/**
	 * @assert {regex: /^0[1-9]+$/}
	 */
	phoneNumber?: string
}

export const test2Model= new Model();
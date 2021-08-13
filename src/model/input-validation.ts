import { ObjectNode } from "@src/compiler/model";
import { InputResolver } from "@src/helpers/interfaces";
import type { GraphQLFieldResolver } from "graphql";

/** Validate input data */
export function inputValidationWrapper(config: ObjectNode, method: GraphQLFieldResolver<any, any, any>){
	// TODO validator logic
	return method;
}
// import { ModelNode } from "@src/schema/model";
// import ts from "typescript";

// /**
//  * Convert Model AST into usable tree format
//  * Compile only INPUT fields with validators for Graphql internal use
//  */
// export function compileOnlyInputsWithValidators(factory: ts.NodeFactory, entitiesMap: Record<string, ModelNode>){
// 	var varDeclarations: ts.VariableDeclaration[]= [];
// 	var varmap: Map<ModelNode, ts.Identifier>= new Map();
// 	var queue: ModelNode[]= [];
// 	// Add interface nodes
// 	var entity: ModelNode;
// 	if(entity= entitiesMap.Query) queue.push({entity, isInput: false, index: 0, entityName: 'Query', circles: []});
// 	if(entity= entitiesMap.Mutation) queue.push({entity, isInput: false, index: 0, entityName: 'Mutation', circles: []});
// 	if(entity= entitiesMap.Subscription) queue.push({entity, isInput: false, index: 0, entityName: 'Subscription', circles: []});
// 	// TODO compile inputs with generators & reutrn maping for vars
// 	return {
// 		vars: factory.createVariableStatement(undefined, factory.createVariableDeclarationList(varDeclarations)),
// 		map: varmap
// 	}
// }
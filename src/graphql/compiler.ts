import { ModelNode, ModelRoot } from "@src/schema/model";
import ts from 'typescript';

/**
 * Compile Model to Graphql
 */
export function compileGraphQL(factory: ts.NodeFactory, ast: ModelRoot, pretty: boolean):ts.CallExpression{
	/** Map each node to it's references */
	const mapNodeRef: Map<ModelNode, Set<ModelNode>>= new Map();
	/** Map references to nodes */
	const mapRefNodes: Map<ModelNode, Set<ModelNode>>= new Map();
	//* Go through Model

	// return factory
	return factory.createCallExpression(
		factory.createParenthesizedExpression(factory.createFunctionExpression(
			undefined,
			undefined,
			undefined,
			undefined,
			[],
			undefined,
			factory.createBlock(
				[factory.createReturnStatement(factory.createStringLiteral("heelo"))],
				pretty
			)
		)), undefined, []
	);
}
import { Node } from "@src/parser/model";
import ts from "typescript";

/** Compile Model into Graphql */
export function toGraphQL(root: Map<string, Node>, factory: ts.NodeFactory, pretty: boolean): GqlCompilerResp{
	const imports: ts.ImportDeclaration[]= [];
	/** Validation schema declarations by the API */
	const validationDeclarations: ts.VariableDeclaration[]= [];
	/** Graphql types declaration */
	const graphqlDeclarations: ts.VariableDeclaration[]= [];
	//* Go through Model
	const queue: QueueInterface[]= [];


	// Create block statement
	const statmentsBlock: ts.Statement[]= [
		// Validation
		factory.createVariableStatement(
			undefined,
			factory.createVariableDeclarationList(validationDeclarations)
		),
		// Graphql schema
		factory.createVariableStatement(
			undefined,
			factory.createVariableDeclarationList(graphqlDeclarations)
		)
	];
	
	
	return {
		imports,
		node: factory.createCallExpression(
			factory.createParenthesizedExpression(factory.createFunctionExpression(
				undefined,
				undefined,
				undefined,
				undefined,
				[],
				undefined,
				factory.createBlock( statmentsBlock, pretty )
			)), undefined, []
		)
	}
}


/** Compiler response */
export interface GqlCompilerResp{
	imports:	ts.ImportDeclaration[]
	node:		ts.CallExpression
}
/** Queue interface */
interface QueueInterface{
	entity:		Node
	isInput:	boolean
	/** Current field index (plain_object) */
	index:		number
	// /** Fields with cicles */
	// circles:	ObjectField[]
	// /** Parent node in case of Plain_object */
	// parent?:		QueueInterface
}
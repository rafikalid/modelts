import { ModelError, ModelErrorCode, JsDocAnnotations, GqlSchema } from '@src';


export class Model {
	/** Create graphql schema */
	scanGraphQL<Schema extends GqlSchema, Context = any, A extends JsDocAnnotations = JsDocAnnotations>(glob: string) {
		throw new ModelError(ModelErrorCode.NOT_COMPILED);
	}
}

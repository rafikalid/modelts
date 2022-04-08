import { ModelError, ModelErrorCode, JsDocAnnotations, GqlSchema } from '@src';


export class Model {
	/** Create graphql schema */
	scanGraphQL<S extends GqlSchema, A extends JsDocAnnotations = JsDocAnnotations, Context = any>(glob: string) {
		throw new ModelError(ModelErrorCode.NOT_COMPILED);
	}
}

import ts, { ClassLikeDeclaration } from "typescript";

/**
 * Transforme typescript interfaces and classes to Models
 */
export function createBeforeTransformer(){
	// return transformer
	return function(ctx: ts.TransformationContext): ts.Transformer<ts.SourceFile>{
		return function(sf: ts.SourceFile){ return ts.visitNode(sf, _visitor(ctx, sf)); }
	}
}

/** Visitor */
function _visitor(ctx:ts.TransformationContext, sf:ts.SourceFile): ts.Visitor{
	/** Visitor callback */
	function visitorCb(node: ts.Node): ts.VisitResult<ts.Node>{
		// Check for jsDoc
		// Classes & interfaces
		switch(node.kind){
			case ts.SyntaxKind.ClassDeclaration:
			case ts.SyntaxKind.InterfaceDeclaration:
				if(_isntTsModel(node)) break;
				//TODO compile interfaces and classes
				console.log('----- compile interface')
				break;
			case ts.SyntaxKind.EnumDeclaration:
				if(_isntTsModel(node)) break;
				//TODO compile enum
				console.log('----- compile enum')
				break;
			case ts.SyntaxKind.TypeAliasDeclaration:
				if(_isntTsModel(node)) break;
				//TODO check and compile "type"
				console.log('----- compile type')
				break
		}
		return ts.visitEachChild(node, visitorCb, ctx);
	}
	return visitorCb;
}

/** Check has not "@tsmodel" flag */
function _isntTsModel(node: ts.Node):boolean{
	var childs= node.getChildren();
	var i, len;
	for (i=0, len=childs.length; i < len; i++) {
		const childNode = childs[i];
		if(ts.isJSDoc(childNode)){
			var childNodes= childNode.getChildren();
			for (let j = 0, jLen= childNodes.length; j < jLen; j++) {
				if(childNodes[j].getFullText().trim()=== '@tsmodel') { return true }
			}
			return false;
		}
	}
	return true;
}
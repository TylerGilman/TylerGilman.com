/**
 * @author mrdoob / http://mrdoob.com/
 */

THREE.FontLoader = function ( manager ) {

	THREE.Loader.call( this, manager );

};

THREE.FontLoader.prototype = Object.assign( Object.create( THREE.Loader.prototype ), {

	constructor: THREE.FontLoader,

	load: function ( url, onLoad, onProgress, onError ) {

		var scope = this;

		var loader = new THREE.FileLoader( this.manager );
		loader.setPath( this.path );
		loader.setRequestHeader( this.requestHeader );
		loader.load( url, function ( text ) {

			var json;

			try {

				json = JSON.parse( text );

			} catch ( e ) {

				console.warn( 'THREE.FontLoader: typeface.js support is being deprecated. Use typeface.json instead.' );
				json = JSON.parse( text.substring( 65, text.length - 2 ) );

			}

			var font = scope.parse( json );

			if ( onLoad ) onLoad( font );

		}, onProgress, onError );

	},

	parse: function ( json ) {

		return new THREE.Font( json );

	}

} );

//

THREE.Font = function ( data ) {

	this.data = data;

};

Object.assign( THREE.Font.prototype, {

	isFont: true,

	generateShapes: function ( text, size ) {

		if ( size === undefined ) size = 100;

		var shapes = [];
		var paths = createPaths( text, size, this.data );

		for ( var p = 0, pl = paths.length; p < pl; p ++ ) {

			Array.prototype.push.apply( shapes, paths[ p ].toShapes() );

		}

		return shapes;

	}

} );

function createPaths( text, size, data ) {

	var chars = Array.from ? Array.from( text ) : String( text ).split( '' ); // see #13988
	var scale = size / data.resolution;
	var line_height = ( data.boundingBox.yMax - data.boundingBox.yMin + data.underlineThickness ) * scale;

	var paths = [];

	var offsetX = 0, offsetY = 0;

	for ( var i = 0; i < chars.length; i ++ ) {

		var char = chars[ i ];

		if ( char === '\n' ) {

			offsetX = 0;
			offsetY -= line_height;

		} else {

			var ret = createPath( char, scale, offsetX, offsetY, data );
			offsetX += ret.offsetX;
			paths.push( ret.path );

		}

	}

	return paths;

}

function createPath( char, scale, offsetX, offsetY, data ) {

	var glyph = data.glyphs[ char ] || data.glyphs[ '?' ];

	if ( ! glyph ) {

		console.error( 'THREE.Font: character "' + char + '" does not exists in font family ' + data.familyName + '.' );

		return;

	}

	var path = new THREE.ShapePath();

	var x, y, cpx, cpy, cpx1, cpy1, cpx2, cpy2;

	if ( glyph.o ) {

		var outline = glyph._cachedOutline || ( glyph._cachedOutline = glyph.o.split( ' ' ) );

		for ( var i = 0, l = outline.length; i < l; ) {

			var action = outline[ i ++ ];

			switch ( action ) {

				case 'm': // moveTo

					x = outline[ i ++ ] * scale + offsetX;
					y = outline[ i ++ ] * scale + offsetY;

					path.moveTo( x, y );

					break;

				case 'l': // lineTo

					x = outline[ i ++ ] * scale + offsetX;
					y = outline[ i ++ ] * scale + offsetY;

					path.lineTo( x, y );

					break;

				case 'q': // quadraticCurveTo

					cpx = outline[ i ++ ] * scale + offsetX;
					cpy = outline[ i ++ ] * scale + offsetY;
					cpx1 = outline[ i ++ ] * scale + offsetX;
					cpy1 = outline[ i ++ ] * scale + offsetY;

					path.quadraticCurveTo( cpx1, cpy1, cpx, cpy );

					break;

				case 'b': // bezierCurveTo

					cpx = outline[ i ++ ] * scale + offsetX;
					cpy = outline[ i ++ ] * scale + offsetY;
					cpx1 = outline[ i ++ ] * scale + offsetX;
					cpy1 = outline[ i ++ ] * scale + offsetY;
					cpx2 = outline[ i ++ ] * scale + offsetX;
					cpy2 = outline[ i ++ ] * scale + offsetY;

					path.bezierCurveTo( cpx1, cpy1, cpx2, cpy2, cpx, cpy );

					break;

			}

		}

	}

	return { offsetX: glyph.ha * scale, path: path };

}
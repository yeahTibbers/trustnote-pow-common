// const _pow	= require( '../pow.js' );
//
//
// let bufInput	= _pow._createInputBufferFromObject
// ({
// 	coinBaseList	: {
// 		'4T57ZFLZOMUAMZTXO63XLK5YDQRF5DP2': 10000,
// 		'2SATGZDFDXNNJRVZ52O4J6VYTTMO2EZR': 10000,
// 	},
// 	trustMEBall	: 'rjywtuZ8A70vgIsZ7L4lBR3gz62Nl3vZr2t7I4lzsMU=',
// 	difficulty	: '000fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
// 	pubSeed		: 'public key',
// 	superNode	: 'xing.supernode.trustnote.org',
// });
//
// console.log( bufInput.length, bufInput );

//
// function f( a )
// {
// 	var b = arguments.callee.name;
// 	var a = this.toString();
// 	var result = /^function\s+([\w\$]+)\s*\(/.exec( this.toString() );
// 	console.log( `${ result }` );
// }
//
// f();


function _generateRandomInteger( nMin, nMax )
{
	return Math.floor( Math.random() * ( nMax + 1 - nMin ) ) + nMin;
}


setInterval( () =>
{
	console.log( _generateRandomInteger( 10 * 1000, 30 * 1000 ) );
},200);



//
// const _blakejs		= require( 'blakejs' );
// const _constants	= require( '../../constants.js' );
//
//
// let sHex = _blakejs.blake2sHex( _constants.GENESIS_UNIT );
// console.log( sHex );
//

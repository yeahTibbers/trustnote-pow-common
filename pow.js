/*jslint node: true */
"use strict";

/**
 *	@boss	XING
 */

const _conf		= require( './conf.js' );

const _ffi		= _conf.debug ? null : require( 'ffi' );
const _ref		= require( 'ref' );
const _fs		= require( 'fs' );
const _crypto		= require( 'crypto' );
const _blakejs		= require( 'blakejs' );
const _async		= require( 'async' );

const _constants	= require( './constants.js' );
const _round		= require( './round.js' );
const _super_node	= require( './supernode.js' );
const _pow_service	= require( './pow_service.js' );
const _event_bus	= require( './event_bus.js' );



/**
 * 	@global
 *	@variables
 */
let _objEquihashLibrary		= null;
let _objDifficultyAdjust	= null;
let _sAssocSingleWallet		= null;


/**
 * 	@author		XING
 * 	@datetime	2018/8/6 4:53 PM
 *
 * 	////////////////////////////////////////////////////////////
 *	@description
 *
 * 	Assume that this is the round N, the inputs of the round N+1 are:
 * 	1, unique coin-base units sorted by address from round (N-1)
 *	   arrCoinBaseList
 *	   [
 *		'address0'	: 20% of total amount,
 *		'address1'	: amount of coins,
 *		'address2'	: amount of coins,
 *		'address3'	: amount of coins,
 *		'address4'	: amount of coins,
 *		'address5'	: amount of coins,
 *		'address6'	: amount of coins,
 *		'address7'	: amount of coins,
 *		'address8'	: amount of coins,
 *	   ]
 *	   Note: the address0 came from TrustNote Foundation.
 *	2, ball address of the first TrustME unit from round (N)
 *	3, difficulty value of round (N)
 *	4, public seed of round (N)
 *	5, author address of current SuperNode.
 *
 *
 *	////////////////////////////////////////////////////////////
 *	@examples
 *
 * 	let bCallStartCalculation = startMining( oConn, function( err )
 * 	{
 * 		if ( err )
 * 		{
 * 			console.log( `failed to start calculation, `, err );
 * 			return;
 * 		}
 *
 * 		console.log( `start calculation successfully.` );
 * 	});
 *
 *	let nCallStartCalculation = startCalculationWithInput
 *	({
 *		 previousCoinBaseList	: {
 *			 '4T57ZFLZOMUAMZTXO63XLK5YDQRF5DP2': 10000,
 *			 '2SATGZDFDXNNJRVZ52O4J6VYTTMO2EZR': 10000,
 *		 },
 *		 currentFirstTrustMEBall	: 'rjywtuZ8A70vgIsZ7L4lBR3gz62Nl3vZr2t7I4lzsMU=',
 *		 currentDifficulty	: '000fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
 *		 currentPubSeed		: 'public key',
 *		 superNodeAuthor		: 'xing.supernode.trustnote.org',
 *	}, function( err )
 *	{
 * 		if ( err )
 * 		{
 * 			console.log( `failed to start calculation, `, err );
 * 			return;
 * 		}
 *
 * 		console.log( `start calculation successfully.` );
 * 	});
 *
 *
 *	let bIsValidEquihash = isValidEquihash
 *	(
 *		{
 *			previousCoinBaseList	: {
 *				'4T57ZFLZOMUAMZTXO63XLK5YDQRF5DP2': 10000,
 *				'2SATGZDFDXNNJRVZ52O4J6VYTTMO2EZR': 10000,
 *			},
 *			currentFirstTrustMEBall	: 'rjywtuZ8A70vgIsZ7L4lBR3gz62Nl3vZr2t7I4lzsMU=',
 *			currentDifficulty	: '000fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
 *			currentPubSeed		: 'public key',
 *			superNodeAuthor		: 'xing.supernode.trustnote.org',
 *		},
 *		'00000001c570c4764aadb3f09895619f549000b8b51a789e7f58ea7500007097',
 *		'xxxxxxxxxxxx'
 *	);
 *	console.log( bIsValidEquihash );
 *
 */



/**
 *	start calculation
 *
 *	@param	{handle}	oConn
 *	@param	{function}	oConn.query
 *	@param	{function}	pfnCallback( err )
 *	@return {boolean}
 *
 * 	@description
 * 	start successfully	pfnCallback( null );
 * 	failed to start		pfnCallback( error );
 */
function startMining( oConn, pfnCallback )
{
	if ( 'function' !== typeof pfnCallback )
	{
		//	arguments.callee.name
		throw new Error( `call startCalculation with invalid pfnCallback.` );
	}
	if ( _conf.debug )
	{
		setTimeout( () =>
		{
			_event_bus.emit
			(
				'pow_mined_gift',
				{
					nonce	: _generateRandomInteger( 10000, 200000 ),
					hash	: _crypto.createHash( 'sha256' ).update( String( Date.now() ), 'utf8' ).digest( 'hex' )
				}
			);
		}, _generateRandomInteger( 10 * 1000, 30 * 1000 ) );

		pfnCallback( null );
		return true;
	}

	let nCurrentRoundIndex		= null;
	let arrPreviousCoinBaseList	= null;
	let sCurrentFirstTrustMEBall	= null;
	let nCurrentDifficultyValue	= null;
	let sCurrentPublicSeed		= null;
	let sSuperNodeAuthorAddress	= null;

	_async.series
	([
		function( pfnNext )
		{
			//
			//	get round index
			//
			_round.getCurrentRoundIndex( oConn, function( nRoundIndex )
			{
				if ( 'number' === nRoundIndex )
				{
					nCurrentRoundIndex	= nRoundIndex;
					pfnNext();
				}
				else
				{
					pfnNext( `previous round index must be great then 0` );
				}
			});
		},
		function( pfnNext )
		{
			//
			//	author address of this super node
			//
			_super_node.readSingleAddress( function( sAddress )
			{
				sSuperNodeAuthorAddress = sAddress;
				return pfnNext();
			});
		},
		function( pfnNext )
		{
			//
			//	round (N-1)
			//	obtain coin-base list of the previous round
			//
			queryCoinBaseListByRoundIndex( oConn, nCurrentRoundIndex - 1, function( err, arrCoinBaseList )
			{
				if ( err )
				{
					return pfnNext( err );
				}

				arrPreviousCoinBaseList = arrCoinBaseList;
				return pfnNext();
			});
		},
		function( pfnNext )
		{
			//
			//	round (N)
			//	obtain ball address of the first TrustME unit from current round
			//
			queryFirstTrustMEBallOnMainChainByRoundIndex( oConn, nCurrentRoundIndex, function( err, sBall )
			{
				if ( err )
				{
					return pfnNext( err );
				}

				sCurrentFirstTrustMEBall = sBall;
				return pfnNext();
			});
		},
		function( pfnNext )
		{
			//
			//	round (N)
			//	calculate difficulty value
			//
			calculateDifficultyValueByCycleIndex( oConn, nCurrentRoundIndex, function( err, nDifficulty )
			{
				if ( err )
				{
					return pfnNext( err );
				}

				nCurrentDifficultyValue	= nDifficulty;
				return pfnNext();
			});
		},
		function( pfnNext )
		{
			//
			//	round (N)
			//	calculate public seed
			//
			calculatePublicSeedByRoundIndex( oConn, nCurrentRoundIndex, function( err, sSeed )
			{
				if ( err )
				{
					return pfnNext( err );
				}

				sCurrentPublicSeed = sSeed;
				return pfnNext();
			});
		}
	], function( err )
	{
		if ( err )
		{
			return pfnCallback( err );
		}

		let objInput	= {
			currentRoundIndex	: nCurrentRoundIndex,
			previousCoinBaseList	: arrPreviousCoinBaseList,
			currentFirstTrustMEBall	: sCurrentFirstTrustMEBall,
			currentDifficulty	: nCurrentDifficultyValue,
			currentPubSeed		: sCurrentPublicSeed,
			superNodeAuthor		: sSuperNodeAuthorAddress,
		};
		startMiningWithInputs( objInput, function( err )
		{
			if ( err )
			{
				return pfnCallback( err );
			}

			//
			//	successfully
			//
			pfnCallback( null );
		});
	});

	return true;
}


/**
 *	start calculation with inputs
 *
 * 	@param	{object}	oInput
 *	@param	{number}	oInput.currentRoundIndex
 *	@param	{array}		oInput.previousCoinBaseList		@see description
 *	@param	{string}	oInput.currentFirstTrustMEBall
 *	@param	{string}	oInput.currentDifficulty
 *	@param	{string}	oInput.currentPubSeed
 *	@param	{string}	oInput.superNodeAuthor
 *	@param	{function}	pfnCallback( err )
 *	@return	{boolean}
 */
function startMiningWithInputs( oInput, pfnCallback )
{
	if ( 'object' !== typeof oInput )
	{
		throw new Error( 'call startMining with invalid oInput' );
	}
	if ( 'number' !== typeof oInput.currentRoundIndex )
	{
		throw new Error( 'call startMining with invalid oInput.currentRoundIndex' );
	}
	if ( ! Array.isArray( oInput.previousCoinBaseList ) || 0 === oInput.previousCoinBaseList.length )
	{
		throw new Error( 'call startMining with invalid oInput.previousCoinBaseList' );
	}
	if ( 'string' !== typeof oInput.currentFirstTrustMEBall || 44 !== oInput.currentFirstTrustMEBall.length )
	{
		throw new Error( 'call startMining with invalid oInput.currentFirstTrustMEBall' );
	}
	if ( 'number' !== typeof oInput.currentDifficulty || oInput.currentDifficulty <= 0 )
	{
		throw new Error( 'call startMining with invalid oInput.currentDifficulty' );
	}
	if ( 'string' !== typeof oInput.currentPubSeed || 0 === oInput.currentPubSeed.length )
	{
		throw new Error( 'call startMining with invalid oInput.currentPubSeed' );
	}
	if ( 'string' !== typeof oInput.superNodeAuthor || 0 === oInput.superNodeAuthor.length )
	{
		throw new Error( 'call startMining with invalid oInput.superNodeAuthor' );
	}
	if ( 'function' !== typeof pfnCallback )
	{
		throw new Error( `call startCalculationWithInputs with invalid pfnCallback.` );
	}

	//
	//	...
	//
	//
	//	pubSeed	hex string 128 chars, 256bit, 64字节
	//
	let sInputHex256 = _createMiningInputHexFromObject( oInput );
	let jsonSource =
	{
		id	: oInput.currentRoundIndex,
		pow	: "equihash",
		"params":
		{
			version		: 0,
			roundNumber	: oInput.currentRoundIndex,
			nonce		: 0,
			pubSeed		: sInputHex256,
			pubKey		: oInput.superNodeAuthor,
			difficulty	: oInput.currentDifficulty,
			filterList	: [],
			times		: 0,
			timeout		: 0
		},
		interrupt	: 0,
		error		: null
	};

	//
	//	create server and wait for the response
	//
	_pow_service.server.createServer
	({
		port		: 1302,
		onStart		: ( err, oWs ) =>
		{
			if ( err )
			{
				return console.error( err );
			}
			console.log( `SERVER >> server start.` );

			//
			//	connect to server and send the message
			//
			_pow_service.client.connectToServer
			({
				minerGateway	: 'ws://127.0.0.1:1302',
				onOpen		: ( err, oWs ) =>
				{
					if ( err )
					{
						return console.error( err );
					}
					console.log( `CLIENT >> we have connected to ${ oWs.host } successfully.` );
					_pow_service.sendMessageOnce( oWs, 'pow/task', jsonSource );
				},
				onMessage	: ( oWs, sMessage ) =>
				{
					console.log( `CLIENT >> received a message : ${ sMessage }` );
				},
				onError		: ( oWs, vError ) =>
				{
					console.error( `CLIENT >> error from server: `, vError );
				},
				onClose		: ( oWs, sReason ) =>
				{
					console.log( `CLIENT >> socket was closed(${ sReason })` );
				}
			});
		},
		onConnection	: ( err, oWs ) =>
		{
			if ( err )
			{
				return console.error( err );
			}
			console.log( `SERVER >> a new client connected in.` );
		},
		onMessage	: ( oWs, sMessage ) =>
		{
			console.log( `SERVER >> received a message: ${ sMessage }` );
		},
		onError		: ( oWs, vError ) =>
		{
			console.error( `SERVER >> occurred an error: `, vError );
		},
		onClose		: ( oWs, sReason ) =>
		{
			console.log( `SERVER >> socket was closed(${ sReason })` );
		}
	});

	return true;
}


/**
 * 	calculate public seed by round index
 *
 *	@param	{handle}	oConn
 *	@param	{function}	oConn.query
 *	@param	{number}	nRoundIndex
 *				round 1
 *					hard code
 *				round 2
 *					previous seed
 *					[]
 *					TrustME Ball
 *				round	3
 *					previous seed
 *					[]
 *					TrustME Ball
 *
 * 	@param	{function}	pfnCallback( err, sSeed )
 *
 * 	@documentation
 *	https://github.com/trustnote/document/blob/master/TrustNote-TR-2018-02.md#PoW-Unit
 *
 * 	pubSeed(i)	= blake2s256
 * 		(
 * 			pubSeed(i-1) + hash( Coin-base(i-2) ) + hash( FirstStableMCUnit(i-1) )
 * 		)
 */
function calculatePublicSeedByRoundIndex( oConn, nRoundIndex, pfnCallback )
{
	if ( ! oConn )
	{
		return pfnCallback( `call calculatePublicSeedByRoundIndex with invalid oConn` );
	}
	if ( 'number' !== typeof nRoundIndex )
	{
		return pfnCallback( `call calculatePublicSeedByRoundIndex with invalid nRoundIndex` );
	}
	if ( nRoundIndex <= 1 )
	{
		//
		//	round 1
		//		hard code
		//
		return pfnCallback( null, _blakejs.blake2sHex( _constants.GENESIS_UNIT ) );
	}

	let sPreviousPublicSeed		= null;
	let arrPrePreviousCoinBase	= null;
	let sPreviousTrustMEBall	= null;

	_async.series
	([
		function( pfnNext )
		{
			//	public seed
			queryPublicSeedByRoundIndex( oConn, nRoundIndex - 1, function( err, sSeed )
			{
				if ( err )
				{
					return pfnNext( err );
				}
				if ( 'string' !== typeof sSeed || 0 === sSeed.length )
				{
					return pfnNext( `calculatePublicSeedByRoundIndex got invalid sSeed.` );
				}

				sPreviousPublicSeed = sSeed;
				return pfnNext();
			} );
		},
		function( pfnNext )
		{
			//	coin base
			queryCoinBaseListByRoundIndex( oConn, nRoundIndex - 2, function( err, arrCoinBaseList )
			{
				if ( err )
				{
					return pfnNext( err );
				}
				if ( ! Array.isArray( arrCoinBaseList ) )
				{
					return pfnNext( 'empty coin base list' );
				}
				if ( _constants.COUNT_WITNESSES !== arrCoinBaseList.length )
				{
					return pfnNext( 'no enough coin base units.' );
				}

				arrPrePreviousCoinBase = arrCoinBaseList;
				return pfnNext();
			} );
		},
		function( pfnNext )
		{
			//	first ball
			queryFirstTrustMEBallOnMainChainByRoundIndex( oConn, nRoundIndex - 1, function( err, sBall )
			{
				if ( err )
				{
					return pfnNext( err );
				}
				if ( 'string' !== typeof sBall || 0 === sBall.length )
				{
					return pfnNext( `calculatePublicSeedByRoundIndex got invalid sBall.` );
				}

				sPreviousTrustMEBall = sBall;
				return pfnNext();
			} );
		}
	], function( err )
	{
		if ( err )
		{
			return pfnCallback( err );
		}

		//	...
		let sSource = ""
		+ sPreviousPublicSeed
		+ _crypto.createHash( 'sha512' ).update( JSON.stringify( arrPrePreviousCoinBase ), 'utf8' ).digest();
		+ _crypto.createHash( 'sha512' ).update( sPreviousTrustMEBall, 'utf8' ).digest();

		pfnCallback( null, _blakejs.blake2sHex( sSource ) );
	});
}


/**
 *	get public seed by round index
 *
 *	@param	{handle}	oConn
 *	@param	{function}	oConn.query
 *	@param	{number}	nRoundIndex
 *	@param	{function}	pfnCallback( err, arrCoinBaseList )
 */
function queryPublicSeedByRoundIndex( oConn, nRoundIndex, pfnCallback )
{
	if ( ! oConn )
	{
		return pfnCallback( `call queryPublicSeedByRoundIndex with invalid oConn` );
	}
	if ( 'number' !== typeof nRoundIndex || nRoundIndex <= 0 )
	{
		return pfnCallback( `call queryPublicSeedByRoundIndex with invalid nRoundIndex` );
	}

	oConn.query
	(
		"SELECT seed \
		FROM round \
		WHERE round_index = ?",
		[
			nRoundIndex
		],
		function( arrRows )
		{
			if ( 0 === arrRows.length )
			{
				return pfnCallback( `seed not found.` );
			}

			return pfnCallback( null, arrRows[ 0 ][ 'seed' ] );
		}
	);
}


/**
 *	calculate difficulty value
 *
 *	@param	{handle}	oConn
 *	@param	{function}	oConn.query
 *	@param	{number}	nCycleIndex		- index of new round
 * 	@param	{function}	pfnCallback( err, nNewDifficultyValue )
 */
function calculateDifficultyValueByCycleIndex( oConn, nCycleIndex, pfnCallback )
{
	if ( ! oConn )
	{
		return pfnCallback( `call calculateDifficultyValue with invalid oConn` );
	}
	if ( 'number' !== typeof nCycleIndex || nCycleIndex <= 0 )
	{
		return pfnCallback( `call calculateDifficultyValue with invalid nCycleIndex` );
	}
	if ( _conf.debug )
	{
		return pfnCallback( null, ( Math.random() * ( 9999 - 1000 ) + 1000 ) );
	}

	let nPreviousDifficulty;
	let nTimeUsed;
	let nTimeStandard;

	_async.series
	([
		function( pfnNext )
		{
			queryDifficultyValueByCycleIndex
			(
				oConn,
				nCycleIndex - 1,
				function( err, nDifficulty )
				{
					nPreviousDifficulty = nDifficulty;
				}
			);
			return pfnNext();
		},
		function( pfnNext )
		{
			//	in seconds
			nTimeUsed = 0;
			return pfnNext();
		},
		function( pfnNext )
		{
			//	in seconds
			nTimeStandard = _constants.DURATION_PER_ROUND * _constants.COUNT_ROUNDS_FOR_DIFFICULTY_SWITCH;
			return pfnNext();
		}
	], function( err )
	{
		if ( err )
		{
			return pfnCallback( err );
		}

		let nNewDifficultyValue = _objDifficultyAdjust.CalculateNextWorkRequired
		(
			nPreviousDifficulty,
			nTimeUsed,
			nTimeStandard,
			Buffer.from( "0007ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff" )
		);

		pfnCallback( null, parseInt( nNewDifficultyValue ) );
	});
}

/**
 *	query difficulty value by round index from database
 *
 *	@param	{handle}	oConn
 *	@param	{function}	oConn.query
 *	@param	{number}	nCycleIndex
 *	@param	{function}	pfnCallback( err, nDifficultyValue )
 */
function queryDifficultyValueByCycleIndex( oConn, nCycleIndex, pfnCallback )
{
	if ( ! oConn )
	{
		return pfnCallback( `call queryDifficultyValueByRoundIndex with invalid oConn` );
	}
	if ( 'number' !== typeof nCycleIndex || nCycleIndex <= 0 )
	{
		return pfnCallback( `call queryDifficultyValueByCycleIndex with invalid nCycleIndex` );
	}

	oConn.query
	(
		"SELECT difficulty \
		FROM round_cycle \
		WHERE cycle_id = ?",
		[
			_round.getCycleIdByRoundIndex( nCycleIndex )
		],
		function( arrRows )
		{
			if ( 0 === arrRows.length )
			{
				return pfnCallback( `difficulty not found in table [round_cycle].` );
			}

			return pfnCallback( null, parseInt( arrRows[ 0 ][ 'difficulty' ] ) );
		}
	);
}


/**
 *	get coin-base list by round index
 *
 *	@param	{handle}	oConn
 *	@param	{function}	oConn.query
 *	@param	{number}	nRoundIndex
 *	@param	{function}	pfnCallback( err, arrCoinBaseList )
 */
function queryCoinBaseListByRoundIndex( oConn, nRoundIndex, pfnCallback )
{
	return _round.queryCoinBaseListByRoundIndex( oConn, nRoundIndex, pfnCallback );


	if ( ! oConn )
	{
		return pfnCallback( `call queryCoinBaseListByRoundIndex with invalid oConn` );
	}
	if ( 'number' !== typeof nRoundIndex )
	{
		return pfnCallback( `call queryCoinBaseListByRoundIndex with invalid nRoundIndex` );
	}
	if ( nRoundIndex <= 0 )
	{
		//
		//	return default coin-base list by hard coding
		//
		return _readSingleWallet( function( sAddress )
		{
			pfnCallback( null, [ { address : sAddress, amount : 0 } ] );
		});
	}

	//
	//	obtain coin-base list of the previous round
	//
	oConn.query
	(
		"SELECT DISTINCT unit_authors.address AS u_address, inputs.amount AS i_amount \
		FROM units JOIN unit_authors USING(unit) JOIN inputs USING(unit) \
		WHERE units.round_index = ? AND units.is_stable=1 AND units.sequence='good' AND units.pow_type=? \
		AND 'coinbase' = inputs.type \
		ORDER BY main_chain_index, unit",
		[
			nRoundIndex,
			_constants.POW_TYPE_COIN_BASE
		],
		function( arrRows )
		{
			if ( 0 === arrRows.length )
			{
				return pfnCallback( `no coin base unit.` );
			}
			if ( arrRows.length < _constants.COUNT_WITNESSES )
			{
				return pfnCallback( `not enough coin base units.` );
			}

			return pfnCallback( null, arrRows.map( oRow =>
			{
				return { address : oRow.u_address, amount : oRow.i_amount };
			}));
		}
	);
}


/**
 *	obtain ball address of the first TrustME unit
 *
 *	@param	{handle}	oConn
 *	@param	{function}	oConn.query
 *	@param	{number}	nRoundIndex
 *	@param	{function}	pfnCallback( err, arrCoinBaseList )
 */
function queryFirstTrustMEBallOnMainChainByRoundIndex( oConn, nRoundIndex, pfnCallback )
{
	if ( ! oConn )
	{
		return pfnCallback( `call queryFirstTrustMEBallOnMainChainByRoundIndex with invalid oConn` );
	}
	if ( 'number' !== typeof nRoundIndex )
	{
		return pfnCallback( `call queryFirstTrustMEBallOnMainChainByRoundIndex with invalid nRoundIndex, must be a number` );
	}
	if ( nRoundIndex <= 0 )
	{
		return pfnCallback( `call queryFirstTrustMEBallOnMainChainByRoundIndex with invalid nRoundIndex, must be greater than zero.` );
	}

	//	...
	oConn.query
	(
		"SELECT ball \
		FROM balls JOIN units USING(unit) \
		WHERE units.round_index = ? AND units.is_stable=1 AND units.is_on_main_chain=1 AND units.sequence='good' AND units.pow_type=? \
		ORDER BY units.main_chain_index ASC \
		LIMIT 1",
		[
			nRoundIndex,
			_constants.POW_TYPE_TRUSTME
		],
		function( arrRows )
		{
			if ( 1 !== arrRows.length )
			{
				return pfnCallback( `Can not find a suitable ball for calculation pow.` );
			}

			//	...
			return pfnCallback( null, arrRows[ 0 ][ 'ball' ] );
		}
	);
}



/**
 *	verify if a hash is valid
 *
 * 	@param	{object}	objInput
 *	@param	{array}		objInput.previousCoinBaseList		@see description
 *	@param	{string}	objInput.currentFirstTrustMEBall
 *	@param	{string}	objInput.currentDifficulty
 *	@param	{string}	objInput.currentPubSeed
 *	@param	{string}	objInput.superNodeAuthor
 *	@param	{string}	sHash				'3270bcfd5d77014d85208e39d8608154c89ea10b51a1ba668bc87193340cdd67'
 *	@param	{number}	nNonce
 *	@return	{boolean}
 */
function isValidEquihash( objInput, sHash, nNonce )
{
	if ( 'object' !== typeof objInput )
	{
		throw new Error( 'call isValidEquihash with invalid objInput' );
	}
	if ( 'string' !== typeof sHash || 64 !== sHash.length )
	{
		throw new Error( 'call isValidEquihash with invalid sHash' );
	}
	if ( 'number' !== typeof nNonce )
	{
		throw new Error( 'call isValidEquihash with invalid sNonce' );
	}
	if ( _conf.debug )
	{
		return ( ( Math.random() * ( 9999 - 1000 ) + 1000 ) > 5000 );
	}

	let bRet;
	let nInputLen;
	let bufInput;
	let bufHash;

	//	...
	bRet		= false;
	nInputLen	= 140;
	bufInput	= _createInputBufferFromObject( objInput );
	bufHash		= Buffer.concat( [ Buffer.from( sHash, 'utf8' ) ], 32 );

	//	load library
	_loadEquihashLibraryIfNeed();

	let nCall       = _objEquihashLibrary.equihash( bufInput, nNonce, bufHash, nInputLen );

	console.log( `call equihash = ${ nCall }` );



	return true;
}


/**
 *	create an input buffer with length of 140 from Js plain object
 *	@public
 *	@param	{object}	objInput
 *	@return	{Buffer}
 */
function _createInputBufferFromObject( objInput )
{
	let sInput;
	let bufSha512;
	let bufMd5;
	let bufRmd160;
	let bufSha384;

	if ( 'object' !== typeof objInput )
	{
		return null;
	}

	//	...
	sInput		= JSON.stringify( objInput );

	bufSha512	= _crypto.createHash( 'sha512' ).update( sInput, 'utf8' ).digest();
	bufMd5		= _crypto.createHash( 'md5' ).update( sInput, 'utf8' ).digest();
	bufRmd160	= _crypto.createHash( 'rmd160' ).update( sInput, 'utf8' ).digest();
	bufSha384	= _crypto.createHash( 'sha384' ).update( sInput, 'utf8' ).digest();

	return Buffer.concat( [ bufSha512, bufMd5, bufRmd160, bufSha384 ], 140 );
}


/**
 *	create an 256bit hex string with length of 128 from Js plain object
 *	@public
 *	@param	{object}	objInput
 *	@return	{Buffer}
 */
function _createMiningInputHexFromObject( objInput )
{
	let sInput;

	if ( 'object' !== typeof objInput )
	{
		return null;
	}

	//	...
	sInput = JSON.stringify( objInput );
	return _crypto.createHash( 'sha256' ).update( sInput, 'utf8' ).digest( 'hex' );
}





/**
 *	load libequihash.so dynamically
 *	@private
 */
function _loadEquihashLibraryIfNeed()
{
	if ( null === _objEquihashLibrary )
	{
		_objEquihashLibrary = _ffi.Library
		(
			`${ __dirname }/libs/libequihash.so`,
			{
				'equihash': [ 'int',  [ 'pointer', 'uint', 'pointer', 'int'  ] ]
			}
		);
	}

	if ( null === _objDifficultyAdjust )
	{
		_objDifficultyAdjust = _ffi.Library
		(
			`${ __dirname }/libs/libdiff_adjust.so`,
			{
				'CalculateNextWorkRequired': [ 'uint',  [ 'uint', 'uint', 'uint', 'pointer'  ] ]
			}
		);
	}
}


/**
 *	read single wallet
 *
 *	@private
 *	@param	{function}	pfnCallback( sAddress )
 *	@return {*}
 */
function _readSingleWallet( pfnCallback )
{
	if ( 'string' === typeof _sAssocSingleWallet && 44 === _sAssocSingleWallet.length )
	{
		return pfnCallback( _sAssocSingleWallet );
	}

	return _super_node.readSingleAddress( sAddress =>
	{
		pfnCallback( sAddress );
	});
}


/**
 *	generate random integer
 *
 *	@private
 *	@param	{number}	nMin
 *	@param	{number}	nMax
 *	@returns {*}
 */
function _generateRandomInteger( nMin, nMax )
{
	return Math.floor( Math.random() * ( nMax + 1 - nMin ) ) + nMin;
}







/**
 *	@exports
 */
module.exports.startMining					= startMining;
module.exports.startMiningWithInputs				= startMiningWithInputs;

module.exports.calculatePublicSeedByRoundIndex			= calculatePublicSeedByRoundIndex;
module.exports.calculateDifficultyValueByCycleIndex		= calculateDifficultyValueByCycleIndex;

module.exports.queryPublicSeedByRoundIndex			= queryPublicSeedByRoundIndex;
module.exports.queryCoinBaseListByRoundIndex			= queryCoinBaseListByRoundIndex;
module.exports.queryFirstTrustMEBallOnMainChainByRoundIndex	= queryFirstTrustMEBallOnMainChainByRoundIndex;

module.exports.isValidEquihash					= isValidEquihash;

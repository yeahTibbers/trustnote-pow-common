/*jslint node: true */
"use strict";
var fs = require('fs'+'');
var path = require('path'+''); // make browserify skip it

function getAppsDataDir(){
	switch(process.platform){
		case 'win32': return process.env.LOCALAPPDATA;
		case 'linux': return process.env.HOME + '/.config';
		case 'darwin': return process.env.HOME + '/Library/Application Support';
		default: throw Error("unknown platform "+process.platform);
	}
}

function getPackageJsonDir(start_dir){
	try{
		fs.accessSync(start_dir + '/package.json');
		return start_dir;
	}
	catch(e){
		var parent_dir = path.dirname(start_dir);
		if (parent_dir === '/' || process.platform === 'win32' && parent_dir.match(/^\w:[\/\\]$/))
			throw Error('no package.json found');
		return getPackageJsonDir(parent_dir);
	}
}

// app installation dir, this is where the topmost package.json resides
function getAppRootDir(){
	//console.log("parent:", module.parent);
	//console.log("process.mainModule:", process.mainModule);
	//console.log("require.main:", require.main);
	var mainModuleDir = path.dirname(process.mainModule.paths[0]);
	return getPackageJsonDir(mainModuleDir);
	/*
	var arrParts = __dirname.split(path.sep + 'node_modules' + path.sep);
	if (arrParts.length === 1) // we are not inside node_modules
		return __dirname;
	else
		return arrParts[0]; // topmost parent of node_modules
	*/
}

// read app name from the topmost package.json
function getAppName(){
	var appDir = getAppRootDir();
	console.log("app dir "+appDir);
	return require(appDir + '/package.json').name;
}

// app data dir inside user's home directory
function getAppDataDir() {
	if (process.platform == 'win32') {
		return (getAppsDataDir() + '\\' + getAppName());
	}
	else {
		return (getAppsDataDir() + '/' + getAppName());
	}
}


exports.getAppRootDir = getAppRootDir;
exports.getAppDataDir = getAppDataDir;


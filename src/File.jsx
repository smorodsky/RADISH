﻿/* 
Radish
Version Control for a Adobe InDesign & InCopy

Copyright: Konstantin Smorodsky
License:   MIT

Permission is hereby granted, free of charge, to any person obtaining a copy 
of this software and associated documentation files (the "Software"), to 
deal in the Software without restriction, including without limitation the 
rights to use, copy, modify, merge, publish, distribute, sublicense, and/or 
sell copies of the Software, and to permit persons to whom the Software is 
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in 
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR 
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, 
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE 
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER 
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING 
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS 
IN THE SOFTWARE.
*/

// 2011-12-28

// get file name without extention
File.prototype.getBaseName = function() {
	var 
		name = this.name,
		i = name.lastIndexOf('.');
	
	if (i < 0) return name;
	
	return name.substring(0, i);
}

// get extentions of file
File.prototype.getExt = function() {
	var 
		name = this.name,
		i = name.lastIndexOf('.');
	
	if (i < 0) return '';
	
	return name.substring(i + 1);
}

// create path
Folder.prototype.makePath = function() {
	this.parent && this.parent.makePath();
	this.create();
	return this.exists;
}

// Get file or folder atrtributes:
// 
// Normal       0	Normal file. No attributes are set.
// ReadOnly     1	Read-only file. Attribute is read/write.
// Hidden       2	Hidden file. Attribute is read/write.
// System       4	System file. Attribute is read/write.
// Volume       8	Disk drive volume label. Attribute is read-only.
// Directory   16	Folder or directory. Attribute is read-only.
// Archive     32	File has changed since last backup. Attribute is read/write.
// Alias       64	Link or shortcut. Attribute is read-only.
// Compressed 128	Compressed file. Attribute is read-only.
Folder.prototype.getAttributes = function() {
	if (File.fs == 'Macintosh') return null;
	if (!this.exists) return null;
	
	var tmp_file_name = Folder.temp.absoluteURI + 
		'/esf' + (new Date().getTime() +
		(function(){
			n = 0;
			return function() {return n++};
		})()()).toString(36);
		
	var tmp_file = new File(tmp_file_name);
	var scpt = '\
on error resume next                                                 \
Set fso = CreateObject( "Scripting.FileSystemObject" )               \
Set f = fso.Get' + this.constructor.name + '("' + this.fsName + '")  \
Set tmp = fso.OpenTextFile("' + tmp_file.fsName + '", 2, True)       \
tmp.Write(f.Attributes)                                              \
tmp.Close                                                            \
';
	try {
		app.doScript(scpt, ScriptLanguage.visualBasic);
		
		if (!tmp_file.exists) {
			throw 0;
		}
		tmp_file.open();
		var attr = parseInt(tmp_file.read(9), 10);
		tmp_file.close();
		tmp_file.remove();
		if (isNaN(attr)) {
			throw 0;
		}
	} catch (e) {
		var attr = null;
	}
	tmp_file.close();
	tmp_file.remove();
	return attr;
}

File.prototype.getAttributes = Folder.prototype.getAttributes;

// Set file or folder atrtributes
// Use negetive value for remove attribute
Folder.prototype.setAttribute = function(attr) {
	if (File.fs == 'Macintosh') return false;
	if (0 == attr) return true;
	
	var scpt = '\
on error resume next                                                \
Set fso = CreateObject( "Scripting.FileSystemObject" )              \
Set f = fso.Get' + this.constructor.name + '("' + this.fsName + '") \
attr = ' + Math.round(attr) + '                                     \
If attr > 0 Then                                                    \
    f.Attributes = f.Attributes OR attr                             \
Else                                                                \
	attr = 255 + attr                                               \
    f.Attributes = f.Attributes AND attr                            \
End If                                                              \
'; 
	try {
		app.doScript(scpt, ScriptLanguage.visualBasic);
		return true;
	} catch (e) {}
	
	return false;
}

File.prototype.setAttribute = Folder.prototype.setAttribute;

// set Hidden attribute
Folder.prototype.hide = function() {
	return this.setAttribute(2);
}

File.prototype.hide = function() {
	return this.setAttribute(2);
}

// возвращает строку кодированную для использования в Applescript
File.prototype.getApplescriptEncodedString = function(/* optional */ str) {
	 
	if (str === undefined) str = this.fsName;
	
	var cCodes = '(['; // mem: "way too long, dude"
	
	for (var i = 0, l = str.length; i < l; i++) {
		cCodes += '\u00ABdata utxt' + ('000' + 
			str.charCodeAt(i).toString(16).toUpperCase()).substr(-4) +
			'\u00BBas Unicode text,\u00AC\n';
	}
	return cCodes + '""] as Unicode text)';
}

// выполняет Аpplescript-команду приожения Finder
File.prototype.doMacFinderCommand = function(cmd) {
	if (File.fs != 'Macintosh' || !this.exists) return;
	
	var scpt = '\
try                                                                              \
	set AppleScript\'s text item delimiters to ""                                \
	set this to (POSIX file ' + this.getApplescriptEncodedString() + ') as alias \
on error                                                                         \
	return                                                                       \
end try                                                                          \
tell application "Finder"                                                        \
	try                                                                          \
		' + cmd + '                                                              \
	on error                                                                     \
		delay 1                                                                  \
		try                                                                      \
			' + cmd + '                                                          \
		end try                                                                  \
	end try                                                                      \
end tell                                                                         \
';
	return app.doScript(scpt, ScriptLanguage.APPLESCRIPT_LANGUAGE);
}

// включает защиту файла
File.prototype.lock = function() {
	if (File.fs == 'Macintosh') {
		return this.doMacFinderCommand('set locked of this to true');
	}
	return this.setAttribute(1);
}

// выключает защиту файла
File.prototype.unlock = function() {
	if (File.fs == 'Macintosh') {
		return !this.doMacFinderCommand('set locked of this to false');
	}
	return this.setAttribute(-1);
}

// true если файл защищен
File.prototype.isLocked = function() {
	if (File.fs == 'Macintosh') {
		return this.doMacFinderCommand('locked of this');
	}
	return 1 & this.getAttributes();
}

//============== Color Labels ===============
// No color = 0
// Orange   = 1
// Red      = 2
// Yellow   = 3
// Blue     = 4
// Purple   = 5
// Green    = 6
// Gray     = 7

// возвращает цветовую этикетку файла
File.prototype.getColorLabel = function() {
	return this.doMacFinderCommand('label index of this');
}

// устанавливает цветовую этикетку
File.prototype.setColorLabel = function(label) {
	
	// set label in string format
	if ('String' == label.constructor.name) {
		label = [
			'no color', 'orange', 'red', 'yellow', 
			'blue', 'purple', 'green', 'gray'
		].indexOf(label.toLowerCase());
	}
	
	if (label < 0 || label > 7 || this.getColorLabel() == label) return;
	
	this.doMacFinderCommand('set the label index of this to ' + label);
}

// записывает коментарий spotlight
File.prototype.setSpotlightComment = function(theComment) {
	this.doMacFinderCommand('set comment of this to ' + 
		this.getApplescriptEncodedString(theComment));
}

// возвращает коментарий spotlight
File.prototype.getSpotlightComment = function() {
	return this.doMacFinderCommand('comment of this');
};

// асинхронное копирование файла
File.prototype.asyncCopy = function(toFile) {
	try {
		if (File.fs == 'Macintosh') {
			var scpt = '\
try                                                                      \
	set AppleScript\'s text item delimiters to ""                        \
	set this to ' + this.getApplescriptEncodedString() + '               \
	set dest to ' + (new File(toFile)).getApplescriptEncodedString() + ' \
	do shell script "cp -p \\"" & (POSIX path of this) & "\\" \\"" & (POSIX path of dest) & "\\">/dev/null 2>&1 &" \
	"ok"                                                                 \
end try                                                                  \
';
			if ('ok' != app.doScript(scpt, ScriptLanguage.APPLESCRIPT_LANGUAGE)) throw 0;
			return true;
		}
		// windows
		throw 0;
	} catch (e) {
		return this.copy(toFile);
	}
}

// download file from specified URL
File.prototype.downloadFrom = function(url) {
	if (File.fs == 'Macintosh') {
		// create file
		if (!this.exists) {
			this.open('w');
			this.close();
			if (!this.exists) {
				throw new Error('Cant create file ' + this.fsName);
			}
		}
		var scpt = '\
try                                                                      \
	set AppleScript\'s text item delimiters to ""                        \
	set this to ' + this.getApplescriptEncodedString() + '               \
	tell application "URL Access Scripting"                              \
		download "' + url + '" to this replacing yes                     \
	end tell                                                             \
	"ok"                                                                 \
on error errMsg                                                          \
	errMsg                                                               \
end try                                                                  \
';
		return 'ok' == app.doScript(scpt, ScriptLanguage.APPLESCRIPT_LANGUAGE);
	}
	// windows
	this.remove();
	if (this.exists) {
		return false;
	}
	var fn = this.fsName.replace(/\\/g, '\\\\');
	var scpt = '\
rem Based on a script found on the Thai Visa forum                 \
rem http://www.thaivisa.com/forum/index.php?showtopic=21832        \
                                                                   \
on error resume next                                               \
Dim i, objFile, objFSO, objHTTP, strFile, strMsg                   \
Const ForWriting = 2                                               \
                                                                   \
Set objFSO = CreateObject( "Scripting.FileSystemObject" )          \
Set objFile = objFSO.OpenTextFile("' + fn + '", ForWriting, True ) \
Set objHTTP = CreateObject( "WinHttp.WinHttpRequest.5.1" )         \
                                                                   \
rem Download the specified URL                                     \
objHTTP.Open "GET", "' + url + '", False                           \
objHTTP.Send                                                       \
                                                                   \
rem Write the downloaded byte stream to the target file            \
For i = 1 To LenB( objHTTP.ResponseBody )                          \
    objFile.Write Chr( AscB( MidB( objHTTP.ResponseBody, i, 1 ) ) )\
Next                                                               \
objFile.Close( )                                                   \
';
	app.doScript(scpt, ScriptLanguage.visualBasic);
	return this.exists;
}

// unzip file
File.prototype.unzip = function(toFolder) {
	if (!this.exists || !toFolder.makePath()) {
		return false;
	}
	// mac
	if (File.fs == 'Macintosh') {
		var scpt = '\
try                                                                         \
	set AppleScript\'s text item delimiters to ""                           \
	set this to ' + this.getApplescriptEncodedString() + '                  \
	set fld to ' + (new File(toFolder.fsName)).getApplescriptEncodedString() + ' \
	do shell script "unzip -u \\"" & POSIX path of this & "\\" -d \\"" & POSIX path of fld & "\\"" \
	"ok"                                                                    \
on error errMsg                                                             \
	errMsg                                                                  \
end try                                                                     \
';
		return 'ok' == app.doScript(scpt, ScriptLanguage.APPLESCRIPT_LANGUAGE);
	}
	// windows
	var scpt = '\
on error resume next                                         \
set sa = CreateObject("Shell.Application")                   \
set filesInzip = sa.NameSpace("' + this.fsName + '").items   \
set targetFolder = sa.NameSpace("' + toFolder.fsName + '")   \
targetFolder.CopyHere(filesInzip)                            \
if Err.Number > 0 then                                       \
	targetFolder.NewFolder("!!broken_zip_file")              \
end if                                                       \
';
	app.doScript(scpt, ScriptLanguage.visualBasic);
	var flFolder = new Folder(toFolder.absoluteURI + '/!!broken_zip_file');
	var broken_zip_file = flFolder.exists;
	flFolder.remove();
	return toFolder.getFiles().length && !broken_zip_file;
}

// read text file
File.prototype.readFile = function() {
	var 
		data,
		i = 999;
	
	if (!this.exists) {
		throw new Error('File not exists');
	}
	while (!this.open('r') && --i) $.sleep(9);
	
	if (i == 0) throw new Error('File locked');
	
	this.encoding = 'UTF-8';
	data = this.read();
	
	if (this.error) {
		try {
			this.close();
		} catch (e) {}
		throw new Error(this.error);
	}
	this.close();
	
	return data;
}
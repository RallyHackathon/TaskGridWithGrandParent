var require = function (file, cwd) {
    var resolved = require.resolve(file, cwd || '/');
    var mod = require.modules[resolved];
    if (!mod) throw new Error(
        'Failed to resolve module ' + file + ', tried ' + resolved
    );
    var res = mod._cached ? mod._cached : mod();
    return res;
}

require.paths = [];
require.modules = {};
require.extensions = [".js",".coffee"];

require._core = {
    'assert': true,
    'events': true,
    'fs': true,
    'path': true,
    'vm': true
};

require.resolve = (function () {
    return function (x, cwd) {
        if (!cwd) cwd = '/';
        
        if (require._core[x]) return x;
        var path = require.modules.path();
        cwd = path.resolve('/', cwd);
        var y = cwd || '/';
        
        if (x.match(/^(?:\.\.?\/|\/)/)) {
            var m = loadAsFileSync(path.resolve(y, x))
                || loadAsDirectorySync(path.resolve(y, x));
            if (m) return m;
        }
        
        var n = loadNodeModulesSync(x, y);
        if (n) return n;
        
        throw new Error("Cannot find module '" + x + "'");
        
        function loadAsFileSync (x) {
            if (require.modules[x]) {
                return x;
            }
            
            for (var i = 0; i < require.extensions.length; i++) {
                var ext = require.extensions[i];
                if (require.modules[x + ext]) return x + ext;
            }
        }
        
        function loadAsDirectorySync (x) {
            x = x.replace(/\/+$/, '');
            var pkgfile = x + '/package.json';
            if (require.modules[pkgfile]) {
                var pkg = require.modules[pkgfile]();
                var b = pkg.browserify;
                if (typeof b === 'object' && b.main) {
                    var m = loadAsFileSync(path.resolve(x, b.main));
                    if (m) return m;
                }
                else if (typeof b === 'string') {
                    var m = loadAsFileSync(path.resolve(x, b));
                    if (m) return m;
                }
                else if (pkg.main) {
                    var m = loadAsFileSync(path.resolve(x, pkg.main));
                    if (m) return m;
                }
            }
            
            return loadAsFileSync(x + '/index');
        }
        
        function loadNodeModulesSync (x, start) {
            var dirs = nodeModulesPathsSync(start);
            for (var i = 0; i < dirs.length; i++) {
                var dir = dirs[i];
                var m = loadAsFileSync(dir + '/' + x);
                if (m) return m;
                var n = loadAsDirectorySync(dir + '/' + x);
                if (n) return n;
            }
            
            var m = loadAsFileSync(x);
            if (m) return m;
        }
        
        function nodeModulesPathsSync (start) {
            var parts;
            if (start === '/') parts = [ '' ];
            else parts = path.normalize(start).split('/');
            
            var dirs = [];
            for (var i = parts.length - 1; i >= 0; i--) {
                if (parts[i] === 'node_modules') continue;
                var dir = parts.slice(0, i + 1).join('/') + '/node_modules';
                dirs.push(dir);
            }
            
            return dirs;
        }
    };
})();

require.alias = function (from, to) {
    var path = require.modules.path();
    var res = null;
    try {
        res = require.resolve(from + '/package.json', '/');
    }
    catch (err) {
        res = require.resolve(from, '/');
    }
    var basedir = path.dirname(res);
    
    var keys = (Object.keys || function (obj) {
        var res = [];
        for (var key in obj) res.push(key)
        return res;
    })(require.modules);
    
    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        if (key.slice(0, basedir.length + 1) === basedir + '/') {
            var f = key.slice(basedir.length);
            require.modules[to + f] = require.modules[basedir + f];
        }
        else if (key === basedir) {
            require.modules[to] = require.modules[basedir];
        }
    }
};

require.define = function (filename, fn) {
    var dirname = require._core[filename]
        ? ''
        : require.modules.path().dirname(filename)
    ;
    
    var require_ = function (file) {
        return require(file, dirname)
    };
    require_.resolve = function (name) {
        return require.resolve(name, dirname);
    };
    require_.modules = require.modules;
    require_.define = require.define;
    var module_ = { exports : {} };
    
    require.modules[filename] = function () {
        require.modules[filename]._cached = module_.exports;
        fn.call(
            module_.exports,
            require_,
            module_,
            module_.exports,
            dirname,
            filename
        );
        require.modules[filename]._cached = module_.exports;
        return module_.exports;
    };
};

if (typeof process === 'undefined') process = {};

if (!process.nextTick) process.nextTick = (function () {
    var queue = [];
    var canPost = typeof window !== 'undefined'
        && window.postMessage && window.addEventListener
    ;
    
    if (canPost) {
        window.addEventListener('message', function (ev) {
            if (ev.source === window && ev.data === 'browserify-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);
    }
    
    return function (fn) {
        if (canPost) {
            queue.push(fn);
            window.postMessage('browserify-tick', '*');
        }
        else setTimeout(fn, 0);
    };
})();

if (!process.title) process.title = 'browser';

if (!process.binding) process.binding = function (name) {
    if (name === 'evals') return require('vm')
    else throw new Error('No such module')
};

if (!process.cwd) process.cwd = function () { return '.' };

if (!process.env) process.env = {};
if (!process.argv) process.argv = [];

require.define("path", function (require, module, exports, __dirname, __filename) {
function filter (xs, fn) {
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        if (fn(xs[i], i, xs)) res.push(xs[i]);
    }
    return res;
}

// resolves . and .. elements in a path array with directory names there
// must be no slashes, empty elements, or device names (c:\) in the array
// (so also no leading and trailing slashes - it does not distinguish
// relative and absolute paths)
function normalizeArray(parts, allowAboveRoot) {
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = parts.length; i >= 0; i--) {
    var last = parts[i];
    if (last == '.') {
      parts.splice(i, 1);
    } else if (last === '..') {
      parts.splice(i, 1);
      up++;
    } else if (up) {
      parts.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (allowAboveRoot) {
    for (; up--; up) {
      parts.unshift('..');
    }
  }

  return parts;
}

// Regex to split a filename into [*, dir, basename, ext]
// posix version
var splitPathRe = /^(.+\/(?!$)|\/)?((?:.+?)?(\.[^.]*)?)$/;

// path.resolve([from ...], to)
// posix version
exports.resolve = function() {
var resolvedPath = '',
    resolvedAbsolute = false;

for (var i = arguments.length; i >= -1 && !resolvedAbsolute; i--) {
  var path = (i >= 0)
      ? arguments[i]
      : process.cwd();

  // Skip empty and invalid entries
  if (typeof path !== 'string' || !path) {
    continue;
  }

  resolvedPath = path + '/' + resolvedPath;
  resolvedAbsolute = path.charAt(0) === '/';
}

// At this point the path should be resolved to a full absolute path, but
// handle relative paths to be safe (might happen when process.cwd() fails)

// Normalize the path
resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
    return !!p;
  }), !resolvedAbsolute).join('/');

  return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
};

// path.normalize(path)
// posix version
exports.normalize = function(path) {
var isAbsolute = path.charAt(0) === '/',
    trailingSlash = path.slice(-1) === '/';

// Normalize the path
path = normalizeArray(filter(path.split('/'), function(p) {
    return !!p;
  }), !isAbsolute).join('/');

  if (!path && !isAbsolute) {
    path = '.';
  }
  if (path && trailingSlash) {
    path += '/';
  }
  
  return (isAbsolute ? '/' : '') + path;
};


// posix version
exports.join = function() {
  var paths = Array.prototype.slice.call(arguments, 0);
  return exports.normalize(filter(paths, function(p, index) {
    return p && typeof p === 'string';
  }).join('/'));
};


exports.dirname = function(path) {
  var dir = splitPathRe.exec(path)[1] || '';
  var isWindows = false;
  if (!dir) {
    // No dirname
    return '.';
  } else if (dir.length === 1 ||
      (isWindows && dir.length <= 3 && dir.charAt(1) === ':')) {
    // It is just a slash or a drive letter with a slash
    return dir;
  } else {
    // It is a full dirname, strip trailing slash
    return dir.substring(0, dir.length - 1);
  }
};


exports.basename = function(path, ext) {
  var f = splitPathRe.exec(path)[2] || '';
  // TODO: make this comparison case-insensitive on windows?
  if (ext && f.substr(-1 * ext.length) === ext) {
    f = f.substr(0, f.length - ext.length);
  }
  return f;
};


exports.extname = function(path) {
  return splitPathRe.exec(path)[3] || '';
};

});

require.define("/app.js", function (require, module, exports, __dirname, __filename) {
    "use strict";
/*global Rally, Ext, require*/
/*
Ext.define('app.Grid2', {
	extend: 'Rally.app.App',

	launch: function launch() {
		Rally.data.ModelFactory.getModel({
			type: 'Task',
			scope: this,
			success: function (model) {
				this.grid = this.add({
					xtype: 'rallygrid',
					model: model,
					columnCfgs: [
						'FormattedID',
						'Name',
						'Owner',
						'WorkProduct'
					],
					listeners: {
							load: this._onDataLoaded,
							scope: this
					},
					storeConfig: {
						filters: [
							{
								property: 'Iteration.State',
								operator: '=',
								value: 'Committed'
							}, {
								property: 'Project.ObjectID',
								operator: '=',
								value: this.getContext().getProject().ObjectID
							}
						]
					}
				});
			}
		});
	},

	_onDataLoaded: function (store, data) {

	}
});

Rally.launchApp('app.Grid2', {
	name: 'Grid2'
});
*/

if (Ext.isEmpty(window.console)) {
	window.console = {
		log: function () {}
	};
}

var detailLink = function (val, ref) {
	//console.log("Detail Link", val, _, rec);

	//var link = new Ext.Template("<a href='{0}' target='_top'>{1}</a>");

	var link = new Rally.util.DetailLinkBuilder().build(val, ref);
	link = link.replace(/onmouseover=".*"/g, '');
	link = link.replace('href="', 'href="/');
	link = link.replace('>', 'target="_top">');

	console.log(link);

	return link;
	//return link.applyTemplate([rec.data.WorkProductParentRef, val]);
};

var refname = function (val, _, rec) {
	if (Ext.isEmpty(val)) {
		return "";
	}

	if (Ext.isObject(val) && val.hasOwnProperty("_refObjectName")) {
		return val._refObjectName;
	}

	return val;
};

var app = Ext.define('CustomApp', {
	extend: 'Rally.app.App',
	componentCls: 'app',

	launch: function () {
		var ws = this.getContext().getWorkspace().ObjectID,
			that = this;

		Ext.create('Rally.data.WsapiDataStore', {
			model: 'UserStory',
			autoLoad: true,
			listeners: {
				load: function (storyStore, storyData) {
					Ext.create('Rally.data.WsapiDataStore', {
						model: 'Task',
						autoLoad: true,
						filters: [
							{
								property: 'State',
								operator: '<',
								value: 'Completed'
							}
						],
						listeners: {
							load: function (taskStore, taskData) {
								Rally.data.ModelFactory.getModel({
								    type: 'Task',
								    context: {
								        workspace: "/workspace/" + ws
								    },
								    success: function(model) {
										that.onDataLoadedTask(storyData, taskData, model);
								    }
								});
							},
							scope: this
						}
					});
				},
				scope: this
			}
		});
	},

	onDataLoadedTask: function (storyData, taskData, model) {
		console.log(storyData);
		console.log(taskData);
		console.log(model.fields);

		var storyParents = {},
			records = [],
			rec,
			columns = [],
			k;

		Ext.Array.each(storyData, function (record) {
			if (!Ext.isEmpty(record.get("Parent"))) {
				storyParents[record.get("_ref")] = {
					name: record.get("Parent")._refObjectName,
					ref: record.get("Parent")._ref
				};
			}
		});

		console.log("Story Parents", storyParents);

		Ext.Array.each(taskData, function (record) {
			var k,
				c,
				b;

			rec = record.data;
			rec.WorkProductName = record.get('WorkProduct')._refObjectName;
			rec.WorkProductParent = storyParents[record.get('WorkProduct')._ref].name;
			rec.WorkProductParentRef = storyParents[record.get('WorkProduct')._ref].ref;

			console.log("Parent?", record.get("Name"), record.get('WorkProduct')._ref, storyParents[record.get('WorkProduct')._ref]);
			if (!Ext.isEmpty(rec.WorkProductParent)) {
				console.log("Found parent", rec);
			}

			if (columns.length === 0) {
				for (k in rec) {
					if (rec.hasOwnProperty(k)) {
						b = true;
						c = {
							text: k.replace(/([A-Z])/g, ' $1'),
							dataIndex: k,
							hidden: true
						};

						b = b && (k.indexOf('_') !== 0);
						b = b && !({
							Subscription: 1,
							RevisionHistory: 1,
							Changesets: 1,
							Discussion: 1,
							Workspace: 1,
							Attachments: 1,
							Recycled: 1,
							WorkProductParentRef: 1, 
							deletable: 1, 
							creatable: 1, 
							updatable: 1}.hasOwnProperty(k));

						console.log(k.indexOf('_'));

						if (typeof rec[k] === 'object') {
							c.renderer = refname;
						}

						if (k === "ObjectID") {
							c.text = "Object ID";
						}

						if (k === "FormattedID") {
							c.renderer = function (val, _, rec) {
								return detailLink(val, rec.data._ref);
							};
							c.hidden = false;
							c.text = "Formatted ID";
						}

						if (k === "WorkProductParent") {
							c.renderer = function (val, _, rec) {
								return detailLink(val, rec.data.WorkProductParentRef);
							};
							c.flex = 1;
							c.hidden = false;
							//c.text = "Work Product Parent";
						}

						if (k === "WorkProduct") {
							c.renderer = function (val, _, rec) {
								return detailLink(val._refObjectName, rec.data.WorkProduct._ref);
							};
							c.flex = 1;
							c.hidden = false;
							//c.text = "Work Product";
						}

						if (k === "Name") {
							c.flex = 2;
							c.hidden = false;
						}

						if (b) {
							columns.push(c);
						}
					}
				}
			}

			records.push(rec);
		});

		columns.sort(function (a, b) {
			if (a.text < b.text) {
				return -1;
			} else if (a.text > b.text) {
				return 1;
			} else {
				return 0;
			}
		});

		this.add({
			xtype: 'rallygrid',
			store: Ext.create('Rally.data.custom.Store', {
				data: records,
				pageSize: 25
			}),
			/*
			columnCfgs: [
				{
					text: 'Formatted ID',
					dataIndex: 'FormattedID'
				},
				{
					text: 'Name',
					dataIndex: 'Name',
					flex: 2
				},
				{
					text: 'Story',
					dataIndex: 'WorkProductName',
					flex: 1
				},
				{
					text: 'Story Parent',
					dataIndex: 'WorkProductParent',
					flex: 1,
					renderer: detailLink,
					hidden: true
				}
			]*/
			columnCfgs: columns
		});
	}
});

Rally.launchApp('CustomApp', {
	name: 'Grid With Freeform Data Example'
});

});
require("/app.js");

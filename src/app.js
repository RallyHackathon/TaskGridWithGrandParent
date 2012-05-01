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

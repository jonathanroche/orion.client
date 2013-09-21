/*******************************************************************************
 * Copyright (c) 2013 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials are made 
 * available under the terms of the Eclipse Public License v1.0 
 * (http://www.eclipse.org/legal/epl-v10.html), and the Eclipse Distribution 
 * License v1.0 (http://www.eclipse.org/org/documents/edl-v10.html). 
 * 
 * Contributors: IBM Corporation - initial API and implementation
 ******************************************************************************/
 
/*global define document window*/
define([
	'i18n!orion/edit/nls/messages',
	'orion/explorers/explorer-table',
	'orion/explorers/navigatorRenderer',
	'orion/selection',
	'orion/fileCommands',
	'orion/extensionCommands',
	'orion/keyBinding',
	'orion/markdownView', 
	'orion/projects/projectEditor',
	'orion/PageUtil',
	'orion/URITemplate',
	'orion/webui/littlelib',
	'orion/objects'
], function(messages, mExplorerTable, mNavigatorRenderer, Selection, FileCommands, ExtensionCommands, mKeyBinding, mMarkdownView, mProjectEditor, PageUtil, URITemplate, lib, objects) {
	
	var FileExplorer = mExplorerTable.FileExplorer;
	var KeyBinding = mKeyBinding.KeyBinding;
	
	function FolderNavExplorer(options) {
		var self = this;
		options.setFocus = false;   // do not steal focus on load
		options.cachePrefix = null; // do not persist table state
		options.dragAndDrop = FileCommands.uploadFile;
		options.rendererFactory = function(explorer) {
			var renderer =  new mNavigatorRenderer.NavigatorRenderer({
				checkbox: false, 
				cachePrefix: "FolderNavigator" //$NON-NLS-0$
			}, explorer, options.commandRegistry, options.contentTypeRegistry);
			renderer.getCellHeaderElement = function(col_no) {
				var td;
				if (col_no === 0) {
					td = document.createElement("th"); //$NON-NLS-0$
					td.colSpan = 1;
					td.appendChild(document.createTextNode(explorer.treeRoot.Name));
					return td;
				} else if (col_no === 1) {
					td = document.createElement("th"); //$NON-NLS-0$
					td.colSpan = 2;
					var span = document.createElement("span"); //$NON-NLS-0$
					span.id = self.toolbarId;
					td.appendChild(span);
					window.setTimeout(function() {
						self.updateCommands();
					}, 0);
					return td;
				}
				return null;
			};
			renderer.getExpandImage = function() {
				return null;
			};
			return renderer;
		};
		FileExplorer.apply(this, arguments);
		this.commandsId = ".folderNav";
		this.serviceRegistry = options.serviceRegistry;
		this.fileClient = options.fileClient;
		this.commandRegistry = options.commandRegistry;
		this.contentTypeRegistry = options.contentTypeRegistry;
		this.treeRoot = {};
		var parent = lib.node(this.parentId);	
		this.toolbarId = parent.id + "Tool"; //$NON-NLS-0$
		this.newActionsScope = parent.id + "New"; //$NON-NLS-0$
		this.selectionActionsScope = parent.id + "Selection"; //$NON-NLS-0$
		this.selection = new Selection.Selection(this.serviceRegistry, "folderNavFileSelection"); //$NON-NLS-0$
		this.selection.addEventListener("selectionChanged", function(event) { //$NON-NLS-0$
			self.updateCommands(event.selections);
		});
	}
	FolderNavExplorer.prototype = Object.create(FileExplorer.prototype);
	objects.mixin(FolderNavExplorer.prototype, /** @lends orion.FolderNavExplorer.prototype */ {
		refresh: function() {
			var self = this;
			var pageParams = PageUtil.matchResourceParameters();
			this.loadResourceList(pageParams.resource, false).then(function() {
				self.registerCommands().then(function() {
					self.updateCommands();
				});
			});
		},
		destroy: function() {
			var _self = this;
			[this.newActionsScope, this.selectionActionsScope].forEach(function(id) {
				delete _self[id];
			});
		},
		createActionSections: function(toolbar) {
			[this.selectionActionsScope, this.newActionsScope].forEach(function(id) {
				if (!lib.node(id)) {
					var elem = document.createElement("ul"); //$NON-NLS-0$
					elem.id = id;
					elem.classList.add("commandList"); //$NON-NLS-0$
					elem.classList.add("layoutRight"); //$NON-NLS-0$
//					elem.classList.add("pageActions"); //$NON-NLS-0$
					toolbar.appendChild(elem);
				}
			});
		},
		// Returns a deferred that completes once file command extensions have been processed
		registerCommands: function() {
			var commandRegistry = this.commandRegistry, fileClient = this.fileClient, serviceRegistry = this.serviceRegistry;
			var newActionsScope = this.newActionsScope;
			var selectionActionsScope = this.selectionActionsScope;
			commandRegistry.addCommandGroup(newActionsScope, "orion.folderNavNewGroup", 1000, messages.New, null, null, "core-sprite-addcontent", null, "dropdownSelection"); //$NON-NLS-3$ //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
			commandRegistry.addCommandGroup(selectionActionsScope, "orion.folderNavSelectionGroup", 100, messages.Actions, null, null, "core-sprite-gear", null, "dropdownSelection"); //$NON-NLS-3$ //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
			commandRegistry.registerSelectionService(selectionActionsScope, this.selection);

			// commands that don't appear but have keybindings
			commandRegistry.registerCommandContribution(newActionsScope, "eclipse.copySelections" + this.commandsId, 1, null, true, new KeyBinding('c', true) /* Ctrl+C */); //$NON-NLS-1$ //$NON-NLS-0$
			commandRegistry.registerCommandContribution(newActionsScope, "eclipse.pasteSelections" + this.commandsId, 1, null, true, new KeyBinding('v', true) /* Ctrl+V */);//$NON-NLS-1$ //$NON-NLS-0$

			// New file and new folder (in a group)
			commandRegistry.registerCommandContribution(newActionsScope, "eclipse.newFile" + this.commandsId, 1, "orion.folderNavNewGroup"); //$NON-NLS-1$ //$NON-NLS-0$
			commandRegistry.registerCommandContribution(newActionsScope, "eclipse.newFolder" + this.commandsId, 2, "orion.folderNavNewGroup", false, null/*, new mCommandRegistry.URLBinding("newFolder", "name")*/); //$NON-NLS-3$ //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
			// New project creation in the toolbar (in a group)
			commandRegistry.registerCommandContribution(newActionsScope, "orion.new.project" + this.commandsId, 1, "orion.folderNavNewGroup"); //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
			commandRegistry.registerCommandContribution(newActionsScope, "orion.new.linkProject" + this.commandsId, 2, "orion.folderNavNewGroup"); //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
			
			var parent = lib.node(this.parentId);
			var renameBinding = new KeyBinding(113); // F2
			renameBinding.domScope = parent.id;
			renameBinding.scopeName = messages.Navigator;
			var delBinding = new KeyBinding(46); // Delete
			delBinding.domScope = parent.id;
			delBinding.scopeName = messages.Navigator;
			commandRegistry.registerCommandContribution(selectionActionsScope, "eclipse.renameResource" + this.commandsId, 2, "orion.folderNavSelectionGroup", false, renameBinding); //$NON-NLS-1$ //$NON-NLS-0$
			commandRegistry.registerCommandContribution(selectionActionsScope, "eclipse.copyFile" + this.commandsId, 3, "orion.folderNavSelectionGroup"); //$NON-NLS-1$ //$NON-NLS-0$
			commandRegistry.registerCommandContribution(selectionActionsScope, "eclipse.moveFile" + this.commandsId, 4, "orion.folderNavSelectionGroup"); //$NON-NLS-1$ //$NON-NLS-0$
			commandRegistry.registerCommandContribution(selectionActionsScope, "eclipse.deleteFile" + this.commandsId, 5, "orion.folderNavSelectionGroup", false, delBinding); //$NON-NLS-1$ //$NON-NLS-0$
			commandRegistry.registerCommandContribution(selectionActionsScope, "eclipse.compareWithEachOther" + this.commandsId, 6, "orion.folderNavSelectionGroup");  //$NON-NLS-1$ //$NON-NLS-0$
			commandRegistry.registerCommandContribution(selectionActionsScope, "eclipse.compareWith" + this.commandsId, 7, "orion.folderNavSelectionGroup");  //$NON-NLS-1$ //$NON-NLS-0$
			commandRegistry.registerCommandContribution(selectionActionsScope, "orion.importZipURL" + this.commandsId, 1, "orion.folderNavSelectionGroup/orion.importExportGroup"); //$NON-NLS-1$ //$NON-NLS-0$
			commandRegistry.registerCommandContribution(selectionActionsScope, "orion.import" + this.commandsId, 2, "orion.folderNavSelectionGroup/orion.importExportGroup"); //$NON-NLS-1$ //$NON-NLS-0$
			commandRegistry.registerCommandContribution(selectionActionsScope, "eclipse.downloadFile" + this.commandsId, 3, "orion.folderNavSelectionGroup/orion.importExportGroup"); //$NON-NLS-1$ //$NON-NLS-0$
			commandRegistry.registerCommandContribution(selectionActionsScope, "orion.importSFTP" + this.commandsId, 4, "orion.folderNavSelectionGroup/orion.importExportGroup"); //$NON-NLS-1$ //$NON-NLS-0$
			commandRegistry.registerCommandContribution(selectionActionsScope, "eclipse.exportSFTPCommand" + this.commandsId, 5, "orion.folderNavSelectionGroup/orion.importExportGroup"); //$NON-NLS-1$ //$NON-NLS-0$
			FileCommands.createFileCommands(serviceRegistry, commandRegistry, this, fileClient);
			return ExtensionCommands.createAndPlaceFileCommandsExtension(serviceRegistry, commandRegistry, selectionActionsScope, 0, "orion.folderNavSelectionGroup", true);
		},
		updateCommands: function(selections) {
			var toolbar = lib.node(this.toolbarId);
			if (!toolbar) {
				return;
			}
			this.createActionSections(toolbar);
			FileCommands.updateNavTools(this.registry, this.commandRegistry, this, this.newActionsScope, this.selectionActionsScope, this.treeRoot, true);
		}
	});
	
	/** 
	 * Constructs a new FolderView object.
	 * 
	 * @class 
	 * @name orion.FolderView
	 */
	function FolderView(options) {
		this._parent = options.parent;
		this._input = options.input;
		this._contents = options.contents;
		this._metadata = options.metadata;
		this.fileClient = options.fileService;
		this.progress = options.progress;
		this.serviceRegistry = options.serviceRegistry;
		this.commandService = options.commandService;
		this.contentTypeRegistry = options.contentTypeRegistry;
		this.showProjectView = true;
		this.showFolderNav = true;
		this._init();
	}
	FolderView.prototype = /** @lends orion.FolderView.prototype */ {
		_init: function(){
			if(this.serviceRegistry.getServiceReferences("orion.projects").length===0){
				this.showProjectView = false;
			}
			this.markdownView = new mMarkdownView.MarkdownView({
				fileClient : this.fileClient,
				progress : this.progress
			});
			if(this.showProjectView){
				this.projectEditor = new mProjectEditor.ProjectEditor({
					fileClient : this.fileClient,
					progress : this.progress,
					serviceRegistry: this.serviceRegistry,
					commandService: this.commandService
				});
			}
		},
		displayFolderView: function(children){
			var projectJson;
			var readmeMd;
			for (var i=0; i<children.length; i++) {
				var child = children[i];
				if (!child.Directory && child.Name === "project.json") { //$NON-NLS-0$
					projectJson = child;
				}
				if (!child.Directory && child.Name && child.Name.toLowerCase() === "readme.md") { //$NON-NLS-0$
					readmeMd = child;
				}

			}
			var div;
			this._node = document.createElement("div"); //$NON-NLS-0$
			this._parent.appendChild(this._node);
				
			if(projectJson && this.showProjectView){
				div = document.createElement("div"); //$NON-NLS-0$
				this.projectEditor.displayContents(div, this._contents);
				this._node.appendChild(div);
			}
			
			if (this.showFolderNav) {
				var navNode = document.createElement("div"); //$NON-NLS-0$
				navNode.className = "folderNav"; //$NON-NLS-0$
				navNode.id = "folderNavNode"; //$NON-NLS-0$
				this.folderNavExplorer = new FolderNavExplorer({
					parentId: navNode,
					serviceRegistry: this.serviceRegistry,
					fileClient: this.fileClient,
					commandRegistry: this.commandService,
					contentTypeRegistry: this.contentTypeRegistry
				});
				this.folderNavExplorer.refresh();
				this._node.appendChild(navNode);
			}
			
			if (!(projectJson && this.showProjectView) && readmeMd) {
				div = document.createElement("div"); //$NON-NLS-0$
				this.markdownView.displayInFrame(div, readmeMd);
				this._node.appendChild(div);
			}
		},
		create: function() {
			if(this._contents.Children){
				this.displayFolderView(this._contents.Children);
			} else if(this._contents.ChildrenLocation){
				var _self = this;
				this.progress.progress(this.fileClient.fetchChildren(this._contents.ChildrenLocation), "Fetching children of " + this._contents.Name).then( 
					function(children) {
						_self.displayFolderView.call(_self, children);
					}
				);
			}
		},
		destroy: function() {
			if (this.folderNavExplorer) {
				this.folderNavExplorer.destroy();
			}
			this.folderNavExplorer = null;
			if (this._node && this._node.parentNode) {
				this._node.parentNode.removeChild(this._node);
			}
			this._node = null;
		}
	};
	return {FolderView: FolderView};
});

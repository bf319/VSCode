/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ICommandHandler } from 'vs/platform/commands/common/commands';
import { IBookmarksManager, BookmarkType, SortType } from 'vs/workbench/contrib/scopeTree/common/bookmarks';
import { MenuRegistry, MenuId } from 'vs/platform/actions/common/actions';
import { KeybindingsRegistry, KeybindingWeight } from 'vs/platform/keybinding/common/keybindingsRegistry';
import { BookmarkHeader } from 'vs/workbench/contrib/scopeTree/browser/bookmarksView';
import { IExplorerService } from 'vs/workbench/contrib/files/common/files';
import { ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';
import { KeyMod, KeyCode } from 'vs/base/common/keyCodes';
import { IListService } from 'vs/platform/list/browser/listService';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { getMultiSelectedResources } from 'vs/workbench/contrib/files/browser/files';
import { AbstractTree } from 'vs/base/browser/ui/tree/abstractTree';
import { Directory } from 'vs/workbench/contrib/scopeTree/browser/directoryViewer';
import { IFileService } from 'vs/platform/files/common/files';
import { ITextFileService } from 'vs/workbench/services/textfile/common/textfiles';
import { IWorkspaceContextService } from 'vs/platform/workspace/common/workspace';
import { IFileDialogService } from 'vs/platform/dialogs/common/dialogs';
import { isEqualOrParent, dirname } from 'vs/base/common/resources';

// Handlers implementations for context menu actions
const addBookmark: ICommandHandler = (accessor: ServicesAccessor, scope: BookmarkType) => {
	const bookmarksManager = accessor.get(IBookmarksManager);
	const explorerService = accessor.get(IExplorerService);
	const stats = explorerService.getContext(/*respectMultiSelection = */ true);

	for (let stat of stats) {
		if (stat.isDirectory) {
			bookmarksManager.addBookmark(stat.resource, scope);
		}
	}
};

const changeFileExplorerRoot: ICommandHandler = (accessor: ServicesAccessor, element: Directory) => {
	const explorerService = accessor.get(IExplorerService);
	const listService = accessor.get(IListService);
	const editorService = accessor.get(IEditorService);

	if (element && element instanceof BookmarkHeader) {
		return;
	}

	// Input received from opening the context menu
	if (element && element.resource) {
		explorerService.setRoot(element.resource);
	} else {
		const lastFocusedList = listService.lastFocusedList;
		if (lastFocusedList && lastFocusedList?.getHTMLElement() === document.activeElement) {
			// Selection in bookmarks panel (don't allow multiple selection)
			const currentFocus = lastFocusedList.getFocus();
			if (lastFocusedList instanceof AbstractTree && currentFocus.every(item => item instanceof Directory)) {
				const resource = currentFocus.length === 1 ? (currentFocus[0] as Directory).resource : undefined;
				if (resource) {
					explorerService.setRoot(resource);
				}
				return;
			}

			// Selection in explorer (don't allow multiple selection)
			const resources = getMultiSelectedResources(undefined, listService, editorService, explorerService);
			const resource = resources && resources.length === 1 ? resources[0] : undefined;
			if (resource) {
				explorerService.setRoot(resource);
			}
		}
	}
};

const sortBookmarksByName: ICommandHandler = (accessor: ServicesAccessor) => {
	accessor.get(IBookmarksManager).sortBookmarks(SortType.NAME);
};

const sortBookmarksByDate: ICommandHandler = (accessor: ServicesAccessor) => {
	accessor.get(IBookmarksManager).sortBookmarks(SortType.DATE);
};

const displayBookmarkInFileTree: ICommandHandler = (accessor: ServicesAccessor, element: Directory | BookmarkHeader) => {
	if (element && element instanceof Directory) {
		const explorerService = accessor.get(IExplorerService);
		const rootResource = explorerService.roots[0].resource;
		const selectedResource = element.resource;

		const isChildOfCurrentRoot = isEqualOrParent(selectedResource, rootResource);
		if (isChildOfCurrentRoot) {
			explorerService.select(selectedResource);
		} else {
			explorerService.setRoot(selectedResource);
		}
	}
};

const handleBookmarksChange = (accessor: ServicesAccessor, element: Directory, newScope: BookmarkType) => {
	const bookmarksManager = accessor.get(IBookmarksManager);
	const resource = element.resource;
	bookmarksManager.addBookmark(resource, newScope);
};

// Bookmarks panel context menu
MenuRegistry.appendMenuItem(MenuId.DisplayBookmarksContext, {
	group: '1_bookmarks_sort',
	order: 10,
	command: {
		id: 'sortBookmarksByName',
		title: 'Sort by: Name'
	}
});

MenuRegistry.appendMenuItem(MenuId.DisplayBookmarksContext, {
	group: '1_bookmarks_sort',
	order: 20,
	command: {
		id: 'sortBookmarksByDate',
		title: 'Sort by: Date added'
	}
});

MenuRegistry.appendMenuItem(MenuId.DisplayBookmarksContext, {
	group: '2_bookmarks_file_tree_actions',
	order: 10,
	command: {
		id: 'setBookmarkAsRoot',
		title: 'Set as root'
	}
});

MenuRegistry.appendMenuItem(MenuId.DisplayBookmarksContext, {
	group: '2_bookmarks_file_tree_actions',
	order: 20,
	command: {
		id: 'displayBookmarkInFileTree',
		title: 'Show in file tree'
	}
});

MenuRegistry.appendMenuItem(MenuId.DisplayBookmarksContext, {
	group: '3_bookmarks_toggle',
	order: 10,
	command: {
		id: 'removeBookmark',
		title: 'Remove bookmark'
	}
});

MenuRegistry.appendMenuItem(MenuId.DisplayBookmarksContext, {
	group: '3_bookmarks_toggle',
	order: 20,
	command: {
		id: 'toggleBookmarkType',
		title: 'Toggle bookmark type'
	}
});

// Add commands in explorer context menu
MenuRegistry.appendMenuItem(MenuId.ExplorerContext, {
	group: '51_add_bookmark',
	order: 10,
	command: {
		id: 'addGlobalBookmark',
		title: 'Add global bookmark'
	}
});

MenuRegistry.appendMenuItem(MenuId.ExplorerContext, {
	group: '51_add_bookmark',
	order: 20,
	command: {
		id: 'addWorkspaceBookmark',
		title: 'Add workspace bookmark'
	}
});

// Register commands
KeybindingsRegistry.registerCommandAndKeybindingRule({
	id: 'addGlobalBookmark',
	weight: KeybindingWeight.WorkbenchContrib,
	handler: (accessor: ServicesAccessor) => addBookmark(accessor, BookmarkType.GLOBAL)
});

KeybindingsRegistry.registerCommandAndKeybindingRule({
	id: 'addWorkspaceBookmark',
	weight: KeybindingWeight.WorkbenchContrib,
	handler: (accessor: ServicesAccessor) => addBookmark(accessor, BookmarkType.WORKSPACE)
});

KeybindingsRegistry.registerCommandAndKeybindingRule({
	id: 'removeBookmark',
	weight: KeybindingWeight.WorkbenchContrib,
	handler: (accessor: ServicesAccessor, element: Directory | BookmarkHeader) => {
		if (element && element instanceof Directory) {
			handleBookmarksChange(accessor, element, BookmarkType.NONE);
		}
	}
});

KeybindingsRegistry.registerCommandAndKeybindingRule({
	id: 'toggleBookmarkType',
	weight: KeybindingWeight.WorkbenchContrib,
	handler: (accessor: ServicesAccessor, element: Directory | BookmarkHeader) => {
		if (element && element instanceof Directory) {
			const currentBookmarkType = accessor.get(IBookmarksManager).getBookmarkType(element.resource);
			const toggledBookmarkType = currentBookmarkType === BookmarkType.WORKSPACE ? BookmarkType.GLOBAL : BookmarkType.WORKSPACE;
			handleBookmarksChange(accessor, element, toggledBookmarkType);
		}
	}
});

KeybindingsRegistry.registerCommandAndKeybindingRule({
	id: 'setBookmarkAsRoot',
	weight: KeybindingWeight.WorkbenchContrib,
	primary: KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.KEY_R,
	handler: changeFileExplorerRoot
});

KeybindingsRegistry.registerCommandAndKeybindingRule({
	id: 'setParentAsRootInFileTree',
	weight: KeybindingWeight.WorkbenchContrib,
	primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyMod.Alt | KeyCode.KEY_R,
	handler: (accessor: ServicesAccessor) => {
		const explorerService = accessor.get(IExplorerService);
		const contextService = accessor.get(IWorkspaceContextService);
		const roots = explorerService.roots;
		if (!roots || roots.length === 0) {
			return;
		}

		const root = roots[0].resource;
		const isWorkspaceRoot = contextService.getWorkspace().folders.find(folder => folder.uri.toString() === root.toString()) !== undefined;
		if (!isWorkspaceRoot) {
			explorerService.setRoot(dirname(root));
		}
	}
});

KeybindingsRegistry.registerCommandAndKeybindingRule({
	id: 'sortBookmarksByName',
	weight: KeybindingWeight.WorkbenchContrib,
	handler: sortBookmarksByName
});

KeybindingsRegistry.registerCommandAndKeybindingRule({
	id: 'sortBookmarksByDate',
	weight: KeybindingWeight.WorkbenchContrib,
	handler: sortBookmarksByDate
});

KeybindingsRegistry.registerCommandAndKeybindingRule({
	id: 'displayBookmarkInFileTree',
	weight: KeybindingWeight.WorkbenchContrib,
	handler: displayBookmarkInFileTree
});

MenuRegistry.appendMenuItem(MenuId.DisplayBookmarksContext, {
	group: '4_blueprint_bookmarks',
	order: 10,
	command: {
		id: 'importBookmarks',
		title: 'Import bookmarks'
	}
});

MenuRegistry.appendMenuItem(MenuId.DisplayBookmarksContext, {
	group: '4_blueprint_bookmarks',
	order: 20,
	command: {
		id: 'exportBookmarks',
		title: 'Export bookmarks'
	}
});

KeybindingsRegistry.registerCommandAndKeybindingRule({
	id: 'exportBookmarks',
	weight: KeybindingWeight.WorkbenchContrib,
	handler: (accessor: ServicesAccessor) => {
		const bookmarksManager = accessor.get(IBookmarksManager);
		const textFileService = accessor.get(ITextFileService);
		const contextService = accessor.get(IWorkspaceContextService);
		const fileDialogService = accessor.get(IFileDialogService);
		const fileService = accessor.get(IFileService);
		const editorService = accessor.get(IEditorService);

		const workspaceBookmarks = new Set(bookmarksManager.workspaceBookmarks);
		const workspaceFolder = contextService.getWorkspace().folders[0];
		if (!workspaceFolder) {
			return;
		}

		const defaultPath = URI.joinPath(workspaceFolder.uri, 'blueprint');
		fileDialogService.showSaveDialog({ title: 'Save Bookmarks As...', defaultUri: defaultPath, filters: [{ name: 'Blueprint files', extensions: ['bookmarks'] }] })
			.then(newPath => {
				if (!newPath) {
					return;
				}

				fileService.exists(newPath).then(async exists => {
					if (exists) {
						// Bookmarks need to be merged
						const blueprintsRaw = (await fileService.readFile(newPath)).value.toString();
						const prevBookmarks = new Set(JSON.parse(blueprintsRaw) as string[]);
						prevBookmarks.forEach(bookmark => {
							workspaceBookmarks.add(bookmark);
						});
					}

					const toWrite: string[] = Directory.getDirectoriesAsSortedTreeElements(workspaceBookmarks, SortType.NAME)
						.map(treeElement => treeElement.element.resource.toString());

					textFileService.create(newPath, JSON.stringify(toWrite, undefined, '\t' /* Insert tab and new line before resource */), { overwrite: true }).then(() => editorService.openEditor({ resource: newPath }));

				});
			});
	}
});

KeybindingsRegistry.registerCommandAndKeybindingRule({
	id: 'importBookmarks',
	weight: KeybindingWeight.WorkbenchContrib,
	handler: (accessor: ServicesAccessor) => {
		const bookmarksManager = accessor.get(IBookmarksManager);
		const fileService = accessor.get(IFileService);
		const fileDialogService = accessor.get(IFileDialogService);
		const contextService = accessor.get(IWorkspaceContextService);

		const workspaceFolder = contextService.getWorkspace().folders[0];
		fileDialogService.showOpenDialog({ defaultUri: workspaceFolder.uri, canSelectFiles: true, canSelectMany: false, filters: [{ name: 'Blueprint files', extensions: ['bookmarks'] }] })
			.then(resources => {
				if (!resources || resources.length === 0) {
					return;
				}

				fileService.readFile(resources[0]).then(bookmarksRaw => {
					const blueprints = new Set(JSON.parse(bookmarksRaw.value.toString()) as string[]);
					blueprints.forEach(res => {
						bookmarksManager.addBookmark(URI.parse(res), BookmarkType.WORKSPACE);
					});
				});
			});
	}
});

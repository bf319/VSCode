/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ICommandHandler } from 'vs/platform/commands/common/commands';
import { IBookmarksManager, BookmarkType } from 'vs/workbench/contrib/scopeTree/common/bookmarks';
import { MenuRegistry, MenuId } from 'vs/platform/actions/common/actions';
import { KeybindingsRegistry, KeybindingWeight } from 'vs/platform/keybinding/common/keybindingsRegistry';
import { Bookmark } from 'vs/workbench/contrib/scopeTree/browser/bookmarksView';
import { IExplorerService } from 'vs/workbench/contrib/files/common/files';

// Handlers implementations for context menu actions
const removeBookmarkHandler: ICommandHandler = (accessor, element: Bookmark) => {
	const bookmarksManager = accessor.get(IBookmarksManager);
	bookmarksManager.addBookmark(element.resource, BookmarkType.NONE);
};

const toggleToGlobalBookmarkHandler: ICommandHandler = (accessor, element: Bookmark) => {
	const bookmarksManager = accessor.get(IBookmarksManager);
	bookmarksManager.addBookmark(element.resource, BookmarkType.GLOBAL);
};

const toggleToWorkspaceBookmarkHandler: ICommandHandler = (accessor, element: Bookmark) => {
	const bookmarksManager = accessor.get(IBookmarksManager);
	bookmarksManager.addBookmark(element.resource, BookmarkType.WORKSPACE);
};

const setBookmarkAsRoot: ICommandHandler = (accessor, element: Bookmark) => {
	const explorerService = accessor.get(IExplorerService);
	explorerService.setRoot(element.resource);
};

const sortBookmarksByName: ICommandHandler = (accessor) => {
	console.log('Sorting by name is not implemented');
};

const sortBookmarksByDate: ICommandHandler = (accessor) => {
	console.log('Sorting by date is not implemented');
};

const displayBookmarkInFileTree: ICommandHandler = (accessor) => {
	console.log('Displaying directory in file tree from bookmarks panel is not implemented');
};

// Workspace panel context menu
MenuRegistry.appendMenuItem(MenuId.DisplayWorkspaceBookmarksContext, {
	group: '1_bookmarks_sort',
	order: 10,
	command: {
		id: 'sortBookmarksByName',
		title: 'Sort by: Name'
	}
});

MenuRegistry.appendMenuItem(MenuId.DisplayWorkspaceBookmarksContext, {
	group: '1_bookmarks_sort',
	order: 20,
	command: {
		id: 'sortBookmarksByDate',
		title: 'Sort by: Date added'
	}
});

MenuRegistry.appendMenuItem(MenuId.DisplayWorkspaceBookmarksContext, {
	group: '2_bookmarks_file_tree_actions',
	order: 10,
	command: {
		id: 'setBookmarkAsRoot',
		title: 'Set as root'
	}
});

MenuRegistry.appendMenuItem(MenuId.DisplayWorkspaceBookmarksContext, {
	group: '2_bookmarks_file_tree_actions',
	order: 20,
	command: {
		id: 'displayBookmarkInFileTree',
		title: 'Show in file tree'
	}
});

MenuRegistry.appendMenuItem(MenuId.DisplayWorkspaceBookmarksContext, {
	group: '3_bookmarks_toggle',
	order: 10,
	command: {
		id: 'removeBookmark',
		title: 'Remove bookmark'
	}
});

MenuRegistry.appendMenuItem(MenuId.DisplayWorkspaceBookmarksContext, {
	group: '3_bookmarks_toggle',
	order: 20,
	command: {
		id: 'toggleBookmarkToGlobal',
		title: 'Change to global bookmark'
	}
});

// Global panel context menu
MenuRegistry.appendMenuItem(MenuId.DisplayGlobalBookmarksContext, {
	group: '1_bookmarks_sort',
	order: 10,
	command: {
		id: 'sortBookmarksByName',
		title: 'Sort by: Name'
	}
});

MenuRegistry.appendMenuItem(MenuId.DisplayGlobalBookmarksContext, {
	group: '1_bookmarks_sort',
	order: 20,
	command: {
		id: 'sortBookmarksByDate',
		title: 'Sort by: Date added'
	}
});

MenuRegistry.appendMenuItem(MenuId.DisplayGlobalBookmarksContext, {
	group: '2_bookmarks_file_tree_actions',
	order: 10,
	command: {
		id: 'setBookmarkAsRoot',
		title: 'Set as root'
	}
});

MenuRegistry.appendMenuItem(MenuId.DisplayGlobalBookmarksContext, {
	group: '2_bookmarks_file_tree_actions',
	order: 20,
	command: {
		id: 'displayBookmarkInFileTree',
		title: 'Show in file tree'
	}
});

MenuRegistry.appendMenuItem(MenuId.DisplayGlobalBookmarksContext, {
	group: '3_bookmarks_toggle',
	order: 10,
	command: {
		id: 'removeBookmark',
		title: 'Remove bookmark'
	}
});

MenuRegistry.appendMenuItem(MenuId.DisplayGlobalBookmarksContext, {
	group: '3_bookmarks_toggle',
	order: 20,
	command: {
		id: 'toggleBookmarkToWorkspace',
		title: 'Change to workspace bookmark'
	}
});

// Register commands
KeybindingsRegistry.registerCommandAndKeybindingRule({
	id: 'removeBookmark',
	weight: KeybindingWeight.WorkbenchContrib,
	handler: removeBookmarkHandler
});

KeybindingsRegistry.registerCommandAndKeybindingRule({
	id: 'toggleBookmarkToGlobal',
	weight: KeybindingWeight.WorkbenchContrib,
	handler: toggleToGlobalBookmarkHandler
});

KeybindingsRegistry.registerCommandAndKeybindingRule({
	id: 'toggleBookmarkToWorkspace',
	weight: KeybindingWeight.WorkbenchContrib,
	handler: toggleToWorkspaceBookmarkHandler
});

KeybindingsRegistry.registerCommandAndKeybindingRule({
	id: 'setBookmarkAsRoot',
	weight: KeybindingWeight.WorkbenchContrib,
	handler: setBookmarkAsRoot
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

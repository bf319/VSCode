/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ICommandHandler } from 'vs/platform/commands/common/commands';
import { IBookmarksManager, BookmarkType, bookmarkClass } from 'vs/workbench/contrib/scopeTree/common/bookmarks';
import { MenuRegistry, MenuId } from 'vs/platform/actions/common/actions';
import { KeybindingsRegistry, KeybindingWeight } from 'vs/platform/keybinding/common/keybindingsRegistry';
import { Bookmark, BookmarkHeader } from 'vs/workbench/contrib/scopeTree/browser/bookmarksView';
import { IExplorerService } from 'vs/workbench/contrib/files/common/files';
import { URI } from 'vs/base/common/uri';
import { ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';
import { KeyMod, KeyCode } from 'vs/base/common/keyCodes';
import { IListService } from 'vs/platform/list/browser/listService';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { getMultiSelectedResources } from 'vs/workbench/contrib/files/browser/files';
import { AbstractTree } from 'vs/base/browser/ui/tree/abstractTree';

// Handlers implementations for context menu actions
const changeFileExplorerRoot: ICommandHandler = (accessor: ServicesAccessor, element: Bookmark) => {
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
			if (lastFocusedList instanceof AbstractTree && currentFocus.every(item => item instanceof Bookmark)) {
				const resource = currentFocus.length === 1 ? (currentFocus[0] as Bookmark).resource : undefined;
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
	console.log('Sorting by name is not implemented');
};

const sortBookmarksByDate: ICommandHandler = (accessor: ServicesAccessor) => {
	console.log('Sorting by date is not implemented');
};

const displayBookmarkInFileTree: ICommandHandler = (accessor: ServicesAccessor) => {
	console.log('Displaying directory in file tree from bookmarks panel is not implemented');
};

const toggleIconIfVisible = (resource: URI, scope: BookmarkType) => {
	const bookmarkIcon = document.getElementById('bookmarkIconContainer_' + resource.toString());
	if (bookmarkIcon) {
		bookmarkIcon.className = bookmarkClass(scope);
	}
};

const handleBookmarksChange = (accessor: ServicesAccessor, element: Bookmark, newScope: BookmarkType) => {
	const bookmarksManager = accessor.get(IBookmarksManager);
	const resource = element.resource;
	bookmarksManager.addBookmark(resource, newScope);
	toggleIconIfVisible(resource, newScope);
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

// Register commands
KeybindingsRegistry.registerCommandAndKeybindingRule({
	id: 'removeBookmark',
	weight: KeybindingWeight.WorkbenchContrib,
	handler: (accessor: ServicesAccessor, element: Bookmark | BookmarkHeader) => {
		if (element && element instanceof Bookmark) {
			handleBookmarksChange(accessor, element, BookmarkType.NONE);
		}
	}
});

KeybindingsRegistry.registerCommandAndKeybindingRule({
	id: 'toggleBookmarkType',
	weight: KeybindingWeight.WorkbenchContrib,
	handler: (accessor: ServicesAccessor, element: Bookmark | BookmarkHeader) => {
		if (element && element instanceof Bookmark) {
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

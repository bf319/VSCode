/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ICommandHandler } from 'vs/platform/commands/common/commands';
import { IBookmarksManager, BookmarkType } from 'vs/workbench/contrib/scopeTree/common/bookmarks';
import { MenuRegistry, MenuId } from 'vs/platform/actions/common/actions';
import { KeybindingsRegistry, KeybindingWeight } from 'vs/platform/keybinding/common/keybindingsRegistry';
import { Bookmark } from 'vs/workbench/contrib/scopeTree/browser/bookmarksView';

const removeBookmarkHandler: ICommandHandler = (accessor, bookmark: Bookmark) => {
};

const toggleToGlobalBookmarkHandler: ICommandHandler = (accessor, bookmark: Bookmark) => {
};

const toggleToWorkspaceBookmarkHandler: ICommandHandler = (accessor, bookmark: Bookmark) => {
};

// Workspace panel context menu
MenuRegistry.appendMenuItem(MenuId.DisplayWorkspaceBookmarksContext, {
	command: {
		id: 'removeBookmark',
		title: 'Remove bookmark'
	}
});

MenuRegistry.appendMenuItem(MenuId.DisplayWorkspaceBookmarksContext, {
	command: {
		id: 'toggleBookmarkToGlobal',
		title: 'Change to global bookmark'
	}
});

// Global panel context menu
MenuRegistry.appendMenuItem(MenuId.DisplayGlobalBookmarksContext, {
	command: {
		id: 'removeBookmark',
		title: 'Remove bookmark'
	}
});

MenuRegistry.appendMenuItem(MenuId.DisplayGlobalBookmarksContext, {
	command: {
		id: 'toggleBookmarkToWorkspace',
		title: 'Change to workspace bookmark'
	}
});

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

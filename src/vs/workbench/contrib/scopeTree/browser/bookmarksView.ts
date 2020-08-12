/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./media/bookmarkIcon';
import * as DOM from 'vs/base/browser/dom';
import { URI } from 'vs/base/common/uri';
import { IViewletViewOptions } from 'vs/workbench/browser/parts/views/viewsViewlet';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { ViewPane } from 'vs/workbench/browser/parts/views/viewPaneContainer';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IViewDescriptorService } from 'vs/workbench/common/views';
import { IOpenerService } from 'vs/platform/opener/common/opener';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IBookmarksManager, BookmarkType } from 'vs/workbench/contrib/scopeTree/common/bookmarks';
import { Codicon } from 'vs/base/common/codicons';
import { dirname, basename } from 'vs/base/common/resources';
import { IExplorerService } from 'vs/workbench/contrib/files/common/files';

export class BookmarksView extends ViewPane {
	static readonly ID: string = 'workbench.explorer.displayBookmarksView';
	static readonly NAME = 'Bookmarks';

	constructor(
		options: IViewletViewOptions,
		@IThemeService themeService: IThemeService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IKeybindingService keybindingService: IKeybindingService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IConfigurationService configurationService: IConfigurationService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IOpenerService openerService: IOpenerService,
		@ITelemetryService telemetryService: ITelemetryService,
		@IBookmarksManager private readonly bookmarksManager: IBookmarksManager,
		@IExplorerService private readonly explorerService: IExplorerService
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, telemetryService);
	}

	protected renderBody(container: HTMLElement): void {
		super.renderBody(container);

		this.renderBookmarksContainer(container, BookmarkType.WORKSPACE);
		this.renderBookmarksContainer(container, BookmarkType.GLOBAL);

		this._register(this.bookmarksManager.onAddedBookmark(e => {
			this.removeBookmark(e.uri);
			this.addNewBookmark(e.uri, e.bookmarkType);
		}));
	}

	private renderBookmarksContainer(container: HTMLElement, scope: BookmarkType): void {
		const header = DOM.append(container, document.createElement('div'));
		header.className = 'bookmark-header';

		const bookmarksContainer = DOM.append(container, document.createElement('div'));
		bookmarksContainer.className = 'bookmarks-container';

		const collapsedTwistie = DOM.$(Codicon.chevronRight.cssSelector);
		const expandedTwistie = DOM.append(header, DOM.$(Codicon.chevronDown.cssSelector));
		const scopeIcon = DOM.append(header, document.createElement('img'));
		scopeIcon.className = scope === BookmarkType.WORKSPACE ? 'bookmark-header-workspace-icon' : 'bookmark-header-global-icon';

		const containerTitle = DOM.append(header, document.createElement('span'));
		containerTitle.innerText = scope === BookmarkType.WORKSPACE ? 'WORKSPACE BOOKMARKS' : 'GLOBAL BOOKMARKS';
		containerTitle.style.color = 'black';

		const bookmarksList = this.renderBookmarksLists(bookmarksContainer, scope);

		header.onclick = () => {
			// Toggle contents and twistie icon, and add some paddinnng
			if (bookmarksList.style.display === 'none') {
				header.replaceChild(expandedTwistie, collapsedTwistie);
				bookmarksList.style.display = '';
			} else {
				header.replaceChild(collapsedTwistie, expandedTwistie);
				bookmarksList.style.display = 'none';
			}
		};
	}

	private renderBookmarksLists(container: HTMLElement, scope: BookmarkType): HTMLElement {
		const bookmarksList = DOM.append(container, document.createElement('ul'));
		const bookmarks = scope === BookmarkType.WORKSPACE ? this.bookmarksManager.workspaceBookmarks : this.bookmarksManager.globalBookmarks;
		bookmarksList.id = scope === BookmarkType.WORKSPACE ? 'workspaceBookmarksList' : 'globalBookmarksList';

		for (let bookmark of bookmarks) {
			bookmarksList.appendChild(this.createBookmark(bookmark, scope));
		}

		return bookmarksList;
	}

	private createBookmark(resourceAsString: string, bookmarkType: BookmarkType): HTMLLIElement {
		const element = document.createElement('li');
		element.style.listStyleType = 'none';

		if (bookmarkType === BookmarkType.WORKSPACE) {
			element.id = 'workspaceBookmarkView_' + resourceAsString;
		} else if (bookmarkType === BookmarkType.GLOBAL) {
			element.id = 'globalBookmarkView_' + resourceAsString;
		}

		const focusIcon = DOM.append(element, document.createElement('img'));
		focusIcon.className = 'scope-tree-focus-icon-near-bookmark';

		// Emphasize elements
		element.addEventListener('mouseover', () => {
			focusIcon.style.visibility = 'visible';
			element.style.background = '#eee';
		});

		// Remove decorations
		element.addEventListener('mouseout', () => {
			focusIcon.style.visibility = 'hidden';
			element.style.background = '';
		});

		focusIcon.addEventListener('click', () => {
			this.explorerService.setRoot(URI.parse(resourceAsString));
		});

		const name = DOM.append(element, document.createElement('span'));
		name.textContent = basename(URI.parse(resourceAsString));
		name.style.color = 'black';

		const path = DOM.append(element, document.createElement('span'));
		path.className = 'bookmark-path';
		path.textContent = dirname(URI.parse(resourceAsString)).toString();

		return element;
	}

	private removeBookmark(resource: URI): void {
		const workspaceBookmark = document.getElementById('workspaceBookmarkView_' + resource.toString());
		if (workspaceBookmark) {
			workspaceBookmark.remove();
		}

		const globalBookmark = document.getElementById('globalBookmarkView_' + resource.toString());
		if (globalBookmark) {
			globalBookmark.remove();
		}
	}

	private addNewBookmark(resource: URI, bookmarkType: BookmarkType): void {
		if (bookmarkType === BookmarkType.NONE) {
			return;
		}

		const bookmarksList = bookmarkType === BookmarkType.WORKSPACE ? document.getElementById('workspaceBookmarksList') : document.getElementById('globalBookmarksList');
		if (bookmarksList) {
			bookmarksList.appendChild(this.createBookmark(resource.toString(), bookmarkType));
		}
	}
}

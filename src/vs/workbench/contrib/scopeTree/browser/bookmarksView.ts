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
import { List, IListAccessibilityProvider } from 'vs/base/browser/ui/list/listWidget';
import { IListVirtualDelegate, IListRenderer } from 'vs/base/browser/ui/list/list';
import { ScrollbarVisibility } from 'vs/base/common/scrollable';
import { RunOnceScheduler } from 'vs/base/common/async';
import { Orientation } from 'vs/base/browser/ui/splitview/splitview';
import { ResourceLabels } from 'vs/workbench/browser/labels';

class Bookmark {
	public content: string;
	public id: string;

	constructor(content: string, id: string) {
		this.content = content;
		this.id = id;
	}
}

export class BookmarksDelegate implements IListVirtualDelegate<Bookmark> {

	static readonly ITEM_HEIGHT = 22;

	getHeight(element: Bookmark): number {
		return BookmarksDelegate.ITEM_HEIGHT;
	}

	getTemplateId(element: Bookmark): string {
		return 'BookmarksRenderer';
	}
}

interface IBookmarkTemplateData {
	container: HTMLElement;
}

class BookmarksRenderer implements IListRenderer<Bookmark, IBookmarkTemplateData> {
	static readonly ID = 'BookmarksRenderer';

	constructor(
	) {
		// noop
	}

	get templateId() {
		return 'BookmarksRenderer';
	}

	// container = monaco-list-row
	renderTemplate(container: HTMLElement): IBookmarkTemplateData {
		container.style.height = '100px';
		container.style.color = 'green';
		container.id = 'bogdan123';

		DOM.append(container, document.createElement('div'));

		return { container };
	}

	renderElement(element: Bookmark, index: number, templateData: IBookmarkTemplateData): void {
	}

	disposeTemplate(templateData: IBookmarkTemplateData): void {
	}
}

export class BookmarksView extends ViewPane {
	static readonly ID: string = 'workbench.explorer.displayBookmarksView';
	static readonly NAME = 'Bookmarks';

	private list!: List<Bookmark>;
	private listLabels!: ResourceLabels;
	private bookmarks: Bookmark[] = [];

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

		for (let i = 0; i < 100; i++) {
			this.bookmarks.push(new Bookmark('bookmark' + i, 'id' + i));
		}
	}

	protected renderBody(container: HTMLElement): void {
		super.renderBody(container);

		const delegate = new BookmarksDelegate();
		const renderer = new BookmarksRenderer();

		this.listLabels = this.instantiationService.createInstance(ResourceLabels, { onDidChangeVisibility: this.onDidChangeBodyVisibility });
		this.list = new List<Bookmark>('Bookmarks', container, delegate, [renderer], {
			verticalScrollMode: ScrollbarVisibility.Auto
		});
		// this.list = <WorkbenchList<Bookmark>>this.instantiationService.createInstance(WorkbenchList, 'Bookmarks', container, delegate, [renderer], {
		// 	accessibilityProvider: new BookmarksAccessibilityProvider()
		// });

		this.list.splice(0, 0, this.bookmarks);

		// this.renderBookmarksContainer(container, BookmarkType.WORKSPACE);
		// this.renderBookmarksContainer(container, BookmarkType.GLOBAL);

		// this._register(this.bookmarksManager.onAddedBookmark(e => {
		// 	this.removeBookmark(e.uri);
		// 	this.addNewBookmark(e.uri, e.bookmarkType);
		// }));
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

	private createBookmark(resource: string, bookmarkType: BookmarkType): HTMLLIElement {
		const element = document.createElement('li');
		element.style.listStyleType = 'none';
		element.id = bookmarkType === BookmarkType.WORKSPACE ? 'workspaceBookmarkView_' + resource : 'globalBookmarkView_' + resource;

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
			this.explorerService.setRoot(URI.parse(resource));
		});

		const name = DOM.append(element, document.createElement('span'));
		name.textContent = basename(URI.parse(resource));
		name.style.color = 'black';

		const path = DOM.append(element, document.createElement('span'));
		path.className = 'bookmark-path';
		path.textContent = dirname(URI.parse(resource)).toString();

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

class BookmarksAccessibilityProvider implements IListAccessibilityProvider<Bookmark> {

	getWidgetAriaLabel(): string {
		return 'sth';
	}

	getAriaLabel(element: Bookmark): string | null {
		return 'sth';
	}
}

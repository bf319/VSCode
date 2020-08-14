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
import { List } from 'vs/base/browser/ui/list/listWidget';
import { IListVirtualDelegate, IListRenderer } from 'vs/base/browser/ui/list/list';
import { ScrollbarVisibility } from 'vs/base/common/scrollable';
import { DisposableStore, IDisposable } from 'vs/base/common/lifecycle';

class Bookmark {
	public resource: URI;

	constructor(path: string) {
		this.resource = URI.parse(path);
	}

	public getName(): string {
		return basename(this.resource);
	}

	public getParent(): string {
		return dirname(this.resource).toString();
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
	bookmarkContainer: HTMLElement;
	elementDisposable: IDisposable;
}

class BookmarksRenderer implements IListRenderer<Bookmark, IBookmarkTemplateData> {
	static readonly ID = 'BookmarksRenderer';

	constructor(
		private readonly bookmarkType: BookmarkType,
		private readonly explorerService: IExplorerService
	) {
		// noop
	}

	get templateId() {
		return 'BookmarksRenderer';
	}

	renderTemplate(container: HTMLElement): IBookmarkTemplateData {
		return { bookmarkContainer: container, elementDisposable: new DisposableStore() };
	}

	renderElement(element: Bookmark, index: number, templateData: IBookmarkTemplateData): void {
		templateData.bookmarkContainer.appendChild(this.renderBookmark(element));
	}

	disposeTemplate(templateData: IBookmarkTemplateData): void {
		templateData.elementDisposable.dispose();
	}

	disposeElement(element: Bookmark, index: number, templateData: IBookmarkTemplateData): void {
		while (templateData.bookmarkContainer.firstChild) {
			templateData.bookmarkContainer.removeChild(templateData.bookmarkContainer.firstChild);
		}
	}

	private renderBookmark(bookmark: Bookmark): HTMLElement {
		const bookmarkElement = document.createElement('div');
		bookmarkElement.id = this.bookmarkType === BookmarkType.WORKSPACE ? 'workspaceBookmarkView_' + bookmark.resource.toString() : 'globalBookmarkView_' + bookmark.resource.toString();

		const focusIcon = DOM.append(bookmarkElement, document.createElement('img'));
		focusIcon.className = 'scope-tree-focus-icon-near-bookmark';

		focusIcon.addEventListener('click', () => {
			this.explorerService.setRoot(bookmark.resource);
		});

		bookmarkElement.addEventListener('mouseover', () => {
			focusIcon.style.visibility = 'visible';
		});

		bookmarkElement.addEventListener('mouseout', () => {
			focusIcon.style.visibility = 'hidden';
		});
		bookmarkElement.addEventListener('dblclick', async () => {
			await this.explorerService.select(bookmark.resource, true);	// Should also expand directory
		});

		const name = DOM.append(bookmarkElement, document.createElement('span'));
		name.textContent = bookmark.getName();

		const path = DOM.append(bookmarkElement, document.createElement('span'));
		path.className = 'bookmark-path';
		path.textContent = bookmark.getParent();

		return bookmarkElement;
	}
}

export class BookmarksView extends ViewPane {
	static readonly ID: string = 'workbench.explorer.displayBookmarksView';
	static readonly NAME = 'Bookmarks';

	private globalBookmarksList!: List<Bookmark>;
	private workspaceBookmarksList!: List<Bookmark>;

	private workspaceBookmarksContainer!: HTMLElement;
	private globalBookmarksContainer!: HTMLElement;

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

		this.renderWorkspaceBookmarks(container);
		this.renderGlobalBookmarks(container);

		this._register(this.bookmarksManager.onAddedBookmark(e => {
		}));
	}

	private renderWorkspaceBookmarks(container: HTMLElement) {
		this.workspaceBookmarksContainer = this.renderBookmarksHeader(container, BookmarkType.WORKSPACE);

		this.workspaceBookmarksList = new List<Bookmark>('Bookmarks', this.workspaceBookmarksContainer, new BookmarksDelegate(), [new BookmarksRenderer(BookmarkType.WORKSPACE, this.explorerService)], {
			verticalScrollMode: ScrollbarVisibility.Auto
		});

		const workspaceBookmarks = Array.from(this.bookmarksManager.workspaceBookmarks).sort((path1: string, path2: string) => {
			const compare = basename(URI.parse(path1)).localeCompare(basename(URI.parse(path2)));

			if (compare) {
				return compare;
			}

			// Directories with identical names are sorted by the length of their path (might need to consider alternatives)
			return path1.split('/').length - path2.split('/').length;

		});

		for (let i = 0; i < workspaceBookmarks.length; i++) {
			this.workspaceBookmarksList.splice(i, 0, [new Bookmark(workspaceBookmarks[i])]);
		}

		this.workspaceBookmarksContainer.style.paddingBottom = '15px';
	}

	private renderGlobalBookmarks(container: HTMLElement) {
		this.globalBookmarksContainer = this.renderBookmarksHeader(container, BookmarkType.GLOBAL);

		this.globalBookmarksList = new List<Bookmark>('Bookmarks', this.globalBookmarksContainer, new BookmarksDelegate(), [new BookmarksRenderer(BookmarkType.GLOBAL, this.explorerService)], {
			verticalScrollMode: ScrollbarVisibility.Auto
		});

		const globalBookmarks = Array.from(this.bookmarksManager.globalBookmarks).sort((path1: string, path2: string) => {
			const compare = basename(URI.parse(path1)).localeCompare(basename(URI.parse(path2)));

			if (compare) {
				return compare;
			}

			// Directories with identical names are sorted by the length of their path (might need to consider alternatives)
			return path1.split('/').length - path2.split('/').length;
		});

		for (let i = 0; i < globalBookmarks.length; i++) {
			this.globalBookmarksList.splice(i, 0, [new Bookmark(globalBookmarks[i])]);
		}
	}

	private renderBookmarksHeader(container: HTMLElement, scope: BookmarkType): HTMLElement {
		const header = DOM.append(container, document.createElement('div'));
		header.className = 'bookmark-header';

		const collapsedTwistie = DOM.$(Codicon.chevronRight.cssSelector);
		const expandedTwistie = DOM.append(header, DOM.$(Codicon.chevronDown.cssSelector));
		const scopeIcon = DOM.append(header, document.createElement('img'));
		scopeIcon.className = scope === BookmarkType.WORKSPACE ? 'bookmark-header-workspace-icon' : 'bookmark-header-global-icon';

		const containerTitle = DOM.append(header, document.createElement('span'));
		containerTitle.innerText = scope === BookmarkType.WORKSPACE ? 'WORKSPACE BOOKMARKS' : 'GLOBAL BOOKMARKS';

		const bookmarksContainer = DOM.append(container, document.createElement('div'));
		bookmarksContainer.className = 'bookmarks-container';

		// Toggle twistie icon and visibility of the bookmarks
		header.onclick = () => {
			if (bookmarksContainer.style.display === 'none') {
				header.replaceChild(expandedTwistie, collapsedTwistie);
				bookmarksContainer.style.display = '';
			} else {
				header.replaceChild(collapsedTwistie, expandedTwistie);
				bookmarksContainer.style.display = 'none';
			}
		};

		return bookmarksContainer;
	}

	protected layoutBody(height: number, width: number): void {
		super.layoutBody(height, width);
		if (this.workspaceBookmarksList) {
			this.workspaceBookmarksList.layout(height * 0.45, width);
		}
		if (this.globalBookmarksList) {
			this.globalBookmarksList.layout(height * 0.45, width);
		}
	}
}

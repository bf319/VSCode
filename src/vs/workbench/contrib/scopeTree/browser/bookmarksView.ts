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
import { IBookmarksManager, BookmarkType, SortType } from 'vs/workbench/contrib/scopeTree/common/bookmarks';
import { Codicon } from 'vs/base/common/codicons';
import { dirname, basename } from 'vs/base/common/resources';
import { IExplorerService } from 'vs/workbench/contrib/files/common/files';
import { IListVirtualDelegate, IKeyboardNavigationLabelProvider } from 'vs/base/browser/ui/list/list';
import { ScrollbarVisibility } from 'vs/base/common/scrollable';
import { IDisposable, Disposable, DisposableStore } from 'vs/base/common/lifecycle';
import { WorkbenchObjectTree } from 'vs/platform/list/browser/listService';
import { FuzzyScore, createMatches } from 'vs/base/common/filters';
import { ITreeRenderer, ITreeNode, ITreeElement, ITreeContextMenuEvent } from 'vs/base/browser/ui/tree/tree';
import { IResourceLabel, ResourceLabels } from 'vs/workbench/browser/labels';
import { IAction } from 'vs/base/common/actions';
import { createAndFillInContextMenuActions } from 'vs/platform/actions/browser/menuEntryActionViewItem';
import { IMenu, IMenuService, MenuId } from 'vs/platform/actions/common/actions';

export class Bookmark {
	private _resource: URI;

	constructor(path: string) {
		this._resource = URI.parse(path);
	}

	public getName(): string {
		return basename(this._resource);
	}

	public getParent(): string {
		return dirname(this._resource).toString();
	}

	get resource(): URI {
		return this._resource;
	}
}

export class BookmarkHeader {
	expanded: boolean = true;

	constructor(readonly scope: BookmarkType) { }
}

class BookmarkDelegate implements IListVirtualDelegate<Bookmark | BookmarkHeader> {
	static readonly ITEM_HEIGHT = 22;

	getHeight(element: Bookmark | BookmarkHeader): number {
		return BookmarkDelegate.ITEM_HEIGHT;
	}

	getTemplateId(element: Bookmark | BookmarkHeader): string {
		if (element instanceof Bookmark) {
			return BookmarkRenderer.ID;
		}

		return BookmarkHeaderRenderer.ID;
	}
}

interface IBookmarkTemplateData {
	bookmarkContainer: HTMLElement;
	label: IResourceLabel;
	elementDisposable: IDisposable;
}

interface IBookmarkHeaderTemplateData {
	headerContainer: HTMLElement;
	elementDisposable: IDisposable;
}

class BookmarkElementIconRenderer implements IDisposable {
	private _focusIcon!: HTMLElement;

	constructor(private readonly container: HTMLElement,
		private readonly stat: URI,
		@IExplorerService private readonly explorerService: IExplorerService) {
		this.renderFocusIcon();
		this.addListeners();
	}

	get focusIcon(): HTMLElement {
		return this._focusIcon;
	}

	private showIcon = () => {
		this._focusIcon.style.visibility = 'visible';
	};

	private hideIcon = () => {
		this._focusIcon.style.visibility = 'hidden';
	};

	private select = async () => {
		await this.explorerService.select(this.stat, true);	// Should also expand directory
	};

	private setRoot = () => {
		this.explorerService.setRoot(this.stat);
	};

	private addListeners(): void {
		this.container.addEventListener('mouseover', this.showIcon);
		this.container.addEventListener('mouseout', this.hideIcon);
		this.container.addEventListener('dblclick', this.select);
		this._focusIcon.addEventListener('click', this.setRoot);
	}

	private renderFocusIcon(): void {
		this._focusIcon = document.createElement('img');
		this._focusIcon.className = 'scope-tree-focus-icon-near-bookmark';
		this.container.insertBefore(this._focusIcon, this.container.firstChild);
	}

	dispose(): void {
		this._focusIcon.remove();
		// Listeners need to be removed because container (templateData.label.element) is not removed from the DOM.
		this.container.removeEventListener('mouseover', this.showIcon);
		this.container.removeEventListener('mouseout', this.hideIcon);
		this.container.removeEventListener('dblclick', this.select);
		this._focusIcon.removeEventListener('click', this.setRoot);
	}
}

class BookmarkRenderer implements ITreeRenderer<Bookmark, FuzzyScore, IBookmarkTemplateData> {
	static readonly ID = 'BookmarkRenderer';

	constructor(
		private labels: ResourceLabels,
		private readonly explorerService: IExplorerService
	) { }

	get templateId() {
		return BookmarkRenderer.ID;
	}

	renderTemplate(container: HTMLElement): IBookmarkTemplateData {
		const label = this.labels.create(container, { supportHighlights: true });
		const bookmarkContainer = DOM.append(container, document.createElement('div'));
		return { bookmarkContainer: bookmarkContainer, label: label, elementDisposable: Disposable.None };
	}

	renderElement(element: ITreeNode<Bookmark, FuzzyScore>, index: number, templateData: IBookmarkTemplateData, height: number | undefined): void {
		templateData.elementDisposable.dispose();
		templateData.elementDisposable = this.renderBookmark(element.element, templateData, element.filterData);
	}

	disposeTemplate(templateData: IBookmarkTemplateData): void {
		templateData.elementDisposable.dispose();
		templateData.label.dispose();
	}

	disposeElement(element: ITreeNode<Bookmark, FuzzyScore>, index: number, templateData: IBookmarkTemplateData, height: number | undefined): void {
		templateData.elementDisposable.dispose();
	}

	private renderBookmark(bookmark: Bookmark, templateData: IBookmarkTemplateData, filterData: FuzzyScore | undefined): IDisposable {
		templateData.label.setResource({
			resource: bookmark.resource,
			name: bookmark.getName(),
			description: bookmark.getParent()
		}, {
			matches: createMatches(filterData)
		});

		return new BookmarkElementIconRenderer(templateData.label.element, bookmark.resource, this.explorerService);
	}
}

class BookmarkHeaderRenderer implements ITreeRenderer<BookmarkHeader, FuzzyScore, IBookmarkHeaderTemplateData>{
	static readonly ID = 'BookmarkHeaderRenderer';

	get templateId() {
		return BookmarkHeaderRenderer.ID;
	}

	renderTemplate(container: HTMLElement): IBookmarkHeaderTemplateData {
		return { headerContainer: container, elementDisposable: Disposable.None };
	}

	renderElement(element: ITreeNode<BookmarkHeader, FuzzyScore>, index: number, templateData: IBookmarkHeaderTemplateData, height: number | undefined): void {
		templateData.elementDisposable.dispose();
		templateData.elementDisposable = this.renderBookmarksHeader(element.element, templateData.headerContainer);
	}

	disposeTemplate(templateData: IBookmarkHeaderTemplateData): void {
		templateData.elementDisposable.dispose();
	}

	private renderBookmarksHeader(element: BookmarkHeader, container: HTMLElement): IDisposable {
		const scope = element.scope;
		const header = DOM.append(container, document.createElement('div'));
		header.className = 'bookmark-header';

		const collapsedTwistie = DOM.$(Codicon.chevronRight.cssSelector);
		collapsedTwistie.style.paddingTop = '2px';
		const expandedTwistie = DOM.$(Codicon.chevronDown.cssSelector);
		expandedTwistie.style.paddingTop = '2px';

		if (element.expanded) {
			header.appendChild(expandedTwistie);
		} else {
			header.appendChild(collapsedTwistie);
		}

		const scopeIcon = DOM.append(header, document.createElement('img'));
		scopeIcon.className = scope === BookmarkType.WORKSPACE ? 'bookmark-header-workspace-icon' : 'bookmark-header-global-icon';

		const containerTitle = DOM.append(header, document.createElement('span'));
		containerTitle.innerText = scope === BookmarkType.WORKSPACE ? 'WORKSPACE BOOKMARKS' : 'GLOBAL BOOKMARKS';

		// Toggle twistie icon
		header.onclick = () => {
			if (expandedTwistie.parentElement) {
				header.replaceChild(collapsedTwistie, expandedTwistie);
			} else {
				header.replaceChild(expandedTwistie, collapsedTwistie);
			}
		};

		return {
			dispose(): void {
				header.remove();
			}
		};
	}
}

export class BookmarksView extends ViewPane {
	static readonly ID: string = 'workbench.explorer.displayBookmarksView';
	static readonly NAME = 'Bookmarks';

	private labels!: ResourceLabels;
	private tree!: WorkbenchObjectTree<Bookmark | BookmarkHeader, FuzzyScore>;

	private globalBookmarksHeader = new BookmarkHeader(BookmarkType.GLOBAL);
	private workspaceBookmarksHeader = new BookmarkHeader(BookmarkType.WORKSPACE);

	private globalBookmarks: ITreeElement<Bookmark>[] = [];
	private workspaceBookmarks: ITreeElement<Bookmark>[] = [];

	private contributedContextMenu!: IMenu;

	private sortType: SortType = SortType.NAME;

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
		@IExplorerService private readonly explorerService: IExplorerService,
		@IMenuService private readonly menuService: IMenuService,
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, telemetryService);

		this.labels = this.instantiationService.createInstance(ResourceLabels, { onDidChangeVisibility: this.onDidChangeBodyVisibility });
		this._register(this.bookmarksManager.onAddedBookmark(e => {
			const resource = e.uri;
			const prevScope = e.prevBookmarkType;
			const newScope = e.bookmarkType;

			if (newScope !== prevScope) {
				this.removeBookmark(resource, prevScope);
				this.renderNewBookmark(resource, newScope);
			}
		}));

		this._register(this.bookmarksManager.onDidSortBookmark(sortType => {
			this.sortType = sortType;
			this.sortAndRefresh(sortType);
		}));
	}

	protected renderBody(container: HTMLElement): void {
		super.renderBody(container);

		this.tree = this.createTree(container);
		this._register(this.tree);

		this.tree.setChildren(null, [{ element: this.globalBookmarksHeader }, { element: this.workspaceBookmarksHeader }]);
		this.sortAndRefresh(this.sortType);

		this._register(this.tree.onMouseClick(e => {
			if (e.element instanceof BookmarkHeader) {
				this.toggleHeader(e.element);
			}
		}));

		this.contributedContextMenu = this.menuService.createMenu(MenuId.DisplayBookmarksContext, this.tree.contextKeyService);
		this.tree.onContextMenu(e => this.onContextMenu(e));
	}

	protected layoutBody(height: number, width: number): void {
		super.layoutBody(height, width);
		this.tree.layout(height, width);
	}

	private sortAndRefresh(sortType: SortType) {
		this.globalBookmarks = this.getBookmarksTreeElements(this.bookmarksManager.globalBookmarks, sortType);
		this.workspaceBookmarks = this.getBookmarksTreeElements(this.bookmarksManager.workspaceBookmarks, sortType);

		this.tree.setChildren(this.globalBookmarksHeader, this.globalBookmarks);
		this.tree.setChildren(this.workspaceBookmarksHeader, this.workspaceBookmarks);
	}

	private createTree(container: HTMLElement): WorkbenchObjectTree<Bookmark | BookmarkHeader, FuzzyScore> {
		return <WorkbenchObjectTree<Bookmark | BookmarkHeader, FuzzyScore>>this.instantiationService.createInstance(
			WorkbenchObjectTree,
			'BookmarksPane',
			container,
			new BookmarkDelegate(),
			[new BookmarkRenderer(this.labels, this.explorerService), new BookmarkHeaderRenderer()],
			{
				accessibilityProvider: {
					getAriaLabel(element: Bookmark | BookmarkHeader): string {
						if (element instanceof Bookmark) {
							return element.resource.toString();
						}

						return 'Bookmark header';
					},
					getWidgetAriaLabel(): string {
						return 'Bookmarks panel';
					}
				},
				verticalScrollMode: ScrollbarVisibility.Auto,
				keyboardNavigationLabelProvider: new BookmarkKeyboardNavigationLabelProvider()
			});
	}

	private onContextMenu(e: ITreeContextMenuEvent<Bookmark | BookmarkHeader | null>): void {
		if (!e.element) {
			return;
		}

		const actions: IAction[] = [];
		const disposables = new DisposableStore();
		disposables.add(createAndFillInContextMenuActions(this.contributedContextMenu, { shouldForwardArgs: true }, actions, this.contextMenuService));

		this.contextMenuService.showContextMenu({
			getAnchor: () => e.anchor,
			getActions: () => actions,
			onHide: (wasCancelled?: boolean) => {
				if (wasCancelled) {
					this.tree.domFocus();
				}
				disposables.dispose();
			},
			getActionsContext: () => e.element
		});
	}

	private sortBookmarkByName(bookmarks: Set<string>): string[] {
		return Array.from(bookmarks).sort((path1: string, path2: string) => {
			const compare = basename(URI.parse(path1)).localeCompare(basename(URI.parse(path2)));

			// Directories with identical names are sorted by the length of their path (might need to consider alternatives)
			return compare ? compare : path1.split('/').length - path2.split('/').length;
		});
	}

	private getBookmarksTreeElements(rawBookmarks: Set<string>, sortType: SortType): ITreeElement<Bookmark>[] {
		// Order has to be revesed when bookmarks are sorted by date because bookmarksManager keeps the most recent at the end of the array
		const sortedBookmarks = sortType === SortType.NAME ? this.sortBookmarkByName(rawBookmarks) : Array.from(rawBookmarks).reverse();
		const treeElements: ITreeElement<Bookmark>[] = [];
		for (let i = 0; i < sortedBookmarks.length; i++) {
			treeElements.push({
				element: new Bookmark(sortedBookmarks[i])
			});
		}
		return treeElements;
	}

	private toggleHeader(header: BookmarkHeader) {
		header.expanded = !header.expanded;
		const headerItem = header.scope === BookmarkType.GLOBAL ? this.globalBookmarksHeader : this.workspaceBookmarksHeader;
		const children = header.expanded ? (header.scope === BookmarkType.GLOBAL ? this.globalBookmarks : this.workspaceBookmarks) : [];

		this.tree.setChildren(headerItem, children);
	}

	private renderNewBookmark(resource: URI, scope: BookmarkType): void {
		const resourceAsString = resource.toString();
		const resourceIndex = this.sortType === SortType.DATE ? 0 : this.findIndexInSortedArray(basename(resource), scope);
		if (scope === BookmarkType.NONE) {
			return;
		}

		if (scope === BookmarkType.WORKSPACE) {
			this.workspaceBookmarks.splice(resourceIndex, 0, { element: new Bookmark(resourceAsString) });
			if (this.workspaceBookmarksHeader.expanded) {
				this.tree.setChildren(this.workspaceBookmarksHeader, this.workspaceBookmarks);
			}
		}

		if (scope === BookmarkType.GLOBAL) {
			this.globalBookmarks.splice(resourceIndex, 0, { element: new Bookmark(resourceAsString) });
			if (this.globalBookmarksHeader.expanded) {
				this.tree.setChildren(this.globalBookmarksHeader, this.globalBookmarks);
			}
		}
	}

	private removeBookmark(resource: URI, prevType: BookmarkType): void {
		if (prevType === BookmarkType.WORKSPACE) {
			this.workspaceBookmarks = this.workspaceBookmarks.filter(e => e.element.resource.toString() !== resource.toString());
			if (this.workspaceBookmarksHeader.expanded) {
				this.tree.setChildren(this.workspaceBookmarksHeader, this.workspaceBookmarks);
			}
		}

		if (prevType === BookmarkType.GLOBAL) {
			this.globalBookmarks = this.globalBookmarks.filter(e => e.element.resource.toString() !== resource.toString());
			if (this.globalBookmarksHeader.expanded) {
				this.tree.setChildren(this.globalBookmarksHeader, this.globalBookmarks);
			}
		}
	}

	private findIndexInSortedArray(resource: string, scope: BookmarkType) {
		// Assuming that the bookmarks array is sorted by name, find the index for this resource using a binary search
		const bookmarks = scope === BookmarkType.WORKSPACE ? this.workspaceBookmarks : this.globalBookmarks;
		let left = 0;
		let right = bookmarks.length;

		while (left < right) {
			const mid = (left + right) >>> 1;
			if (bookmarks[mid].element.getName() < resource) {
				left = mid + 1;
			} else {
				right = mid;
			}
		}

		return left;
	}
}

class BookmarkKeyboardNavigationLabelProvider implements IKeyboardNavigationLabelProvider<Bookmark | BookmarkHeader> {
	getKeyboardNavigationLabel(element: Bookmark | BookmarkHeader): string | undefined {
		if (element instanceof Bookmark) {
			return element.getName();
		}

		return undefined;
	}
}

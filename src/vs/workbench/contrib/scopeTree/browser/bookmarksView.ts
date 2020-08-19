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
import { IListVirtualDelegate, IKeyboardNavigationLabelProvider } from 'vs/base/browser/ui/list/list';
import { ScrollbarVisibility } from 'vs/base/common/scrollable';
import { IDisposable, Disposable } from 'vs/base/common/lifecycle';
import { WorkbenchObjectTree } from 'vs/platform/list/browser/listService';
import { FuzzyScore, createMatches } from 'vs/base/common/filters';
import { ITreeRenderer, ITreeNode, ITreeElement } from 'vs/base/browser/ui/tree/tree';
import { IResourceLabel, ResourceLabels } from 'vs/workbench/browser/labels';

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
	private _scope: BookmarkType;
	private _visibility: boolean;

	constructor(scope: BookmarkType) {
		this._scope = scope;
		this._visibility = true;
	}

	get scope(): BookmarkType {
		return this._scope;
	}

	get visibility(): boolean {
		return this._visibility;
	}

	set visibility(show: boolean) {
		this._visibility = show;
	}
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

	constructor(container: HTMLElement,
		private readonly stat: URI,
		@IExplorerService private readonly explorerService: IExplorerService) {
		this.renderFocusIcon(container);
		this.addListeners(container);
	}

	get focusIcon(): HTMLElement {
		return this._focusIcon;
	}

	private addListeners(container: HTMLElement): void {
		container.addEventListener('mouseover', () => {
			this._focusIcon.style.visibility = 'visible';
		});
		container.addEventListener('mouseout', () => {
			this._focusIcon.style.visibility = 'hidden';
		});
		container.addEventListener('dblclick', async () => {
			await this.explorerService.select(this.stat, true);	// Should also expand directory
		});
		this._focusIcon.addEventListener('click', () => {
			this.explorerService.setRoot(this.stat);
		});
	}

	private renderFocusIcon(container: HTMLElement): void {
		this._focusIcon = document.createElement('img');
		this._focusIcon.className = 'scope-tree-focus-icon-near-bookmark';
		container.insertBefore(this._focusIcon, container.firstChild);
	}

	dispose(): void {
		this._focusIcon.remove();
	}
}

class BookmarkElementHeaderRenderer implements IDisposable {
	private headerContainer: HTMLElement;

	constructor(headerContainer: HTMLElement) {
		this.headerContainer = headerContainer;
	}

	dispose(): void {
		this.headerContainer.remove();
	}
}

class BookmarkRenderer implements ITreeRenderer<Bookmark, FuzzyScore, IBookmarkTemplateData> {
	static readonly ID = 'BookmarkRenderer';

	constructor(
		private labels: ResourceLabels,
		private readonly explorerService: IExplorerService
	) {
		// noop
	}

	renderElement(element: ITreeNode<Bookmark, FuzzyScore>, index: number, templateData: IBookmarkTemplateData, height: number | undefined): void {
		templateData.elementDisposable.dispose();
		templateData.elementDisposable = this.renderBookmark(element.element, templateData, element.filterData);
	}

	get templateId() {
		return BookmarkRenderer.ID;
	}

	renderTemplate(container: HTMLElement): IBookmarkTemplateData {
		const label = this.labels.create(container, { supportHighlights: true });
		return { bookmarkContainer: container, label: label, elementDisposable: Disposable.None };
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

		if (element.visibility) {
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

		return new BookmarkElementHeaderRenderer(header);
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
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, telemetryService);
	}

	protected renderBody(container: HTMLElement): void {
		super.renderBody(container);

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

		this.tree = this.createTree(container);
		this._register(this.tree);

		const globalBookmarks = this.sortBookmarkByName(this.bookmarksManager.globalBookmarks);
		for (let i = 0; i < globalBookmarks.length; i++) {
			this.globalBookmarks.push({
				element: new Bookmark(globalBookmarks[i])
			});
		}

		const workspaceBookmarks = this.sortBookmarkByName(this.bookmarksManager.workspaceBookmarks);
		for (let i = 0; i < workspaceBookmarks.length; i++) {
			this.workspaceBookmarks.push({
				element: new Bookmark(workspaceBookmarks[i])
			});
		}

		this.tree.setChildren(null, [{ element: this.globalBookmarksHeader }, { element: this.workspaceBookmarksHeader }]);
		this.tree.setChildren(this.globalBookmarksHeader, this.globalBookmarks);
		this.tree.setChildren(this.workspaceBookmarksHeader, this.workspaceBookmarks);

		this._register(this.tree.onMouseClick(e => {
			if (e.element instanceof BookmarkHeader) {
				this.toggleHeader(e.element);
			}
		}));
	}

	protected layoutBody(height: number, width: number): void {
		super.layoutBody(height, width);
		this.tree.layout(height, width);
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

	private sortBookmarkByName(bookmarks: Set<string>) {
		return Array.from(bookmarks).sort((path1: string, path2: string) => {
			const compare = basename(URI.parse(path1)).localeCompare(basename(URI.parse(path2)));

			// Directories with identical names are sorted by the length of their path (might need to consider alternatives)
			return compare ? compare : path1.split('/').length - path2.split('/').length;
		});
	}

	private toggleHeader(header: BookmarkHeader) {
		header.visibility = !header.visibility;
		const headerItem = header.scope === BookmarkType.GLOBAL ? this.globalBookmarksHeader : this.workspaceBookmarksHeader;
		const children = header.visibility ? (header.scope === BookmarkType.GLOBAL ? this.globalBookmarks : this.workspaceBookmarks) : [];

		this.tree.setChildren(headerItem, children);
	}

	private renderNewBookmark(resource: URI, scope: BookmarkType): void {
		const resourceAsString = resource.toString();
		if (scope === BookmarkType.NONE) {
			return;
		}

		if (scope === BookmarkType.WORKSPACE) {
			this.workspaceBookmarks.splice(0, 0, { element: new Bookmark(resourceAsString) });
			this.tree.setChildren(this.workspaceBookmarksHeader, this.workspaceBookmarks);
		}

		if (scope === BookmarkType.GLOBAL) {
			this.globalBookmarks.splice(0, 0, { element: new Bookmark(resourceAsString) });
			this.tree.setChildren(this.globalBookmarksHeader, this.globalBookmarks);
		}
	}

	private removeBookmark(resource: URI, prevType: BookmarkType): void {
		if (prevType === BookmarkType.WORKSPACE) {
			this.workspaceBookmarks = this.workspaceBookmarks.filter(e => e.element.resource.toString() !== resource.toString());
			this.tree.setChildren(this.workspaceBookmarksHeader, this.workspaceBookmarks);
		}

		if (prevType === BookmarkType.GLOBAL) {
			this.globalBookmarks = this.globalBookmarks.filter(e => e.element.resource.toString() !== resource.toString());
			this.tree.setChildren(this.globalBookmarksHeader, this.globalBookmarks);
		}
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

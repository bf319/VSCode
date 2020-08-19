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
	label: IResourceLabel;
	elementDisposable: IDisposable;
}

class BookmarkDisposable implements IDisposable {
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

class BookmarksRenderer implements ITreeRenderer<Bookmark, FuzzyScore, IBookmarkTemplateData> {
	static readonly ID = 'BookmarksRenderer';

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
		return BookmarksRenderer.ID;
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

		return new BookmarkDisposable(templateData.label.element, bookmark.resource, this.explorerService);
	}
}

export class BookmarksView extends ViewPane {
	static readonly ID: string = 'workbench.explorer.displayBookmarksView';
	static readonly NAME = 'Bookmarks';

	private labels!: ResourceLabels;
	private globalBookmarksTree!: WorkbenchObjectTree<Bookmark, FuzzyScore>;
	private workspaceBookmarksTree!: WorkbenchObjectTree<Bookmark, FuzzyScore>;

	private workspaceBookmarksContainer!: HTMLElement;
	private globalBookmarksContainer!: HTMLElement;

	private workspaceBookmarksTreeItems: ITreeElement<Bookmark>[] = [];
	private globalBookmarksTreeItems: ITreeElement<Bookmark>[] = [];

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

		this.labels = this.instantiationService.createInstance(ResourceLabels, { onDidChangeVisibility: this.onDidChangeBodyVisibility });
		this.renderGlobalBookmarks(container);
		this.renderWorkspaceBookmarks(container);

		this._register(this.bookmarksManager.onAddedBookmark(e => {
			const resource = e.uri;
			const prevScope = e.prevBookmarkType;
			const newScope = e.bookmarkType;

			if (newScope !== prevScope) {
				this.removeBookmark(resource, prevScope);
				this.renderNewBookmark(resource, newScope);
			}
		}));
	}

	protected layoutBody(height: number, width: number): void {
		super.layoutBody(height, width);

		this.globalBookmarksTree.layout(height * 0.45, width);
		this.workspaceBookmarksTree.layout(height * 0.45, width);
	}

	private createTree(container: HTMLElement, scope: BookmarkType): WorkbenchObjectTree<Bookmark, FuzzyScore> {
		const tree = <WorkbenchObjectTree<Bookmark, FuzzyScore>>this.instantiationService.createInstance(
			WorkbenchObjectTree,
			'BookmarksPane' + (scope === BookmarkType.GLOBAL ? 'Global' : 'Workspace'),
			container,
			new BookmarksDelegate(),
			[new BookmarksRenderer(this.labels, this.explorerService)],
			{
				accessibilityProvider: {
					getAriaLabel(element: Bookmark): string {
						return element.resource.toString();
					},
					getWidgetAriaLabel(): string {
						return 'Bookmarks panel';
					}
				},
				verticalScrollMode: ScrollbarVisibility.Auto,
				keyboardNavigationLabelProvider: new BookmarkKeyboardNavigationLabelProvider()
			});
		this._register(tree);

		return tree;
	}

	private renderGlobalBookmarks(container: HTMLElement) {
		this.globalBookmarksContainer = this.renderBookmarksHeader(container, BookmarkType.GLOBAL);
		this.globalBookmarksTree = this.createTree(this.globalBookmarksContainer, BookmarkType.GLOBAL);

		const globalBookmarks = this.sortBookmarkByName(this.bookmarksManager.globalBookmarks);
		for (let i = 0; i < globalBookmarks.length; i++) {
			this.globalBookmarksTreeItems.push({
				element: new Bookmark(globalBookmarks[i])
			});
		}
		this.globalBookmarksTree.setChildren(null, this.globalBookmarksTreeItems);
	}

	private renderWorkspaceBookmarks(container: HTMLElement) {
		this.workspaceBookmarksContainer = this.renderBookmarksHeader(container, BookmarkType.WORKSPACE);
		this.workspaceBookmarksTree = this.createTree(this.workspaceBookmarksContainer, BookmarkType.WORKSPACE);

		const workspaceBookmarks = this.sortBookmarkByName(this.bookmarksManager.workspaceBookmarks);
		for (let i = 0; i < workspaceBookmarks.length; i++) {
			this.workspaceBookmarksTreeItems.push({
				element: new Bookmark(workspaceBookmarks[i])
			});
		}
		this.workspaceBookmarksTree.setChildren(null, this.workspaceBookmarksTreeItems);
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

	private sortBookmarkByName(bookmarks: Set<string>) {
		return Array.from(bookmarks).sort((path1: string, path2: string) => {
			const compare = basename(URI.parse(path1)).localeCompare(basename(URI.parse(path2)));

			// Directories with identical names are sorted by the length of their path (might need to consider alternatives)
			return compare ? compare : path1.split('/').length - path2.split('/').length;
		});
	}

	private renderNewBookmark(resource: URI, scope: BookmarkType): void {
		const resourceAsString = resource.toString();
		if (scope === BookmarkType.NONE) {
			return;
		}

		if (scope === BookmarkType.WORKSPACE) {
			this.workspaceBookmarksTreeItems.splice(0, 0, { element: new Bookmark(resourceAsString) });
			this.workspaceBookmarksTree.setChildren(null, this.workspaceBookmarksTreeItems);
		}

		if (scope === BookmarkType.GLOBAL) {
			this.globalBookmarksTreeItems.splice(0, 0, { element: new Bookmark(resourceAsString) });
			this.globalBookmarksTree.setChildren(null, this.globalBookmarksTreeItems);
		}
	}

	private removeBookmark(resource: URI, prevType: BookmarkType): void {
		if (prevType === BookmarkType.WORKSPACE) {
			this.workspaceBookmarksTreeItems = this.workspaceBookmarksTreeItems.filter(e => e.element.resource.toString() !== resource.toString());
			this.workspaceBookmarksTree.setChildren(null, this.workspaceBookmarksTreeItems);
		}

		if (prevType === BookmarkType.GLOBAL) {
			this.globalBookmarksTreeItems = this.globalBookmarksTreeItems.filter(e => e.element.resource.toString() !== resource.toString());
			this.globalBookmarksTree.setChildren(null, this.globalBookmarksTreeItems);
		}
	}
}

export class BookmarkKeyboardNavigationLabelProvider implements IKeyboardNavigationLabelProvider<Bookmark> {
	getKeyboardNavigationLabel(element: Bookmark): { toString(): string } {
		return element.getName();
	}
}

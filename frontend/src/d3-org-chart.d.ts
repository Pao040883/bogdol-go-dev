declare module 'd3-org-chart' {
  export class OrgChart {
    constructor();
    container(element: HTMLElement): this;
    data(data: any[]): this;
    nodeWidth(width: () => number): this;
    nodeHeight(height: () => number): this;
    childrenMargin(margin: () => number): this;
    compactMarginBetween(margin: () => number): this;
    compactMarginPair(margin: () => number): this;
    neighbourMargin(margin: () => number): this;
    nodeContent(fn: (d: any) => string): this;
    onNodeClick(fn: (d: any) => void): this;
    render(): this;
    expandAll(): this;
    collapseAll(): this;
    fit(): this;
  }
}

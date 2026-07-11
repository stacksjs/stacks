/**
 * Generate relationship diagram from models
 */
export declare function relationDiagram(options?: DiagramOptions): Promise<string>;
export declare interface DiagramOptions {
  dir?: string
  format?: 'mermaid' | 'dot'
  output?: string
  verbose?: boolean
}
export { relationDiagram as generateDiagram };

export type Scope = { escopo: 'regional'|'unidade', regionalId?: string|null, unidadeId?: string|null }
export const defaultScope: Scope = { escopo:'unidade', regionalId:null, unidadeId:null }

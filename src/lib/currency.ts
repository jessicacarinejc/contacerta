export const currency = new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',minimumFractionDigits:2});
export const compactCurrency = new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',notation:'compact',maximumFractionDigits:1});
export const toCurrency=(value:number)=>currency.format(Number.isFinite(value)?value:0);
export function parseBRL(value:string){const normalized=value.replace(/[^\d,.-]/g,'').replace(/\./g,'').replace(',','.');const parsed=Number(normalized);return Number.isFinite(parsed)?parsed:0;}

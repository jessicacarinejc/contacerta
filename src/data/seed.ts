import type { Account, Asset, Budget, Category, CreditCard, Goal, Transaction } from '../types/finance';
const now = new Date(); const y = now.getFullYear(); const m = String(now.getMonth() + 1).padStart(2, '0'); const next = (day: number) => `${y}-${m}-${String(day).padStart(2, '0')}`;
export const categories: Category[] = [
  { id:'cat_salary',name:'Salário',icon:'wallet',color:'#16a567',type:'income' },{ id:'cat_extra',name:'Receitas extras',icon:'sparkles',color:'#2e78d4',type:'income' },{ id:'cat_home',name:'Moradia',icon:'house',color:'#156cc5',type:'expense' },{ id:'cat_food',name:'Alimentação',icon:'utensils',color:'#f2ab27',type:'expense' },{ id:'cat_transport',name:'Transporte',icon:'car',color:'#6f61c6',type:'expense' },{ id:'cat_health',name:'Saúde',icon:'heart',color:'#e85050',type:'expense' },{ id:'cat_leisure',name:'Lazer',icon:'party',color:'#a64fa3',type:'expense' },{ id:'cat_education',name:'Educação',icon:'book',color:'#12979d',type:'expense' },{ id:'cat_finance',name:'Financeiro',icon:'landmark',color:'#62748c',type:'expense' },{ id:'cat_other',name:'Outros',icon:'circle',color:'#8e99a8',type:'both' }
];
export const accounts: Account[] = [
  { id:'acc_main',name:'Conta Principal',institution:'Banco Conta Certa',type:'checking',balance:12750.45,color:'#0b7b52',active:true },{ id:'acc_savings',name:'Reserva',institution:'Conta Digital',type:'savings',balance:4800,color:'#2e78d4',active:true },{ id:'acc_wallet',name:'Carteira',institution:'Dinheiro',type:'wallet',balance:1200,color:'#f2ab27',active:true }
];
export const cards: CreditCard[] = [
  { id:'card_1',name:'Cartão Platinum',institution:'Banco Conta Certa',lastDigits:'4287',limit:10000,used:3245.8,closingDay:18,dueDay:25,color:'#072653' },{ id:'card_2',name:'Cartão Digital',institution:'Conta Digital',lastDigits:'9012',limit:5000,used:840.3,closingDay:5,dueDay:12,color:'#198860' }
];
export const transactions: Transaction[] = [
  { id:'tx_1',description:'Salário mensal',type:'income',amount:15400,date:next(2),paidAt:next(2),accountId:'acc_main',categoryId:'cat_salary',status:'paid',recurring:true,createdAt:new Date().toISOString() },
  { id:'tx_2',description:'Consultoria',type:'income',amount:4250,date:next(8),paidAt:next(8),accountId:'acc_main',categoryId:'cat_extra',status:'paid',createdAt:new Date().toISOString() },
  { id:'tx_3',description:'Condomínio',type:'expense',amount:650,date:next(5),dueDate:next(20),accountId:'acc_main',categoryId:'cat_home',status:'pending',recurring:true,createdAt:new Date().toISOString() },
  { id:'tx_4',description:'Plano de saúde',type:'expense',amount:620.9,date:next(5),dueDate:next(22),accountId:'acc_main',categoryId:'cat_health',status:'pending',recurring:true,createdAt:new Date().toISOString() },
  { id:'tx_5',description:'Supermercado Central',type:'expense',amount:1485.2,date:next(6),paidAt:next(6),accountId:'acc_main',categoryId:'cat_food',status:'paid',createdAt:new Date().toISOString() },
  { id:'tx_6',description:'Combustível',type:'expense',amount:780,date:next(9),paidAt:next(9),accountId:'acc_main',categoryId:'cat_transport',status:'paid',createdAt:new Date().toISOString() },
  { id:'tx_7',description:'Internet residencial',type:'expense',amount:119.9,date:next(7),dueDate:next(28),accountId:'acc_main',categoryId:'cat_home',status:'pending',recurring:true,createdAt:new Date().toISOString() },
  { id:'tx_8',description:'Mensalidade escolar',type:'expense',amount:980,date:next(3),dueDate:next(30),accountId:'acc_main',categoryId:'cat_education',status:'pending',recurring:true,createdAt:new Date().toISOString() },
  { id:'tx_9',description:'Restaurante',type:'expense',amount:342.6,date:next(11),paidAt:next(11),accountId:'acc_main',categoryId:'cat_leisure',status:'paid',createdAt:new Date().toISOString() },
  { id:'tx_10',description:'Farmácia',type:'expense',amount:280.4,date:next(12),paidAt:next(12),accountId:'acc_main',categoryId:'cat_health',status:'paid',createdAt:new Date().toISOString() }
];
export const budgets: Budget[] = [{ id:'budget_food',categoryId:'cat_food',month:`${y}-${m}`,limit:2600 },{ id:'budget_transport',categoryId:'cat_transport',month:`${y}-${m}`,limit:1500 },{ id:'budget_leisure',categoryId:'cat_leisure',month:`${y}-${m}`,limit:900 },{ id:'budget_health',categoryId:'cat_health',month:`${y}-${m}`,limit:1400 }];
export const goals: Goal[] = [{ id:'goal_emergency',name:'Reserva de emergência',target:10000,current:6800,deadline:`${y+1}-12-31`,icon:'shield' },{ id:'goal_trip',name:'Viagem',target:15000,current:4200,deadline:`${y+1}-07-01`,icon:'plane' }];
export const assets: Asset[] = [{ id:'asset_accounts',name:'Saldos em contas',type:'cash',value:18750.45,updatedAt:new Date().toISOString() },{ id:'asset_investment',name:'Investimentos',type:'investment',value:28500,updatedAt:new Date().toISOString() },{ id:'asset_vehicle',name:'Veículo',type:'vehicle',value:118000,updatedAt:new Date().toISOString() },{ id:'asset_debt',name:'Empréstimos',type:'debt',value:-12400,updatedAt:new Date().toISOString() }];

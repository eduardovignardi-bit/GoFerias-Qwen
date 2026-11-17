export const ADDITIONAL_PROPERTY_MONTHLY_PRICE = 69.96;
export function quantidadeImoveisAdicionaisCobrados(quantidadeAtivos: number): number {
  return Math.max(0, Math.floor(quantidadeAtivos) - 1);
}
export const FREE_ACTIVE_PROPERTIES_LIMIT = 1;
export const PLATFORM_COMMISSION_RATE = 0;

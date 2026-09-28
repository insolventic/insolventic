/**
 * Jest globalSetup — corre UNA vez, en el proceso principal, antes de crear los
 * workers (que heredan el entorno).
 *
 * Fija la zona horaria del proceso en UTC: es la de producción (Vercel) y la de
 * los runners de CI. Sin esto, la suite daría resultados distintos en una
 * máquina de Bogotá que en CI, y el golden master del mapper de placeholders
 * (que depende de la zona del servidor; ver tests/unit/documents/mapper-golden
 * .test.ts) no sería reproducible.
 *
 * No se puede hacer desde un archivo de test: dentro de Jest `process.env` es una
 * copia y asignar `TZ` allí no llega al proceso real.
 */
module.exports = async () => {
  process.env.TZ = 'UTC';
};

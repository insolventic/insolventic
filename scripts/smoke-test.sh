#!/usr/bin/env bash
#
# Smoke test post-deploy (A-5, auditoría 2026-08-25).
#
# Verifica que un deploy recién publicado está realmente vivo y que los
# gates de seguridad siguen en pie. Corre contra preview y contra
# producción; solo hace GETs, no muta nada.
#
# Uso:
#   ./scripts/smoke-test.sh https://mi-deploy.vercel.app
#   BASE_URL=https://... ./scripts/smoke-test.sh
#
# Sale 0 si todo pasa, 1 al primer fallo (para frenar el workflow).

set -uo pipefail

BASE_URL="${1:-${BASE_URL:-}}"
if [ -z "$BASE_URL" ]; then
  echo "ERROR: falta BASE_URL (argumento o variable de entorno)" >&2
  exit 1
fi
BASE_URL="${BASE_URL%/}"

# El primer request contra un deploy nuevo paga cold start; reintentamos
# solo el health check, que es el que despierta la función.
MAX_RETRIES=6
RETRY_DELAY=10
CURL="curl --silent --show-error --max-time 30"

fail() { echo "FALLO: $*" >&2; exit 1; }
ok()   { echo "  ok — $*"; }

echo "Smoke test contra $BASE_URL"

# ---------------------------------------------------------------------------
# 1. Health check: la app responde y la BD contesta.
# ---------------------------------------------------------------------------
echo "[1/4] /api/health"
attempt=1
health_body=""
health_code=""
while [ "$attempt" -le "$MAX_RETRIES" ]; do
  health_body=$($CURL -w '\n%{http_code}' "$BASE_URL/api/health" 2>/dev/null || true)
  health_code=$(printf '%s' "$health_body" | tail -n1)
  health_body=$(printf '%s' "$health_body" | sed '$d')

  if [ "$health_code" = "200" ]; then
    break
  fi
  echo "  intento $attempt/$MAX_RETRIES — HTTP ${health_code:-sin respuesta}, reintentando en ${RETRY_DELAY}s"
  attempt=$((attempt + 1))
  [ "$attempt" -le "$MAX_RETRIES" ] && sleep "$RETRY_DELAY"
done

[ "$health_code" = "200" ] || fail "/api/health devolvió HTTP ${health_code:-sin respuesta} tras $MAX_RETRIES intentos. Body: $health_body"
echo "$health_body" | grep -q '"status":"ok"' || fail "/api/health respondió 200 pero sin status ok: $health_body"
echo "$health_body" | grep -q '"database":{"status":"ok"' || fail "la base de datos no responde: $health_body"
ok "app viva y BD respondiendo"

# ---------------------------------------------------------------------------
# 2. La home pública renderiza.
# ---------------------------------------------------------------------------
echo "[2/4] / (pública)"
home_code=$($CURL -o /dev/null -w '%{http_code}' "$BASE_URL/" || true)
[ "$home_code" = "200" ] || fail "/ devolvió HTTP $home_code (esperado 200)"
ok "home responde 200"

# ---------------------------------------------------------------------------
# 3. Gate de auth: una ruta protegida sin cookie redirige a /login.
#    Regresión de C-1 — el middleware trataba todo como público.
# ---------------------------------------------------------------------------
echo "[3/4] /cases sin sesión → /login"
cases_code=$($CURL -o /dev/null -w '%{http_code}' "$BASE_URL/cases" || true)
case "$cases_code" in
  301|302|303|307|308) ;;
  *) fail "/cases sin sesión devolvió HTTP $cases_code (esperado redirect). El gate de auth no está actuando." ;;
esac
cases_location=$($CURL -o /dev/null -w '%{redirect_url}' "$BASE_URL/cases" || true)
case "$cases_location" in
  */login*) ;;
  *) fail "/cases redirige a '$cases_location' en vez de /login" ;;
esac
ok "ruta protegida redirige a login"

# ---------------------------------------------------------------------------
# 4. Registro cerrado: /register no debe ser accesible (C-2).
# ---------------------------------------------------------------------------
echo "[4/4] /register cerrado"
register_location=$($CURL -o /dev/null -w '%{redirect_url}' "$BASE_URL/register" || true)
case "$register_location" in
  */login*) ;;
  *) fail "/register no redirige a /login (redirect_url='$register_location'). El registro público podría estar abierto." ;;
esac
ok "registro público cerrado"

echo
echo "Smoke test OK — $BASE_URL"

#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_ENV=""
FRONTEND_ENV=""

usage() {
	cat <<'EOF'
Uso: ./start.sh [--benv=SUFFIX] [--fenv=SUFFIX]

Por padrão, carrega back-end/.env e front-end/.env.
Com --benv=prod ou --fenv=prod, carrega .env.prod no serviço correspondente.
EOF
}

for arg in "$@"; do
	case "$arg" in
		--benv=*) BACKEND_ENV="${arg#--benv=}" ;;
		--fenv=*) FRONTEND_ENV="${arg#--fenv=}" ;;
		-h|--help) usage; exit 0 ;;
		*) echo "Argumento inválido: $arg" >&2; usage >&2; exit 2 ;;
	esac
done

env_file() {
	local service_dir="$1" suffix="$2"
	if [[ -n "$suffix" ]]; then
		printf '%s/.env.%s' "$service_dir" "$suffix"
	else
		printf '%s/.env' "$service_dir"
	fi
}

BACKEND_ENV_FILE="$(env_file "$ROOT_DIR/back-end" "$BACKEND_ENV")"
FRONTEND_ENV_FILE="$(env_file "$ROOT_DIR/front-end" "$FRONTEND_ENV")"

for file in "$BACKEND_ENV_FILE" "$FRONTEND_ENV_FILE"; do
	if [[ ! -f "$file" ]]; then
		echo "Arquivo de ambiente não encontrado: $file" >&2
		exit 1
	fi
done

run_service() {
	local service_dir="$1" file="$2" command="$3"
	cd "$service_dir"
	set -a
	# Os arquivos .env são carregados como assignments de shell.
	# shellcheck disable=SC1090
	source "$file"
	set +a
	exec npm run "$command"
}

run_service "$ROOT_DIR/back-end" "$BACKEND_ENV_FILE" start:dev &
BACKEND_PID=$!
run_service "$ROOT_DIR/front-end" "$FRONTEND_ENV_FILE" dev &
FRONTEND_PID=$!

cleanup() {
	trap - EXIT INT TERM
	kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
	wait "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

wait -n "$BACKEND_PID" "$FRONTEND_PID"
